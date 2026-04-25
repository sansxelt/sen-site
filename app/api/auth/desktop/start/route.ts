import { NextResponse } from "next/server";
import { createDesktopAuthRequest } from "../../../../../lib/desktop-auth";

// Called by the desktop app when the user clicks "Sign in".
// Returns a request_id + the URL the desktop should open in the
// browser. No auth needed — anyone can start a request, but the
// approval step requires a real signed-in browser session.
export async function POST(request: Request) {
  let payload: { device_label?: string } = {};
  try {
    payload = (await request.json()) as { device_label?: string };
  } catch {
    // Body is optional — desktop may post empty.
  }

  try {
    const req = await createDesktopAuthRequest(payload.device_label ?? null);
    const origin = new URL(request.url).origin;
    const approvalUrl = `${origin}/desktop-auth?request_id=${req.request_id}`;

    return NextResponse.json({
      request_id: req.request_id,
      approval_url: approvalUrl,
      expires_at: req.expires_at,
    });
  } catch (error) {
    console.error("desktop/start failed:", error);
    return NextResponse.json(
      { error: "Could not start desktop sign-in." },
      { status: 500 },
    );
  }
}
