# Trimy Desktop (Tauri 2)

Windows-first desktop shell for Trimy. Loads the web editor in WebView2.

## Dev

```bash
# From repo root
bun run dev:tauri

# Or from this directory (auto-starts web dev server)
bun run dev
```

Opens `http://localhost:3000/projects` in dev mode.

## Build

```bash
bun run build
```

Produces platform installer under `src-tauri/target/release/bundle/`.

> **Note:** Production build requires static frontend (`frontendDist`). Vite migration (Phase 1b) pending — dev mode works today.
