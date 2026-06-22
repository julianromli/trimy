# Trimy Editor (Vite SPA)

Desktop-first Vite bundle for Trimy. Reuses OpenCut Classic editor source from `../web/src` via path aliases and Next.js shims.

## Dev

```bash
# From repo root
bun install
bun run build:wasm   # first time only

bun run dev:editor
```

Open http://localhost:5173/projects

## Env

Copy `.env.example` to `.env.local`:

```bash
GROQ_API_KEY=gsk_...
```

Groq transcription is proxied at `/api/transcribe/groq` during dev (API key stays server-side in Vite middleware).

## Tauri

```bash
bun run dev:tauri
```

Tauri loads this Vite dev server in development and `apps/editor/dist` for production builds.

## Architecture

- `@/` → `apps/web/src` (shared editor code)
- `next/*` → local shims (`src/shims/`)
- `@/env/web` → trimmed desktop env (no Postgres/Redis/auth)
- `content-collections` → empty stub (changelog banner disabled)
