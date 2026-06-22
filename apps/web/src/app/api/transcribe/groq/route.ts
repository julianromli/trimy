import { parseGroqVerboseJson } from "@/services/transcription/groq-parse";

const GROQ_TRANSCRIPTION_URL =
	"https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_MODEL = "whisper-large-v3-turbo";

export async function POST(request: Request) {
	const apiKey = process.env.GROQ_API_KEY;
	if (!apiKey) {
		return Response.json(
			{
				error:
					"GROQ_API_KEY is not configured. Add it to apps/web/.env.local for dev.",
			},
			{ status: 503 },
		);
	}

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return Response.json({ error: "Expected multipart form data" }, { status: 400 });
	}

	const file = formData.get("file");
	if (!(file instanceof File) || file.size === 0) {
		return Response.json({ error: "Missing audio file" }, { status: 400 });
	}

	const language = formData.get("language");
	const groqForm = new FormData();
	groqForm.append("file", file, file.name || "audio.wav");
	groqForm.append("model", GROQ_MODEL);
	groqForm.append("response_format", "verbose_json");
	groqForm.append("timestamp_granularities[]", "word");
	groqForm.append("timestamp_granularities[]", "segment");
	if (typeof language === "string" && language.length > 0) {
		groqForm.append("language", language);
	}

	const groqResponse = await fetch(GROQ_TRANSCRIPTION_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
		body: groqForm,
	});

	if (!groqResponse.ok) {
		const errorText = await groqResponse.text();
		return Response.json(
			{
				error: `Groq API error (${groqResponse.status}): ${errorText.slice(0, 500)}`,
			},
			{ status: 502 },
		);
	}

	const payload = await groqResponse.json();
	parseGroqVerboseJson(payload);
	return Response.json(payload);
}
