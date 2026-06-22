import { chromium } from "playwright";

const BASE = process.env.TRIMY_URL ?? "http://localhost:5173";
const TIMEOUT_MS = 25_000;

async function main() {
	const browser = await chromium.launch({
		headless: true,
		args: ["--enable-unsafe-webgpu"],
	});
	const context = await browser.newContext();
	const page = await context.newPage();

	const consoleLogs = [];
	const errors = [];
	page.on("console", (msg) => {
		consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
	});
	page.on("pageerror", (err) => {
		errors.push(err.message);
	});

	console.log(`→ Open ${BASE}/projects`);
	await page.goto(`${BASE}/projects`, { waitUntil: "networkidle", timeout: TIMEOUT_MS });

	const title = await page.title();
	console.log(`  title: ${title}`);

	// Click New project button
	const newBtn = page.getByRole("button", { name: /new project|new/i }).first();
	await newBtn.waitFor({ state: "visible", timeout: 10_000 });
	console.log("→ Click New project");
	await newBtn.click();

	// Wait for navigation to editor
	await page.waitForURL(/\/editor\//, { timeout: 15_000 });
	const url = page.url();
	console.log(`  navigated: ${url}`);

	const start = Date.now();
	let lastText = "";
	while (Date.now() - start < TIMEOUT_MS) {
		const bodyText = await page.locator("body").innerText();
		lastText = bodyText.slice(0, 500);

		if (bodyText.includes("Loading project")) {
			await page.waitForTimeout(500);
			continue;
		}
		if (bodyText.includes("Exiting project")) {
			console.log("✗ STUCK on 'Exiting project...' (activeProject null after load)");
			break;
		}
		// Editor loaded indicators
		if (
			bodyText.includes("Export") ||
			bodyText.includes("Timeline") ||
			(await page.locator('[data-testid="timeline"], .timeline, [class*="timeline"]').count()) > 0
		) {
			console.log("✓ Editor loaded successfully");
			console.log(`  elapsed: ${Date.now() - start}ms`);
			await browser.close();
			process.exit(0);
		}
		await page.waitForTimeout(500);
	}

	console.log("✗ TIMEOUT — editor did not load");
	console.log(`  last body text:\n${lastText}`);
	if (errors.length) {
		console.log("  page errors:");
		errors.forEach((e) => console.log(`    - ${e}`));
	}
	const gpuLogs = consoleLogs.filter((l) => /gpu|wasm|webgpu/i.test(l));
	if (gpuLogs.length) {
		console.log("  gpu/wasm logs:");
		gpuLogs.slice(-10).forEach((l) => console.log(`    ${l}`));
	}

	await page.screenshot({ path: "/tmp/trimy-e2e-fail.png", fullPage: true });
	console.log("  screenshot: /tmp/trimy-e2e-fail.png");

	await browser.close();
	process.exit(1);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
