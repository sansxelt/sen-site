// GET /oauth/authorize — where ChatGPT, claude.ai or another MCP connector sends a person to connect Vraelis.
//
// A ROUTE, NOT A PAGE, so every answer is a real HTTP redirect. As a page it had to call redirect() after the
// sign-in layout had started streaming, and Next can then only redirect with a meta refresh inside a 200:
// fine for a person, wrong for an OAuth client that reads the status line.
//
// It validates the request (lib/mcp/oauth.ts), packs it into one signed token, and sends the browser on:
//   - bad client or unregistered redirect_uri: to /oauth/consent?problem=..., NEVER to the redirect_uri,
//     because an unverified address is exactly where an error must not be sent;
//   - any other invalid request: back to the client with error=... and its state (RFC 6749 4.1.2.1);
//   - not signed in: to /signin, which returns to the consent screen afterwards;
//   - signed in: to the consent screen.
// /signin only returns to a plain path and every redirect_uri is full of encoded slashes, which is why the
// token exists: base64url survives the round trip untouched.
import { auth } from "@/auth";
import { parseAuthorizeQuery, packAuthRequest, redirectBack } from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const go = (req: Request, to: string) => Response.redirect(new URL(to, req.url), 302);

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const parsed = await parseAuthorizeQuery(q);
  if ("error" in parsed) {
    if (parsed.redirectable) {
      return Response.redirect(redirectBack(q.get("redirect_uri") as string, { error: parsed.error, error_description: parsed.description, state: q.get("state") }), 302);
    }
    return go(req, `/oauth/consent?problem=${encodeURIComponent(parsed.error)}`);
  }
  const consent = `/oauth/consent?req=${packAuthRequest(parsed.req)}`;
  const email = (await auth())?.user?.email;
  if (!email) return go(req, `/signin?callbackUrl=${encodeURIComponent(consent)}`);
  return go(req, consent);
}
