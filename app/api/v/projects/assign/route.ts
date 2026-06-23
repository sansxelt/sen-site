// Move an evaluation into a project (or out of one with projectId=null). The lib
// verifies the user owns both the evaluation and the target project.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { assignTestToProject } from "@/lib/v-projects";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const testId = String(body?.testId || "");
  if (!testId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const projectId = body?.projectId ? String(body.projectId) : null;
  const r = await assignTestToProject(email, testId, projectId);
  return NextResponse.json({ ok: r.ok });
}
