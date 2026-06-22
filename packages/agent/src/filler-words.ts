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

export function getFillerWordsForLanguage(
	language: "en" | "id" | "all",
	customWords?: string[],
): string[] {
	const source =
		customWords && customWords.length > 0
			? customWords
			: getDefaultFillerWords();

	if (language === "all") {
		return source;
	}

	const allowed = new Set(
		(language === "en" ? DEFAULT_FILLER_WORDS_EN : DEFAULT_FILLER_WORDS_ID).map(
			(word) => word.toLowerCase(),
		),
	);

	return source.filter((word) => allowed.has(word.trim().toLowerCase()));
}

function normalizeToken(text: string): string {
	return text.trim().toLowerCase().replace(/[.,!?;:]+$/g, "");
}

function isWordBoundaryMatch({
	text,
	filler,
	index,
}: {
	text: string;
	filler: string;
	index: number;
}): boolean {
	const before = index === 0 ? " " : text[index - 1];
	const after =
		index + filler.length >= text.length ? " " : text[index + filler.length];
	return /\s|[.,!?;:]/.test(before) && /\s|[.,!?;:]/.test(after);
}

export function findFillerWordHits({
	text,
	segments,
	fillerWords,
	language = "all",
	paddingMs = 80,
}: {
	text: string;
	segments: Array<{
		text: string;
		start: number;
		end: number;
		words?: Array<{ text: string; start: number; end: number }>;
	}>;
	fillerWords: string[];
	language?: "en" | "id" | "all";
	paddingMs?: number;
}): Array<{ text: string; startSeconds: number; endSeconds: number }> {
	const hits: Array<{ text: string; startSeconds: number; endSeconds: number }> =
		[];
	const normalizedFillers = getFillerWordsForLanguage(language, fillerWords)
		.map((w) => w.trim().toLowerCase())
		.filter(Boolean)
		.sort((a, b) => b.length - a.length);
	const paddingSec = paddingMs / 1000;

	for (const segment of segments) {
		if (segment.words && segment.words.length > 0) {
			for (const word of segment.words) {
				const token = normalizeToken(word.text);
				if (!token || !normalizedFillers.includes(token)) {
					continue;
				}
				hits.push({
					text: token,
					startSeconds: Math.max(0, word.start - paddingSec),
					endSeconds: word.end + paddingSec,
				});
			}
			continue;
		}

		const segmentText = segment.text.toLowerCase();
		for (const filler of normalizedFillers) {
			let index = 0;
			while ((index = segmentText.indexOf(filler, index)) !== -1) {
				if (!isWordBoundaryMatch({ text: segmentText, filler, index })) {
					index += filler.length;
					continue;
				}

				const ratio =
					segment.end > segment.start ? index / segment.text.length : 0;
				const startSeconds =
					segment.start + ratio * (segment.end - segment.start);
				const endSeconds = startSeconds + 0.3;
				hits.push({
					text: filler,
					startSeconds: Math.max(0, startSeconds - paddingSec),
					endSeconds: Math.min(segment.end, endSeconds + paddingSec),
				});
				index += filler.length;
			}
		}
	}

	return hits.sort((a, b) => a.startSeconds - b.startSeconds);
}
