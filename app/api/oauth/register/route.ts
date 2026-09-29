// POST /api/oauth/register — dynamic client registration (RFC 7591) for MCP connectors.
//
// Public clients only: no secret is issued, because a connector's secret would sit in someone else's
// infrastructure and PKCE already binds each code to the client that asked for it. The client_id that comes
// back is the registration itself, signed (lib/mcp/oauth.ts), so nothing is written anywhere.
import { registerClient } from "@/lib/mcp/oauth";
import { json, preflight } from "../_cors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { redirect_uris?: unknown; client_name?: unknown; token_endpoint_auth_method?: unknown } | null;
  if (!body || typeof body !== "object") return json({ error: "invalid_client_metadata", error_description: "Send the client metadata as JSON." }, 400);
  if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== "none") {
    return json({ error: "invalid_client_metadata", error_description: "Only public clients (token_endpoint_auth_method none, with PKCE) are supported." }, 400);
  }
  const r = registerClient(body);
  if ("error" in r) return json({ error: "invalid_redirect_uri", error_description: "Every redirect URI must be https, or http on localhost." }, 400);
  return json({
    client_id: r.clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: r.name,
    redirect_uris: r.redirectUris,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  }, 201);
}

export const OPTIONS = preflight;
