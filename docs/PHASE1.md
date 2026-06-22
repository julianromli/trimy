# Phase 1 — Tauri Shell + Desktop MVP

## Goal

Wrap the OpenCut Classic editor in a **Tauri 2** desktop window (WebView2 on Windows). User can import → edit → export without the agent sidebar yet.

## Status

| Item | Status |
|------|--------|
| Tauri 2 scaffold (`apps/tauri`) | Done |
| Dev loads editor at `/projects` | Done (via `devUrl` → Vite) |
| Workspace + root scripts (`dev:tauri`) | Done |
| App identifier `com.faizintifada.trimy` | Done |
| Placeholder icons | Done |
| `cargo check` compiles | Done |
| **Vite SPA (`apps/editor`)** | **Done (Phase 1b)** |
| Next.js shims (link, image, navigation) | Done |
| Groq API Vite proxy | Done |
| Strip cloud auth (better-auth, PG) | Done (editor bypasses Next app) |
| Windows `.exe` build on Faiz PC | Pending |
| Native file dialog (Tauri plugin) | Not started |

## Architecture (Phase 1)

```
Tauri 2 (trimy-desktop)
└── WebView2 → http://localhost:5173/projects  (dev, Vite)
            → ../editor/dist                    (prod)
```

`apps/editor` is a Vite SPA that reuses `apps/web/src` editor code via `@/` alias. Next.js APIs are shimmed; cloud deps (auth, Postgres, Redis) are not loaded.

## Dev commands

From repo root:

```bash
bun install

# No build:wasm needed — opencut-wasm comes from npm unless you edit rust/wasm

# Terminal 1 — Vite editor (required for Tauri dev)
bun run dev:editor

# Terminal 2 — Tauri window
bun run dev:tauri
```

**Windows note:** If you do need a local WASM build, install tools first:

```powershell
powershell -ExecutionPolicy Bypass -File .\script\setup-rust.ps1
# new terminal
bun run build:wasm
```

Tauri `beforeDevCommand` auto-starts `dev:editor` if you run from `apps/tauri`:

```bash
cd apps/tauri && bun run dev
```

Add `GROQ_API_KEY` to `apps/editor/.env.local` for Groq transcription.

## Files

| Path | Purpose |
|------|---------|
| `apps/editor/` | Vite SPA + TanStack Router (Trimy desktop UI) |
| `apps/editor/vite.config.ts` | Aliases, Groq proxy, API stubs |
| `apps/editor/src/shims/` | `next/link`, `next/image`, `next/navigation` |
| `apps/web/src/` | Shared editor core (unchanged) |
| `apps/tauri/src-tauri/tauri.conf.json` | Window, devUrl, `frontendDist` |
| `apps/tauri/src-tauri/src/lib.rs` | Tauri entry + logging plugin |

## Phase 1 exit criteria

- [ ] `bun run dev:tauri` opens Trimy window with project list
- [ ] Create project → import clip → split → export MP4
- [ ] `bun run build:tauri` produces Windows installer on Faiz PC
- [ ] No PostgreSQL / Redis / cloud auth required

## Next: Phase 2

Agent sidebar, OpenRouter runtime, confirm-before-execute, 15 internal tools.
