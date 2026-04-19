import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import {
  type DesktopPreferences,
  getPreferencesForEmail,
  savePreferencesForEmail,
} from "../../../../lib/desktop-preferences";

export async function GET(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const prefs = await getPreferencesForEmail(email);
    return NextResponse.json({ prefs });
  } catch (err) {
    console.error("desktop/preferences.get failed:", err);
    return NextResponse.json(
      { error: "Could not load preferences." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  let payload: Partial<DesktopPreferences>;
  try {
    payload = (await request.json()) as Partial<DesktopPreferences>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  try {
    const prefs = await savePreferencesForEmail(email, payload);
    return NextResponse.json({ prefs });
  } catch (err) {
    console.error("desktop/preferences.patch failed:", err);
    return NextResponse.json(
      { error: "Could not save preferences." },
      { status: 500 },
    );
  }
}
