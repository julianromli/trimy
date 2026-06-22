export const SCREEN_RECORD_CLASSES = [
	"loading",
	"error",
	"idle",
	"active_demo",
	"title_card",
	"unknown",
] as const;

export type ScreenRecordClass = (typeof SCREEN_RECORD_CLASSES)[number];

export function buildFrameDescriptionPrompt(): string {
	return `Classify this video editor frame for a screen-recording tutorial.

Return JSON only:
{
  "label": "loading|error|idle|active_demo|title_card|unknown",
  "confidence": 0.0,
  "summary": "short plain-language description"
}

Definitions:
- loading: splash screens, spinners, progress bars, waiting states
- error: error dialogs, stack traces, failed builds, red alerts
- idle: empty desktop, paused state, no meaningful demo action
- active_demo: coding, editing, clicking through the tutorial content
- title_card: intro/outro cards, chapter titles, branding slides
- unknown: cannot tell`;
}

export function parseFrameDescription(content: string): {
	label: ScreenRecordClass;
	confidence: number;
	summary: string;
} {
	try {
		const jsonMatch = content.match(/\{[\s\S]*\}/);
		const parsed = JSON.parse(jsonMatch?.[0] ?? content) as {
			label?: string;
			confidence?: number;
			summary?: string;
		};
		const label = SCREEN_RECORD_CLASSES.includes(
			parsed.label as ScreenRecordClass,
		)
			? (parsed.label as ScreenRecordClass)
			: "unknown";
		return {
			label,
			confidence:
				typeof parsed.confidence === "number" ? parsed.confidence : 0,
			summary: parsed.summary?.trim() || "No description returned",
		};
	} catch {
		return {
			label: "unknown",
			confidence: 0,
			summary: content.trim().slice(0, 240),
		};
	}
}
