import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../lib/desktop-auth";
import { createNote, listNotesForEmail } from "../../../lib/notes";

// GET /api/notes — list the signed-in user's notes (newest first)
export async function GET(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const notes = await listNotesForEmail(email);
    return NextResponse.json({ notes });
  } catch (err) {
    console.error("notes.list failed:", err);
    return NextResponse.json(
      { error: "Could not load notes." },
      { status: 500 },
    );
  }
}

// POST /api/notes — create a fresh note
export async function POST(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: { title?: string; body?: string } = {};
  try {
    payload = (await request.json()) as { title?: string; body?: string };
  } catch {
    // Body optional; create an empty note.
  }

  try {
    const note = await createNote(
      email,
      payload.title ?? "Untitled",
      payload.body ?? "",
    );
    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    console.error("notes.create failed:", err);
    return NextResponse.json(
      { error: "Could not create note." },
      { status: 500 },
    );
  }
}
