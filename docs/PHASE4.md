# Trimy Phase 4 — Desktop Release (v0.1.0)

**Status:** Complete  
**Prerequisite:** Phase 3 (`f37c145a`)

## What shipped

### 4.1 Tauri production backend

- Rust commands: `get_api_status`, `set_api_key`, `delete_api_key`
- HTTP proxies: `proxy_openrouter_chat`, `proxy_openrouter_vision`, `proxy_groq_transcribe`
- API keys stored in **OS credential store** via `keyring` (Windows Credential Manager)
- Frontend `trimyFetch` transport adapter — dev uses Vite proxy, Tauri uses `invoke()`

### 4.2 Native desktop UX

- `tauri-plugin-dialog` — native file picker for media import
- `tauri-plugin-fs` — save export to user-chosen path
- First-run settings banner when OpenRouter key missing

### 4.3 Error polish

- Actionable agent errors (401 → settings, 429 → rate limit, offline → connection)
- Retry last message button in agent sidebar
- Cancel confirm posts "Cancelled — no changes made"

### 4.4 Persistence

- Agent chat per project (localStorage, last 40 messages) — unchanged, verified
- Panel layout + agent collapsed state persisted via zustand

### 4.5 Release packaging

- NSIS installer target, `installMode: currentUser` (no admin)
- Version `0.1.0` in `tauri.conf.json`

## Build Windows installer

```powershell
git clone git@github.com:julianromli/trimy.git
cd trimy
bun install
bun run build:editor
bun run build:tauri
```

Artifact:

```
apps/tauri/src-tauri/target/release/bundle/nsis/Trimy_0.1.0_x64-setup.exe
```

Requires: Rust, MSVC Build Tools, WebView2 runtime.

## First launch (production .exe)

1. Open app → Agent sidebar → Settings (gear via banner)
2. Enter **OpenRouter** key (chat + vision)
3. Enter **Groq** key (cloud transcription)
4. Optional: download local Whisper model (~1.5 GB)

Keys are saved to OS credential store — not in project files.

## Dev vs production

| Feature | `bun run dev:editor` | Installed `.exe` |
|---------|---------------------|------------------|
| OpenRouter | `apps/editor/.env.local` | Keyring |
| Groq | `apps/editor/.env.local` | Keyring |
| Import | Browser file input | Native dialog |
| Export | Browser download | Native save dialog |

## Troubleshooting

**Agent says "API key not configured"** — Open AI Settings, re-enter keys. In dev, check `apps/editor/.env.local`.

**Groq transcription fails** — Verify Groq key in settings. Large files auto-chunk (>24 MB).

**WebGPU degraded banner** — Editor still works; export may be slower. Try updating GPU drivers / WebView2.

**SmartScreen warning** — v0.1.0 is unsigned. Click "More info" → "Run anyway".

## Tests

```bash
bun test packages/agent
bun run build:editor
bun run test:e2e:agent
bun run test:e2e:phase3
```

Manual checklist: install `.exe` → set keys → import → agent rough cut → export → restart app → chat persists.
