import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { isTauriRuntime } from "./tauri-transport";

const MEDIA_FILTERS = [
	{
		name: "Media",
		extensions: [
			"mp4",
			"mov",
			"webm",
			"mkv",
			"mp3",
			"wav",
			"m4a",
			"aac",
			"png",
			"jpg",
			"jpeg",
			"webp",
		],
	},
];

export async function pickMediaFiles({
	multiple = false,
}: {
	multiple?: boolean;
} = {}): Promise<File[] | null> {
	if (!isTauriRuntime()) return null;

	const selected = await open({
		multiple,
		directory: false,
		filters: MEDIA_FILTERS,
	});

	if (!selected) return null;

	const paths = Array.isArray(selected) ? selected : [selected];
	const files: File[] = [];

	for (const filePath of paths) {
		if (typeof filePath !== "string") continue;
		const bytes = await readFile(filePath);
		const fileName = filePath.split(/[\\/]/).pop() ?? "media";
		files.push(new File([bytes], fileName));
	}

	return files;
}

export async function saveExportBuffer({
	buffer,
	filename,
}: {
	buffer: ArrayBuffer;
	filename: string;
	mimeType: string;
}): Promise<boolean> {
	if (!isTauriRuntime()) return false;

	const extension = filename.includes(".")
		? (filename.split(".").pop() ?? "mp4")
		: "mp4";

	const targetPath = await save({
		defaultPath: filename,
		filters: [{ name: "Export", extensions: [extension] }],
	});

	if (!targetPath || typeof targetPath !== "string") return false;

	await writeFile(targetPath, new Uint8Array(buffer));
	return true;
}

export { isTauriRuntime };
