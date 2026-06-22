# Trimy Desktop (Tauri 2)

Windows-first desktop shell for Trimy. Loads the Vite editor SPA in WebView2.

## Dev

```bash
# From repo root
bun run dev:tauri

# Or from this directory (auto-starts Vite editor)
bun run dev
```

Opens `http://localhost:5173/projects` in dev mode.

## Build

```bash
bun run build
```

Produces platform installer under `src-tauri/target/release/bundle/`.

Production build uses `apps/editor/dist` (Vite static output).
