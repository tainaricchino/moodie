"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

function normalizeHex(value) {
  if (typeof value !== "string") return "";

  const withHash = value.trim().toUpperCase().replace(/^#?/, "#");
  return /^#[0-9A-F]{6}$/.test(withHash) ? withHash : "";
}

function readColors(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeHex).filter(Boolean);
  }

  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map(normalizeHex).filter(Boolean);
  } catch {
    return trimmed.split(/[,\s]+/).map(normalizeHex).filter(Boolean);
  }

  return [];
}

function safeHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

function hostnameOf(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function archiveNumber(index) {
  return String(index + 1).padStart(2, "0");
}

function describeLoadError(error) {
  const message = `${error?.message || ""} ${error?.code || ""}`;
  if (/permission|jwt|rls|policy|42501/i.test(message)) {
    return "A leitura da tabela references foi recusada.";
  }

  return "Não foi possível carregar o arquivo.";
}

function channelLuma(value) {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function toneInk(hex) {
  const r = channelLuma(parseInt(hex.slice(1, 3), 16));
  const g = channelLuma(parseInt(hex.slice(3, 5), 16));
  const b = channelLuma(parseInt(hex.slice(5, 7), 16));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const onDark = (luminance + 0.05) / 0.05;
  const onLight = 1.05 / (luminance + 0.05);
  return onDark >= onLight ? "#090A0C" : "#F2F4F7";
}

export default function HomePage() {
  const [references, setReferences] = useState([]);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [activeColor, setActiveColor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!supabase) {
        if (!active) return;
        setStatus("error");
        setErrorMessage("Supabase não está configurado.");
        return;
      }

      let { data, error } = await supabase
        .from("references")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        const fallback = await supabase.from("references").select("*");
        data = fallback.data;
        error = fallback.error;
      }

      if (!active) return;

      if (error) {
        setStatus("error");
        setErrorMessage(describeLoadError(error));
        return;
      }

      setReferences(data || []);
      setStatus("ready");
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;

    const timeout = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!selected) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") setSelected(null);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selected]);

  const archive = useMemo(
    () =>
      references.map((item, index) => ({
        item,
        number: archiveNumber(index),
        colors: readColors(item.hex_colors),
        sourceUrl: safeHttpUrl(item.source_url),
      })),
    [references]
  );

  const frequentColors = useMemo(() => {
    const counts = new Map();

    for (const entry of archive) {
      for (const color of new Set(entry.colors)) {
        counts.set(color, (counts.get(color) || 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 12);
  }, [archive]);

  const visible = useMemo(() => {
    if (!activeColor) return archive;
    return archive.filter((entry) => entry.colors.includes(activeColor));
  }, [archive, activeColor]);

  const copyHex = useCallback(async (hex) => {
    try {
      await navigator.clipboard.writeText(hex);
      setToast({ id: Date.now(), hex, copied: true });
    } catch {
      setToast({ id: Date.now(), hex, copied: false });
    }
  }, []);

  const totalLabel = status === "loading" ? "—" : String(archive.length).padStart(2, "0");

  return (
    <>
      <header className="sticky top-0 z-30 bg-ink/95 backdrop-blur-md">
        <div className="mx-auto max-w-[1680px] px-5 pt-6 md:px-10">
          <div className="flex flex-row flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-[#222630] pb-6">
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#00FF9D]">
                Acervo cromático
              </p>
              <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-none tracking-tight text-[#F0F2F5] sm:text-5xl">
                Moodie
              </h1>
            </div>

            <div className="flex items-end gap-5 font-mono text-[11px] uppercase tracking-[0.16em] text-[#717888]">
              <p>
                <span className="sr-only">Referências </span>
                {totalLabel} Ref
              </p>
              <ChromaticBar
                colors={frequentColors}
                activeColor={activeColor}
                onSelect={setActiveColor}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1680px] px-5 py-6 md:px-10 md:py-8">
        {status === "loading" && (
          <>
            <p className="sr-only">Carregando arquivo</p>
            <SkeletonGrid />
          </>
        )}

        {status === "error" && (
          <ArchiveNotice title="O arquivo não abriu" body={errorMessage} />
        )}

        {status === "ready" && visible.length === 0 && (
          <ArchiveNotice
            title={activeColor ? "Nada neste recorte" : "Arquivo vazio"}
            body={
              activeColor
                ? "Nenhuma referência carrega esta cor."
                : "O arquivo ainda não recebeu imagens."
            }
          />
        )}

        {status === "ready" && visible.length > 0 && (
          <div className="masonry">
            {visible.map((entry) => (
              <ReferenceCard
                key={entry.item.id || `${entry.item.image_url}-${entry.number}`}
                entry={entry}
                onOpen={setSelected}
                onCopy={copyHex}
              />
            ))}
          </div>
        )}

        {status === "ready" && visible.length > 0 && (
          <p className="mt-10 text-center font-mono text-[10px] uppercase tracking-[0.32em] text-highlight/35">
            Fim do arquivo
          </p>
        )}
      </main>

      {selected && (
        <InspectionDialog entry={selected} onClose={() => setSelected(null)} onCopy={copyHex} />
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {toast && <ArchiveToast key={toast.id} toast={toast} />}
      </div>
    </>
  );
}

function ChromaticBar({ colors, activeColor, onSelect }) {
  return (
    <div className="flex items-end gap-3">
      <button
        type="button"
        aria-pressed={!activeColor}
        onClick={() => onSelect(null)}
        className={`shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-[#717888] ${
          activeColor ? "" : "shadow-[inset_0_-1px_0_#00FF9D]"
        }`}
      >
        Todas
      </button>

      <div className="flex h-6 w-36 overflow-hidden border border-line bg-card sm:w-52">
          {colors.length === 0 && <div className="h-full w-full bg-line/50" />}
          {colors.map(([hex, count]) => {
            const selected = activeColor === hex;

            return (
              <button
                key={hex}
                type="button"
                title={`${hex} · ${count}`}
                aria-label={`Filtrar por ${hex}, ${count} ${count === 1 ? "peça" : "peças"}`}
                aria-pressed={selected}
                onClick={() => onSelect(selected ? null : hex)}
                style={{
                  backgroundColor: hex,
                  flexGrow: count,
                  flexBasis: 0,
                  minWidth: "1.75rem",
                  boxShadow: selected ? "inset 0 -3px 0 #00FF9D" : undefined,
                }}
                className={`h-full transition duration-300 ${
                  activeColor && !selected ? "opacity-30" : "opacity-100"
                } ${selected ? "" : "hover:brightness-110"}`}
              />
            );
          })}
      </div>
      {activeColor && <span className="max-w-[6.5rem] truncate">{activeColor}</span>}
    </div>
  );
}

function ReferenceCard({ entry, onOpen, onCopy }) {
  const { item, number, colors, sourceUrl } = entry;

  return (
    <article className="group border border-line bg-card transition-colors duration-300 hover:border-accent">
      <button
        type="button"
        aria-label={`Inspecionar referência ${number}`}
        onClick={() => onOpen(entry)}
        className="block w-full cursor-zoom-in overflow-hidden text-left"
      >
        <ReferenceImage src={item.image_url} alt={`Referência ${number}`} className="block w-full" />
      </button>

      <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2.5">
        <p className="font-display text-[13px] font-bold uppercase tracking-[0.14em] text-highlight">
          No. {number}
        </p>
        {sourceUrl && <SourceLink href={sourceUrl} />}
      </div>

      {colors.length > 0 && (
        <div className="flex h-11 w-full border-t border-line">
          {colors.map((hex, index) => (
            <button
              key={`${hex}-${index}`}
              type="button"
              title={`Copiar ${hex}`}
              aria-label={`Copiar ${hex}`}
              onClick={() => onCopy(hex)}
              style={{ backgroundColor: hex, color: toneInk(hex) }}
              className="flex h-full min-w-0 flex-1 items-end overflow-hidden px-1.5 pb-1.5 text-left font-mono text-[10px] uppercase leading-none tracking-tight transition-[flex] duration-300 hover:flex-[2.4] focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
            >
              <span className="truncate">{hex}</span>
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function InspectionDialog({ entry, onClose, onCopy }) {
  const titleId = useId();
  const closeRef = useRef(null);
  const { item, number, colors, sourceUrl } = entry;
  const dateLabel = formatDate(item.created_at);
  const host = sourceUrl ? hostnameOf(sourceUrl) : "";

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/80 backdrop-blur-md" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className="relative grid max-h-[92vh] w-full max-w-6xl overflow-y-auto border border-line bg-card md:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.72fr)]"
      >
        <div className="flex items-center justify-center bg-ink">
          <ReferenceImage
            src={item.image_url}
            alt={`Referência ${number} em tamanho grande`}
            className="h-auto max-h-[70vh] w-auto max-w-full object-contain md:max-h-[84vh]"
          />
        </div>

        <div className="flex h-full flex-col border-t border-line p-6 sm:p-8 md:border-l md:border-t-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-[12px] font-bold uppercase tracking-[0.22em] text-accent">
                Inspeção
              </p>
              <h2
                id={titleId}
                className="mt-3 font-display text-5xl font-bold uppercase leading-none tracking-tight text-highlight"
              >
                No. {number}
              </h2>
              {(dateLabel || host) && (
                <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-highlight/45">
                  {[dateLabel, host].filter(Boolean).join("  ·  ")}
                </p>
              )}
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="font-display text-[12px] font-bold uppercase tracking-[0.16em] text-highlight/60 transition-colors hover:text-accent"
            >
              Fechar
            </button>
          </div>

          <div className="mt-8">
            <p className="font-display text-[12px] font-bold uppercase tracking-[0.22em] text-highlight/55">
              Paleta
            </p>
            {colors.length === 0 ? (
              <p className="mt-4 font-display text-2xl font-bold uppercase tracking-tight text-highlight/70">
                Sem paleta extraída
              </p>
            ) : (
              <ul className="mt-4 flex flex-col border border-line">
                {colors.map((hex, index) => (
                  <li key={`${hex}-${index}`} className="border-t border-black/15 first:border-t-0">
                    <button
                      type="button"
                      onClick={() => onCopy(hex)}
                      style={{ backgroundColor: hex, color: toneInk(hex) }}
                      className="flex h-14 w-full items-center justify-between gap-4 px-3 text-left font-mono text-sm uppercase tracking-wide"
                    >
                      <span>{hex}</span>
                      <span className="font-display text-[11px] font-bold tracking-[0.16em]">
                        {index === 0 ? "Dominante" : `Tom ${archiveNumber(index)}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center justify-between gap-4 border border-line px-4 py-3 font-display text-[12px] font-bold uppercase tracking-[0.16em] text-highlight/80 transition-colors hover:border-accent hover:text-accent md:mt-auto"
            >
              Abrir fonte
              <ArrowIcon />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ArchiveToast({ toast }) {
  return (
    <div
      role="status"
      className="pointer-events-auto flex animate-rise items-center gap-3 bg-accent px-3 py-2 font-mono text-[12px] uppercase tracking-wide text-ink"
    >
      <span>{toast.hex}</span>
      <span>{toast.copied ? "Copiado" : "Não copiado"}</span>
    </div>
  );
}

function SkeletonGrid() {
  const heights = ["h-72", "h-[26rem]", "h-64", "h-96", "h-80", "h-[22rem]", "h-72", "h-[28rem]"];

  return (
    <div className="masonry" aria-hidden="true">
      {heights.map((height, index) => (
        <article key={height + index} className="border border-line bg-card">
          <div className={`animate-pulse bg-line ${height}`} />
          <div className="h-11 border-t border-line bg-line/70" />
        </article>
      ))}
    </div>
  );
}

function ArchiveNotice({ title, body }) {
  return (
    <div className="border border-line px-6 py-24 text-center">
      <p className="font-display text-4xl font-bold uppercase tracking-tight text-highlight sm:text-5xl">
        {title}
      </p>
      <p className="mx-auto mt-4 max-w-md font-sans text-sm leading-relaxed text-highlight/55">{body}</p>
    </div>
  );
}

function SourceLink({ href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Abrir fonte original em nova aba"
      className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-highlight/55 transition-colors hover:text-accent"
    >
      Fonte
      <ArrowIcon />
    </a>
  );
}

function ReferenceImage({ src, alt, className }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`flex min-h-56 items-end bg-ink p-4 ${className || ""}`}>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-highlight/40">
          Imagem indisponível
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
      <path
        d="M3.2 8.8 L8.8 3.2 M4.8 3.2 H8.8 V7.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
