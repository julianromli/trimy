import type { AgentBridge } from "./index";
import type { TranscriptionResult } from "@/transcription/types";
import { ToggleBookmarkCommand } from "@/commands/scene/toggle-bookmark";
import { mediaTimeFromSeconds, mediaTimeToSeconds } from "@/wasm/media-time";
import {
	buildPendingAction,
	requiresConfirm,
} from "@trimy/agent";
import { findFillerWordHits, getDefaultFillerWords } from "@trimy/agent";
import type { ToolName, ToolResult } from "@trimy/agent";
import { nanoid } from "nanoid";

const TRANSCRIPT_CACHE = new Map<string, TranscriptionResult>();

export function cacheTranscript(projectId: string, result: TranscriptionResult): void {
	TRANSCRIPT_CACHE.set(projectId, result);
	if (typeof window !== "undefined") {
		try {
			localStorage.setItem(
				`trimy-transcript-${projectId}`,
				JSON.stringify(result),
			);
		} catch {
			// ignore quota
		}
	}
}

export function getCachedTranscript(projectId: string): TranscriptionResult | null {
	if (TRANSCRIPT_CACHE.has(projectId)) {
		return TRANSCRIPT_CACHE.get(projectId) ?? null;
	}
	if (typeof window !== "undefined") {
		try {
			const raw = localStorage.getItem(`trimy-transcript-${projectId}`);
			if (raw) {
				const parsed = JSON.parse(raw) as TranscriptionResult;
				TRANSCRIPT_CACHE.set(projectId, parsed);
				return parsed;
			}
		} catch {
			// ignore
		}
	}
	return null;
}

function getBridge(): AgentBridge {
	if (!window.__agentBridge?.ready) {
		throw new Error("Agent bridge not ready");
	}
	return window.__agentBridge;
}

function deleteRangeOnTimeline({
	bridge,
	startSeconds,
	endSeconds,
}: {
	bridge: AgentBridge;
	startSeconds: number;
	endSeconds: number;
}): void {
	const editor = bridge.getEditor();
	const state = bridge.getState();
	const scene = editor.scenes.getActiveScene();
	const tracks = [...scene.tracks.overlay, scene.tracks.main, ...scene.tracks.audio];

	const toDelete: Array<{ trackId: string; elementId: string }> = [];

	for (const track of tracks) {
		for (const element of track.elements) {
			const elStart = mediaTimeToSeconds({ time: element.startTime });
			const elEnd = elStart + mediaTimeToSeconds({ time: element.duration });

			if (elEnd <= startSeconds || elStart >= endSeconds) continue;

			if (elStart < startSeconds - 0.05 || elEnd > endSeconds + 0.05) {
				if (elStart < startSeconds) bridge.splitAt(startSeconds);
				if (elEnd > endSeconds) bridge.splitAt(endSeconds);
			}

			const refreshedScene = editor.scenes.getActiveScene();
			const refreshedTracks = [
				...refreshedScene.tracks.overlay,
				refreshedScene.tracks.main,
				...refreshedScene.tracks.audio,
			];
			for (const t of refreshedTracks) {
				for (const el of t.elements) {
					const s = mediaTimeToSeconds({ time: el.startTime });
					const e = s + mediaTimeToSeconds({ time: el.duration });
					if (s >= startSeconds - 0.05 && e <= endSeconds + 0.05) {
						toDelete.push({ trackId: t.id, elementId: el.id });
					}
				}
			}
		}
	}

	if (toDelete.length > 0) {
		editor.timeline.deleteElements({ elements: toDelete });
	}
}

async function detectSilenceStub({
	totalDurationSeconds,
	minDurationMs = 1500,
}: {
	totalDurationSeconds: number;
	minDurationMs?: number;
}): Promise<
	Array<{ startSeconds: number; endSeconds: number; durationSeconds: number }>
> {
	// Phase 3: real VAD. Stub: synthetic gaps every 30s for demo/testing
	const regions: Array<{
		startSeconds: number;
		endSeconds: number;
		durationSeconds: number;
	}> = [];
	const gapSec = minDurationMs / 1000;
	let t = 15;
	while (t + gapSec < totalDurationSeconds) {
		regions.push({
			startSeconds: t,
			endSeconds: t + gapSec,
			durationSeconds: gapSec,
		});
		t += 30;
	}
	return regions;
}

export async function executeAgentTool(
	name: ToolName,
	args: Record<string, unknown> = {},
): Promise<ToolResult> {
	try {
		const bridge = getBridge();
		const editor = bridge.getEditor();
		const state = bridge.getState();
		const skipConfirm = Boolean(args._skipConfirm);

		switch (name) {
			case "get_project_state": {
				const transcript = getCachedTranscript(state.projectId);
				return {
					ok: true,
					data: {
						...state,
						transcriptAvailable: Boolean(transcript),
					},
				};
			}

			case "get_transcript": {
				const transcript = getCachedTranscript(state.projectId);
				if (!transcript) {
					return { ok: true, data: null };
				}
				return { ok: true, data: transcript };
			}

			case "transcribe": {
				const result = await bridge.transcribe({
					provider: (args.provider as "groq" | "local") ?? "groq",
					language: (args.language as "auto" | "en" | "id") ?? "auto",
					insertCaptions: false,
				});
				cacheTranscript(state.projectId, result);
				return { ok: true, data: result };
			}

			case "split_at": {
				const seconds = Number(args.seconds);
				const split = bridge.splitAt(seconds);
				return { ok: true, data: { splitCount: split.length, seconds } };
			}

			case "seek_to": {
				const seconds = Number(args.seconds);
				bridge.seek(seconds);
				return { ok: true, data: { seconds } };
			}

			case "undo": {
				bridge.undo();
				return { ok: true, data: { action: "undo" } };
			}

			case "redo": {
				bridge.redo();
				return { ok: true, data: { action: "redo" } };
			}

			case "export_video": {
				const result = await bridge.exportVideo({
					format: (args.format as "mp4" | "webm") ?? "mp4",
					quality: (args.quality as "low" | "medium" | "high") ?? "medium",
					includeAudio: true,
				});
				return { ok: true, data: result };
			}

			case "trim_clip": {
				const { elementId, trackId, inSeconds, outSeconds } = args as {
					elementId: string;
					trackId: string;
					inSeconds?: number;
					outSeconds?: number;
				};
				const updates: Array<{
					trackId: string;
					elementId: string;
					patch: Record<string, unknown>;
				}> = [];
				const patch: Record<string, unknown> = {};
				if (inSeconds !== undefined) {
					patch.trimStart = mediaTimeFromSeconds({ seconds: inSeconds });
				}
				if (outSeconds !== undefined) {
					patch.duration = mediaTimeFromSeconds({ seconds: outSeconds });
				}
				updates.push({ trackId, elementId, patch });
				editor.timeline.updateElements({ updates });
				return { ok: true, data: { elementId, trackId } };
			}

			case "delete_range": {
				const startSeconds = Number(args.startSeconds);
				const endSeconds = Number(args.endSeconds);
				const duration = endSeconds - startSeconds;

				if (
					!skipConfirm &&
					requiresConfirm({
						toolName: name,
						affectedRegions: 1,
						removedDurationSec: duration,
					})
				) {
					return {
						ok: true,
						requiresConfirm: true,
						pendingAction: buildPendingAction({
							id: nanoid(),
							tools: [{ name, args }],
							summary: `Delete ${startSeconds.toFixed(1)}s – ${endSeconds.toFixed(1)}s`,
							details: [`Remove ~${duration.toFixed(1)}s`],
							affectedRegions: 1,
							removedDurationSec: duration,
						}),
					};
				}

				deleteRangeOnTimeline({ bridge, startSeconds, endSeconds });
				return {
					ok: true,
					data: { startSeconds, endSeconds, removedSeconds: duration },
				};
			}

			case "add_marker": {
				const seconds = Number(args.seconds);
				const time = mediaTimeFromSeconds({ seconds });
				editor.command.execute({ command: new ToggleBookmarkCommand(time) });
				return { ok: true, data: { seconds } };
			}

			case "detect_silence": {
				const regions = await detectSilenceStub({
					totalDurationSeconds: state.totalDurationSeconds,
					minDurationMs: Number(args.minDurationMs ?? 1500),
				});
				const totalDurationSeconds = regions.reduce(
					(sum, r) => sum + r.durationSeconds,
					0,
				);
				return {
					ok: true,
					data: { regions, count: regions.length, totalDurationSeconds },
				};
			}

			case "find_filler_words": {
				const transcript = getCachedTranscript(state.projectId);
				if (!transcript) {
					return { ok: false, error: "No transcript. Call transcribe first." };
				}
				const fillerWords = getDefaultFillerWords();
				const hits = findFillerWordHits({
					text: transcript.text,
					segments: transcript.segments,
					fillerWords,
				});
				return { ok: true, data: { hits, count: hits.length } };
			}

			case "remove_silence": {
				const detectResult = await executeAgentTool("detect_silence", {
					minDurationMs: args.minDurationMs,
					thresholdDb: args.thresholdDb,
					_skipConfirm: true,
				});
				const regions =
					(detectResult.data as { regions?: Array<{ startSeconds: number; endSeconds: number; durationSeconds: number }> })
						?.regions ?? [];
				const totalDurationSeconds = regions.reduce(
					(s, r) => s + r.durationSeconds,
					0,
				);

				if (
					!skipConfirm &&
					requiresConfirm({
						toolName: name,
						affectedRegions: regions.length,
						removedDurationSec: totalDurationSeconds,
					})
				) {
					return {
						ok: true,
						requiresConfirm: true,
						pendingAction: buildPendingAction({
							id: nanoid(),
							tools: [
								{
									name,
									args: {
										...args,
										regions,
										count: regions.length,
										_skipConfirm: true,
									},
								},
							],
							summary: `Remove ${regions.length} silent regions`,
							details: [
								`${regions.length} regions`,
								`~${Math.round(totalDurationSeconds)}s total silence`,
							],
							affectedRegions: regions.length,
							removedDurationSec: totalDurationSeconds,
						}),
						data: { regions, count: regions.length },
					};
				}

				for (const region of [...regions].reverse()) {
					deleteRangeOnTimeline({
						bridge,
						startSeconds: region.startSeconds,
						endSeconds: region.endSeconds,
					});
				}
				return {
					ok: true,
					data: { removed: regions.length, totalDurationSeconds },
				};
			}

			case "remove_filler_words": {
				const findResult = await executeAgentTool("find_filler_words", {
					...args,
					_skipConfirm: true,
				});
				const hits =
					(findResult.data as { hits?: Array<{ startSeconds: number; endSeconds: number }> })
						?.hits ?? [];

				if (
					!skipConfirm &&
					requiresConfirm({
						toolName: name,
						affectedRegions: hits.length,
						removedDurationSec: hits.length * 0.3,
					})
				) {
					return {
						ok: true,
						requiresConfirm: true,
						pendingAction: buildPendingAction({
							id: nanoid(),
							tools: [
								{
									name,
									args: { ...args, hits, count: hits.length, _skipConfirm: true },
								},
							],
							summary: `Remove ${hits.length} filler words`,
							details: [`${hits.length} filler hits detected`],
							affectedRegions: hits.length,
							removedDurationSec: hits.length * 0.3,
						}),
						data: { hits, count: hits.length },
					};
				}

				for (const hit of [...hits].reverse()) {
					deleteRangeOnTimeline({
						bridge,
						startSeconds: hit.startSeconds,
						endSeconds: hit.endSeconds,
					});
				}
				return { ok: true, data: { removed: hits.length } };
			}

			case "find_highlights": {
				const transcript = getCachedTranscript(state.projectId);
				const count = Number(args.count ?? 3);
				if (!transcript) {
					return { ok: false, error: "No transcript. Call transcribe first." };
				}
				const highlights = transcript.segments
					.filter((s) => s.text.trim().length > 20)
					.slice(0, count)
					.map((s, i) => ({
						startSeconds: s.start,
						endSeconds: s.end,
						score: 0.8 - i * 0.1,
						reason: "Dense speech segment",
					}));
				return { ok: true, data: { highlights } };
			}

			case "export_frame": {
				const seconds = Number(args.seconds);
				bridge.seek(seconds);
				return {
					ok: true,
					data: {
						seconds,
						note: "Frame export stub — vision in Phase 3",
						describe: args.describe ?? false,
					},
				};
			}

			default:
				return { ok: false, error: `Unknown tool: ${name}` };
		}
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Tool execution failed",
		};
	}
}
