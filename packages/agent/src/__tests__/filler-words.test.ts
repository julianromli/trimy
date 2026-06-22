import { describe, expect, test } from "bun:test";
import { findFillerWordHits } from "../filler-words";

describe("findFillerWordHits", () => {
	test("uses word-level timestamps when available", () => {
		const hits = findFillerWordHits({
			text: "eh jadi ini penting",
			segments: [
				{
					text: "eh jadi ini penting",
					start: 0,
					end: 4,
					words: [
						{ text: "eh", start: 0.2, end: 0.45 },
						{ text: "jadi", start: 0.5, end: 0.9 },
						{ text: "ini", start: 1.0, end: 1.3 },
						{ text: "penting", start: 1.4, end: 2.0 },
					],
				},
			],
			fillerWords: ["eh", "jadi"],
			paddingMs: 80,
		});

		expect(hits).toHaveLength(2);
		expect(hits[0]?.text).toBe("eh");
		expect(hits[0]?.startSeconds).toBeCloseTo(0.12, 2);
		expect(hits[0]?.endSeconds).toBeCloseTo(0.53, 2);
	});

	test("filters fillers by language", () => {
		const hits = findFillerWordHits({
			text: "eh basically okay",
			segments: [{ text: "eh basically okay", start: 0, end: 3 }],
			fillerWords: ["eh", "basically"],
			language: "id",
		});

		expect(hits.map((hit) => hit.text)).toEqual(["eh"]);
	});
});
