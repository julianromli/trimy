# Trimy

**Trimy** is a cross-platform desktop video editor (Windows-first) with a built-in AI agent sidebar for transcript-driven rough cuts. Forked from [OpenCut Classic](https://github.com/opencut-app/opencut-classic) (MIT).

English & Indonesian focused. Podcast, talking head, monolog, and screen-record tutorial workflows.

## Status

**v0.1.0 — Desktop release** (Phase 4)

- [x] Tauri Rust proxy (OpenRouter + Groq + vision) with OS keychain
- [x] Native import/export dialogs in desktop mode
- [x] Actionable agent errors + retry
- [x] NSIS installer (`installMode: currentUser`)
- [x] Phase 3 intelligence: real silence, filler, frame vision

See [`docs/PHASE4.md`](docs/PHASE4.md) and [`docs/BYOK.md`](docs/BYOK.md).

**Phase 3 — Intelligence** (done)

- [x] Real RMS silence detection
- [x] Word-level filler removal (EN + ID)
- [x] Frame vision via Gemini 3 Flash Preview
- [x] Groq audio chunking for large files

**Phase 2 — AI Agent sidebar** (done)

- [x] Agent panel (4th column, `Ctrl+J`)
- [x] 15 internal tools + confirm-before-execute
- [x] E2E: agent panel, chat split, import→export

**Phase 1 — Tauri + Vite** (done)

- [x] Tauri 2 + Vite SPA editor
- [x] Windows `.exe` build path (`bun run build:tauri`)

## Agent Bridge & Sidebar

**In-app chat:** Open the **Trimy Agent** panel (right column, `Ctrl+J`). Set `OPENROUTER_API_KEY` in `apps/editor/.env.local` or enter key in panel settings.

**DevTools / E2E:**

```javascript
// Project snapshot
window.__agentBridge.getState()

// All agent tools
await window.__agentBridge.executeTool("split_at", { seconds: 60 })
await window.__agentBridge.executeTool("detect_silence", { minDurationMs: 1500 })
await window.__agentBridge.executeTool("get_transcript")

// Split at playhead
window.__agentBridge.splitAtPlayhead()
window.__agentBridge.splitAt(12.5)
window.__agentBridge.undo()
```

All mutations go through `CommandManager` — undo/redo works the same as manual edits.

## Stack

| Layer | Tech |
|-------|------|
| Editor core | OpenCut Classic (TypeScript + Rust/WASM compositor) |
| Desktop | Tauri 2 + WebView2 (NSIS installer) |
| Agent LLM | OpenRouter BYOK (`deepseek/deepseek-v4-pro`) |
| Vision | OpenRouter BYOK (`google/gemini-3-flash-preview`) |
| Transcription | Groq `whisper-large-v3-turbo` + local `whisper-large-v3-turbo` offline |

## Getting Started (dev)

### Prerequisites

- [Bun](https://bun.sh) 1.2+
- **Rust + wasm-pack** — only if you edit `rust/wasm` (see [WASM build](#wasm-build-optional))

### Quick start (Windows / macOS / Linux)

```bash
git clone https://github.com/julianromli/trimy.git
cd trimy
bun install

# Copy env for Groq + OpenRouter
cp apps/editor/.env.example apps/editor/.env.local
# Add GROQ_API_KEY=gsk_...
# Add OPENROUTER_API_KEY=sk-or-...

# Terminal 1 — Vite editor
bun run dev:editor

# Terminal 2 — Tauri desktop window (optional)
bun run dev:tauri
```

Open `http://localhost:5173/projects` (or use the Tauri window). **You do not need `bun run build:wasm`** for normal dev — `opencut-wasm` is installed from npm.

### WASM build (optional)

Only required when changing Rust code under `rust/wasm` or `rust/crates`.

**Windows (PowerShell):**

```powershell
powershell -ExecutionPolicy Bypass -File .\script\setup-rust.ps1
# Open a NEW terminal, then:
bun run build:wasm
```

**macOS / Linux:**

```bash
./script/setup-rust
bun run build:wasm
```

If `wasm-pack` is missing, `bun run build:wasm` prints install instructions instead of a cryptic error.

### Legacy web path (Next.js)

```bash
bun run dev:web   # port 3000 — reference only; desktop uses apps/editor
```

Add `GROQ_API_KEY` to `apps/editor/.env.local` (or `apps/web/.env.local` for legacy path).

> Docker (PostgreSQL, Redis) is optional — local IndexedDB storage works for editor-only testing.

## Attribution

Based on [OpenCut Classic](https://github.com/opencut-app/opencut-classic) by the OpenCut team. Licensed under MIT.

## License

MIT — see [LICENSE](LICENSE).
