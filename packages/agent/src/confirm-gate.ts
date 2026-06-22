import type { PendingAction, PendingActionToolCall, ToolName } from "./types";

const READ_ONLY_TOOLS = new Set<ToolName>([
	"get_project_state",
	"get_transcript",
	"detect_silence",
	"find_filler_words",
	"find_highlights",
	"export_frame",
]);

const SINGLE_MUTATION_TOOLS = new Set<ToolName>([
	"split_at",
	"seek_to",
	"undo",
	"redo",
	"trim_clip",
	"add_marker",
	"transcribe",
	"export_video",
]);

const BATCH_MUTATION_TOOLS = new Set<ToolName>([
	"delete_range",
	"remove_silence",
	"remove_filler_words",
]);

export function getToolCategory(name: ToolName): "read_only" | "single_mutation" | "batch_mutation" {
	if (READ_ONLY_TOOLS.has(name)) return "read_only";
	if (BATCH_MUTATION_TOOLS.has(name)) return "batch_mutation";
	if (SINGLE_MUTATION_TOOLS.has(name)) return "single_mutation";
	return "single_mutation";
}

export function requiresConfirm({
	toolName,
	affectedRegions = 0,
	removedDurationSec = 0,
}: {
	toolName: ToolName;
	affectedRegions?: number;
	removedDurationSec?: number;
}): boolean {
	if (getToolCategory(toolName) !== "batch_mutation") {
		return false;
	}
	return affectedRegions > 3 || removedDurationSec > 30;
}

export function buildPendingAction({
	id,
	tools,
	summary,
	details,
	affectedRegions,
	removedDurationSec,
}: {
	id: string;
	tools: PendingActionToolCall[];
	summary: string;
	details: string[];
	affectedRegions: number;
	removedDurationSec: number;
}): PendingAction {
	return {
		id,
		summary,
		details,
		tools,
		affectedRegions,
		removedDurationSec,
	};
}

export function aggregateBatchTools(tools: PendingActionToolCall[]): {
	affectedRegions: number;
	removedDurationSec: number;
} {
	let affectedRegions = 0;
	let removedDurationSec = 0;

	for (const tool of tools) {
		if (tool.name === "remove_silence" || tool.name === "delete_range") {
			const regions = tool.args.regions as Array<{ durationSeconds?: number }> | undefined;
			if (regions) {
				affectedRegions += regions.length;
				for (const r of regions) {
					removedDurationSec += r.durationSeconds ?? 0;
				}
			} else if (typeof tool.args.count === "number") {
				affectedRegions += tool.args.count;
			}
		}
		if (tool.name === "remove_filler_words") {
			const count = tool.args.count as number | undefined;
			if (count) affectedRegions += count;
		}
	}

	return { affectedRegions, removedDurationSec };
}
