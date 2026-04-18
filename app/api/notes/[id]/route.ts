import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { getNoteById, softDeleteNote, updateNote } from "../../../../lib/notes";

type Params = Promise<{ id: string }>;

// GET /api/notes/:id — fetch a single note (handy for detail views)
export async function GET(request: Request, { params }: { params: Params }) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const note = await getNoteById(email, id);
    if (!note) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ note });
  } catch (err) {
    console.error("notes.get failed:", err);
    return NextResponse.json(
      { error: "Could not load note." },
      { status: 500 },
    );
  }
}

// PATCH /api/notes/:id — update title and/or body
export async function PATCH(request: Request, { params }: { params: Params }) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  let payload: { title?: string; body?: string };
  try {
    payload = (await request.json()) as { title?: string; body?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const note = await updateNote(email, id, payload);
    if (!note) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ note });
  } catch (err) {
    console.error("notes.update failed:", err);
    return NextResponse.json(
      { error: "Could not save note." },
      { status: 500 },
    );
  }
}

// DELETE /api/notes/:id — soft delete (sets deleted_at)
export async function DELETE(request: Request, { params }: { params: Params }) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const ok = await softDeleteNote(email, id);
    if (!ok) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("notes.delete failed:", err);
    return NextResponse.json(
      { error: "Could not delete note." },
      { status: 500 },
    );
  }
}
