import type { TranscriptionResult, TranscriptionSegment } from "@/transcription/types";

export interface GroqVerboseWord {
	word: string;
	start: number;
	end: number;
}

export interface GroqVerboseSegment {
	id: number;
	start: number;
	end: number;
	text: string;
	words?: GroqVerboseWord[];
}

export interface GroqVerboseTranscription {
	task?: string;
	language?: string;
	duration?: number;
	text: string;
	segments?: GroqVerboseSegment[];
}

export function parseGroqVerboseJson(
	payload: GroqVerboseTranscription,
): TranscriptionResult {
	const segments: TranscriptionSegment[] = (payload.segments ?? [])
		.map((segment) => ({
			text: segment.text.trim(),
			start: segment.start,
			end: segment.end,
			words: segment.words
				?.map((word) => ({
					text: word.word.trim(),
					start: word.start,
					end: word.end,
				}))
				.filter((word) => word.text.length > 0),
		}))
		.filter((segment) => segment.text.length > 0);

	return {
		text: payload.text.trim(),
		segments,
		language: payload.language ?? "auto",
	};
}
