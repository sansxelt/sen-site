// POST /api/oauth/authorize — the person's decision on the consent screen (/oauth/consent).
//
// Allow mints a Vraelis API key for the signed-in person, named after the connector, with only the scopes
// the MCP tools need: preview a plan, start a verification, read results. It cannot approve plans (no key
// can) and it cannot read or change billing. The key travels to the connector only inside the encrypted,
// PKCE-bound authorization code.
//
// The request being answered comes from the signed token the consent page rendered, never from loose form
// fields, so a forged form cannot swap the redirect address or the client.
import { auth } from "@/auth";
import { generateApiKey } from "@/lib/v-api-keys";
import { unpackAuthRequest, resolveClient, issueCode, redirectBack, publicOrigin, consentProofValid } from "@/lib/mcp/oauth";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";

const SCOPES = ["preflight:preview", "preflight:run:read", "preflight:run:create"];

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("req") ?? "");
  const decision = String(form?.get("decision") ?? "");
  const r = unpackAuthRequest(token);
  if (!r) return new Response("This sign-in request expired. Start the connection again from the app you were connecting.", { status: 400 });

  const client = await resolveClient(r.clientId);
  if (!client || !client.redirectUris.includes(r.redirectUri)) return new Response("Unknown client.", { status: 400 });

  const email = (await auth())?.user?.email;
  if (!email) return Response.redirect(new URL(`/signin?callbackUrl=${encodeURIComponent(`/oauth/consent?req=${token}`)}`, req.url), 303);

  // The decision must come from the consent page THIS person was shown for THIS request (see
  // consentProof). Checked before either branch, so a forged Cancel cannot bounce anyone either.
  if (!consentProofValid(email, token, String(form?.get("proof") ?? ""))) {
    return new Response("This approval did not come from your Vraelis consent screen. Start the connection again from the app you were connecting.", { status: 403 });
  }

  if (decision !== "allow") {
    return Response.redirect(redirectBack(r.redirectUri, { error: "access_denied", state: r.state }), 303);
  }

  const key = await generateApiKey(email, `${client.name} connector`.slice(0, 40), SCOPES);
  if (!key) return Response.redirect(redirectBack(r.redirectUri, { error: "server_error", error_description: "Could not create the connection. Try again.", state: r.state }), 303);
  await logEvent({ userId: email.toLowerCase(), eventType: "mcp_connector_authorized", actorType: "owner", source: "app", metadata: { client: client.name, prefix: key.prefix, redirect_host: new URL(r.redirectUri).host } });

  const code = issueCode({ apiKey: key.key, clientId: r.clientId, redirectUri: r.redirectUri, codeChallenge: r.codeChallenge });
  return Response.redirect(redirectBack(r.redirectUri, { code, state: r.state, iss: publicOrigin(req) }), 303);
}
