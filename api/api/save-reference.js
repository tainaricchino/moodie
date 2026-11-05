const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const { getPalette } = require("colorthief");
const { createClient } = require("@supabase/supabase-js");

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const BUCKET = "moodboard-images";

const FILE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/tiff": "tif",
};

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile();

let supabase;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  if (!supabase) {
    supabase = createClient(url, serviceRoleKey);
  }

  return supabase;
}

function rgbToHex([red, green, blue]) {
  const channel = (value) =>
    Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");

  return `#${channel(red)}${channel(green)}${channel(blue)}`.toUpperCase();
}

function extensionFor(contentType) {
  return FILE_EXTENSIONS[contentType] || "jpg";
}

function contentTypeFromHeader(headerValue, srcUrl) {
  const headerType = headerValue?.split(";")[0].trim().toLowerCase();
  if (headerType && headerType.startsWith("image/")) return headerType;

  try {
    const extension = path.extname(new URL(srcUrl).pathname).toLowerCase();
    const byExtension = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".avif": "image/avif",
      ".tif": "image/tiff",
      ".tiff": "image/tiff",
    };
    if (byExtension[extension]) return byExtension[extension];
  } catch {
    return "image/jpeg";
  }

  return "image/jpeg";
}

async function readImage(srcUrl) {
  if (srcUrl.startsWith("data:")) {
    const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(srcUrl);
    if (!match) {
      const error = new Error("Não foi possível ler a imagem.");
      error.status = 422;
      throw error;
    }

    const buffer = Buffer.from(match[2], "base64");
    return { buffer, contentType: match[1].toLowerCase() };
  }

  let parsed;
  try {
    parsed = new URL(srcUrl);
  } catch {
    const error = new Error("srcUrl inválida.");
    error.status = 400;
    throw error;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    const error = new Error("srcUrl inválida.");
    error.status = 400;
    throw error;
  }

  const response = await fetch(srcUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "User-Agent": "Moodboard/1.0",
    },
  });

  if (!response.ok) {
    const error = new Error("Não foi possível baixar a imagem.");
    error.status = 422;
    throw error;
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
    const error = new Error("A imagem excede o tamanho máximo de 12 MB.");
    error.status = 413;
    throw error;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    const error = new Error("A imagem excede o tamanho máximo de 12 MB.");
    error.status = buffer.length === 0 ? 422 : 413;
    if (buffer.length === 0) error.message = "Não foi possível baixar a imagem.";
    throw error;
  }

  const contentType = contentTypeFromHeader(
    response.headers.get("content-type"),
    srcUrl
  );

  return { buffer, contentType };
}

async function saveReference(req, res) {
  try {
    const { srcUrl, pageUrl } = req.body || {};

    if (!srcUrl || !pageUrl) {
      return res.status(400).json({ error: "srcUrl e pageUrl são obrigatórios." });
    }

    const client = getSupabase();
    if (!client) {
      return res.status(500).json({ error: "Supabase não está configurado." });
    }

    const { buffer, contentType } = await readImage(srcUrl);
    const palette = await getPalette(buffer, 5);

    if (!palette || palette.length === 0) {
      return res.status(422).json({ error: "Não foi possível extrair a paleta de cores." });
    }

    const hexColors = palette.slice(0, 5).map(rgbToHex);
    const fileName = `${crypto.randomUUID()}.${extensionFor(contentType)}`;

    const { error: uploadError } = await client.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    const { data: publicUrlData } = client.storage.from(BUCKET).getPublicUrl(fileName);

    const { data, error: insertError } = await client
      .from("references")
      .insert({
        image_url: publicUrlData.publicUrl,
        source_url: pageUrl,
        hex_colors: hexColors,
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    return res.status(201).json(data);
  } catch (error) {
    const status = error.status || 500;
    const message =
      status === 500
        ? "Não foi possível salvar a referência."
        : error.message;

    return res.status(status).json({ error: message });
  }
}

const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json());
app.post(["/api/save-reference", "/"], saveReference);

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ error: "JSON inválido." });
  }

  return next(error);
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port);
}

module.exports = app;
