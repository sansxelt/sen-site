// GET /api/v1/credits — credit balance for the key's account. Auth: API key.

import { NextResponse } from "next/server";
import { apiAuth } from "../_auth";
import { balance } from "@/lib/v-credits";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await apiAuth(req);
  if (!auth) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  return NextResponse.json({ balance: await balance(auth.userId) });
}
