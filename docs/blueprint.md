# Blueprint Spec: Trimy — OpenCut Fork + Tauri + In-App AI Agent

**Project name:** Trimy
**Author:** Faiz Intifada
**Date:** 2026-06-22
**Status:** Approved v1.2 — decisions locked; awaiting approval before Phase 0 spike
**Base repo:** `opencut-app/opencut-classic` (archived, MIT)
**Target repo:** `github.com/julianromli/trimy` (public from day 1)
**Target platform:** Windows (primary), cross-platform later

---

## 0. Locked Decisions (Faiz, 2026-06-22)

| # | Decision | Value |
|---|----------|-------|
| D1 | Project name | **Trimy** |
| D2 | Destructive edits | **Confirm first** — agent proposes plan, user approves, then executes. Undo always available after execution. |
| D3 | Default chat model | **openai/gpt-5.4-mini** via OpenRouter BYOK |
| D4 | Repo visibility | **Public** from day 1 |
| D5 | Transcription | **Groq** `whisper-large-v3-turbo` (cloud, BYOK) + **local** `whisper-large-v3-turbo` offline (user downloads from HuggingFace). User picks provider in Settings. |
| D6 | Filler words (ID + EN) | Extended list including `maksudnya`, `kayaknya`, `pokoknya`, `sebenarnya`, etc. (see §7) |
| D7 | Vision model | **google/gemini-3.5-flash** via OpenRouter BYOK |
| D8 | Language focus | **General app** — English & Indonesian primary; auto-detect for other languages via Whisper |

### Transcription strategy

Two providers, same model family (`whisper-large-v3-turbo`):

| Provider | When to use | Key / download |
|----------|-------------|----------------|
| **Groq** (cloud) | Fast first pass, no local GPU/RAM | Groq API key (BYOK) |
| **Local** (offline) | Privacy, no API cost, offline editing | User downloads model once (~1.5 GB) |

Both support **English and Indonesian** (and 90+ languages via Whisper). Local runtime uses ONNX or whisper.cpp build of [openai/whisper-large-v3-turbo](https://huggingface.co/openai/whisper-large-v3-turbo) — not smaller classic ONNX models.

**No Parakeet** — dropped from scope; Whisper large-v3-turbo covers both target languages on cloud and local.

---

## 1. Executive Summary

Fork OpenCut classic into **Trimy** — a self-contained desktop video editor (Tauri 2 + WebView2) with an **in-app AI agent sidebar**. Not MCP, not external IDE. User brings OpenRouter API key (BYOK) for chat + vision; optional Groq API key for cloud transcription. English & Indonesian focused, general-purpose for other languages via Whisper auto-detect.

Agent understands project footage (transcript, audio analysis, frame snapshots) and performs **offline rough-cut editing** for podcast, talking head, monolog, and screen-record tutorial workflows.

Mental model: **Palmier Pro's in-app chat**, but Windows-native, open source, transcript-driven, fully offline-capable after model download.

---

## 2. Goals and Non-Goals

### MVP Goals

| # | Goal | Success criteria |
|---|------|------------------|
| G1 | Agent chat sidebar inside editor | User types natural language, sees streaming response, zero external tools |
| G2 | Project understanding | Agent receives auto-built context: timeline, media pool, transcript, playhead |
| G3 | Offline rough cut | Agent splits, trims, ripple-deletes via undoable commands |
| G4 | Transcript-driven editing | Groq Whisper + local ASR; word-level timestamps; filler/silence removal |
| G5 | Frame understanding | Export frame at timestamp; vision model describes content |
| G6 | BYOK OpenRouter | API key in Settings; agent uses tool-calling model |
| G7 | Confirm-before-execute | Batch destructive ops require user approval card in sidebar |
| G8 | Windows desktop | Tauri build produces installer; WebGPU + WASM compositor works |

### MVP Non-Goals (defer)

- MCP server / Cursor integration
- Generative video in-timeline (Fal, Runway, etc.)
- Cloud sync, auth, collaboration
- Color grading agent control
- Multi-user / subscription billing
- Semantic footage search (visual + spoken embeddings)
- macOS / Linux builds (post-MVP)
- FFmpeg native export (Phase 2+)

---

## 3. Architecture Overview

```
Tauri 2 Application (Rust) — Trimy
├── WebView2 — Editor UI (Vite SPA, EditorCore, CommandManager)
├── Agent Sidebar (React — chat, confirm cards, tool progress, presets)
└── Agent Runtime (Rust)
    ├── Session Manager (per-project chat history)
    ├── Context Builder (timeline/transcript snapshot)
    ├── OpenRouter Client (streaming tool-calling, gpt-5.4-mini default)
    ├── Transcription Router (Groq API | local whisper-large-v3-turbo)
    └── Tool Executor → IPC → EditorCore commands
```

### Key design decisions

1. **Tool layer is internal** — MCP-shaped tools, in-process via Tauri IPC. No HTTP server.
2. **EditorCore is source of truth** — all mutations via `CommandManager.execute()` for undo/redo.
3. **Agent runtime in Rust** — API keys in OS keychain via `keyring` crate.
4. **Confirm gate** — mutation tools that affect >1 region queue a `PendingAction` card; execution blocked until user taps Approve.
5. **Context is snapshot-based** — rebuilt before each agent turn.

---

## 4. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Editor base | opencut-classic fork | Working timeline, command pattern, WASM compositor |
| Desktop shell | Tauri 2 | Small binary, WebView2, Rust IPC |
| Frontend | Vite SPA + TanStack Router | Static bundle for Tauri |
| UI | React 19, Tailwind 4, Radix | Keep from classic |
| Compositor | opencut-wasm | Existing GPU pipeline |
| Cloud transcription | Groq `whisper-large-v3-turbo` | Fast, word timestamps, EN + ID |
| Local transcription | `whisper-large-v3-turbo` (ONNX/whisper.cpp) | Offline, same model family, user download |
| Export | mediabunny (MVP) | Sufficient for rough cut |
| Agent LLM | OpenRouter `openai/gpt-5.4-mini` | BYOK, tool-calling |
| Vision model | `google/gemini-3.5-flash` | Frame understanding for screen-record QC |
| Silence detection | Energy-based MVP → Silero VAD Phase 2 | New build |
| Package manager | Bun + Turbo | Familiar stack |

---

## 5. Agent Runtime

### Session model

Chat history: `{app_data_dir}/projects/{projectId}/agent-session.json`

Per turn: ContextBuilder.build() → OpenRouter with tools → if destructive batch → **PendingAction card** → on approve → execute via IPC → loop (max 10 rounds) → persist.

### Settings UI

**OpenRouter (required for agent):**
- API key (keychain)
- Chat model (default: `openai/gpt-5.4-mini`)
- Vision model (default: `google/gemini-3.5-flash`)
- Max tool rounds (default 10)
- Temperature (default 0.3)

**Transcription (user picks one active provider):**
| Provider | Key needed | Download | EN + ID | Offline |
|----------|------------|----------|---------|---------|
| Groq `whisper-large-v3-turbo` | Groq API key | None | ✅ | ❌ |
| Local `whisper-large-v3-turbo` | None | ~1.5 GB (HuggingFace) | ✅ | ✅ |

Settings also exposes **default language** (`auto` | `en` | `id`) passed to both providers.

**Editing prefs:**
- Silence threshold (default -40 dB)
- Min silence duration (default 1500 ms)
- Filler word list (editable)
- Confirm mode: **always on** for MVP (not toggleable until Phase 4)

---

## 6. Confirm-Before-Execute Flow

When agent plans a batch mutation (e.g. `remove_silence` with 47 regions, `remove_filler_words` with 134 hits), runtime **does not execute immediately**.

### PendingAction card (sidebar)

```
┌─────────────────────────────────────────┐
│ ⚠️  Proposed edit                        │
│                                         │
│ Remove 47 silence regions (8m 20s)      │
│ Remove 134 filler words                 │
│                                         │
│ 42:15 → ~31:40 estimated                │
│                                         │
│ [Approve]  [Edit plan]  [Cancel]        │
└─────────────────────────────────────────┘
```

- **Approve** → execute tool calls, show progress, result undoable via Ctrl+Z
- **Edit plan** → user types adjustment ("skip first 2 minutes", "keep 'jadi'")
- **Cancel** → discard pending action, agent acknowledges

Single-clip edits (`split_at` one timestamp) may execute without confirm card — configurable threshold: confirm if >3 affected regions OR >30s total duration removed.

---

## 7. Internal Tool Registry (15 tools MVP)

### Read-only

| Tool | Purpose |
|------|---------|
| get_project_state | Full ProjectContext refresh |
| get_transcript | Word-level transcript; respects active transcription provider |
| export_frame | PNG at tick + optional vision description |
| detect_silence | VAD → silent regions (no mutation) |
| find_filler_words | Pattern match transcript (no mutation) |
| find_highlights | Score segments for short clips |

### Mutations (undoable, confirm-gated when batch)

| Tool | Maps to | Confirm? |
|------|---------|----------|
| transcribe | Transcription router → store segments | No (progress only) |
| split_at | SplitElementsCommand | No (single) |
| delete_range | Split + DeleteElementsCommand | Yes if >3 regions |
| trim_clip | UpdateElementsCommand | No |
| remove_silence | detect → delete_range | **Yes** |
| remove_filler_words | find → split → delete | **Yes** |
| add_marker | UpdateBookmarkCommand | No |
| seek_to | PlaybackManager seek | No |
| export_video | RendererManager.exportProject() | Yes (shows preset) |
| undo / redo | CommandManager | No |

### Transcription tool

```typescript
transcribe({
  media_id?: string,        // default: primary timeline audio
  provider?: "groq" | "local",  // default: user setting
  language?: "id" | "en" | "auto"  // default: auto-detect (Whisper supports 90+ langs)
})
```

**Groq call:**
```
POST https://api.groq.com/openai/v1/audio/transcriptions
model: whisper-large-v3-turbo
response_format: verbose_json
timestamp_granularities: ["word", "segment"]
language: id  // when known
```

### Local `whisper-large-v3-turbo` (offline)

Source: [openai/whisper-large-v3-turbo](https://huggingface.co/openai/whisper-large-v3-turbo) (~1.5 GB).

Classic ships smaller ONNX models (tiny/base/small). Trimy upgrades local path to **large-v3-turbo only** — same accuracy tier as Groq cloud.

**Phase 0 spike must pick runtime:**

| Option | Pros | Cons |
|--------|------|------|
| whisper.cpp (GGML) | Fast CPU, Tauri can spawn binary | Need GGML conversion from HF |
| ONNX Runtime (Web Worker) | Fits classic's existing worker pattern | Large model in browser = RAM heavy |
| Tauri Rust (candle/whisper-rs) | Native, no WebView RAM pressure | More Rust integration work |

**Recommendation:** Tauri sidecar `whisper.cpp` binary for Windows (user downloads model to `%APPDATA%/Trimy/models/`). WebView sends audio path via IPC; Rust returns word-level JSON matching Groq response shape. Unified `TranscriptSegment[]` type regardless of provider.

**Download UX:** Settings → Transcription → "Download local model (~1.5 GB)" with progress bar. App works without download if Groq key is set.

### Filler word list (default, Indonesian + English)

```json
[
  "um", "uh", "umm", "uhh", "erm",
  "eh", "ehm", "emm",
  "anu", "nggak", "gimana ya",
  "jadi", "jadi gini", "jadi ya",
  "maksudnya", "kayaknya", "kayak", "kayak gini",
  "pokoknya", "sebenarnya", "intinya",
  "basically", "literally", "like", "you know", "i mean",
  "sort of", "kind of"
]
```

User-editable in Settings. Agent uses `find_filler_words` with fuzzy match (case-insensitive, word boundary).

---

## 8. System Prompt (summary)

You are Trimy Agent — embedded rough-cut assistant inside a video editor.

Rules:
- Inspect project context before acting
- Transcript-driven edits for podcast/talking head/tutorial
- Use tools, don't just describe what you'd do
- **Never execute batch destructive edits without user approval** — call read-only detect tools first, present plan, wait for confirm
- Respond in user's language (Indonesian or English; app is EN/ID focused)
- Be concise; cite timestamps

Cannot: color grade, add transitions, generate footage (MVP).

---

## 9. Agent Sidebar UI

### Layout

4-panel editor: Assets | Preview | Properties | **Agent** (320–400px, collapsible `Ctrl+J`)

### Components

- Message list (streaming)
- **PendingAction confirm cards** (primary interaction for batch edits)
- Tool progress ("Detecting silence…", "Transcribing via Groq…")
- Preset chips
- Chat input
- API key banner (OpenRouter + Groq if cloud transcription selected)

### Preset chips

- Rough cut podcast
- Clean talking head
- Trim tutorial
- Find highlights
- Export rough cut

Each preset pre-fills a prompt; agent still follows confirm flow for destructive steps.

---

## 10. Intelligence Layer

**Silence:** Decode audio 16kHz → 30ms RMS windows → merge below threshold → map to ticks. Present count + total duration before confirm.

**Filler removal:** Reverse-chronological split + delete with 80ms padding. Present hit count + sample timestamps before confirm.

**Screen record:** `export_frame` every 30s (max 20/turn) → vision classify (`loading`, `error`, `idle`, `active_demo`) → propose `delete_range` merged → confirm card.

**Highlights:** Heuristic score = keyword density + speech rate + position bonus. Phase 2: LLM scoring.

---

## 11. Tauri IPC

| Command | Purpose |
|---------|---------|
| agent_send_message | Start agent turn |
| agent_event | Stream tokens, tool progress, pending actions |
| agent_confirm_action | User approves/rejects PendingAction |
| agent_abort | Cancel in-flight request |
| get/save_settings | Keychain + prefs |
| execute_tool | Rust → WebView runs tool on EditorCore |
| transcribe_groq | Rust → Groq API (audio extracted in WebView, sent to Rust) |

---

## 12. Repo Structure

```
trimy/                          # github.com/julianromli/trimy (public)
├── apps/editor/                # Vite SPA (from classic apps/web)
├── apps/tauri/                 # Tauri 2 shell
├── packages/agent/             # Tool registry, context builder, confirm gate
├── packages/agent-ui/          # Sidebar, PendingAction cards
├── packages/transcription/     # Groq client, local whisper-large-v3-turbo runtime
├── rust/                       # compositor + wasm (from classic)
├── docs/
│   └── blueprint.md            # This file (copy for repo)
└── README.md                   # Trimy positioning, BYOK setup, fork attribution
```

Remove from classic fork: marketing web, Docker DB, Cloudflare Workers, better-auth, GPUI desktop.

**README attribution:** "Forked from OpenCut classic (MIT). Not affiliated with OpenCut team."

---

## 13. Implementation Phases

### Phase 0 — Spike (1 week)

Fork classic → `julianromli/trimy`, add `window.__agentBridge`, prove `SplitElementsCommand` from injected script + undo. Validate Groq transcription on sample ID podcast clip. Spike local whisper-large-v3-turbo runtime (whisper.cpp vs ONNX).

**Exit:** Programmatic split works; Groq transcript returns word timestamps; local runtime decision documented.

### Phase 1 — Tauri + Vite (2 weeks)

Tauri window, Vite migration, strip cloud deps, native file dialog, Windows `.exe`.

**Exit:** Import → edit → export MP4 without agent.

### Phase 2 — Agent engine (2–3 weeks)

15 tools, confirm gate, sidebar UI, Rust OpenRouter runtime, keychain, IPC bridge.

**Exit:** "Split at 1 minute" via chat; batch silence removal shows confirm card first.

### Phase 3 — Intelligence (2 weeks)

Silence detection, filler removal, frame vision, highlights, Groq + local transcription router.

**Exit:** 45min ID podcast rough cut end-to-end with confirm flow.

### Phase 4 — Polish (1–2 weeks)

Error states, session persistence, NSIS installer, public README, v0.1.0 tag.

**Total: 7–9 weeks full-time, 11–14 weeks part-time.**

---

## 14. Example Workflow: Podcast (with confirm)

User: *"Rough cut podcast ini, buang jeda panjang sama filler word"*

Agent trace:
1. `get_project_state` → 42:15 duration
2. `get_transcript` → null → `transcribe(provider=groq, language=id)`
3. `detect_silence(1500ms)` → 47 regions, 8m20s → **PendingAction card shown**
4. User taps **Approve**
5. `remove_silence` → batch delete
6. `find_filler_words` → 134 hits → **PendingAction card shown**
7. User taps **Approve**
8. `remove_filler_words` → execute
9. Response: *"42:15 → 31:40. Review 04:12 dan 18:30. Export?"*

---

## 15. Risks

| Risk | Mitigation |
|------|------------|
| WebGPU broken on some Windows GPUs | DegradedRendererBanner + CPU fallback |
| Vite migration breaks editor | Phase 0 on Next first, migrate in Phase 1 |
| gpt-5.4-mini tool-calling flaky | Document fallback models in Settings; test in Phase 2 |
| Local large-v3-turbo heavy (~1.5GB) | Lazy download UI; show disk/RAM requirements before install |
| Groq rate limits / 25MB file cap | Chunk long audio; fallback to local whisper-large-v3-turbo |
| ONNX export of large-v3-turbo | Spike in Phase 0: whisper.cpp vs ONNX Runtime vs transformers.js |
| Classic archived | Pin deps, own maintenance |
| Aggressive deletes despite confirm | Undo always available; session log of agent actions |

---

## 16. Success Metrics

- Podcast 45min rough cut: under 5 min agent time (excl transcription)
- Tutorial trim: 70%+ dead air removed correctly (user spot-check)
- 100% agent edits undoable
- Confirm card shown for 100% of batch mutations
- Cold start under 60s (excl model download)

---

## 17. Public Repo Checklist (day 1)

- [ ] MIT license retained + OpenCut attribution in README
- [ ] Trimy branding (name, icon placeholder)
- [ ] Blueprint in `docs/blueprint.md`
- [ ] BYOK setup guide (OpenRouter + Groq keys)
- [ ] Clear "MVP / early fork" disclaimer
- [ ] No secrets in repo

---

*Blueprint v1.2 — approved. Phase 0 spike awaits explicit go-ahead.*
