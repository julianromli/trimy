# Trimy Phase 3 — Intelligence Layer

Phase 3 replaces Phase 2 stubs with real audio/transcript/frame intelligence.

## What shipped

- **Real silence detection** via RMS analysis on decoded timeline audio (`packages/agent/src/silence-detection.ts`)
- **Word-level filler removal** from Groq `verbose_json` word timestamps
- **Highlights heuristic** for short-clip suggestions
- **Frame capture + vision** via `/api/agent/vision` (Gemini 3 Flash Preview on OpenRouter)
- **Groq chunking** for audio files larger than 24 MB
- **Local Whisper download UI** in Agent settings (large-v3-turbo only)

## Env vars (`apps/editor/.env.local`)

```env
OPENROUTER_API_KEY=sk-or-...
GROQ_API_KEY=gsk_...
```

## Test commands

```bash
# Unit tests
bun test packages/agent
bun test apps/web/src/services/transcription/__tests__

# Phase 2 regression
OPENROUTER_API_KEY=... bun run test:e2e:agent

# Phase 3
bun run test:e2e:phase3
```

## Agent tools changed

| Tool | Phase 3 behavior |
|------|------------------|
| `detect_silence` | Real RMS/VAD on timeline audio |
| `remove_silence` | Uses real regions + confirm card previews |
| `find_filler_words` | Word-level hits when Groq words exist |
| `remove_filler_words` | Padded cuts + preview timestamps |
| `find_highlights` | Heuristic scoring |
| `export_frame` | Captures PNG from compositor; `describe: true` calls vision |

## Notes

- Silence detection is voice-first. Music beds may produce false positives — raise `silenceThresholdDb` in settings if needed.
- Local Whisper large-v3-turbo needs WebGPU for acceptable speed; CPU fallback works but is slow on long files.
- Vision is capped in the system prompt to 20 frames per agent turn.

## Manual validation (Windows)

1. Import 5–10 min ID podcast clip
2. Agent: "Rough cut podcast ini, buang jeda panjang dan filler word"
3. Approve silence + filler cards
4. Screen record: "Trim tutorial, hapus loading screen" with `export_frame describe=true`
