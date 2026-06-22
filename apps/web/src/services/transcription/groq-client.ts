import { trimyFetch } from "@trimy/agent";
import type {
	TranscriptionLanguage,
	TranscriptionProgress,
	TranscriptionResult,
} from "@/transcription/types";
import { parseGroqVerboseJson } from "./groq-parse";

type ProgressCallback = (progress: TranscriptionProgress) => void;

const GROQ_MAX_BYTES = 24 * 1024 * 1024;
const CHUNK_OVERLAP_SECONDS = 2;

async function transcribeChunk({
	audioBlob,
	language,
}: {
	audioBlob: Blob;
	language?: TranscriptionLanguage;
}): Promise<TranscriptionResult> {
	const formData = new FormData();
	formData.append(
		"file",
		audioBlob,
		audioBlob.type.includes("wav") ? "timeline.wav" : "timeline.mp3",
	);
	if (language && language !== "auto") {
		formData.append("language", language);
	}

	const response = await trimyFetch("/api/transcribe/groq", {
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

	const payload = await response.json();
	return parseGroqVerboseJson(payload);
}

function mergeChunkResults({
	chunks,
}: {
	chunks: Array<{ offsetSeconds: number; result: TranscriptionResult }>;
}): TranscriptionResult {
	const segments = chunks.flatMap(({ offsetSeconds, result }) =>
		result.segments.map((segment) => ({
			...segment,
			start: segment.start + offsetSeconds,
			end: segment.end + offsetSeconds,
			words: segment.words?.map((word) => ({
				...word,
				start: word.start + offsetSeconds,
				end: word.end + offsetSeconds,
			})),
		})),
	);

	return {
		text: chunks.map(({ result }) => result.text).join(" ").trim(),
		segments,
		language: chunks[0]?.result.language ?? "auto",
	};
}

async function splitAudioBlobIntoChunks({
	audioBlob,
	sampleRate = 16_000,
	chunkDurationSeconds = 600,
}: {
	audioBlob: Blob;
	sampleRate?: number;
	chunkDurationSeconds?: number;
}): Promise<Array<{ blob: Blob; offsetSeconds: number }>> {
	const arrayBuffer = await audioBlob.arrayBuffer();
	const audioContext = new AudioContext({ sampleRate });
	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
	const totalDuration = audioBuffer.duration;
	const chunks: Array<{ blob: Blob; offsetSeconds: number }> = [];

	for (
		let offsetSeconds = 0;
		offsetSeconds < totalDuration;
		offsetSeconds += chunkDurationSeconds - CHUNK_OVERLAP_SECONDS
	) {
		const startSample = Math.floor(offsetSeconds * audioBuffer.sampleRate);
		const endSample = Math.min(
			audioBuffer.length,
			Math.floor((offsetSeconds + chunkDurationSeconds) * audioBuffer.sampleRate),
		);
		const length = endSample - startSample;
		if (length <= 0) break;

		const chunkBuffer = audioContext.createBuffer(
			audioBuffer.numberOfChannels,
			length,
			audioBuffer.sampleRate,
		);
		for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
			const source = audioBuffer.getChannelData(channel).subarray(
				startSample,
				endSample,
			);
			chunkBuffer.copyToChannel(source, channel, 0);
		}

		const wavBlob = audioBufferToWavBlob(chunkBuffer);
		chunks.push({ blob: wavBlob, offsetSeconds });
	}

	await audioContext.close();
	return chunks;
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
	const numChannels = buffer.numberOfChannels;
	const sampleRate = buffer.sampleRate;
	const bytesPerSample = 2;
	const blockAlign = numChannels * bytesPerSample;
	const dataLength = buffer.length * blockAlign;
	const arrayBuffer = new ArrayBuffer(44 + dataLength);
	const view = new DataView(arrayBuffer);

	writeString(view, 0, "RIFF");
	view.setUint32(4, 36 + dataLength, true);
	writeString(view, 8, "WAVE");
	writeString(view, 12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * blockAlign, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, bytesPerSample * 8, true);
	writeString(view, 36, "data");
	view.setUint32(40, dataLength, true);

	let offset = 44;
	for (let i = 0; i < buffer.length; i++) {
		for (let channel = 0; channel < numChannels; channel++) {
			const sample = buffer.getChannelData(channel)[i] ?? 0;
			const clamped = Math.max(-1, Math.min(1, sample));
			view.setInt16(
				offset,
				clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
				true,
			);
			offset += 2;
		}
	}

	return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, value: string): void {
	for (let i = 0; i < value.length; i++) {
		view.setUint8(offset + i, value.charCodeAt(i));
	}
}

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

	if (audioBlob.size <= GROQ_MAX_BYTES) {
		const result = await transcribeChunk({ audioBlob, language });
		onProgress?.({
			status: "transcribing",
			progress: 100,
			message: "Transcript ready",
		});
		return result;
	}

	onProgress?.({
		status: "transcribing",
		progress: 15,
		message: "Audio is long — splitting into chunks for Groq...",
	});

	const chunks = await splitAudioBlobIntoChunks({ audioBlob });
	const merged: Array<{ offsetSeconds: number; result: TranscriptionResult }> =
		[];

	for (let index = 0; index < chunks.length; index++) {
		const chunk = chunks[index];
		if (!chunk) continue;

		onProgress?.({
			status: "transcribing",
			progress: 20 + Math.round((index / chunks.length) * 70),
			message: `Transcribing chunk ${index + 1}/${chunks.length}...`,
		});

		const result = await transcribeChunk({
			audioBlob: chunk.blob,
			language,
		});
		merged.push({ offsetSeconds: chunk.offsetSeconds, result });
	}

	onProgress?.({
		status: "transcribing",
		progress: 100,
		message: "Merged chunked transcript",
	});

	return mergeChunkResults({ chunks: merged });
}
