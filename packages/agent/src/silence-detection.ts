export interface SilentRegion {
	startSeconds: number;
	endSeconds: number;
	durationSeconds: number;
}

const MIN_RMS = 1e-8;

export function rmsToDb(rms: number): number {
	return 20 * Math.log10(Math.max(rms, MIN_RMS));
}

export function computeRmsWindows({
	samples,
	sampleRate,
	windowMs = 30,
}: {
	samples: Float32Array;
	sampleRate: number;
	windowMs?: number;
}): Array<{ startSeconds: number; endSeconds: number; rmsDb: number }> {
	const windowSamples = Math.max(1, Math.floor((sampleRate * windowMs) / 1000));
	const windows: Array<{ startSeconds: number; endSeconds: number; rmsDb: number }> = [];

	for (let i = 0; i < samples.length; i += windowSamples) {
		const end = Math.min(samples.length, i + windowSamples);
		let sumSquares = 0;
		const count = end - i;
		for (let j = i; j < end; j++) {
			const value = samples[j] ?? 0;
			sumSquares += value * value;
		}
		const rms = Math.sqrt(sumSquares / count);
		windows.push({
			startSeconds: i / sampleRate,
			endSeconds: end / sampleRate,
			rmsDb: rmsToDb(rms),
		});
	}

	return windows;
}

export function detectSilenceRegions({
	samples,
	sampleRate,
	minDurationMs = 1500,
	thresholdDb = -40,
	windowMs = 30,
	edgePaddingMs = 100,
}: {
	samples: Float32Array;
	sampleRate: number;
	minDurationMs?: number;
	thresholdDb?: number;
	windowMs?: number;
	edgePaddingMs?: number;
}): SilentRegion[] {
	if (samples.length === 0 || sampleRate <= 0) {
		return [];
	}

	const windows = computeRmsWindows({ samples, sampleRate, windowMs });
	const minDurationSec = minDurationMs / 1000;
	const paddingSec = edgePaddingMs / 1000;
	const totalDurationSec = samples.length / sampleRate;

	const rawRegions: Array<{ startSeconds: number; endSeconds: number }> = [];
	let regionStart: number | null = null;

	for (const window of windows) {
		const isSilent = window.rmsDb <= thresholdDb;
		if (isSilent) {
			if (regionStart === null) {
				regionStart = window.startSeconds;
			}
		} else if (regionStart !== null) {
			rawRegions.push({
				startSeconds: regionStart,
				endSeconds: window.startSeconds,
			});
			regionStart = null;
		}
	}

	if (regionStart !== null) {
		rawRegions.push({
			startSeconds: regionStart,
			endSeconds: totalDurationSec,
		});
	}

	return rawRegions
		.map((region) => {
			const paddedStart = Math.max(0, region.startSeconds + paddingSec);
			const paddedEnd = Math.min(totalDurationSec, region.endSeconds - paddingSec);
			const durationSeconds = Math.max(0, paddedEnd - paddedStart);
			return {
				startSeconds: paddedStart,
				endSeconds: paddedEnd,
				durationSeconds,
			};
		})
		.filter((region) => region.durationSeconds >= minDurationSec);
}
