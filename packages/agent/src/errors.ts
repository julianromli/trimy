export function formatAgentError({
	status,
	message,
}: {
	status?: number;
	message: string;
}): string {
	const normalized = message.toLowerCase();

	if (status === 401 || status === 403 || normalized.includes("invalid api key")) {
		return "Invalid API key — open AI Settings and check your OpenRouter key.";
	}

	if (status === 429 || normalized.includes("rate limit")) {
		return "Rate limited — wait a moment, then try again.";
	}

	if (
		status === 503 ||
		normalized.includes("not configured") ||
		normalized.includes("missing openrouter") ||
		normalized.includes("missing groq")
	) {
		return "API key not configured — open AI Settings.";
	}

	if (
		normalized.includes("failed to fetch") ||
		normalized.includes("network") ||
		normalized.includes("request failed") ||
		status === 502
	) {
		return "Can't reach the API — check your internet connection.";
	}

	if (normalized.includes("agent reached max tool rounds")) {
		return "Agent stopped after 10 steps — try a smaller request.";
	}

	return message;
}

export function parseHttpErrorMessage(text: string): string {
	try {
		const parsed = JSON.parse(text) as { error?: string | { message?: string } };
		if (typeof parsed.error === "string") return parsed.error;
		if (parsed.error && typeof parsed.error.message === "string") {
			return parsed.error.message;
		}
	} catch {
		// ignore
	}
	return text.trim() || "Request failed";
}
