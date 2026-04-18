# sansxel desktop

Native Windows-first desktop app for sansxel. Tauri 2 + React + TypeScript.

## Run locally

From the repo root:

```
npm run desktop:dev
```

Or from this folder:

```
npm run tauri dev
```

The first run is slow (~5–15 min) because Cargo compiles every Rust dep from scratch. Subsequent runs are fast (incremental).

## Layout

- `src/` — React frontend (the visible UI)
- `src-tauri/` — Rust backend (window management, native APIs)
- `src-tauri/tauri.conf.json` — window size, identifier, bundling
- `src-tauri/Cargo.toml` — Rust deps

## Build a release installer

```
npm run desktop:build
```

Produces an MSI / NSIS installer under `desktop/src-tauri/target/release/bundle/`.

## Prereqs

- Rust toolchain (`rustup`)
- Microsoft C++ Build Tools (or full Visual Studio with "Desktop development with C++")
- WebView2 runtime (preinstalled on Windows 10/11)
- Node 20+
