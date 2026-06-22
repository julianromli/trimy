#!/usr/bin/env bash
# Phase 0.5 spike: call Groq whisper-large-v3-turbo on a short WAV file.
# Usage: GROQ_API_KEY=gsk_... ./scripts/spike-groq-transcribe.sh [audio.wav]

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AUDIO="${1:-}"

if [[ -z "${GROQ_API_KEY:-}" ]]; then
  if [[ -f "$ROOT/apps/web/.env.local" ]]; then
    # shellcheck disable=SC1091
    GROQ_API_KEY="$(grep -E '^GROQ_API_KEY=' "$ROOT/apps/web/.env.local" | cut -d= -f2- | tr -d '"' || true)"
    export GROQ_API_KEY
  fi
fi

if [[ -z "${GROQ_API_KEY:-}" ]]; then
  echo "Set GROQ_API_KEY in env or apps/web/.env.local" >&2
  exit 1
fi

if [[ -z "$AUDIO" ]]; then
  AUDIO="/tmp/trimy-spike-sample.wav"
  python3 - << 'PY'
import math, struct, wave
path = "/tmp/trimy-spike-sample.wav"
rate = 16000
duration = 2.0
with wave.open(path, "w") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(rate)
    frames = b"".join(
        struct.pack("<h", int(12000 * math.sin(2 * math.pi * 440 * i / rate)))
        for i in range(int(rate * duration))
    )
    w.writeframes(frames)
print(path)
PY
fi

echo "Transcribing: $AUDIO"
curl -sS -X POST "https://api.groq.com/openai/v1/audio/transcriptions" \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -F "file=@${AUDIO}" \
  -F "model=whisper-large-v3-turbo" \
  -F "response_format=verbose_json" \
  -F "timestamp_granularities[]=word" \
  -F "timestamp_granularities[]=segment" \
  | python3 -m json.tool
