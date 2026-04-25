import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";

export const runtime = "nodejs";

// GET /api/integrations/github — placeholder connect-state endpoint.
// Real OAuth wiring lands in v0.1.5; this returns a deterministic
// "not connected" payload so the desktop UI can render an actionable
// state without a 404 in the network panel.
export async function GET(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({
    connected: false,
    message: "Connect via /account/integrations",
  });
}
