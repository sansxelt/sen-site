// GET /api/v/keys/spend — everything this owner's API keys have ever cost, split by whether the key survives.
//
// Separate from /api/v/keys because that list is a hot path opened to copy a prefix, and this is a scan of
// every key-launched run. Separate from the per-key detail because a per-key view cannot, by construction,
// account for a key that has been revoked: revokeApiKey deletes the row, and the detail view establishes
// ownership from the caller's live key list.
//
// That gap was not small. In production, 9 of 10 key-launched runs, $120 of $135, belonged to keys since
// revoked. Adding up the per-key panels gave $15 against a $135 bill. Losing "which key" after revocation
// is reasonable; losing "does this add up" is not.
//
// Reads only. Owner-scoped in the query, not merely in the URL.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listApiKeys } from "@/lib/v-api-keys";
import { keySpendSummary } from "@/lib/preflight/key-usage";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });

  const owner = email.toLowerCase();
  const keys = await listApiKeys(owner);
  const summary = await keySpendSummary(owner, keys.map((k) => k.id));
  if (!summary) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  return NextResponse.json({ summary });
}
