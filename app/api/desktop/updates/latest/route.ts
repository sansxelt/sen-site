import { NextResponse } from "next/server";
import {
  desktopLatestShippedDateIso,
  desktopLatestShippedVersion,
  desktopLatestUpdaterNotes,
  desktopWindowsInstallerPath,
} from "@/lib/desktop-release";

// Tauri updater manifest. Each installed Sansxel desktop polls this
// endpoint on startup; if the version here is newer than what's
// installed, the updater downloads and replaces it.
//
// The shape is fixed by Tauri:
//   { version, notes, pub_date, platforms: { "<target>-<arch>": { signature, url } } }
//
// Updates ship signed with the matching private key the user generated
// via `npm run tauri signer generate -- -w sansxel.key`. The pubkey
// goes into tauri.conf.json; the signature for each .msi.zip / .nsis.zip
// goes here. Wire this to point at GitHub Releases or Cloudflare R2 once
// you've uploaded the artifacts there.

// Set this to null if you need to pause update delivery temporarily.
const LATEST_VERSION: string | null = desktopLatestShippedVersion;
const RELEASE_NOTES = desktopLatestUpdaterNotes;
const RELEASE_DATE = desktopLatestShippedDateIso;

// Per-platform artifact map. We host binaries from /public/desktop/
// on this same Vercel app, which keeps the GitHub repo private.
const PLATFORMS: Record<string, { url: string; signature: string }> = {
  "windows-x86_64": {
    url: `https://sansxel.ai${desktopWindowsInstallerPath}`,
    signature:
      "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVUaTF3Z0Z6OHUrWURieU9tMkErcW5qYm1CK2o1c1c5OXhDMiszZE9tNEp3bmJ3WnBJQ09RY3psYTBadkx0bmt0aVhkdkdFQ1hkano1ZlBUMnUwZXNVNmE4RHo3MDdDUHcwPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzc2NjY3OTE5CWZpbGU6c2Fuc3hlbF8wLjEuMTRfeDY0LXNldHVwLmV4ZQpCZTF4clNxWk1ZWXB3MHVDYVRxOExrNmFMWGdjZmdiU2NxcFRSMmRjUGc1Z29vVEJhOWZDM1pTbGxTakdrekJOcDR0OWRLYVF6ZU01UGx3TGl5SWxEZz09Cg==",
  },
};

export async function GET(request: Request) {
  if (!LATEST_VERSION) {
    return new NextResponse(null, { status: 204 });
  }

  const url = new URL(request.url);
  const platform = url.searchParams.get("platform") ?? "";
  const installed = url.searchParams.get("version") ?? "";

  if (installed === LATEST_VERSION) {
    return new NextResponse(null, { status: 204 });
  }

  const artifact = PLATFORMS[platform];
  if (!artifact) {
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
