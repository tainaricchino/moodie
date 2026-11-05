# Gerenciador Inteligente de Moodboard & Inspirações Visual/UI

## Visão Geral

Sistema de curadoria de referências visuais que captura imagens do navegador via Extensão do Chrome, processa a imagem em um backend Node.js extraindo a paleta de 5 cores HEX (via `colorthief`), armazena os dados no Supabase e exibe em um Dashboard React com grid Masonry e amostras de cores clicáveis.

---

## Estrutura de Pastas

```text
C:\Users\taina\dev\moodboard-monorepo\
├── .gitignore
├── .cursorrules (ignorado no git)
├── ARCHITECTURE.md
│
├── extension/          # Extensão Chrome (Manifest V3)
│   ├── manifest.json
│   └── background.js
│
├── api/                # Backend Serverless (Vercel)
│   ├── package.json
│   └── api/
│       └── save-reference.js
│
└── dashboard/          # Frontend React + Tailwind CSS
    ├── src/
    │   ├── app/
    │   │   └── page.jsx
    │   └── lib/
    │       └── supabase.js
    └── tailwind.config.js
```
