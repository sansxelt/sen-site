// GET /api/v/keys/[id]/usage — what one API key has cost, for the person who owns it.
//
// Session-gated and owner-scoped twice over: the key must appear in THIS caller's key list before anything
// is read, and the run query filters on user_id as well as api_key_id. A key id guessed or leaked from
// another tenant returns nothing rather than someone else's spend.
//
// Reads only. Nothing here can create, revoke or re-price anything.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listApiKeys } from "@/lib/v-api-keys";
import { keyUsage } from "@/lib/preflight/key-usage";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });

  const { id } = await ctx.params;
  const owner = email.toLowerCase();

  // Ownership is established from the caller's own key list, not from the id in the URL.
  const keys = await listApiKeys(owner);
  const key = keys.find((k) => k.id === id);
  if (!key) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const usage = await keyUsage(owner, {
    id: key.id,
    prefix: key.prefix,
    dailyCeilingCents: key.daily_ceiling_cents ?? null,
  });
  if (!usage) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  return NextResponse.json({
    key: { id: key.id, prefix: key.prefix, name: key.name ?? null, createdAt: key.created_at, lastUsed: key.last_used },
    usage,
  });
}
