// The OAuth and MCP endpoints are called by other companies' servers (ChatGPT, claude.ai) and, for local
// debugging, from a browser (MCP Inspector). None of them carries a Vraelis cookie, so allowing any origin
// grants nothing: every one of these endpoints authenticates by what is in the request, never by ambient
// credentials.
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id, x-api-key",
  "Access-Control-Expose-Headers": "www-authenticate, mcp-session-id",
  "Access-Control-Max-Age": "86400",
};

export const preflight = () => new Response(null, { status: 204, headers: CORS_HEADERS });

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...CORS_HEADERS, "cache-control": "no-store", ...extra } });
}
