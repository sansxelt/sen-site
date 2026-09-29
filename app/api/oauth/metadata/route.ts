// GET /.well-known/oauth-authorization-server (RFC 8414), rewritten here by proxy.ts.
//
// How an MCP client learns where to send a person to sign in and where to trade the result for a token.
// Public clients only (no client secret): PKCE with S256 is what binds a code to the client that asked.
import { MCP_SCOPE, publicOrigin } from "@/lib/mcp/oauth";
import { json, preflight } from "../_cors";

export const runtime = "nodejs";

export function GET(req: Request) {
  const origin = publicOrigin(req);
  return json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [MCP_SCOPE],
    client_id_metadata_document_supported: true,
    service_documentation: `${origin}/agents`,
  });
}

export const OPTIONS = preflight;
