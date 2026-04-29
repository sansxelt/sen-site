import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { deletePin, updatePin } from "../../../../lib/projects";

export const runtime = "nodejs";

async function emailFromRequest(request: Request): Promise<string | null> {
  const desktopEmail = await getDesktopUserEmailFromRequest(request);
  if (desktopEmail) return desktopEmail;
  const session = await auth();
  return session?.user?.email ?? null;
}

// PATCH /api/pins/[id], edit a pinned item in place. Body:
// { label?, content? }. Pass label=null to clear the label.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    label?: string | null;
    content?: string;
  };
  const pin = await updatePin({
    email,
    pinId: id,
    patch: { label: body.label, content: body.content },
  });
  if (!pin) {
    return NextResponse.json({ error: "Update failed." }, { status: 400 });
  }
  return NextResponse.json({ pin }, { status: 200 });
}

// DELETE /api/pins/[id], remove a pin.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const ok = await deletePin({ email, pinId: id });
  if (!ok) return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
