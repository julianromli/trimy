# Phase 0 Spike — Agent Bridge

## Goal

Prove that Trimy can execute timeline edits programmatically (same undo stack as manual edits) before Tauri shell and agent sidebar work.

## Deliverables

| Item | Status |
|------|--------|
| Fork `opencut-classic` → `julianromli/trimy` | Done |
| `window.__agentBridge` mounted after project load | Done |
| `splitAtPlayhead()` / `splitAt(seconds)` via `CommandManager` | Done |
| `getState()` project snapshot | Done |
| `undo()` / `redo()` | Done |
| Dev server runs | Done (port 3001 with `.env.local`) |
| Manual DevTools validation with clip | Pending (needs media + GROQ_API_KEY on dev machine) |
| Groq transcription spike | Done (API route + agent bridge `transcribe`) |

## Implementation

**Files:**
- `apps/web/src/agent-bridge/index.ts` — bridge API + `mountAgentBridge()`
- `apps/web/src/agent-bridge/use-agent-bridge.ts` — React hook
- `apps/web/src/components/providers/editor-provider.tsx` — mounts after `useEditorActions()`

**Design decisions:**
- Bridge calls `editor.timeline.splitElements()` directly (not raw `SplitElementsCommand.execute()`)
- Selection fallback: explicit `elementIds` → current selection → `getElementsAtTime()` at split time
- Times accept seconds; converted via `mediaTimeFromSeconds()` internally
- `invokeAction("split")` exposed for keyboard-parity shortcuts

## Manual validation checklist

1. `bun run dev:web` — editor loads
2. Create project, import video/audio clip
3. DevTools: `window.__agentBridge?.ready === true`
4. `__agentBridge.getState()` — correct playhead, element count
5. Seek to middle of clip, `__agentBridge.splitAtPlayhead()` — clip splits
6. `__agentBridge.undo()` — split reverts
7. `__agentBridge.splitAt(5.0)` — split at 5s

## Next: Groq transcription spike

Replicate `handleGenerateTranscript` from `apps/web/src/subtitles/components/assets-view.tsx` as `__agentBridge.transcribe({ provider: "groq" })` in Phase 0.5.

Requires:
- Groq API key in env for spike script
- `whisper-large-v3-turbo` model ID
- Test clip: Indonesian podcast audio (~1–2 min)

## Next: Phase 1

- Migrate editor routes from Next.js → Vite SPA
- Tauri 2 shell with WebView2
- Strip cloud auth (better-auth, PostgreSQL) for local-first desktop


## Phase 0.5 — Groq transcription

**Files:**
- `apps/web/src/app/api/transcribe/groq/route.ts` — server proxy (keeps `GROQ_API_KEY` off client)
- `apps/web/src/services/transcription/groq-client.ts` — browser client
- `apps/web/src/services/transcription/groq-parse.ts` — verbose_json → `TranscriptionResult`
- `scripts/spike-groq-transcribe.sh` — CLI spike without editor

**Dev setup:** add `GROQ_API_KEY=gsk_...` to `apps/web/.env.local`, restart `bun run dev:web`.

**Agent bridge:**
```javascript
await __agentBridge.transcribe({ provider: "groq", language: "id" })
// insertCaptions: true (default) adds subtitle track
await __agentBridge.transcribe({ provider: "local", language: "en", insertCaptions: false })
```
