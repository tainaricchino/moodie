# MOODIE — Acervo Cromático & Inspirações Visual/UI

## Visão Geral

MOODIE é uma ferramenta de curadoria de referências visuais. A extensão do Chrome captura uma imagem da página aberta, a API em Node.js extrai uma paleta de cinco cores HEX com a biblioteca local `colorthief` e grava a imagem e os dados no Supabase. O Dashboard em Next.js lê esse acervo e o apresenta em um grid Masonry, com filtro cromático e cópia do código HEX ao clique.

O fluxo tem três peças:

1. **Extensão Chrome (Manifest V3)** — menu de contexto em imagens. Envia a URL da imagem e a URL da página para a API local.
2. **Backend API** — baixa a imagem, extrai a paleta, envia o arquivo ao Storage e insere a referência no Postgres.
3. **Dashboard Next.js** — lê a tabela `references` com a chave anônima do Supabase e renderiza o acervo.

## Arquitetura do Monorepo

```text
moodboard-monorepo/
├── .gitignore
├── ARCHITECTURE.md
├── README.md
│
├── extension/                 # Extensão Chrome (Manifest V3)
│   ├── manifest.json
│   └── background.js
│
├── api/                       # Backend Node.js (Express + colorthief)
│   ├── package.json
│   └── api/
│       └── save-reference.js
│
└── dashboard/                 # Frontend Next.js + Tailwind + Supabase
    ├── package.json
    ├── next.config.js
    ├── postcss.config.js
    ├── tailwind.config.js
    └── src/
        ├── app/
        │   ├── layout.jsx
        │   ├── page.jsx
        │   └── globals.css
        └── lib/
            └── supabase.js
```

Cada pasta é um pacote independente, com o próprio `package.json` na API e no Dashboard. A extensão não tem dependências de npm.

## Stack Tecnológico

### Extensão — Manifest V3

- Manifest V3, service worker em `extension/background.js`.
- Permissão `contextMenus`. O item **Salvar no Moodboard** aparece no clique direito de uma imagem.
- `host_permissions` limitado a `http://localhost:3000/*`.
- O service worker faz `POST` em `http://localhost:3000/api/save-reference` com o corpo `{ srcUrl, pageUrl }`.

### API — Node.js e Colorthief

- Node.js com Express. O ponto de entrada é `api/api/save-reference.js`.
- Rotas `POST /api/save-reference` e `POST /`.
- `colorthief` extrai até cinco cores dominantes no processo local. Nenhuma API paga de visão ou de cor é usada.
- A imagem é baixada pela URL recebida, com limite de 12 MB. Formatos aceitos: JPEG, PNG, WebP, GIF, AVIF e TIFF.
- O arquivo sobe para o bucket público `moodboard-images`. A linha correspondente entra na tabela `references` com `image_url`, `source_url` e `hex_colors`.
- O cliente Supabase da API usa a **service role key**, que ignora RLS. Essa chave fica só no servidor.

Em desenvolvimento o servidor escuta a porta `3000` (`PORT`, quando definida). O script `npm start` sobe o Express. O módulo também exporta o app para um runtime serverless.

### Dados — Supabase Postgres e Storage

- Tabela `public.references`: `id` (uuid), `image_url`, `source_url`, `hex_colors` (`text[]`) e `created_at`.
- Bucket público `moodboard-images` para os arquivos enviados pela API.
- Leitura do Dashboard com a chave anônima, restrita por uma policy de `SELECT`.
- Escrita e upload ficam na API, com a service role.

### Dashboard — Next.js e Tailwind

- Next.js 16 (App Router) e React 19. A página principal está em `dashboard/src/app/page.jsx`.
- Tailwind CSS 3, identidade escura Swiss Precision Studio.
- Cliente Supabase em `dashboard/src/lib/supabase.js`, com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- O acervo é ordenado por `created_at` descendente, filtrado pela paleta e disposto em grid Masonry. O clique em um tom copia o HEX.

### Tipografia

- **Barlow** — texto de interface. Carregada com `next/font` (pesos 400, 500 e 600), variável `--font-sans`.
- **Barlow Semi Condensed** — marca e títulos. Carregada com `next/font` (pesos 600, 700 e 800), variável `--font-display`. No cabeçalho, MOODIE usa caixa alta e ExtraBold.
- **Barlow Mono** — códigos HEX, eyebrow e metadados. Carregada do Google Fonts e ligada a `--font-mono`. O catálogo do `next/font` desta versão do Next não inclui Barlow Mono.

## Guia de Configuração e Instalação

Requisitos: Node.js, npm, um projeto no Supabase e o Google Chrome.

### 1. Script SQL no Supabase

No SQL Editor do projeto, execute:

```sql
create extension if not exists pgcrypto;

create table if not exists public.references (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  source_url text,
  hex_colors text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.references enable row level security;

create policy "leitura publica do acervo"
on public.references
for select
to anon, authenticated
using (true);

grant select on table public.references to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('moodboard-images', 'moodboard-images', true)
on conflict (id) do update set public = true;

create policy "leitura publica das imagens"
on storage.objects
for select
to public
using (bucket_id = 'moodboard-images');
```

Se a policy de Storage já existir, o segundo `create policy` falha por nome duplicado. Nesse caso, confirme no painel que o bucket `moodboard-images` está público e que a leitura dos objetos está liberada.

A API grava com a service role, que não depende dessas policies de escrita. Não crie policy de `INSERT` para a chave anônima.

### 2. Variáveis de ambiente

Não commite estes arquivos. A raiz já ignora `.env` e `.env.local`.

`api/.env`:

```text
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
PORT=3000
```

`SUPABASE_URL` é a URL do projeto, sem o sufixo `/rest/v1`. `SUPABASE_SERVICE_ROLE_KEY` fica em Project Settings → API. `PORT` é opcional; o padrão é `3000`, que é o endereço autorizado pela extensão.

`dashboard/.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
```

O cliente do Dashboard remove uma barra final e um sufixo `/rest/v1`, se a URL do REST for colada no lugar da URL do projeto. Use a chave **anon / publishable**, nunca a service role, neste arquivo.

### 3. Backend

```text
cd api
npm install
npm start
```

A API fica em `http://localhost:3000`. O endpoint usado pela extensão é `POST /api/save-reference`.

### 4. Frontend

Em outro terminal:

```text
cd dashboard
npm install
npm run dev
```

O Dashboard abre em `http://localhost:3001`. `npm run build` gera a build de produção e `npm start` a serve.

### 5. Extensão

1. Abra `chrome://extensions`.
2. Ative o Modo do desenvolvedor.
3. Escolha **Carregar sem compactação** e selecione a pasta `extension`.
4. Com a API rodando em `localhost:3000`, clique com o botão direito em uma imagem e use **Salvar no Moodboard**.
5. Atualize o Dashboard. A referência entra no acervo com a imagem, a fonte e a paleta.

A extensão só conversa com `http://localhost:3000`. Se a porta da API mudar, atualize `PORT`, `API_ENDPOINT` em `extension/background.js` e `host_permissions` em `extension/manifest.json`.

## Design System / Identity Tokens

A interface segue o sistema Swiss Precision Studio: fundo quase preto, uma única cor de destaque e tipografia condensada em caixa alta para a marca.

| Token | Valor | Uso |
| --- | --- | --- |
| `ink` | `#090A0C` | Fundo principal |
| `card` | `#121418` | Superfície dos cards e do seletor |
| `line` | `#222630` | Bordas e a linha inferior do cabeçalho |
| `accent` | `#00FF9D` | Destaque, eyebrow, borda em hover e aviso de cópia |
| `highlight` | `#F2F4F7` | Texto corrente |
| marca | `#F0F2F5` | Título MOODIE |
| meta | `#717888` | Contadores, filtro e rótulos técnicos |

Diretrizes de tipo:

- A marca **MOODIE** usa Barlow Semi Condensed, caixa alta, ExtraBold e `leading-none`.
- A eyebrow **ACERVO CROMÁTICO** usa Barlow Mono, caixa alta, 11px e tracking `0.2em`, na cor `#00FF9D`.
- Metadados (`00 REF`, filtro ativo e códigos HEX) usam Barlow Mono. No cabeçalho, a cor é `#717888`.
- O corpo usa Barlow. Não misture outra família na interface do acervo.
