import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import {
  approveDesktopAuthRequest,
  getDesktopAuthRequest,
  isRequestUsable,
} from "../../../../../lib/desktop-auth";

// Called from the /desktop-auth page when the signed-in user clicks
// "Approve". Requires a real browser session, that's the entire
// point of this step. The approval binds the desktop request to the
// user's email so the desktop can redeem it next.
export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

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
    if (req.status !== "pending") {
      return NextResponse.json(
        { error: "Request already approved." },
        { status: 409 },
      );
    }

    await approveDesktopAuthRequest(payload.request_id, email);

    return NextResponse.json({
      ok: true,
      // Desktop deep-link the browser will redirect to next
      callback: `vraelis://auth?request_id=${payload.request_id}`,
    });
  } catch (error) {
    console.error("desktop/approve failed:", error);
    return NextResponse.json(
      { error: "Could not approve sign-in." },
      { status: 500 },
    );
  }
}
