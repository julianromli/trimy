/**
 * E2E: podcast rough-cut tool chain with cached transcript (no Groq required)
 * Usage: TRIMY_URL=http://localhost:5173 node scripts/e2e-agent-podcast-rough-cut.mjs
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.env.TRIMY_URL ?? "http://localhost:5173";
const VIDEO = process.env.TRIMY_TEST_VIDEO ?? "/tmp/trimy-test.mp4";
const TIMEOUT_MS = 120_000;

const CACHED_TRANSCRIPT = {
	text: "eh jadi hari ini kita bahas rough cut podcast dengan Trimy eh maksudnya pokoknya intinya",
	language: "id",
	segments: [
		{
			text: "eh jadi hari ini kita bahas rough cut podcast dengan Trimy eh maksudnya pokoknya intinya",
			start: 0,
			end: 2,
			words: [
				{ text: "eh", start: 0.05, end: 0.2 },
				{ text: "jadi", start: 0.25, end: 0.55 },
				{ text: "hari", start: 0.6, end: 0.9 },
				{ text: "ini", start: 0.95, end: 1.1 },
				{ text: "kita", start: 1.15, end: 1.35 },
				{ text: "bahas", start: 1.4, end: 1.7 },
				{ text: "rough", start: 1.75, end: 1.95 },
				{ text: "eh", start: 1.96, end: 2.0 },
				{ text: "maksudnya", start: 2.01, end: 2.05 },
				{ text: "pokoknya", start: 2.06, end: 2.1 },
				{ text: "intinya", start: 2.11, end: 2.15 },
			],
		},
	],
};

async function main() {
	readFileSync(VIDEO);

	const chromePath =
		process.env.CHROME_PATH ?? "/usr/bin/google-chrome-stable";
	const browser = await chromium.launch({
		executablePath: chromePath,
		headless: process.env.HEADLESS === "1",
		args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-webgpu"],
	});
	const page = await browser.newPage();

	await page.goto(`${BASE}/projects`, { waitUntil: "networkidle", timeout: TIMEOUT_MS });
	await page.getByRole("button", { name: /new project/i }).first().click();
	await page.waitForURL(/\/editor\//, { timeout: 30_000 });

	await page.waitForFunction(() => window.__agentBridge?.ready === true, {
		timeout: 60_000,
	});

	const fileInput = page.locator('input[type="file"]').first();
	await fileInput.setInputFiles(VIDEO);
	await page.waitForFunction(
		() => window.__agentBridge.getEditor().media.getAssets().length > 0,
		{ timeout: 90_000 },
	);
	await page.evaluate(() => window.__agentBridge.addMediaToTimeline());
	await page.waitForTimeout(1000);

	await page.evaluate((transcript) => {
		const projectId = window.__agentBridge.getState().projectId;
		localStorage.setItem(
			`trimy-transcript-${projectId}`,
			JSON.stringify(transcript),
		);
	}, CACHED_TRANSCRIPT);

	const fillerFind = await page.evaluate(async () => {
		return window.__agentBridge.executeTool("find_filler_words", {
			language: "id",
		});
	});
	console.log("find_filler_words:", JSON.stringify(fillerFind));

	if ((fillerFind.data?.count ?? 0) < 4) {
		throw new Error("Expected at least 4 filler hits from cached transcript");
	}

	const fillerRemove = await page.evaluate(async () => {
		return window.__agentBridge.executeTool("remove_filler_words", {
			language: "id",
		});
	});

	if (!fillerRemove.requiresConfirm || !fillerRemove.pendingAction) {
		throw new Error(
			`Expected filler confirm gate. Got: ${JSON.stringify(fillerRemove)}`,
		);
	}

	const approved = await page.evaluate(async () => {
		return window.__agentBridge.executeTool("remove_filler_words", {
			language: "id",
			_skipConfirm: true,
		});
	});
	console.log("approved filler removal:", JSON.stringify(approved));

	const undo = await page.evaluate(async () => {
		return window.__agentBridge.executeTool("undo", {});
	});
	console.log("undo:", JSON.stringify(undo));

	await browser.close();
	console.log("PASS e2e-agent-podcast-rough-cut");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
