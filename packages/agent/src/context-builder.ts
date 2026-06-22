import type { ProjectContext } from "./types";

export interface BridgeStateLike {
	projectId: string;
	projectName: string;
	playheadSeconds: number;
	totalDurationSeconds: number;
	fpsValue: number;
	scene: { trackCount: number; elementCount: number };
}

export interface BridgeEditorLike {
	media: {
		getAssets: () => Array<{
			id: string;
			name: string;
			type: string;
			duration: number | null;
		}>;
	};
	scenes: {
		getActiveScene: () => {
			bookmarks: Array<{ time: unknown; label?: string }>;
			tracks: {
				overlay: Array<{ id: string; elements: TimelineElementLike[] }>;
				main: { id: string; elements: TimelineElementLike[] };
				audio: Array<{ id: string; elements: TimelineElementLike[] }>;
			};
		};
	};
}

interface TimelineElementLike {
	id: string;
	name: string;
	startTime: unknown;
	duration: unknown;
	mediaId?: string;
}

export function mediaTimeToSecondsFromUnknown(time: unknown): number {
	if (typeof time === "number") return time;
	if (time && typeof time === "object" && "ticks" in time) {
		const ticks = (time as { ticks: bigint | number }).ticks;
		return Number(ticks) / 1_000_000;
	}
	return 0;
}

export function buildProjectContext({
	state,
	editor,
	transcript,
}: {
	state: BridgeStateLike;
	editor: BridgeEditorLike;
	transcript?: {
		language: string;
		segments: Array<{ text: string }>;
	} | null;
}): ProjectContext {
	const scene = editor.scenes.getActiveScene();
	const tracks = [
		...scene.tracks.overlay,
		scene.tracks.main,
		...scene.tracks.audio,
	];

	const elements: ProjectContext["timeline"]["elements"] = [];
	for (const track of tracks) {
		for (const el of track.elements) {
			const startSeconds = mediaTimeToSecondsFromUnknown(el.startTime);
			const durationSeconds = mediaTimeToSecondsFromUnknown(el.duration);
			elements.push({
				id: el.id,
				trackId: track.id,
				name: el.name,
				startSeconds,
				endSeconds: startSeconds + durationSeconds,
				mediaId: el.mediaId,
			});
		}
	}

	const mediaPool = editor.media.getAssets().map((asset) => ({
		id: asset.id,
		name: asset.name,
		type: asset.type,
		durationSeconds: asset.duration,
	}));

	const textPreview = transcript?.segments
		.slice(0, 5)
		.map((s) => s.text)
		.join(" ")
		.slice(0, 200);

	return {
		projectId: state.projectId,
		projectName: state.projectName,
		playheadSeconds: state.playheadSeconds,
		totalDurationSeconds: state.totalDurationSeconds,
		fps: state.fpsValue,
		mediaPool,
		timeline: {
			trackCount: state.scene.trackCount,
			elementCount: state.scene.elementCount,
			elements,
		},
		transcript: {
			available: Boolean(transcript),
			language: transcript?.language,
			segmentCount: transcript?.segments.length,
			textPreview,
		},
		markers: scene.bookmarks.map((b) => ({
			timeSeconds: mediaTimeToSecondsFromUnknown(b.time),
			label: b.label,
		})),
	};
}

export function formatContextForPrompt(context: ProjectContext): string {
	return JSON.stringify(
		{
			project: {
				id: context.projectId,
				name: context.projectName,
				durationSeconds: context.totalDurationSeconds,
				playheadSeconds: context.playheadSeconds,
				fps: context.fps,
			},
			media: context.mediaPool,
			timeline: context.timeline,
			transcript: context.transcript,
			markers: context.markers,
		},
		null,
		2,
	);
}
