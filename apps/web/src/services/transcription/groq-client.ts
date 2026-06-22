import type {
	TranscriptionLanguage,
	TranscriptionProgress,
	TranscriptionResult,
} from "@/transcription/types";
import { parseGroqVerboseJson } from "./groq-parse";

type ProgressCallback = (progress: TranscriptionProgress) => void;

export async function transcribeWithGroq({
	audioBlob,
	language = "auto",
	onProgress,
}: {
	audioBlob: Blob;
	language?: TranscriptionLanguage;
	onProgress?: ProgressCallback;
}): Promise<TranscriptionResult> {
	onProgress?.({
		status: "transcribing",
		progress: 10,
		message: "Uploading audio to Groq...",
	});

	const formData = new FormData();
	formData.append(
		"file",
		audioBlob,
		audioBlob.type.includes("wav") ? "timeline.wav" : "timeline.mp3",
	);
	if (language !== "auto") {
		formData.append("language", language);
	}

	const response = await fetch("/api/transcribe/groq", {
		method: "POST",
		body: formData,
	});

	if (!response.ok) {
		let message = `Groq transcription failed (${response.status})`;
		try {
			const body = (await response.json()) as { error?: string };
			if (body.error) message = body.error;
		} catch {
			// ignore JSON parse errors
		}
		throw new Error(message);
	}

	onProgress?.({
		status: "transcribing",
		progress: 90,
		message: "Parsing transcript...",
	});

	const payload = await response.json();
	return parseGroqVerboseJson(payload);
}
