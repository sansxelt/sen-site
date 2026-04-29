import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import {
  deleteProject,
  getProjectWithPins,
  updateProject,
} from "../../../../lib/projects";

export const runtime = "nodejs";

async function emailFromRequest(request: Request): Promise<string | null> {
  const desktopEmail = await getDesktopUserEmailFromRequest(request);
  if (desktopEmail) return desktopEmail;
  const session = await auth();
  return session?.user?.email ?? null;
}

// GET /api/projects/[id], project + pinned items in one payload so
// the side panel can render without a second round-trip.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const project = await getProjectWithPins(email, id);
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(
    { project },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

// PATCH /api/projects/[id], rename or edit description / goals.
// Body: { name?, description?, goals? }. Pass null to clear.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    description?: string | null;
    goals?: string | null;
  };
  const project = await updateProject({
    email,
    projectId: id,
    patch: {
      name: body.name,
      description: body.description,
      goals: body.goals,
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Update failed." }, { status: 400 });
  }
  return NextResponse.json({ project }, { status: 200 });
}

// DELETE /api/projects/[id], hard delete + cascades pinned items.
// Threads with this project_id get their FK set to null (kept).
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const ok = await deleteProject({ email, projectId: id });
  if (!ok) return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
