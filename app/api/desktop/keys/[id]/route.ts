import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../../lib/desktop-auth";
import { revokeApiKey } from "../../../../../lib/api-keys";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// DELETE /api/desktop/keys/[id], revoke a key the desktop user owns.
// Mirrors /api/account/keys/[id] DELETE; ownership is enforced inside
// revokeApiKey via the email guard.
export async function DELETE(request: Request, context: RouteContext) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Key ID is required." }, { status: 400 });
  }

  try {
    await revokeApiKey(id, email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("desktop/keys.delete failed:", err);
    return NextResponse.json(
      { error: "Could not revoke API key. Please try again." },
      { status: 500 },
    );
  }
}
