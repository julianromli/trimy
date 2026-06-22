import type { ToolName } from "./types";

export const TOOL_DEFINITIONS: Array<{
	type: "function";
	function: {
		name: ToolName;
		description: string;
		parameters: Record<string, unknown>;
	};
}> = [
	{
		type: "function",
		function: {
			name: "get_project_state",
			description: "Get current project snapshot: timeline, media pool, playhead, duration.",
			parameters: { type: "object", properties: {}, additionalProperties: false },
		},
	},
	{
		type: "function",
		function: {
			name: "get_transcript",
			description: "Get cached transcript with word-level timestamps if available.",
			parameters: { type: "object", properties: {}, additionalProperties: false },
		},
	},
	{
		type: "function",
		function: {
			name: "transcribe",
			description: "Transcribe timeline audio. Uses Groq whisper-large-v3-turbo by default.",
			parameters: {
				type: "object",
				properties: {
					provider: { type: "string", enum: ["groq", "local"] },
					language: { type: "string", enum: ["auto", "en", "id"] },
				},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "split_at",
			description: "Split all clips at the given timestamp in seconds.",
			parameters: {
				type: "object",
				properties: {
					seconds: { type: "number", description: "Timestamp in seconds" },
				},
				required: ["seconds"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "seek_to",
			description: "Move playhead to timestamp in seconds.",
			parameters: {
				type: "object",
				properties: { seconds: { type: "number" } },
				required: ["seconds"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "undo",
			description: "Undo the last edit.",
			parameters: { type: "object", properties: {} },
		},
	},
	{
		type: "function",
		function: {
			name: "redo",
			description: "Redo the last undone edit.",
			parameters: { type: "object", properties: {} },
		},
	},
	{
		type: "function",
		function: {
			name: "trim_clip",
			description: "Set in/out points for a clip by element ID.",
			parameters: {
				type: "object",
				properties: {
					elementId: { type: "string" },
					trackId: { type: "string" },
					inSeconds: { type: "number" },
					outSeconds: { type: "number" },
				},
				required: ["elementId", "trackId"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "delete_range",
			description: "Ripple-delete a time range from the timeline.",
			parameters: {
				type: "object",
				properties: {
					startSeconds: { type: "number" },
					endSeconds: { type: "number" },
				},
				required: ["startSeconds", "endSeconds"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "add_marker",
			description: "Add a bookmark/marker at timestamp.",
			parameters: {
				type: "object",
				properties: {
					seconds: { type: "number" },
					label: { type: "string" },
				},
				required: ["seconds"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "detect_silence",
			description: "Detect silent regions in audio. Read-only.",
			parameters: {
				type: "object",
				properties: {
					minDurationMs: { type: "number", default: 1500 },
					thresholdDb: { type: "number", default: -40 },
				},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "find_filler_words",
			description: "Find filler words in transcript. Read-only.",
			parameters: {
				type: "object",
				properties: {
					language: { type: "string", enum: ["en", "id", "all"] },
				},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "remove_silence",
			description: "Remove silent regions. Requires user confirmation for batch.",
			parameters: {
				type: "object",
				properties: {
					minDurationMs: { type: "number", default: 1500 },
					thresholdDb: { type: "number", default: -40 },
				},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "remove_filler_words",
			description: "Remove filler words from timeline. Requires user confirmation for batch.",
			parameters: {
				type: "object",
				properties: {
					language: { type: "string", enum: ["en", "id", "all"] },
				},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "find_highlights",
			description: "Find highlight segments for short clips. Read-only.",
			parameters: {
				type: "object",
				properties: {
					count: { type: "number", default: 3 },
				},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "export_frame",
			description: "Export a preview frame at timestamp for visual inspection.",
			parameters: {
				type: "object",
				properties: {
					seconds: { type: "number" },
					describe: { type: "boolean", default: false },
				},
				required: ["seconds"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "export_video",
			description: "Export timeline to MP4.",
			parameters: {
				type: "object",
				properties: {
					quality: { type: "string", enum: ["low", "medium", "high"] },
					format: { type: "string", enum: ["mp4", "webm"] },
				},
			},
		},
	},
];
