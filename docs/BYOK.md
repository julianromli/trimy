# Bring Your Own Key (BYOK)

Trimy does not host AI models or bill for usage. You connect your own API keys.

## Required keys

### OpenRouter (chat + vision)

Used for:
- Agent chat (`openai/gpt-5.4-mini`)
- Frame vision / screen-record classification (`google/gemini-3.5-flash`)

1. Create account at [openrouter.ai](https://openrouter.ai)
2. Generate API key (`sk-or-...`)
3. Add credits to your OpenRouter wallet

**Desktop app:** Agent sidebar → Settings → OpenRouter API Key  
**Dev:** `OPENROUTER_API_KEY=sk-or-...` in `apps/editor/.env.local`

### Groq (cloud transcription)

Used for:
- `whisper-large-v3-turbo` transcription (fast, EN + ID)

1. Create account at [console.groq.com](https://console.groq.com)
2. Generate API key (`gsk_...`)

**Desktop app:** Agent sidebar → Settings → Groq API Key  
**Dev:** `GROQ_API_KEY=gsk_...` in `apps/editor/.env.local`

## Optional: local Whisper

For fully offline transcription:

1. Agent sidebar → Settings → **Download local model** (~1.5 GB)
2. Use agent prompt: `transcribe with local provider`

Model: OpenAI Whisper large-v3-turbo (ONNX), same family as Groq cloud.

## Default models

| Role | Model ID |
|------|----------|
| Chat | `openai/gpt-5.4-mini` |
| Vision | `google/gemini-3.5-flash` |
| Transcribe (cloud) | `whisper-large-v3-turbo` |
| Transcribe (local) | `whisper-large-v3-turbo` |

## Security

- **Production (.exe):** keys stored in OS credential store (Windows Credential Manager)
- **Dev browser:** keys in `.env.local` (gitignored) or session-only in settings panel
- Keys are never sent to Trimy servers — only directly to OpenRouter / Groq from your machine

## Cost tips

- Vision (`export_frame` with describe) uses image tokens — agent uses it sparingly for tutorials
- Groq Whisper is inexpensive for podcast-length files
- Use confirm mode before batch deletes to avoid wasted agent rounds
