import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(__dirname, "../web/src");

const GROQ_TRANSCRIPTION_URL =
	"https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_MODEL = "whisper-large-v3-turbo";

function openRouterProxy(apiKey: string | undefined): Plugin {
	return {
		name: "trimy-openrouter-proxy",
		configureServer(server) {
			server.middlewares.use("/api/agent/status", (_req, res) => {
				res.statusCode = 200;
				res.setHeader("Content-Type", "application/json");
				res.end(
					JSON.stringify({
						openRouter: Boolean(apiKey),
						groq: Boolean(process.env.GROQ_API_KEY),
					}),
				);
			});

			server.middlewares.use("/api/agent/vision", async (req, res, next) => {
				if (req.method !== "POST") {
					next();
					return;
				}

				if (!apiKey) {
					res.statusCode = 503;
					res.setHeader("Content-Type", "application/json");
					res.end(
						JSON.stringify({
							error:
								"OPENROUTER_API_KEY is not configured. Add it to apps/editor/.env.local for dev.",
						}),
					);
					return;
				}

				try {
					const chunks: Buffer[] = [];
					for await (const chunk of req) {
						chunks.push(Buffer.from(chunk));
					}
					const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
						model?: string;
						imageBase64?: string;
						prompt?: string;
					};

					const orResponse = await fetch(
						"https://openrouter.ai/api/v1/chat/completions",
						{
							method: "POST",
							headers: {
								Authorization: `Bearer ${apiKey}`,
								"Content-Type": "application/json",
								"HTTP-Referer": "https://trimy.app",
								"X-Title": "Trimy",
							},
							body: JSON.stringify({
								model: payload.model ?? "google/gemini-3.5-flash",
								messages: [
									{
										role: "user",
										content: [
											{ type: "text", text: payload.prompt ?? "Describe this frame." },
											{
												type: "image_url",
												image_url: {
													url: `data:image/png;base64,${payload.imageBase64 ?? ""}`,
												},
											},
										],
									},
								],
							}),
						},
					);

					const responseJson = (await orResponse.json()) as {
						choices?: Array<{ message?: { content?: string } }>;
						error?: { message?: string };
					};

					if (!orResponse.ok) {
						res.statusCode = orResponse.status;
						res.setHeader("Content-Type", "application/json");
						res.end(
							JSON.stringify({
								error:
									responseJson.error?.message ??
									`Vision request failed (${orResponse.status})`,
							}),
						);
						return;
					}

					res.statusCode = 200;
					res.setHeader("Content-Type", "application/json");
					res.end(
						JSON.stringify({
							content: responseJson.choices?.[0]?.message?.content ?? "",
						}),
					);
				} catch (error) {
					res.statusCode = 502;
					res.setHeader("Content-Type", "application/json");
					res.end(
						JSON.stringify({
							error:
								error instanceof Error
									? error.message
									: "Vision proxy failed",
						}),
					);
				}
			});

			server.middlewares.use("/api/agent/openrouter", async (req, res, next) => {
				if (req.method !== "POST") {
					next();
					return;
				}

				if (!apiKey) {
					res.statusCode = 503;
					res.setHeader("Content-Type", "application/json");
					res.end(
						JSON.stringify({
							error:
								"OPENROUTER_API_KEY is not configured. Add it to apps/editor/.env.local for dev.",
						}),
					);
					return;
				}

				try {
					const chunks: Buffer[] = [];
					for await (const chunk of req) {
						chunks.push(Buffer.from(chunk));
					}
					const body = Buffer.concat(chunks);

					const orResponse = await fetch(
						"https://openrouter.ai/api/v1/chat/completions",
						{
							method: "POST",
							headers: {
								Authorization: `Bearer ${apiKey}`,
								"Content-Type": "application/json",
								"HTTP-Referer": "https://trimy.app",
								"X-Title": "Trimy",
							},
							body,
						},
					);

					const responseText = await orResponse.text();
					res.statusCode = orResponse.status;
					res.setHeader("Content-Type", "application/json");
					res.end(responseText);
				} catch (error) {
					res.statusCode = 502;
					res.setHeader("Content-Type", "application/json");
					res.end(
						JSON.stringify({
							error:
								error instanceof Error
									? error.message
									: "OpenRouter proxy failed",
						}),
					);
				}
			});
		},
	};
}

function groqTranscribeProxy(apiKey: string | undefined): Plugin {
	return {
		name: "trimy-groq-transcribe-proxy",
		configureServer(server) {
			server.middlewares.use("/api/transcribe/groq", async (req, res, next) => {
				if (req.method !== "POST") {
					next();
					return;
				}

				if (!apiKey) {
					res.statusCode = 503;
					res.setHeader("Content-Type", "application/json");
					res.end(
						JSON.stringify({
							error:
								"GROQ_API_KEY is not configured. Add it to apps/editor/.env.local for dev.",
						}),
					);
					return;
				}

				try {
					const chunks: Buffer[] = [];
					for await (const chunk of req) {
						chunks.push(Buffer.from(chunk));
					}
					const body = Buffer.concat(chunks);

					const contentType = req.headers["content-type"] ?? "";
					const groqResponse = await fetch(GROQ_TRANSCRIPTION_URL, {
						method: "POST",
						headers: {
							Authorization: `Bearer ${apiKey}`,
							"Content-Type": contentType,
						},
						body,
					});

					const responseText = await groqResponse.text();
					res.statusCode = groqResponse.status;
					res.setHeader("Content-Type", "application/json");
					res.end(responseText);
				} catch (error) {
					res.statusCode = 502;
					res.setHeader("Content-Type", "application/json");
					res.end(
						JSON.stringify({
							error:
								error instanceof Error
									? error.message
									: "Groq proxy failed",
						}),
					);
				}
			});
		},
	};
}

function apiStubsPlugin(): Plugin {
	return {
		name: "trimy-api-stubs",
		configureServer(server) {
			server.middlewares.use("/api/feedback", (_req, res) => {
				res.statusCode = 501;
				res.setHeader("Content-Type", "application/json");
				res.end(JSON.stringify({ error: "Feedback API disabled in Trimy desktop" }));
			});

			server.middlewares.use("/api/sounds/search", (_req, res) => {
				res.statusCode = 200;
				res.setHeader("Content-Type", "application/json");
				res.end(
					JSON.stringify({
						count: 0,
						next: null,
						previous: null,
						results: [],
					}),
				);
			});
		},
	};
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, __dirname, "");
	const groqApiKey = env.GROQ_API_KEY;
	const openRouterApiKey = env.OPENROUTER_API_KEY;

	return {
		publicDir: path.resolve(__dirname, "../web/public"),
		plugins: [
			wasm(),
			topLevelAwait(),
			react(),
			groqTranscribeProxy(groqApiKey),
			openRouterProxy(openRouterApiKey),
			apiStubsPlugin(),
		],
		server: {
			port: 5173,
			strictPort: true,
		},
		preview: {
			port: 5173,
			strictPort: true,
		},
		resolve: {
			alias: [
				{
					find: "@trimy/agent",
					replacement: path.resolve(__dirname, "../../packages/agent/src"),
				},
				{
					find: "@trimy/agent-ui",
					replacement: path.resolve(__dirname, "../../packages/agent-ui/src"),
				},
				{
					find: "@/env/web",
					replacement: path.resolve(__dirname, "src/env/web.ts"),
				},
				{
					find: "content-collections",
					replacement: path.resolve(
						__dirname,
						"src/shims/content-collections.ts",
					),
				},
				{
					find: "next/image",
					replacement: path.resolve(__dirname, "src/shims/next-image.tsx"),
				},
				{
					find: "next/link",
					replacement: path.resolve(__dirname, "src/shims/next-link.tsx"),
				},
				{
					find: "next/navigation",
					replacement: path.resolve(__dirname, "src/shims/next-navigation.tsx"),
				},
				{
					find: "@",
					replacement: webSrc,
				},
			],
		},
		optimizeDeps: {
			exclude: ["opencut-wasm"],
			esbuildOptions: {
				target: "esnext",
			},
		},
		build: {
			outDir: "dist",
			sourcemap: true,
			target: "esnext",
		},
	};
});
