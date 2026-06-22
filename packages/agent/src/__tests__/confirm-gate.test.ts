import { describe, expect, test } from "bun:test";
import { requiresConfirm, getToolCategory } from "../confirm-gate";

describe("confirm-gate", () => {
	test("split_at is single mutation", () => {
		expect(getToolCategory("split_at")).toBe("single_mutation");
	});

	test("remove_silence is batch mutation", () => {
		expect(getToolCategory("remove_silence")).toBe("batch_mutation");
	});

	test("requires confirm when regions > 3", () => {
		expect(
			requiresConfirm({
				toolName: "remove_silence",
				affectedRegions: 5,
				removedDurationSec: 10,
			}),
		).toBe(true);
	});

	test("requires confirm when duration > 30s", () => {
		expect(
			requiresConfirm({
				toolName: "remove_silence",
				affectedRegions: 2,
				removedDurationSec: 45,
			}),
		).toBe(true);
	});

	test("no confirm for small batch", () => {
		expect(
			requiresConfirm({
				toolName: "remove_silence",
				affectedRegions: 2,
				removedDurationSec: 5,
			}),
		).toBe(false);
	});
});
