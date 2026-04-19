import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { createApiKey, listApiKeys } from "../../../../lib/api-keys";

// GET /api/desktop/keys — list active API keys for the desktop user.
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
    console.error("desktop/keys.get failed:", err);
    return NextResponse.json(
      { error: "Could not load keys." },
      { status: 500 },
    );
  }
}

type CreateKeyPayload = {
  name?: string;
};

// POST /api/desktop/keys — create a new key. Returns the plaintext
// `rawKey` ONCE (only chance to copy it). Mirrors /api/account/keys
// POST so the same lib/api-keys helper handles hashing + storage.
export async function POST(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: CreateKeyPayload;
  try {
    payload = (await request.json()) as CreateKeyPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = (payload.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Key name is required." }, { status: 400 });
  }
  if (name.length > 64) {
    return NextResponse.json(
      { error: "Key name must be 64 characters or fewer." },
      { status: 400 },
    );
  }

  try {
    const { record, rawKey } = await createApiKey(email, name);
    return NextResponse.json({
      key: {
        id: record.id,
        name: record.name,
        key_prefix: record.key_prefix,
        created_at: record.created_at,
        last_used_at: record.last_used_at,
      },
      rawKey,
    });
  } catch (err) {
    console.error("desktop/keys.post failed:", err);
    return NextResponse.json(
      { error: "Could not create API key. Please try again." },
      { status: 500 },
    );
  }
}
