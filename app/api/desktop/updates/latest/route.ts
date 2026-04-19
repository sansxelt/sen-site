import { NextResponse } from "next/server";

// Tauri updater manifest. Each installed sansxel desktop polls this
// endpoint on startup; if the version here is newer than what's
// installed, the updater downloads + replaces.
//
// The shape is fixed by Tauri:
//   { version, notes, pub_date, platforms: { "<target>-<arch>": { signature, url } } }
//
// Updates ship signed with the matching private key the user generated
// via `npm run tauri signer generate -- -w sansxel.key`. The pubkey
// goes into tauri.conf.json; the signature for each .msi.zip / .nsis.zip
// goes here. Wire this to point at GitHub Releases or Cloudflare R2 once
// you've uploaded the artifacts there.
//
// Until you ship a release: the endpoint returns 204 (no update). The
// installed app will check, see no update, and move on. No error.

const LATEST_VERSION: string | null = null;
const RELEASE_NOTES = "";
const RELEASE_DATE = ""; // ISO 8601, e.g. "2026-04-19T20:00:00Z"

// Per-platform artifact map. Fill these in when you ship a release.
//   key   = "<target>-<arch>" (e.g. "windows-x86_64", "darwin-aarch64")
//   url   = full URL to the .zip / .tar.gz containing the installer
//   sig   = the .sig file contents Tauri generated next to the artifact
const PLATFORMS: Record<string, { url: string; signature: string }> = {
  // "windows-x86_64": {
  //   url: "https://github.com/sansxelt/sen-site/releases/download/v0.2.0/sansxel_0.2.0_x64-setup.nsis.zip",
  //   signature: "PUT_THE_CONTENTS_OF_THE_.sig_FILE_HERE",
  // },
};

export async function GET(request: Request) {
  // No release pinned yet → tell the updater we're up to date
  if (!LATEST_VERSION) {
    return new NextResponse(null, { status: 204 });
  }

  const url = new URL(request.url);
  const platform = url.searchParams.get("platform") ?? "";
  const installed = url.searchParams.get("version") ?? "";

  // If the installed version already matches latest, no update
  if (installed === LATEST_VERSION) {
    return new NextResponse(null, { status: 204 });
  }

  const artifact = PLATFORMS[platform];
  if (!artifact) {
    // We don't ship this target → no update available
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({
    version: LATEST_VERSION,
    notes: RELEASE_NOTES,
    pub_date: RELEASE_DATE,
    platforms: {
      [platform]: artifact,
    },
  });
}
