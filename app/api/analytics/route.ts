import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdminClient, isDatabaseConfigured } from "@/lib/supabase-admin";

// POST /api/analytics — body: { name, session_id?, path?, props? }
//
// Lightweight server-side event log for the marketing site. No PII
// validation beyond payload size caps. Fire-and-forget from the
// client; the response is always 200 unless DB is unconfigured (in
// which case we 204 to avoid client-side error logs spamming).

type Payload = {
  name?: string;
  session_id?: string;
  path?: string;
  props?: Record<string, unknown>;
};

export async function POST(req: Request) {
  if (!isDatabaseConfigured()) {
    // Don't error out on the client; just no-op.
    return new NextResponse(null, { status: 204 });
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const name = (body.name ?? "").trim().slice(0, 100);
  const path = body.path?.trim().slice(0, 500) ?? null;
  const session_id = body.session_id?.trim().slice(0, 64) ?? null;
  const props = body.props ?? null;

  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase() ?? null;

  const sb = getSupabaseAdminClient();
  const { error } = await sb
    .from("analytics_events")
    // @ts-expect-error generic schema
    .insert({ name, session_id, path, props, user_email: userEmail });

  if (error) {
    // Still respond 204 so client never throws on landing-page traffic.
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ ok: true });
}
