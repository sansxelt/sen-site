import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type EarlyAccessPayload = {
  email?: string;
  focusArea?: string;
  name?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      {
        error:
          "Early access requests are temporarily unavailable. Please try again shortly.",
      },
      { status: 503 },
    );
  }

  let payload: EarlyAccessPayload;

  try {
    payload = (await request.json()) as EarlyAccessPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = payload.email?.trim().toLowerCase() ?? "";
  const name = payload.name?.trim() ?? "";
  const focusArea = payload.focusArea?.trim() ?? "";

  if (!emailPattern.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { error } = await supabase.from("early_access_signups").upsert(
    [
      {
        email,
        focus_area: focusArea || null,
        name: name || null,
        source: "website",
      },
    ],
    { onConflict: "email" },
  );

  if (error) {
    console.error("Early access save failed:", error);

    return NextResponse.json(
      {
        error:
          "We couldn't save your request right now. Please try again or contact hello@sansxel.app.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
  });
}
