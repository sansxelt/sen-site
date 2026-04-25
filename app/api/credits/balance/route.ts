import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { getCreditBalance } from "../../../../lib/credits";

export const runtime = "nodejs";

// GET /api/credits/balance → { balance: number }
//
// Lightweight read so the LEI input chip can show "you have N credits"
// without going through the heavier billing-state endpoint. Falls open
// to 0 on any failure (matches credits.ts policy).
export async function GET(request: Request) {
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ balance: 0 }, { status: 200 });
  }
  const balance = await getCreditBalance(email);
  return NextResponse.json(
    { balance },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
