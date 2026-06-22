import { verifyApiKey } from "@/lib/v-api-keys";
import { getPlan } from "@/lib/v-db";
import { apiAccessAllowed } from "@/lib/v-entitlements";
import { logEvent } from "@/lib/v-events";

// Coarse endpoint group from the path — never the full (possibly id-bearing) URL.
function endpointGroup(url: string): string {
  try {
    const p = new URL(url).pathname;
    if (p.includes("/export")) return "tests.export";
    if (/\/api\/v1\/tests\/[^/]+$/.test(p)) return "tests.get";
    if (p.endsWith("/api/v1/tests")) return "tests.create";
    if (p.includes("/api/v1/credits")) return "credits";
    return "other";
  } catch { return "other"; }
}

// Reads the API key from `X-Api-Key` or `Authorization: Bearer ...`, then
// re-checks plan entitlement so a key minted on Scale stops working after a
// downgrade (defense-in-depth beyond the mint-time gate in /api/v/keys).
export async function apiAuth(req: Request): Promise<{ userId: string; scopes: string[] } | null> {
  const key = req.headers.get("x-api-key") || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!key) return null;
  const v = await verifyApiKey(key);
  if (!v) return null;
  if (!apiAccessAllowed(await getPlan(v.userId), v.userId)) return null;
  // API usage analytics — coarse group + method only, never the key or full URL.
  await logEvent({ userId: v.userId, eventType: "api_request_made", actorType: "api", source: "api", route: endpointGroup(req.url), metadata: { method: req.method, endpoint: endpointGroup(req.url) } });
  return v;
}
