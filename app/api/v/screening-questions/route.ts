// Owner-managed screening questions for an evaluation. GET ?testId lists; POST
// creates (max 3, multiple-choice). Ownership enforced in the lib.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createScreeningQuestion, listScreeningQuestions } from "@/lib/v-screening";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ questions: [] });
  const testId = new URL(req.url).searchParams.get("testId") || "";
  if (!testId) return NextResponse.json({ questions: [] });
  return NextResponse.json({ questions: await listScreeningQuestions(email, testId) });
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await createScreeningQuestion(email, String(body?.testId || ""), String(body?.question || ""), body?.options, body?.qualifying, body?.isRequired !== false);
  if (!r.ok) return NextResponse.json({ error: "create_failed" }, { status: 400 });
  return NextResponse.json({ ok: true, id: r.id });
}
