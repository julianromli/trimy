# Phase 2 — In-App AI Agent Sidebar

## What's included

- **Agent panel** (4th column, `Ctrl+J` toggle)
- **OpenRouter BYOK** via dev proxy (`OPENROUTER_API_KEY` in `apps/editor/.env.local`)
- **15 internal tools** via `__agentBridge.executeTool()`
- **Confirm-before-execute** for batch edits (PendingAction card)
- **Preset chips** for podcast / talking head / tutorial workflows

## Dev setup

```bash
cp apps/editor/.env.example apps/editor/.env.local
# Add:
OPENROUTER_API_KEY=sk-or-...
GROQ_API_KEY=gsk_...   # optional, for transcribe

bun install
bun run dev:editor
```

Open editor → Agent panel on the right. Enter API key in panel settings if not using server env.

## Default models

| Role | Model |
|------|-------|
| Chat | `openai/gpt-5.4-mini` |
| Vision | `google/gemini-3.5-flash` |

## E2E tests

```bash
bun run dev:editor   # terminal 1

# terminal 2
bun run test:e2e:agent
OPENROUTER_API_KEY=sk-or-... node scripts/e2e-agent-chat.mjs
```

## Architecture

```
AgentPanel (React) → AgentRuntime (TS) → /api/agent/openrouter (Vite proxy)
                    → executeAgentTool → __agentBridge → EditorCore
```

Tauri keychain IPC is planned for production builds; dev uses Vite proxy (key never in browser network tab to OpenRouter directly).

## Phase 3 (not in Phase 2)

- Real VAD silence detection
- Frame export + Gemini vision
- Local whisper-large-v3-turbo download UI
