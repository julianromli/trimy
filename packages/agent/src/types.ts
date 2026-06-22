export type ToolName =
	| "get_project_state"
	| "get_transcript"
	| "transcribe"
	| "split_at"
	| "seek_to"
	| "undo"
	| "redo"
	| "export_video"
	| "trim_clip"
	| "delete_range"
	| "add_marker"
	| "detect_silence"
	| "find_filler_words"
	| "remove_silence"
	| "remove_filler_words"
	| "find_highlights"
	| "export_frame";

export type ToolCategory = "read_only" | "single_mutation" | "batch_mutation";

export interface TranscriptWord {
	text: string;
	start: number;
	end: number;
}

export interface TranscriptSegment {
	text: string;
	start: number;
	end: number;
	words?: TranscriptWord[];
}

export interface SilentRegion {
	startSeconds: number;
	endSeconds: number;
	durationSeconds: number;
}

export interface FillerHit {
	text: string;
	startSeconds: number;
	endSeconds: number;
}

export interface HighlightSegment {
	startSeconds: number;
	endSeconds: number;
	score: number;
	reason: string;
}

export interface PendingActionToolCall {
	name: ToolName;
	args: Record<string, unknown>;
}

export interface PendingAction {
	id: string;
	summary: string;
	details: string[];
	tools: PendingActionToolCall[];
	affectedRegions: number;
	removedDurationSec: number;
}

export interface ToolResult {
	ok: boolean;
	data?: unknown;
	error?: string;
	requiresConfirm?: boolean;
	pendingAction?: PendingAction;
}

export interface AgentMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: number;
	toolCalls?: Array<{ name: ToolName; args: Record<string, unknown> }>;
}

export interface AgentSettings {
	openRouterApiKey: string;
	chatModel: string;
	visionModel: string;
	groqApiKey: string;
	transcriptionProvider: "groq" | "local";
	defaultLanguage: "auto" | "en" | "id";
	fillerWords: string[];
	silenceMinDurationMs: number;
	silenceThresholdDb: number;
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
	openRouterApiKey: "",
	chatModel: "deepseek/deepseek-v4-pro",
	visionModel: "google/gemini-3-flash-preview",
	groqApiKey: "",
	transcriptionProvider: "groq",
	defaultLanguage: "auto",
	fillerWords: [],
	silenceMinDurationMs: 1500,
	silenceThresholdDb: -40,
};

export interface ProjectContext {
	projectId: string;
	projectName: string;
	playheadSeconds: number;
	totalDurationSeconds: number;
	fps: number;
	mediaPool: Array<{
		id: string;
		name: string;
		type: string;
		durationSeconds: number | null;
	}>;
	timeline: {
		trackCount: number;
		elementCount: number;
		elements: Array<{
			id: string;
			trackId: string;
			name: string;
			startSeconds: number;
			endSeconds: number;
			mediaId?: string;
		}>;
	};
	transcript: {
		available: boolean;
		language?: string;
		segmentCount?: number;
		textPreview?: string;
	};
	markers: Array<{ timeSeconds: number; label?: string }>;
}

export type AgentEvent =
	| { type: "token"; delta: string }
	| { type: "tool_start"; name: ToolName; args: Record<string, unknown> }
	| { type: "tool_end"; name: ToolName; result: ToolResult }
	| { type: "pending_action"; action: PendingAction }
	| { type: "done"; messageId: string; content?: string }
	| { type: "error"; message: string };
