# Installs Rust toolchain, wasm32 target, and wasm-pack (Windows).
# Run from repo root: powershell -ExecutionPolicy Bypass -File .\script\setup-rust.ps1

$ErrorActionPreference = "Stop"

$cargoHome = if ($env:CARGO_HOME) { $env:CARGO_HOME } else { "$env:USERPROFILE\.cargo" }
$cargoBin = "$cargoHome\bin"
$rustupExe = "$cargoBin\rustup.exe"

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    if (-not (Test-Path $rustupExe)) {
        Write-Output "Installing rustup..."
        $installer = "$env:TEMP\rustup-init.exe"
        Invoke-WebRequest -Uri "https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe" -OutFile $installer
        & $installer -y --default-toolchain stable
        Remove-Item -Force $installer
    }
}

$env:PATH = "$cargoBin;$env:PATH"

Write-Output "Rust: $(& rustc --version)"

Write-Output "Adding wasm32-unknown-unknown target..."
& rustup target add wasm32-unknown-unknown

if (-not (Get-Command wasm-pack -ErrorAction SilentlyContinue)) {
    Write-Output "Installing wasm-pack (may take a few minutes)..."
    & cargo install wasm-pack
} else {
    Write-Output "wasm-pack already installed: $(& wasm-pack --version)"
}

Write-Output ""
Write-Output "Done. Open a NEW PowerShell window, then:"
Write-Output "  cd trimy"
Write-Output "  bun install"
Write-Output "  bun run dev:editor    # no build:wasm needed for normal dev"
Write-Output ""
Write-Output "Only run 'bun run build:wasm' if you edit rust/wasm."
