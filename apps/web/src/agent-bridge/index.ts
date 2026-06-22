"use client";

import type { EditorCore } from "@/core";
import { invokeAction } from "@/actions";
import { getElementsAtTime } from "@/timeline/element-utils";
import {
	mediaTimeFromSeconds,
	mediaTimeToSeconds,
	type MediaTime,
} from "@/wasm/media-time";

export type AgentBridgeSplitRetainSide = "both" | "left" | "right";

export interface AgentBridgeProjectState {
	ready: true;
	projectId: string;
	projectName: string;
	playheadSeconds: number;
	playheadTicks: MediaTime;
	fps: { numerator: number; denominator: number };
	fpsValue: number;
	totalDurationSeconds: number;
	selection: Array<{ trackId: string; elementId: string }>;
	scene: {
		trackCount: number;
		elementCount: number;
	};
}

export interface AgentBridge {
	ready: boolean;
	version: string;
	getEditor: () => EditorCore;
	invokeAction: typeof invokeAction;
	getState: () => AgentBridgeProjectState;
	seek: (seconds: number) => void;
	splitAtPlayhead: (options?: {
		retainSide?: AgentBridgeSplitRetainSide;
		elementIds?: string[];
		seconds?: number;
	}) => Array<{ trackId: string; elementId: string }>;
	splitAt: (
		seconds: number,
		options?: {
			retainSide?: AgentBridgeSplitRetainSide;
			elementIds?: string[];
		},
	) => Array<{ trackId: string; elementId: string }>;
	undo: () => void;
	redo: () => void;
}

declare global {
	interface Window {
		__agentBridge?: AgentBridge;
	}
}

function resolveElementsToSplit({
	editor,
	splitTime,
	elementIds,
}: {
	editor: EditorCore;
	splitTime: MediaTime;
	elementIds?: string[];
}): Array<{ trackId: string; elementId: string }> {
	if (elementIds && elementIds.length > 0) {
		const tracks = editor.scenes.getActiveScene().tracks;
		const orderedTracks = [...tracks.overlay, tracks.main, ...tracks.audio];
		const resolved: Array<{ trackId: string; elementId: string }> = [];

		for (const elementId of elementIds) {
			for (const track of orderedTracks) {
				const element = track.elements.find((item) => item.id === elementId);
				if (element) {
					resolved.push({ trackId: track.id, elementId: element.id });
					break;
				}
			}
		}

		return resolved;
	}

	const selected = editor.selection.getSelectedElements();
	if (selected.length > 0) {
		return selected;
	}

	return getElementsAtTime({
		tracks: editor.scenes.getActiveScene().tracks,
		time: splitTime,
	});
}

function buildProjectState(editor: EditorCore): AgentBridgeProjectState {
	const project = editor.project.getActiveOrNull();
	if (!project) {
		throw new Error("No active project loaded");
	}

	const scene = editor.scenes.getActiveScene();
	const tracks = [...scene.tracks.overlay, scene.tracks.main, ...scene.tracks.audio];
	const playhead = editor.playback.getCurrentTime();
	const fps = project.settings.fps;

	return {
		ready: true,
		projectId: project.metadata.id,
		projectName: project.metadata.name,
		playheadSeconds: mediaTimeToSeconds({ time: playhead }),
		playheadTicks: playhead,
		fps,
		fpsValue: fps.numerator / fps.denominator,
		totalDurationSeconds: mediaTimeToSeconds({
			time: editor.timeline.getTotalDuration(),
		}),
		selection: editor.selection.getSelectedElements(),
		scene: {
			trackCount: tracks.length,
			elementCount: tracks.reduce((count, track) => count + track.elements.length, 0),
		},
	};
}

function splitAtTime({
	editor,
	splitTime,
	retainSide = "both",
	elementIds,
}: {
	editor: EditorCore;
	splitTime: MediaTime;
	retainSide?: AgentBridgeSplitRetainSide;
	elementIds?: string[];
}): Array<{ trackId: string; elementId: string }> {
	const elements = resolveElementsToSplit({ editor, splitTime, elementIds });
	if (elements.length === 0) {
		return [];
	}

	return editor.timeline.splitElements({
		elements,
		splitTime,
		retainSide,
	});
}

export function mountAgentBridge(editor: EditorCore): () => void {
	const bridge: AgentBridge = {
		ready: true,
		version: "0.1.0-phase0",
		getEditor: () => editor,
		invokeAction,
		getState: () => buildProjectState(editor),
		seek: (seconds) => {
			editor.playback.seek({
				time: mediaTimeFromSeconds({ seconds }),
			});
		},
		splitAtPlayhead: (options = {}) => {
			const splitTime =
				options.seconds !== undefined
					? mediaTimeFromSeconds({ seconds: options.seconds })
					: editor.playback.getCurrentTime();

			if (options.seconds !== undefined) {
				editor.playback.seek({ time: splitTime });
			}

			return splitAtTime({
				editor,
				splitTime,
				retainSide: options.retainSide,
				elementIds: options.elementIds,
			});
		},
		splitAt: (seconds, options = {}) => {
			const splitTime = mediaTimeFromSeconds({ seconds });
			editor.playback.seek({ time: splitTime });
			return splitAtTime({
				editor,
				splitTime,
				retainSide: options.retainSide,
				elementIds: options.elementIds,
			});
		},
		undo: () => {
			editor.command.undo();
		},
		redo: () => {
			editor.command.redo();
		},
	};

	window.__agentBridge = bridge;

	return () => {
		if (window.__agentBridge === bridge) {
			delete window.__agentBridge;
		}
	};
}
