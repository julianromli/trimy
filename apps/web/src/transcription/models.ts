import type {
	TranscriptionModel,
	TranscriptionModelId,
} from "./types";

export const TRANSCRIPTION_MODELS: TranscriptionModel[] = [
	{
		id: "whisper-tiny",
		name: "Tiny",
		huggingFaceId: "onnx-community/whisper-tiny",
		description: "Fastest, lower accuracy (dev only)",
	},
	{
		id: "whisper-small",
		name: "Small",
		huggingFaceId: "onnx-community/whisper-small",
		description: "Good balance of speed and accuracy (dev only)",
	},
	{
		id: "whisper-medium",
		name: "Medium",
		huggingFaceId: "onnx-community/whisper-medium",
		description: "Higher accuracy, slower (dev only)",
	},
	{
		id: "whisper-large-v3-turbo",
		name: "Large v3 Turbo",
		huggingFaceId: "onnx-community/whisper-large-v3-turbo",
		description: "Best accuracy for EN/ID. Download ~1.5 GB for offline use.",
	},
];

export const AGENT_TRANSCRIPTION_MODELS = TRANSCRIPTION_MODELS.filter(
	(model) => model.id === "whisper-large-v3-turbo",
);

export const DEFAULT_TRANSCRIPTION_MODEL: TranscriptionModelId =
	"whisper-large-v3-turbo";
