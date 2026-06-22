import type { EditorCore } from "@/core";
import { extractTimelineAudio } from "@/media/mediabunny";
import { decodeAudioToFloat32 } from "@/media/audio";
import { DEFAULT_TRANSCRIPTION_SAMPLE_RATE } from "@/transcription/audio";
import { detectSilenceRegions } from "@trimy/agent";

export async function getTimelineAudioSamples({
	editor,
	onProgress,
}: {
	editor: EditorCore;
	onProgress?: (progress: number) => void;
}): Promise<{ samples: Float32Array; sampleRate: number }> {
	const scene = editor.scenes.getActiveScene();
	const mediaAssets = editor.media.getAssets();
	const totalDuration = editor.timeline.getTotalDuration();

	const audioBlob = await extractTimelineAudio({
		tracks: scene.tracks,
		mediaAssets,
		totalDuration,
		onProgress,
	});

	const { samples, sampleRate } = await decodeAudioToFloat32({
		audioBlob,
		sampleRate: DEFAULT_TRANSCRIPTION_SAMPLE_RATE,
	});

	return { samples, sampleRate };
}

export async function detectSilenceFromEditor({
	editor,
	minDurationMs,
	thresholdDb,
}: {
	editor: EditorCore;
	minDurationMs: number;
	thresholdDb: number;
}) {
	const { samples, sampleRate } = await getTimelineAudioSamples({ editor });
	return detectSilenceRegions({
		samples,
		sampleRate,
		minDurationMs,
		thresholdDb,
	});
}
