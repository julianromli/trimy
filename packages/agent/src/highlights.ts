export interface HighlightSegment {
	startSeconds: number;
	endSeconds: number;
	score: number;
	reason: string;
}

const HOOK_TOKENS = [
	"?",
	"!",
	"how",
	"why",
	"what",
	"cara",
	"ini",
	"tips",
	"secret",
	"best",
	"important",
	"penting",
	"kenapa",
	"bagaimana",
];

function countHookTokens(text: string): number {
	const lower = text.toLowerCase();
	let count = 0;
	for (const token of HOOK_TOKENS) {
		if (lower.includes(token)) {
			count += 1;
		}
	}
	return count;
}

function positionBonus({
	startSeconds,
	totalDurationSeconds,
}: {
	startSeconds: number;
	totalDurationSeconds: number;
}): number {
	if (totalDurationSeconds <= 0) return 0;
	const ratio = startSeconds / totalDurationSeconds;
	if (ratio <= 0.3) return 1;
	if (ratio >= 0.5 && ratio <= 0.7) return 0.8;
	return 0.4;
}

export function findHighlightSegments({
	segments,
	totalDurationSeconds,
	count = 3,
	minDurationSeconds = 5,
}: {
	segments: Array<{ text: string; start: number; end: number }>;
	totalDurationSeconds: number;
	count?: number;
	minDurationSeconds?: number;
}): HighlightSegment[] {
	const scored = segments
		.map((segment) => {
			const duration = Math.max(0.1, segment.end - segment.start);
			if (duration < minDurationSeconds) {
				return null;
			}

			const charsPerSecond = segment.text.trim().length / duration;
			const speechRate = Math.min(1, charsPerSecond / 18);
			const keywordDensity = Math.min(1, countHookTokens(segment.text) / 3);
			const position = positionBonus({
				startSeconds: segment.start,
				totalDurationSeconds,
			});
			const lengthNorm = Math.min(1, duration / 30);
			const score =
				0.4 * keywordDensity +
				0.3 * speechRate +
				0.2 * position +
				0.1 * lengthNorm;

			return {
				startSeconds: segment.start,
				endSeconds: segment.end,
				score,
				reason:
					keywordDensity > 0.5
						? "Hook keywords detected"
						: speechRate > 0.6
							? "Fast, dense speech"
							: "Strong segment position",
			};
		})
		.filter((segment): segment is HighlightSegment => segment !== null)
		.sort((a, b) => b.score - a.score);

	const selected: HighlightSegment[] = [];
	for (const candidate of scored) {
		const overlaps = selected.some(
			(existing) =>
				candidate.startSeconds < existing.endSeconds &&
				candidate.endSeconds > existing.startSeconds,
		);
		if (!overlaps) {
			selected.push(candidate);
		}
		if (selected.length >= count) {
			break;
		}
	}

	return selected.sort((a, b) => a.startSeconds - b.startSeconds);
}
