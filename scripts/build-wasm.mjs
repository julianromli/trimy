#!/usr/bin/env bun
/**
 * Build opencut-wasm from rust/wasm. Requires wasm-pack on PATH.
 * Normal Trimy dev does NOT need this — opencut-wasm comes from npm.
 */
import { spawnSync } from "node:child_process";

function commandExists(name) {
	const result = spawnSync(name, ["--version"], {
		shell: true,
		encoding: "utf8",
	});
	return result.status === 0;
}

if (!commandExists("wasm-pack")) {
	const isWin = process.platform === "win32";
	console.error(`
wasm-pack not found.

Most devs can SKIP this step — Trimy uses opencut-wasm from npm (already in bun install).
Only run build:wasm when editing rust/wasm or rust/crates.

Install wasm-pack:
${isWin ? `  powershell -ExecutionPolicy Bypass -File .\\script\\setup-rust.ps1
  # or manually:
  rustup target add wasm32-unknown-unknown
  cargo install wasm-pack` : `  ./script/setup-rust
  # or manually:
  rustup target add wasm32-unknown-unknown
  cargo install wasm-pack`}

Then open a NEW terminal (so PATH picks up ~/.cargo/bin) and retry:
  bun run build:wasm
`);
	process.exit(1);
}

const build = spawnSync(
	"wasm-pack",
	["build", "rust/wasm", "--target", "bundler", "--out-dir", "pkg"],
	{ stdio: "inherit", shell: true },
);

process.exit(build.status ?? 1);
