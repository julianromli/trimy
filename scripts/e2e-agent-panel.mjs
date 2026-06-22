/**
 * E2E: agent panel visible + split_at tool via bridge
 * Usage: TRIMY_URL=http://localhost:5173 node scripts/e2e-agent-panel.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.TRIMY_URL ?? "http://localhost:5173";
const TIMEOUT_MS = 120_000;

async function main() {
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

	// Agent panel header should be visible
	const agentHeader = page.getByText("Trimy Agent");
	await agentHeader.waitFor({ timeout: 10_000 });
	console.log("✓ Agent panel visible");

	// split_at via bridge
	const splitResult = await page.evaluate(async () => {
		return window.__agentBridge.executeTool("split_at", { seconds: 1 });
	});
	if (!splitResult.ok) {
		throw new Error(`split_at failed: ${JSON.stringify(splitResult)}`);
	}
	console.log("✓ split_at tool:", JSON.stringify(splitResult));

	await browser.close();
	console.log("PASS e2e-agent-panel");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
