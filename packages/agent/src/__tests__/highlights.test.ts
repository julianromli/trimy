import { describe, expect, test } from "bun:test";
import { findHighlightSegments } from "../highlights";

describe("findHighlightSegments", () => {
	test("ranks hook-heavy segments higher", () => {
		const highlights = findHighlightSegments({
			totalDurationSeconds: 120,
			count: 2,
			segments: [
				{ text: "um", start: 0, end: 6 },
				{
					text: "Ini cara terbaik bikin rough cut podcast dengan Trimy.",
					start: 10,
					end: 20,
				},
				{ text: "okay", start: 40, end: 46 },
				{
					text: "Why does this workflow matter for creators?",
					start: 70,
					end: 82,
				},
			],
		});

		expect(highlights.length).toBe(2);
		expect(highlights[0]?.startSeconds).toBe(10);
	});
});
