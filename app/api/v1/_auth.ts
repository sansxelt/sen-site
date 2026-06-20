import { verifyApiKey } from "@/lib/v-api-keys";

// Reads the API key from `X-Api-Key` or `Authorization: Bearer ...`.
export async function apiAuth(req: Request): Promise<{ userId: string; scopes: string[] } | null> {
  const key = req.headers.get("x-api-key") || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!key) return null;
  return verifyApiKey(key);
}
