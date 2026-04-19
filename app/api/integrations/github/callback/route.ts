import { NextResponse } from "next/server";

export const runtime = "nodejs";

// GET /api/integrations/github/callback
// TODO v0.1.5 — exchange `code` for an access token, persist it
// against the user's account from `state` (email), then redirect into
// the desktop app via the sansxel:// deep link. For the v0.1.4
// scaffold we just acknowledge so the OAuth round trip completes.
export async function GET(_request: Request) {
  return NextResponse.json({ connected: true, message: "GitHub connected (stub)." });
}
