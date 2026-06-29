@AGENTS.md

# CVCheck Project

## Overview
CV analiz uygulaması. Kullanıcı PDF CV yükler, hedef sektör seçer ve Groq/Llama üzerinden güçlü yönler, eksikler, öneriler ve skor alır.

## Stack
- **Framework**: Next.js 16 (App Router, JavaScript), Turbopack default
- **Styling**: Tailwind CSS v4
- **AI**: Groq API (`llama-3.3-70b-versatile`) via `groq-sdk`
- **PDF Read**: `pdfjs-dist` v6 (client-side text extraction)

## Environment Variables
- `GROQ_API_KEY` — Groq API key (`.env.local`)
- `UPSTASH_REDIS_REST_URL` — optional shared rate-limit store
- `UPSTASH_REDIS_REST_TOKEN` — optional shared rate-limit store token

## Pages
- `/` — PDF yükle, sektör seç, AI analiz et

## Key Files
- `app/page.js` — Analyze UI (pdfjs drag & drop)
- `app/api/analyze/route.js` — POST { cvText, sector } → { strengths, weaknesses, suggestions, score }

## Model
Always use `llama-3.3-70b-versatile` via `groq-sdk`.

## PDF Worker
`public/pdf.worker.min.mjs` — copied from node_modules. Set via `GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"`

## Next.js Config
Uses `turbopack.resolveAlias` (not webpack), canvas aliased to `./empty-module.js`

## Design
- Background: `#080c0c`, Card bg: `#0d1a1a`
- Accent: `#2dd4bf` (teal-400)
- Font: system-ui / Inter
