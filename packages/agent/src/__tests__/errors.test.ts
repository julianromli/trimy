import { describe, expect, test } from "bun:test";
import { formatAgentError, parseHttpErrorMessage } from "../errors";

describe("formatAgentError", () => {
	test("maps 401 to settings hint", () => {
		expect(
			formatAgentError({ status: 401, message: "Unauthorized" }),
		).toContain("AI Settings");
	});

	test("maps rate limit", () => {
		expect(
			formatAgentError({ status: 429, message: "rate limit exceeded" }),
		).toContain("Rate limited");
	});

	test("maps network failures", () => {
		expect(
			formatAgentError({ message: "Failed to fetch" }),
		).toContain("internet connection");
	});
});

describe("parseHttpErrorMessage", () => {
	test("extracts string error", () => {
		expect(parseHttpErrorMessage('{"error":"bad key"}')).toBe("bad key");
	});
});
