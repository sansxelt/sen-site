// Projects for the signed-in user. GET lists their projects (with eval counts);
// POST creates one. Session-scoped — never returns another user's projects.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createProject, listProjects } from "@/lib/v-projects";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ projects: [] });
  return NextResponse.json({ projects: await listProjects(email) });
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  const r = await createProject(email, name, String(body?.description || ""));
  if (!r.ok) return NextResponse.json({ error: "create_failed" }, { status: 503 });
  return NextResponse.json({ ok: true, id: r.id });
}
