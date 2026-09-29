// GET /.well-known/oauth-protected-resource (RFC 9728), rewritten here by proxy.ts.
//
// The first thing an MCP client reads after /mcp answers 401: which authorization server issues tokens for
// this resource. It is this same origin.
import { MCP_SCOPE, mcpResourceUrl, publicOrigin } from "@/lib/mcp/oauth";
import { json, preflight } from "../_cors";

export const runtime = "nodejs";

export function GET(req: Request) {
  const origin = publicOrigin(req);
  return json({
    resource: mcpResourceUrl(origin),
    authorization_servers: [origin],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "Vraelis",
    resource_documentation: `${origin}/agents`,
  });
}

export const OPTIONS = preflight;
