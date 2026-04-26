import { NextResponse } from "next/server";
import {
  desktopCurrentCodeVersion,
  desktopLatestShippedVersion,
  desktopNextVersion,
  desktopNextVersionHighlights,
  desktopShippedReleases,
} from "@/lib/desktop-release";

// v0.1.13, Desktop Updates view used to ship a hardcoded changelog
// in updates-view.tsx that stayed at v0.1.4 forever. Now it fetches
// from this endpoint so both web and desktop read from the single
// source of truth in lib/desktop-release.ts. Unauthenticated;
// release notes are public information.
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    currentCodeVersion: desktopCurrentCodeVersion,
    latestShippedVersion: desktopLatestShippedVersion,
    nextVersion: desktopNextVersion,
    nextVersionHighlights: desktopNextVersionHighlights,
    releases: desktopShippedReleases,
  });
}
