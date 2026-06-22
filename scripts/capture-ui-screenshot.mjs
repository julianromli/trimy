/**
 * Capture Trimy editor UI with timeline + agent sidebar.
 * Usage: TRIMY_URL=http://localhost:5173 TRIMY_TEST_VIDEO=/tmp/trimy-test.mp4 node scripts/capture-ui-screenshot.mjs
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.env.TRIMY_URL ?? "http://localhost:5173";
const VIDEO = process.env.TRIMY_TEST_VIDEO ?? "/tmp/trimy-test.mp4";
const OUT = process.env.OUTPUT_PATH ?? "/tmp/trimy-ui-editor-agent.png";
const TIMEOUT_MS = 180_000;

async function main() {
	readFileSync(VIDEO);

	const chromePath =
		process.env.CHROME_PATH ?? "/usr/bin/google-chrome-stable";
	const browser = await chromium.launch({
		executablePath: chromePath,
		headless: process.env.HEADLESS !== "0",
		args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-webgpu"],
	});
	const context = await browser.newContext({
		viewport: { width: 1440, height: 900 },
		deviceScaleFactor: 1,
	});
	const page = await context.newPage();

	page.on("pageerror", (err) => console.error("pageerror:", err.message));
	page.on("console", (msg) => {
		if (msg.type() === "error") console.error("console:", msg.text());
	});

	await page.goto(`${BASE}/projects`, {
		waitUntil: "domcontentloaded",
		timeout: TIMEOUT_MS,
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

	const closeOnboarding = page.getByRole("button", { name: /close/i });
	if (await closeOnboarding.isVisible().catch(() => false)) {
		await closeOnboarding.click();
	}

	const degraded = page.getByRole("button", { name: /dismiss/i });
	if (await degraded.isVisible().catch(() => false)) {
		await degraded.click();
	}

	const fileInput = page.locator('input[type="file"]').first();
	await fileInput.setInputFiles(VIDEO);
	await page.waitForFunction(
		() => window.__agentBridge.getEditor().media.getAssets().length > 0,
		{ timeout: 90_000 },
	);
	await page.evaluate(() => window.__agentBridge.addMediaToTimeline());
	await page.waitForTimeout(3000);

	await page.getByText("Trimy Agent").waitFor({ timeout: 15_000 });

	const hasError = await page.evaluate(() =>
		document.body.innerText.includes("Something went wrong"),
	);
	if (hasError) {
		throw new Error("Editor crashed before screenshot");
	}

	await page.screenshot({ path: OUT, fullPage: false });
	console.log(`Saved screenshot: ${OUT}`);

	await browser.close();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
