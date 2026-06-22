import { invoke } from "@tauri-apps/api/core";
import { trimyFetch, setTransportAdapter } from "@trimy/agent";

interface ProxyResponse {
	status: number;
	body: string;
}

interface ApiStatus {
	open_router: boolean;
	groq: boolean;
}

export function isTauriRuntime(): boolean {
	return (
		typeof window !== "undefined" &&
		("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
	);
}

function proxyResponseToFetch(response: ProxyResponse): Response {
	return new Response(response.body, {
		status: response.status,
		headers: { "Content-Type": "application/json" },
	});
}

async function bodyToBytes(body: BodyInit | null | undefined): Promise<Uint8Array> {
	if (!body) return new Uint8Array();
	if (body instanceof Uint8Array) return body;
	if (body instanceof ArrayBuffer) return new Uint8Array(body);
	if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
	if (typeof body === "string") return new TextEncoder().encode(body);
	return new Uint8Array(await new Response(body).arrayBuffer());
}

export function initTauriTransport(): void {
	if (!isTauriRuntime()) return;

	setTransportAdapter(async (path, init) => {
		const method = (init?.method ?? "GET").toUpperCase();

		if (path === "/api/agent/status" && method === "GET") {
			const status = await invoke<ApiStatus>("get_api_status");
			return new Response(
				JSON.stringify({
					openRouter: status.open_router,
					groq: status.groq,
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}

		if (path === "/api/agent/openrouter" && method === "POST") {
			const body = await bodyToBytes(init?.body);
			const response = await invoke<ProxyResponse>("proxy_openrouter_chat", {
				request: { body: new TextDecoder().decode(body) },
			});
			return proxyResponseToFetch(response);
		}

		if (path === "/api/agent/vision" && method === "POST") {
			const payload = JSON.parse(new TextDecoder().decode(await bodyToBytes(init?.body))) as {
				model?: string;
				imageBase64?: string;
				prompt?: string;
			};
			const response = await invoke<ProxyResponse>("proxy_openrouter_vision", {
				request: {
					model: payload.model,
					image_base64: payload.imageBase64 ?? "",
					prompt: payload.prompt,
				},
			});
			return proxyResponseToFetch(response);
		}

		if (path === "/api/transcribe/groq" && method === "POST") {
			const wrapped = new Response(init?.body ?? null);
			const contentType =
				wrapped.headers.get("content-type") ?? "multipart/form-data";
			const body = new Uint8Array(await wrapped.arrayBuffer());

			const response = await invoke<ProxyResponse>("proxy_groq_transcribe", {
				request: {
					body: Array.from(body),
					content_type: contentType,
				},
			});
			return proxyResponseToFetch(response);
		}

		return trimyFetch(path, init);
	});
}

export async function saveApiKeyToKeyring({
	provider,
	key,
}: {
	provider: "openrouter" | "groq";
	key: string;
}): Promise<void> {
	if (!isTauriRuntime()) return;
	await invoke("set_api_key", { request: { provider, key } });
}

export async function deleteApiKeyFromKeyring(
	provider: "openrouter" | "groq",
): Promise<void> {
	if (!isTauriRuntime()) return;
	await invoke("delete_api_key", { provider });
}

export async function fetchApiStatus(): Promise<{
	openRouter: boolean;
	groq: boolean;
}> {
	if (isTauriRuntime()) {
		const status = await invoke<ApiStatus>("get_api_status");
		return { openRouter: status.open_router, groq: status.groq };
	}

	const response = await fetch("/api/agent/status");
	if (!response.ok) return { openRouter: false, groq: false };
	const data = (await response.json()) as { openRouter?: boolean; groq?: boolean };
	return {
		openRouter: Boolean(data.openRouter),
		groq: Boolean(data.groq),
	};
}
