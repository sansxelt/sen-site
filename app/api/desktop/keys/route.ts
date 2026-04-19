import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { listApiKeys } from "../../../../lib/api-keys";

// GET /api/desktop/keys — list active API keys for the desktop user.
// Read-only by design; key creation + revoke happens on the website
// (the desktop links out to /account/keys for those).
export async function GET(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const keys = await listApiKeys(email);
    return NextResponse.json({
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        key_prefix: k.key_prefix,
        created_at: k.created_at,
        last_used_at: k.last_used_at,
      })),
    });
  } catch (err) {
    console.error("desktop/keys failed:", err);
    return NextResponse.json(
      { error: "Could not load keys." },
      { status: 500 },
    );
  }
}
