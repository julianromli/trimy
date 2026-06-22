# Phase 1 — Tauri Shell + Desktop MVP

## Goal

Wrap the OpenCut Classic editor in a **Tauri 2** desktop window (WebView2 on Windows). User can import → edit → export without the agent sidebar yet.

## Status

| Item | Status |
|------|--------|
| Tauri 2 scaffold (`apps/tauri`) | Done |
| Dev loads editor at `/projects` | Done (via `devUrl`) |
| Workspace + root scripts (`dev:tauri`) | Done |
| App identifier `com.faizintifada.trimy` | Done |
| Placeholder icons | Done |
| `cargo check` compiles | Done |
| Windows `.exe` build on Faiz PC | Pending |
| Next.js → Vite SPA migration | Not started |
| Strip cloud auth (better-auth, PG) | Not started |
| Native file dialog (Tauri plugin) | Not started |

## Architecture (Phase 1 interim)

```
Tauri 2 (trimy-desktop)
└── WebView2 → http://localhost:3000/projects  (dev)
            → ../web/out                        (prod, after static export / Vite)
```

**Interim strategy:** keep Next.js dev server for Phase 1 dev builds. Production `.exe` needs either:

1. **Vite migration** (target, Phase 1b) — editor + projects as SPA, static `dist/` for Tauri
2. **Next standalone + sidecar** (fallback) — spawn `next start` from Tauri; heavier, not ideal

Blueprint target is (1).

## Dev commands

From repo root:

```bash
# Terminal 1 — web editor (required for Tauri dev)
bun run dev:web

# Terminal 2 — Tauri window (Linux/macOS/Windows with display)
bun run dev:tauri
```

Tauri `beforeDevCommand` auto-starts `dev:web` if you run from `apps/tauri`:

```bash
cd apps/tauri && bun run dev
```

## Files

| Path | Purpose |
|------|---------|
| `apps/tauri/src-tauri/tauri.conf.json` | Window, devUrl, bundle config |
| `apps/tauri/src-tauri/Cargo.toml` | `trimy-desktop` Rust crate |
| `apps/tauri/src-tauri/src/lib.rs` | Tauri entry + logging plugin |
| `apps/tauri/src-tauri/icons/` | App icons (placeholder) |
| `apps/desktop/` | Legacy GPUI stub (unused by Trimy; keep for upstream parity) |

## Phase 1b — Vite migration (next)

1. Create `apps/editor` Vite SPA with TanStack Router
2. Move editor routes: `/projects`, `/editor/:projectId`
3. Port `@/` imports from `apps/web/src`
4. Keep Groq API as Tauri command (Rust) or Vite dev proxy
5. Remove: marketing pages, blog, auth, Drizzle, Cloudflare deploy
6. Point `frontendDist` → `apps/editor/dist`

## Phase 1 exit criteria

- [ ] `bun run dev:tauri` opens Trimy window with project list
- [ ] Create project → import clip → split → export MP4
- [ ] `bun run build:tauri` produces Windows installer on Faiz PC
- [ ] No PostgreSQL / Redis / cloud auth required

## Next: Phase 2

Agent sidebar, OpenRouter runtime, confirm-before-execute, 15 internal tools.
