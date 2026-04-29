import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../lib/desktop-auth";
import {
  createProject,
  listProjectsForOwner,
} from "../../../lib/projects";

export const runtime = "nodejs";

async function emailFromRequest(request: Request): Promise<string | null> {
  const desktopEmail = await getDesktopUserEmailFromRequest(request);
  if (desktopEmail) return desktopEmail;
  const session = await auth();
  return session?.user?.email ?? null;
}

// GET /api/projects, list the caller's projects newest-first.
export async function GET(request: Request) {
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ projects: [] }, { status: 401 });
  const projects = await listProjectsForOwner(email);
  return NextResponse.json(
    { projects },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

// POST /api/projects, create. Body: { name, description?, goals? }.
export async function POST(request: Request) {
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    goals?: string;
  };
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  const project = await createProject({
    email,
    name,
    description: body.description,
    goals: body.goals,
  });
  if (!project) {
    return NextResponse.json({ error: "Could not create project." }, { status: 500 });
  }
  return NextResponse.json({ project }, { status: 200 });
}
