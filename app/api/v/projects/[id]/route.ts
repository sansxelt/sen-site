// A single project (owner only). GET returns the project + its stats and
// evaluations; PATCH updates name/description. Ownership enforced in the lib —
// a project that isn't yours returns 404 / no-op.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProject, updateProject, projectStats } from "@/lib/v-projects";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const project = await getProject(email, id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ project, stats: await projectStats(email, id) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await updateProject(email, id, { name: body?.name, description: body?.description });
  return NextResponse.json({ ok: r.ok });
}
