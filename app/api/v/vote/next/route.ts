import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile, nextTestForVoter } from "@/lib/v-db";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  await ensureProfile(email, session.user?.name ?? undefined);
  const next = await nextTestForVoter(email);
  if (!next) return NextResponse.json({ test: null });
  const { test, options } = next;
  // Don't leak the owner to voters.
  return NextResponse.json({
    test: { id: test.id, title: test.title, context: test.context, category: test.category },
    options: options.map((o) => ({ id: o.id, position: o.position, asset_url: o.asset_url, label: o.label })),
  });
}
