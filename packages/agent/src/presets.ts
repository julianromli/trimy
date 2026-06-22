export interface AgentPreset {
	id: string;
	label: string;
	message: string;
}

export const AGENT_PRESETS: AgentPreset[] = [
	{
		id: "rough-cut-podcast",
		label: "Rough cut podcast",
		message:
			"Buat rough cut podcast ini: hapus jeda panjang dan filler word. Deteksi dulu, tanya saya sebelum eksekusi batch.",
	},
	{
		id: "clean-talking-head",
		label: "Clean talking head",
		message:
			"Bersihkan talking head: filler words, jeda awkward. Keep hook di 30 detik pertama. Konfirmasi sebelum batch delete.",
	},
	{
		id: "trim-tutorial",
		label: "Trim tutorial",
		message:
			"Untuk screen record tutorial: identifikasi bagian loading/error/idle, propose hapus. Gunakan export_frame kalau perlu.",
	},
	{
		id: "find-highlights",
		label: "Find highlights",
		message: "Cari 3 segment terbaik untuk short clip, kasih timestamp dan alasan.",
	},
	{
		id: "export-rough",
		label: "Export rough cut",
		message:
			"Export MP4 quality medium. Pastikan tidak ada pending edit sebelum export.",
	},
];
