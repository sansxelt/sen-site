import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import {
  getPreferencesForEmail,
  savePreferencesForEmail,
} from "../../../../lib/desktop-preferences";

export const runtime = "nodejs";

async function emailFromRequest(request: Request): Promise<string | null> {
  const desktopEmail = await getDesktopUserEmailFromRequest(request);
  if (desktopEmail) return desktopEmail;
  const session = await auth();
  return session?.user?.email ?? null;
}

// GET /api/account/theme → { theme: "light" | "dark" | "system" }
export async function GET(request: Request) {
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ theme: "dark" }, { status: 200 });
  const prefs = await getPreferencesForEmail(email);
  return NextResponse.json(
    { theme: prefs.theme },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

// PUT /api/account/theme  Body: { theme: "light" | "dark" | "system" }
export async function PUT(request: Request) {
  const email = await emailFromRequest(request);
  if (!email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { theme?: string };
  const t = body.theme;
  if (t !== "light" && t !== "dark" && t !== "system") {
    return NextResponse.json({ error: "Invalid theme." }, { status: 400 });
  }
  const next = await savePreferencesForEmail(email, { theme: t });
  return NextResponse.json({ theme: next.theme });
}
