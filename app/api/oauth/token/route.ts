// POST /api/oauth/token — trade an authorization code for the access token.
//
// The token is the Vraelis API key minted when the person clicked Allow (see lib/mcp/oauth.ts for why). It
// does not expire on a clock; it ends when the person revokes it in the console, like every other key. So
// there is no refresh token and no expires_in: promising a refresh the server would never need to honour is
// a second mechanism to get wrong.
import { redeemCode, MCP_SCOPE } from "@/lib/mcp/oauth";
import { json, preflight } from "../_cors";

export const runtime = "nodejs";

async function readForm(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    return Object.fromEntries(Object.entries(j ?? {}).map(([k, v]) => [k, String(v)]));
  }
  const text = await req.text().catch(() => "");
  return Object.fromEntries(new URLSearchParams(text));
}

export async function POST(req: Request) {
  const f = await readForm(req);
  if (f.grant_type !== "authorization_code") {
    return json({ error: "unsupported_grant_type", error_description: "Only authorization_code is supported." }, 400);
  }
  if (!f.code || !f.client_id || !f.redirect_uri || !f.code_verifier) {
    return json({ error: "invalid_request", error_description: "code, client_id, redirect_uri and code_verifier are all required." }, 400);
  }
  const r = redeemCode(f.code, { clientId: f.client_id, redirectUri: f.redirect_uri, codeVerifier: f.code_verifier });
  if ("error" in r) return json({ error: r.error, error_description: "The code is invalid, expired, or does not match this client." }, 400);
  return json({ access_token: r.apiKey, token_type: "Bearer", scope: MCP_SCOPE });
}

export const OPTIONS = preflight;
