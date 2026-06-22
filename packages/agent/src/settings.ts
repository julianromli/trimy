import {
	DEFAULT_AGENT_SETTINGS,
	type AgentSettings,
	type AgentMessage,
} from "./types";
import { getDefaultFillerWords } from "./filler-words";

const SETTINGS_KEY = "trimy-agent-settings";
const SESSION_KEY_PREFIX = "trimy-agent-session-";

export function loadAgentSettings(): AgentSettings {
	if (typeof window === "undefined") {
		return { ...DEFAULT_AGENT_SETTINGS, fillerWords: getDefaultFillerWords() };
	}

	try {
		const raw = localStorage.getItem(SETTINGS_KEY);
		if (!raw) {
			return {
				...DEFAULT_AGENT_SETTINGS,
				fillerWords: getDefaultFillerWords(),
			};
		}
		const parsed = JSON.parse(raw) as Partial<AgentSettings>;
		return {
			...DEFAULT_AGENT_SETTINGS,
			...parsed,
			fillerWords:
				parsed.fillerWords && parsed.fillerWords.length > 0
					? parsed.fillerWords
					: getDefaultFillerWords(),
		};
	} catch {
		return {
			...DEFAULT_AGENT_SETTINGS,
			fillerWords: getDefaultFillerWords(),
		};
	}
}

export function saveAgentSettings(settings: Partial<AgentSettings>): AgentSettings {
	const current = loadAgentSettings();
	const next = { ...current, ...settings };
	if (typeof window !== "undefined") {
		const toStore = { ...next };
		// Don't persist empty keys if server proxy is used
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(toStore));
	}
	return next;
}

export function hasOpenRouterKey(settings: AgentSettings): boolean {
	return Boolean(settings.openRouterApiKey?.trim());
}

export function loadAgentSession(projectId: string): AgentMessage[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(`${SESSION_KEY_PREFIX}${projectId}`);
		if (!raw) return [];
		return JSON.parse(raw) as AgentMessage[];
	} catch {
		return [];
	}
}

export function saveAgentSession(projectId: string, messages: AgentMessage[]): void {
	if (typeof window === "undefined") return;
	const trimmed = messages.slice(-40);
	localStorage.setItem(
		`${SESSION_KEY_PREFIX}${projectId}`,
		JSON.stringify(trimmed),
	);
}

export function clearAgentSession(projectId: string): void {
	if (typeof window === "undefined") return;
	localStorage.removeItem(`${SESSION_KEY_PREFIX}${projectId}`);
}
