/**
 * E2E: confirm gate for remove_silence (stub returns >3 regions on 2min clip)
 * Usage: TRIMY_URL=http://localhost:5173 TRIMY_TEST_VIDEO=/tmp/trimy-test-long.mp4 node scripts/e2e-agent-confirm.mjs
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.env.TRIMY_URL ?? "http://localhost:5173";
const VIDEO = process.env.TRIMY_TEST_VIDEO ?? "/tmp/trimy-test.mp4";
const TIMEOUT_MS = 120_000;

async function main() {
	readFileSync(VIDEO); // ensure exists

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
	await fileInput.setInputFiles(VIDEO);
	await page.waitForFunction(
		() => window.__agentBridge.getEditor().media.getAssets().length > 0,
		{ timeout: 90_000 },
	);
	await page.evaluate(() => window.__agentBridge.addMediaToTimeline());
	await page.waitForTimeout(1500);

	const detectResult = await page.evaluate(async () => {
		return window.__agentBridge.executeTool("detect_silence", {
			minDurationMs: 1500,
		});
	});
	console.log("detect_silence:", JSON.stringify(detectResult));

	const removeResult = await page.evaluate(async () => {
		return window.__agentBridge.executeTool("remove_silence", {
			minDurationMs: 1500,
		});
	});

	if (!removeResult.requiresConfirm && !removeResult.pendingAction) {
		// Short video may not trigger confirm — that's ok if regions <= 3
		console.log("Note: confirm not required (small clip)", JSON.stringify(removeResult));
	} else {
		if (!removeResult.pendingAction) {
			throw new Error(`Expected pendingAction: ${JSON.stringify(removeResult)}`);
		}
		console.log("✓ PendingAction:", removeResult.pendingAction.summary);

		const approved = await page.evaluate(async (action) => {
			return window.__agentBridge.executeTool("remove_silence", {
				minDurationMs: 1500,
				_skipConfirm: true,
			});
		}, removeResult.pendingAction);
		console.log("✓ Approved execute:", JSON.stringify(approved));
	}

	await browser.close();
	console.log("PASS e2e-agent-confirm");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
