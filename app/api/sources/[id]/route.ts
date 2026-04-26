import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { deleteSource } from "../../../../lib/chat-sources";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

// DELETE /api/sources/:id, remove an uploaded source.
export async function DELETE(
  request: Request,
  { params }: { params: Params },
) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const ok = await deleteSource(email, id);
    if (!ok) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("sources.delete failed:", err);
    return NextResponse.json(
      { error: "Could not delete source." },
      { status: 500 },
    );
  }
}
