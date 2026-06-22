import { describe, expect, test } from "bun:test";
import { parseGroqVerboseJson } from "../groq-parse";

describe("parseGroqVerboseJson", () => {
	test("maps segments and language", () => {
		const result = parseGroqVerboseJson({
			task: "transcribe",
			language: "indonesian",
			duration: 12.5,
			text: "Halo semua, selamat datang.",
			segments: [
				{
					id: 0,
					start: 0,
					end: 5.2,
					text: " Halo semua,",
				},
				{
					id: 1,
					start: 5.2,
					end: 12.5,
					text: " selamat datang.",
				},
			],
		});

		expect(result.language).toBe("indonesian");
		expect(result.text).toBe("Halo semua, selamat datang.");
		expect(result.segments).toEqual([
			{ text: "Halo semua,", start: 0, end: 5.2 },
			{ text: "selamat datang.", start: 5.2, end: 12.5 },
		]);
	});

	test("filters empty segments", () => {
		const result = parseGroqVerboseJson({
			text: "only text",
			segments: [
				{ id: 0, start: 0, end: 1, text: "   " },
				{ id: 1, start: 1, end: 2, text: "hello" },
			],
		});

		expect(result.segments).toEqual([{ text: "hello", start: 1, end: 2 }]);
	});

	test("preserves word-level timestamps", () => {
		const result = parseGroqVerboseJson({
			text: "eh jadi",
			segments: [
				{
					id: 0,
					start: 0,
					end: 1.2,
					text: " eh jadi",
					words: [
						{ word: "eh", start: 0.1, end: 0.3 },
						{ word: "jadi", start: 0.35, end: 0.8 },
					],
				},
			],
		});

		expect(result.segments[0]?.words).toEqual([
			{ text: "eh", start: 0.1, end: 0.3 },
			{ text: "jadi", start: 0.35, end: 0.8 },
		]);
	});
});
