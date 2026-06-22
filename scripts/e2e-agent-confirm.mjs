/**
 * E2E: confirm gate for remove_silence using real RMS detection
 * Usage: TRIMY_URL=http://localhost:5173 node scripts/e2e-agent-confirm.mjs
 */
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const BASE = process.env.TRIMY_URL ?? "http://localhost:5173";
const SILENCE_WAV = "/tmp/trimy-phase3-silence.wav";
const TIMEOUT_MS = 120_000;

function ensureSilenceFixture() {
	if (!existsSync(SILENCE_WAV)) {
		execSync("node scripts/generate-phase3-fixtures.mjs", {
			cwd: new URL("..", import.meta.url).pathname,
			stdio: "inherit",
		});
	}
	readFileSync(SILENCE_WAV);
}

async function main() {
	ensureSilenceFixture();

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
	await page.waitForFunction(
		() => !document.body.innerText.includes("Loading project"),
		{ timeout: 60_000 },
	);

	const fileInput = page.locator('input[type="file"]').first();
	await fileInput.setInputFiles(SILENCE_WAV);
	await page.waitForFunction(
		() => window.__agentBridge.getEditor().media.getAssets().length > 0,
		{ timeout: 90_000 },
	);
	await page.evaluate(() => window.__agentBridge.addMediaToTimeline());
	await page.waitForTimeout(1500);

	const detectResult = await page.evaluate(async () => {
		return window.__agentBridge.executeTool("detect_silence", {
			minDurationMs: 1200,
			thresholdDb: -35,
		});
	});
	console.log("detect_silence:", JSON.stringify(detectResult));

	const regions = detectResult.data?.regions ?? [];
	if (regions.length < 3) {
		throw new Error(
			`Expected >=3 silence regions from fixture, got ${regions.length}`,
		);
	}

	const removeResult = await page.evaluate(async () => {
		return window.__agentBridge.executeTool("remove_silence", {
			minDurationMs: 1200,
			thresholdDb: -35,
		});
	});

	if (!removeResult.requiresConfirm || !removeResult.pendingAction) {
		throw new Error(
			`Expected confirm gate for remove_silence. Got: ${JSON.stringify(removeResult)}`,
		);
	}

	console.log("✓ PendingAction:", removeResult.pendingAction.summary);

	const approved = await page.evaluate(async () => {
		return window.__agentBridge.executeTool("remove_silence", {
			minDurationMs: 1200,
			thresholdDb: -35,
			_skipConfirm: true,
		});
	});
	console.log("✓ Approved execute:", JSON.stringify(approved));

	await browser.close();
	console.log("PASS e2e-agent-confirm");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
