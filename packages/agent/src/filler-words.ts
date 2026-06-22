export const DEFAULT_FILLER_WORDS_ID = [
	"umm",
	"um",
	"uh",
	"eh",
	"anu",
	"jadi",
	"jadi gini",
	"kayak",
	"kayaknya",
	"maksudnya",
	"pokoknya",
	"sebenarnya",
	"intinya",
	"nggak",
	"gitu",
	"ya kan",
	"loh",
	"sih",
];

export const DEFAULT_FILLER_WORDS_EN = [
	"um",
	"uh",
	"like",
	"you know",
	"basically",
	"actually",
	"literally",
	"sort of",
	"kind of",
	"i mean",
	"right",
	"so yeah",
];

export function getDefaultFillerWords(): string[] {
	return [...DEFAULT_FILLER_WORDS_ID, ...DEFAULT_FILLER_WORDS_EN];
}

export function findFillerWordHits({
	text,
	segments,
	fillerWords,
}: {
	text: string;
	segments: Array<{ text: string; start: number; end: number }>;
	fillerWords: string[];
}): Array<{ text: string; startSeconds: number; endSeconds: number }> {
	const hits: Array<{ text: string; startSeconds: number; endSeconds: number }> = [];
	const normalizedFillers = fillerWords
		.map((w) => w.trim().toLowerCase())
		.filter(Boolean)
		.sort((a, b) => b.length - a.length);

	for (const segment of segments) {
		const segmentText = segment.text.toLowerCase();
		for (const filler of normalizedFillers) {
			let index = 0;
			while ((index = segmentText.indexOf(filler, index)) !== -1) {
				const before = index === 0 ? " " : segmentText[index - 1];
				const after =
					index + filler.length >= segmentText.length
						? " "
						: segmentText[index + filler.length];
				const isWordBoundary =
					/\s|[.,!?;:]/.test(before) && /\s|[.,!?;:]/.test(after);
				if (isWordBoundary) {
					const ratio = segment.end > segment.start ? index / segment.text.length : 0;
					const startSeconds =
						segment.start + ratio * (segment.end - segment.start);
					const endSeconds = startSeconds + 0.3;
					hits.push({
						text: filler,
						startSeconds,
						endSeconds: Math.min(endSeconds, segment.end),
					});
				}
				index += filler.length;
			}
		}
	}

	return hits.sort((a, b) => a.startSeconds - b.startSeconds);
}
