# CVCheck — AI-Powered CV Analysis Tool

## The Problem

As someone job hunting without a degree, I couldn't understand why my CV kept getting rejected. Professional CV consulting is expensive, and generic advice wasn't helping. I built CVCheck to solve this.

## What It Does

- Upload a PDF CV, select your industry
- Groq AI analyzes strengths, weaknesses, and gives suggestions, with optional Gemini fallback
- Returns a score out of 100
- Free, no sign-up required

## Technical Decisions & Why

- **Groq AI over OpenAI**: Free tier, faster response times, sufficient quality for CV analysis
- **Provider fallback**: If Groq is unavailable or rate-limited, the API can fall back to Gemini when `GEMINI_API_KEY` is configured
- **pdfjs-dist client-side**: PDF parsing in the browser — no file uploads to server, better privacy
- **Rate limiting (5 req/hour/IP)**: Uses Upstash Redis in production when configured, with an in-memory fallback for local development
- **Input sanitization**: CV text validated, truncated at 50k chars, sector whitelist enforced
- **PDF guardrails**: Client-side file size and page-count limits prevent oversized PDFs from slowing the browser

## Challenges

- Gemini API quota limits forced migration to Groq mid-development
- pdfjs-dist worker configuration in Next.js App Router required a static worker file and Turbopack alias
- Balancing response quality vs API costs led to prompt engineering iterations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS |
| AI | Groq API + optional Gemini fallback |
| PDF Parsing | pdfjs-dist |
| Deployment | Vercel |

## Live Demo

[cvcheck-six.vercel.app](https://cvcheck-six.vercel.app)

## Setup

1. Clone the repo
2. `npm install`
3. Create `.env.local`: `GROQ_API_KEY=your_key`
4. `npm run dev`

Optional AI fallback:

```bash
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-1.5-flash
```

Optional production rate limiting:

```bash
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```
