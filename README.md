# Trimy

**Trimy** is a cross-platform desktop video editor (Windows-first) with a built-in AI agent sidebar for transcript-driven rough cuts. Forked from [OpenCut Classic](https://github.com/opencut-app/opencut-classic) (MIT).

English & Indonesian focused. Podcast, talking head, monolog, and screen-record tutorial workflows.

## Status

**Phase 0.5 — Groq transcription** (done, staged)

- [x] Groq `whisper-large-v3-turbo` API route + `__agentBridge.transcribe`
- [ ] Manual DevTools validation with media clip on dev machine

**Phase 1 — Tauri shell** (in progress)

- [x] Tauri 2 scaffold (`apps/tauri`, `bun run dev:tauri`)
- [ ] Windows `.exe` smoke test
- [ ] Vite migration (editor SPA)

Full blueprint: [`docs/blueprint.md`](docs/blueprint.md)

## Agent Bridge (Phase 0)

After loading a project in the editor, open DevTools and run:

```javascript
// Project snapshot
window.__agentBridge.getState()

// Split at playhead (uses selection, or elements under playhead)
window.__agentBridge.splitAtPlayhead()

// Split at 12.5 seconds
window.__agentBridge.splitAt(12.5)

// Undo / redo
window.__agentBridge.undo()
window.__agentBridge.redo()

// Keyboard-parity actions
window.__agentBridge.invokeAction("split")
```

All mutations go through `CommandManager` — undo/redo works the same as manual edits.

## Stack

| Layer | Tech |
|-------|------|
| Editor core | OpenCut Classic (TypeScript + Rust/WASM compositor) |
| Desktop (planned) | Tauri 2 + WebView2 |
| Agent LLM | OpenRouter BYOK (`openai/gpt-5.4-mini`) |
| Vision | OpenRouter BYOK (`google/gemini-3.5-flash`) |
| Transcription | Groq `whisper-large-v3-turbo` + local `whisper-large-v3-turbo` offline |

## Getting Started (dev)

### Prerequisites

- [Bun](https://bun.sh) 1.2+
- [Rust](https://rustup.rs) (for WASM compositor build)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/)

### Setup

```bash
git clone https://github.com/julianromli/trimy.git
cd trimy
bun install

# Build WASM compositor (first time)
bun run build:wasm

# Start web editor
bun run dev:web

# Desktop shell (dev — starts web server + Tauri window)
bun run dev:tauri
```

Open `http://localhost:3000` and create/open a project.

Add `GROQ_API_KEY` to `apps/web/.env.local` for cloud transcription (Phase 0.5).

> Docker (PostgreSQL, Redis) is optional for Phase 0 — local IndexedDB storage works for editor-only testing.

## Attribution

Based on [OpenCut Classic](https://github.com/opencut-app/opencut-classic) by the OpenCut team. Licensed under MIT.

## License

MIT — see [LICENSE](LICENSE).
