import OpenAI from "openai";
import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../../lib/desktop-auth";

export const runtime = "nodejs";

const client = new OpenAI();

// POST /api/ai/voice/transcribe
// multipart/form-data with field "audio" (any audio file the browser
// or Tauri can produce — webm, mp4, wav, m4a). Returns { text }.
export async function POST(request: Request) {
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "Missing audio." }, { status: 400 });
  }

  // OpenAI SDK accepts a File-like object. The Blob alone doesn't
  // carry a name/type the API expects, so wrap it.
  const file = new File([audio], "audio.webm", {
    type: audio.type || "audio/webm",
  });

  try {
    const result = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    return NextResponse.json({ text: result.text });
  } catch (err) {
    console.error("voice/transcribe failed:", err);
    return NextResponse.json(
      { error: "Could not transcribe." },
      { status: 500 },
    );
  }
}
