/**
 * E2E: new project → import video → place on timeline → export MP4
 * Usage: TRIMY_URL=http://localhost:5173 TRIMY_TEST_VIDEO=/tmp/trimy-test.mp4 node scripts/e2e-import-export.mjs
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const BASE = process.env.TRIMY_URL ?? "http://localhost:5173";
const VIDEO = process.env.TRIMY_TEST_VIDEO ?? "/tmp/trimy-test.mp4";
const TIMEOUT_MS = 120_000;
const OUT = process.env.TRIMY_EXPORT_OUT ?? "/tmp/trimy-export.mp4";

async function main() {
	const videoBytes = readFileSync(VIDEO);
	console.log(`→ Test video: ${VIDEO} (${videoBytes.length} bytes)`);

	const chromePath =
		process.env.CHROME_PATH ?? "/usr/bin/google-chrome-stable";
	const browser = await chromium.launch({
		executablePath: chromePath,
		// Headed + xvfb: WebCodecs/OPFS/WebGPU need a secure origin (localhost), not bare about:blank
		headless: process.env.HEADLESS === "1",
		args: [
			"--no-sandbox",
			"--disable-dev-shm-usage",
			"--enable-unsafe-webgpu",
			"--use-angle=default",
		],
	});
	const context = await browser.newContext();
	const page = await context.newPage();

	const errors = [];
	const logs = [];
	page.on("pageerror", (e) => errors.push(e.message));
	page.on("console", (msg) => {
		const text = msg.text();
		if (msg.type() === "error" || /fail|error|panic/i.test(text)) {
			logs.push(`[${msg.type()}] ${text}`);
		}
	});

	// --- 1. New project ---
	console.log(`→ Open ${BASE}/projects`);
	await page.goto(`${BASE}/projects`, { waitUntil: "networkidle", timeout: TIMEOUT_MS });

	const newBtn = page.getByRole("button", { name: /new project/i }).first();
	await newBtn.click();
	await page.waitForURL(/\/editor\//, { timeout: 30_000 });
	console.log(`  editor URL: ${page.url()}`);

	await page.waitForFunction(() => window.__agentBridge?.ready === true, {
		timeout: 60_000,
	});
	console.log("✓ Agent bridge ready");

	// Wait past loading screen
	await page.waitForFunction(
		() => !document.body.innerText.includes("Loading project"),
		{ timeout: 60_000 },
	);
	console.log("✓ Editor loaded");

	// --- 2. Import video via file input (assets panel) ---
	const fileInput = page.locator('input[type="file"]').first();
	await fileInput.setInputFiles(VIDEO);
	console.log("→ File input set, waiting for media processing...");

	await page.waitForFunction(
		() => {
			const bridge = window.__agentBridge;
			if (!bridge?.ready) return false;
			return bridge.getEditor().media.getAssets().length > 0;
		},
		{ timeout: 90_000 },
	);

	const assetInfo = await page.evaluate(() => {
		const asset = window.__agentBridge.getEditor().media.getAssets()[0];
		return { id: asset.id, name: asset.name, type: asset.type, duration: asset.duration };
	});
	console.log(`✓ Media imported: ${JSON.stringify(assetInfo)}`);

	// --- 3. Place on timeline ---
	await page.evaluate(() => {
		window.__agentBridge.addMediaToTimeline();
	});
	await page.waitForTimeout(2000);

	const placed = await page.evaluate(() => window.__agentBridge.getState());
	console.log(
		`✓ Placed on timeline: ${placed.scene.elementCount} elements, ${placed.totalDurationSeconds.toFixed(2)}s`,
	);

	if (placed.scene.elementCount === 0 || placed.totalDurationSeconds <= 0) {
		throw new Error(`Timeline empty after place: ${JSON.stringify(placed)}`);
	}

	// --- 4. Export MP4 ---
	console.log("→ Exporting MP4 (low quality)...");
	const exportResult = await page.evaluate(async () => {
		const result = await window.__agentBridge.exportVideo({
			format: "mp4",
			quality: "low",
			includeAudio: true,
		});
		return {
			success: result.success,
			error: result.error,
			cancelled: result.cancelled,
			bytes: result.buffer?.byteLength ?? 0,
			buffer: result.buffer ? [...new Uint8Array(result.buffer)] : null,
		};
	});

	console.log(`  export result: success=${exportResult.success}, bytes=${exportResult.bytes}`);

	if (!exportResult.success || exportResult.bytes < 500) {
		if (logs.length) {
			console.log("  console errors:");
			logs.slice(-15).forEach((l) => console.log(`    ${l}`));
		}
		if (errors.length) {
			console.log("  page errors:");
			errors.forEach((e) => console.log(`    - ${e}`));
		}
		await page.screenshot({ path: "/tmp/trimy-export-fail.png", fullPage: true });
		throw new Error(`Export failed: ${JSON.stringify(exportResult)}`);
	}

	// Save exported buffer
	if (!exportResult.buffer) throw new Error("Could not retrieve export buffer");
	writeFileSync(OUT, Buffer.from(exportResult.buffer));
	console.log(`✓ Export saved: ${OUT} (${exportResult.buffer.length} bytes)`);

	await browser.close();
	console.log("\n✅ E2E PASS — import + export succeeded");
}

main().catch((err) => {
	console.error("\n✗ E2E FAIL:", err.message);
	process.exit(1);
});
