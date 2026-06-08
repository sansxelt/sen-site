import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { deleteGithubIntegration } from "../../../../../lib/github";

export const runtime = "nodejs";

// POST /api/integrations/github/disconnect
// Removes the user's stored GitHub access token. Doesn't revoke the
// token on GitHub's side (that needs the OAuth app to call DELETE
// /applications/{client_id}/grant, separate flow). Removing the row
// here is enough to break the connection from Vraelis's side; the
// user can re-authorize at any time.
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  try {
    await deleteGithubIntegration(session.user.email.toLowerCase());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[github disconnect] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not disconnect." },
      { status: 500 },
    );
  }
}
