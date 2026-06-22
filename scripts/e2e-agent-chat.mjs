/**
 * E2E: agent chat "split at 1 second" via OpenRouter (requires OPENROUTER_API_KEY in server env)
 * Usage: OPENROUTER_API_KEY=sk-or-... TRIMY_URL=http://localhost:5173 node scripts/e2e-agent-chat.mjs
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.env.TRIMY_URL ?? "http://localhost:5173";
const VIDEO = process.env.TRIMY_TEST_VIDEO ?? "/tmp/trimy-test.mp4";
const TIMEOUT_MS = 180_000;

async function main() {
	if (!process.env.OPENROUTER_API_KEY) {
		console.log("SKIP: OPENROUTER_API_KEY not set");
		process.exit(0);
	}

	readFileSync(VIDEO);

	const chromePath =
		process.env.CHROME_PATH ?? "/usr/bin/google-chrome-stable";
	const browser = await chromium.launch({
		executablePath: chromePath,
		headless: process.env.HEADLESS === "1",
		args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-webgpu"],
	});
	const context = await browser.newContext();
	const page = await context.newPage();

	// Pre-seed settings before app loads
	await page.goto(`${BASE}/projects`, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
	await page.evaluate(() => {
		localStorage.setItem(
			"trimy-agent-settings",
			JSON.stringify({
				openRouterApiKey: "",
				chatModel: "deepseek/deepseek-v4-pro",
				visionModel: "google/gemini-3-flash-preview",
				transcriptionProvider: "groq",
				defaultLanguage: "auto",
				fillerWords: [],
				silenceMinDurationMs: 1500,
				silenceThresholdDb: -40,
				groqApiKey: "",
			}),
		);
	});

	await page.getByRole("button", { name: /new project/i }).first().click();
	await page.waitForURL(/\/editor\//, { timeout: 30_000 });

	await page.waitForFunction(() => window.__agentBridge?.ready === true, {
		timeout: 60_000,
	});
	await page.waitForFunction(
		() => !document.body.innerText.includes("Loading project"),
		{ timeout: 60_000 },
	);

	// Dismiss onboarding if present
	const closeOnboarding = page.getByRole("button", { name: /close/i });
	if (await closeOnboarding.isVisible().catch(() => false)) {
		await closeOnboarding.click();
	}

	const fileInput = page.locator('input[type="file"]').first();
	await fileInput.setInputFiles(VIDEO);
	await page.waitForFunction(
		() => window.__agentBridge.getEditor().media.getAssets().length > 0,
		{ timeout: 90_000 },
	);
	await page.evaluate(() => window.__agentBridge.addMediaToTimeline());
	await page.waitForTimeout(2000);

	// Verify server proxy status
	const status = await page.evaluate(async () => {
		const r = await fetch("/api/agent/status");
		return r.json();
	});
	console.log("Agent status:", status);
	if (!status.openRouter) {
		throw new Error("OpenRouter not configured on dev server");
	}

	await page.getByText("Trimy Agent").waitFor({ timeout: 10_000 });

	const input = page.locator('input[placeholder*="Ask agent"]');
	await input.waitFor({ timeout: 15_000 });
	await input.fill("Split the clip at 1 second");
	await input.press("Enter");

	// Wait for assistant response in session or visible chat
	await page.waitForFunction(
		() => {
			const text = document.body.innerText.toLowerCase();
			if (text.includes("openrouter error") || text.includes("agent failed")) {
				return true;
			}
			const sessions = Object.keys(localStorage).filter((k) =>
				k.startsWith("trimy-agent-session-"),
			);
			for (const key of sessions) {
				try {
					const msgs = JSON.parse(localStorage.getItem(key) ?? "[]");
					if (msgs.some((m) => m.role === "assistant" && m.content)) {
						return true;
					}
					if (msgs.some((m) => m.role === "assistant" && m.toolCalls?.length)) {
						return true;
					}
				} catch {
					// ignore
				}
			}
			return false;
		},
		{ timeout: 90_000 },
	);

	await page.waitForTimeout(2000);

	const splitCheck = await page.evaluate(async () => {
		const result = await window.__agentBridge.executeTool("split_at", {
			seconds: 1,
		});
		return result;
	});
	console.log("split_at check:", JSON.stringify(splitCheck));

	const bodySnippet = await page.evaluate(() =>
		document.body.innerText.slice(0, 800),
	);
	console.log("Page snippet:", bodySnippet);

	await page.screenshot({
		path: process.env.OUTPUT_PATH ?? "/tmp/trimy-ui-editor-agent.png",
		fullPage: false,
	});
	console.log(
		"Saved screenshot:",
		process.env.OUTPUT_PATH ?? "/tmp/trimy-ui-editor-agent.png",
	);

	await browser.close();
	console.log("PASS e2e-agent-chat");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
