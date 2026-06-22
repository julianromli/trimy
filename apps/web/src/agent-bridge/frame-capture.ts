import type { EditorCore } from "@/core";
import { CanvasRenderer } from "@/services/renderer/canvas-renderer";
import { frameRateToFloat } from "@/fps/utils";
import { formatTimecode } from "opencut-wasm";
import { mediaTimeFromSeconds } from "@/wasm/media-time";

export interface CapturedFrame {
	seconds: number;
	width: number;
	height: number;
	pngBase64: string;
	filename: string;
}

export async function captureFrameAtSeconds({
	editor,
	seconds,
}: {
	editor: EditorCore;
	seconds: number;
}): Promise<CapturedFrame> {
	const activeProject = editor.project.getActiveOrNull();
	const renderTree = editor.renderer.getRenderTree();
	if (!activeProject || !renderTree) {
		throw new Error("No project or scene to capture");
	}

	const duration = editor.timeline.getTotalDuration();
	if (duration === 0) {
		throw new Error("Project is empty");
	}

	const renderTime = mediaTimeFromSeconds({
		seconds: Math.max(0, Math.min(seconds, duration)),
	});
	editor.playback.seek({ time: renderTime });

	const { canvasSize, fps } = activeProject.settings;
	const renderer = new CanvasRenderer({
		width: canvasSize.width,
		height: canvasSize.height,
		fps,
	});

	const tempCanvas = document.createElement("canvas");
	tempCanvas.width = canvasSize.width;
	tempCanvas.height = canvasSize.height;

	await renderer.renderToCanvas({
		node: renderTree,
		time: renderTime,
		targetCanvas: tempCanvas,
	});

	const blob = await new Promise<Blob>((resolve, reject) => {
		tempCanvas.toBlob((result) => {
			if (!result) {
				reject(new Error("Failed to encode frame PNG"));
				return;
			}
			resolve(result);
		}, "image/png");
	});

	const pngBase64 = await blobToBase64(blob);
	const fpsValue = frameRateToFloat(fps);
	const filename = `trimy-frame-${formatTimecode({
		time: renderTime,
		fps: fpsValue,
	})}.png`;

	return {
		seconds,
		width: canvasSize.width,
		height: canvasSize.height,
		pngBase64,
		filename,
	};
}

async function blobToBase64(blob: Blob): Promise<string> {
	const buffer = await blob.arrayBuffer();
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i] ?? 0);
	}
	return btoa(binary);
}
