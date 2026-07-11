import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdminClient, isDatabaseConfigured } from "@/lib/supabase-admin";

// POST /api/waitlist — body: { email, product, source? }
//
// product is one of workshop | whisper | lens | lens-day-kit | platform.
// Idempotent on (email, product) via the unique constraint, so a
// re-submit returns success without duplicating.

const PRODUCTS = ["workshop", "whisper", "lens", "lens-day-kit", "platform"] as const;
type Product = typeof PRODUCTS[number];

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Payload = {
  email?: string;
  product?: string;
  source?: string;
};

export async function POST(req: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Waitlist temporarily unavailable. Try again shortly." },
      { status: 503 },
    );
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const product = (body.product ?? "").trim().toLowerCase() as Product;
  const source  = (body.source ?? "").trim().slice(0, 80) || null;

  if (!emailRe.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!PRODUCTS.includes(product)) {
    return NextResponse.json({ error: "Unknown product." }, { status: 400 });
  }

  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase() ?? null;

  const sb = getSupabaseAdminClient();

  // Upsert pattern: try insert, treat unique-violation as success.
  const { error } = await sb
    .from("waitlist")
    .upsert(
      {
        email,
        product,
        source,
        user_email: userEmail,
      } as never, // generic (untyped) schema table
      { onConflict: "email,product", ignoreDuplicates: true },
    );

  if (error) {
    return NextResponse.json(
      { error: "Could not save. Try again." },
      { status: 500 },
    );
  }

  // Fire-and-forget analytics event
  try {
    await sb
      .from("analytics_events")
      .insert({
        name: "waitlist_joined",
        path: source,
        props: { product },
        user_email: userEmail,
      } as never); // generic (untyped) schema table
  } catch {
    // analytics insert is best-effort, never block the response
  }

  return NextResponse.json({ ok: true });
}
