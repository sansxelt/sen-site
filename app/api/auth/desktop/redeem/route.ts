import { NextResponse } from "next/server";
import {
  createDesktopSession,
  generateSessionToken,
  getDesktopAuthRequest,
  isRequestUsable,
  markRequestRedeemed,
} from "../../../../../lib/desktop-auth";

// Called by the desktop app once it receives the deep-link callback.
// Trades the approved request_id for a long-lived session token. We
// only ever return the raw token at this single moment, after this,
// the desktop must keep it safe (Windows Credential Manager / store
// plugin). The request can only be redeemed once.
export async function POST(request: Request) {
  let payload: { request_id?: string };
  try {
    payload = (await request.json()) as { request_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!payload.request_id) {
    return NextResponse.json(
      { error: "Missing request_id." },
      { status: 400 },
    );
  }

  try {
    const req = await getDesktopAuthRequest(payload.request_id);
    if (!req) {
      return NextResponse.json(
        { error: "Request not found." },
        { status: 404 },
      );
    }
    if (!isRequestUsable(req)) {
      return NextResponse.json(
        { error: "Request expired or already used." },
        { status: 410 },
      );
    }
    if (req.status !== "approved" || !req.email) {
      return NextResponse.json(
        { error: "Request not approved yet." },
        { status: 409 },
      );
    }

    const { token, hash } = generateSessionToken();
    await createDesktopSession(req.email, hash, req.device_label);
    await markRequestRedeemed(payload.request_id);

    return NextResponse.json({
      token,
      email: req.email,
    });
  } catch (error) {
    console.error("desktop/redeem failed:", error);
    return NextResponse.json(
      { error: "Could not redeem sign-in." },
      { status: 500 },
    );
  }
}
