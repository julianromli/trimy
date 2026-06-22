import { describe, expect, test } from "bun:test";
import { detectSilenceRegions } from "../silence-detection";

function buildSamples({
	sampleRate,
	segments,
}: {
	sampleRate: number;
	segments: Array<{ seconds: number; amplitude: number }>;
}): Float32Array {
	const totalSeconds = segments.reduce((sum, segment) => sum + segment.seconds, 0);
	const samples = new Float32Array(Math.ceil(totalSeconds * sampleRate));
	let offset = 0;

	for (const segment of segments) {
		const count = Math.floor(segment.seconds * sampleRate);
		for (let i = 0; i < count; i++) {
			samples[offset + i] = segment.amplitude;
		}
		offset += count;
	}

	return samples;
}

describe("detectSilenceRegions", () => {
	test("detects a long silent gap between speech", () => {
		const sampleRate = 16_000;
		const samples = buildSamples({
			sampleRate,
			segments: [
				{ seconds: 1, amplitude: 0.2 },
				{ seconds: 2, amplitude: 0 },
				{ seconds: 1, amplitude: 0.25 },
			],
		});

		const regions = detectSilenceRegions({
			samples,
			sampleRate,
			minDurationMs: 1200,
			thresholdDb: -35,
			edgePaddingMs: 50,
		});

		expect(regions.length).toBe(1);
		expect(regions[0]?.durationSeconds).toBeGreaterThan(1.2);
	});

	test("returns empty when audio stays loud", () => {
		const sampleRate = 16_000;
		const samples = buildSamples({
			sampleRate,
			segments: [{ seconds: 3, amplitude: 0.3 }],
		});

		const regions = detectSilenceRegions({
			samples,
			sampleRate,
			minDurationMs: 500,
			thresholdDb: -40,
		});

		expect(regions).toEqual([]);
	});
});
