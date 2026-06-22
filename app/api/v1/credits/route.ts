// GET /api/v1/credits — credit balance for the key's account. Auth: API key.

import { apiAuth } from "../_auth";
import { balance } from "@/lib/v-credits";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await apiAuth(req, "credits:read");
  if (!a.ok) return a.response;
  return Response.json({ balance: await balance(a.userId) });
}
