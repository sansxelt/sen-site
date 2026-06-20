import { verifyApiKey } from "@/lib/v-api-keys";
import { getPlan } from "@/lib/v-db";
import { apiAccessAllowed } from "@/lib/v-entitlements";

// Reads the API key from `X-Api-Key` or `Authorization: Bearer ...`, then
// re-checks plan entitlement so a key minted on Scale stops working after a
// downgrade (defense-in-depth beyond the mint-time gate in /api/v/keys).
export async function apiAuth(req: Request): Promise<{ userId: string; scopes: string[] } | null> {
  const key = req.headers.get("x-api-key") || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!key) return null;
  const v = await verifyApiKey(key);
  if (!v) return null;
  if (!apiAccessAllowed(await getPlan(v.userId), v.userId)) return null;
  return v;
}
