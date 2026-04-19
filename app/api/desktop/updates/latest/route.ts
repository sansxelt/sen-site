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

const LATEST_VERSION: string | null = "0.1.2";
const RELEASE_NOTES =
  "Borderless main window with custom title bar, app shows as 'sansxel' instead of 'sansxel.exe' in Start menu, minimal NSIS installer (currentUser, no UAC), corrected updater pubkey so future versions auto-update without reinstalling.";
const RELEASE_DATE = "2026-04-18T23:15:00Z";

// Per-platform artifact map. We host binaries from /public/desktop/
// on this same Vercel app — keeps the GitHub repo private. Tauri 2
// NSIS updater downloads the .exe directly + verifies the .sig.
const PLATFORMS: Record<string, { url: string; signature: string }> = {
  "windows-x86_64": {
    url: "https://sansxel.ai/desktop/sansxel_0.1.2_x64-setup.exe",
    signature:
      "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVUaTF3Z0Z6OHUrWUgvSkZQZnpGNnVvTUEwdUxIVkVzSGVud0l4VTJVVU9lWWNudGZXak1sQ1JJYWVQN25tdlc2OUExb1VxOE1XMUNzRUdLSTVoNWFKcU9Bb3RsaFVLZmdjPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzc2NTc5MzM4CWZpbGU6c2Fuc3hlbF8wLjEuMl94NjQtc2V0dXAuZXhlCkMzNWE1dlF4cXgxeWhidWthdlF6ek04ZXdqVEdJZGIzY2d1VzN5STVyWXVFMnlVbjh6Rnp6UWRvMjdmV0NIOERXVzVNY3kvaVM0blJyMVU2L2ZFcURBPT0K",
  },
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
