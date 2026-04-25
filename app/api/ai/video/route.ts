import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";

export const runtime = "nodejs";

// POST /api/ai/video — STUB.
//
// Placeholder for video generation. We expose the route + UI button so
// the LEI surface looks complete, but the actual generator is gated.
// Returns 501 with a friendly message the client renders as
// "coming soon." When we wire a real provider (Pika / Runway / etc.)
// this is the seam to swap.
export async function POST(request: Request) {
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: "Video generation is in private beta — joining the waitlist?",
      coming_soon: true,
      eta: "v0.2.0",
    },
    { status: 501 },
  );
}
