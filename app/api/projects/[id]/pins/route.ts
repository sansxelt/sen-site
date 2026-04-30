import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../../lib/desktop-auth";
import { addPin } from "../../../../../lib/projects";

export const runtime = "nodejs";

async function emailFromRequest(request: Request): Promise<string | null> {
  const desktopEmail = await getDesktopUserEmailFromRequest(request);
  if (desktopEmail) return desktopEmail;
  const session = await auth();
  return session?.user?.email ?? null;
}

// POST /api/projects/[id]/pins, append a pin to the project's
// context list. Body: { content, label? }.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
    content?: string;
    kind?: string;
  };
  const content = (body.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "Content required." }, { status: 400 });
  }
  const kind = body.kind === "prompt" ? "prompt" : "context";
  const pin = await addPin({
    email,
    projectId: id,
    label: body.label,
    content,
    kind,
  });
  if (!pin) {
    return NextResponse.json({ error: "Could not add pin." }, { status: 400 });
  }
  return NextResponse.json({ pin }, { status: 200 });
}
