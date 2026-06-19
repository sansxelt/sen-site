// POST /api/flip/generate — the core endpoint. Auth/limit check FIRST, then the
// Claude vision call, then record the item + decrement free credits.
//   - anon (no login): 1 free, tracked by an httpOnly cookie + flip_items count.
//   - signed in (Google): 3 free total, tracked by flip_accounts.free_used.
//   - plan 'pro': unlimited.
// Over the limit AND not pro → 402 (anon → sign in, signed-in → upgrade).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { generateListing } from "@/lib/flip-ai";
import {
  getOrCreateFlipAccount,
  incrementFreeUsed,
  countAnonItems,
  insertFlipItem,
  FLIP_FREE_SIGNED_IN,
  FLIP_FREE_ANON,
} from "@/lib/flip-db";

export const runtime = "nodejs"; // service-role Supabase + the Anthropic SDK
export const maxDuration = 60; // a vision listing takes ~10-20s; default ~10s 502s. Matches the vraelis AI routes.

const OK_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ANON_COOKIE = "flip_anon";
const ANON_MAXAGE = 60 * 60 * 24 * 365;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  }

  let body: { images?: { media_type: string; data: string }[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const images = (body.images ?? [])
    .filter((i) => i && typeof i.data === "string" && OK_MEDIA.has(i.media_type))
    .slice(0, 5);
  if (images.length === 0) {
    return NextResponse.json({ error: "no_images" }, { status: 400 });
  }

  const session = await auth();
  const email = session?.user?.email ?? null;
  const jar = await cookies();

  // ── Limit check FIRST (before spending an AI call) ────────────────────
  let setAnonCookie: string | null = null;
  if (email) {
    const account = await getOrCreateFlipAccount(email);
    const plan = account?.plan ?? "free";
    const used = account?.free_used ?? 0;
    if (plan !== "pro" && used >= FLIP_FREE_SIGNED_IN) {
      return NextResponse.json(
        { error: "limit", reason: "upgrade", used, limit: FLIP_FREE_SIGNED_IN },
        { status: 402 },
      );
    }
  } else {
    let anonId = jar.get(ANON_COOKIE)?.value ?? "";
    if (!anonId) {
      anonId = "anon_" + randomUUID().replace(/-/g, "");
      setAnonCookie = anonId;
    }
    const used = await countAnonItems(anonId);
    if (used >= FLIP_FREE_ANON) {
      const res = NextResponse.json(
        { error: "limit", reason: "signin", used, limit: FLIP_FREE_ANON },
        { status: 402 },
      );
      if (setAnonCookie) {
        res.cookies.set(ANON_COOKIE, setAnonCookie, { httpOnly: true, sameSite: "lax", maxAge: ANON_MAXAGE, path: "/" });
      }
      return res;
    }
  }

  // ── Generate the listing ──────────────────────────────────────────────
  let listing;
  try {
    listing = await generateListing(images);
  } catch (e) {
    console.error("[flip generate] AI failed:", e);
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }

  // ── Record the item + decrement the free quota ────────────────────────
  const anonId = email ? null : jar.get(ANON_COOKIE)?.value ?? setAnonCookie ?? null;
  await insertFlipItem({ userId: email, anonId, listing });
  if (email) await incrementFreeUsed(email);

  // Credits remaining (null = unlimited / pro).
  let creditsLeft: number | null = null;
  if (email) {
    const acct = await getOrCreateFlipAccount(email);
    creditsLeft = acct?.plan === "pro" ? null : Math.max(0, FLIP_FREE_SIGNED_IN - (acct?.free_used ?? 0));
  } else {
    const used = await countAnonItems(anonId ?? "");
    creditsLeft = Math.max(0, FLIP_FREE_ANON - used);
  }

  const res = NextResponse.json({ listing, creditsLeft, signedIn: Boolean(email) });
  if (setAnonCookie) {
    res.cookies.set(ANON_COOKIE, setAnonCookie, { httpOnly: true, sameSite: "lax", maxAge: ANON_MAXAGE, path: "/" });
  }
  return res;
}
