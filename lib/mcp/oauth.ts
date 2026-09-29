// OAuth for the hosted MCP server, so ChatGPT and claude.ai connectors can sign in as a Vraelis user.
//
// WHY THIS IS SMALL. The access token a connector receives IS a Vraelis API key, minted when the person
// clicks Allow and named after the connector ("ChatGPT"). So there is no second credential system: the
// key shows up in the console's key list, revoking it there disconnects the connector, every per-key spend
// ceiling and scope applies, and the /v1 routes the MCP tools call authenticate it the way they
// authenticate any key. A key cannot approve a plan (the approve route refuses every key), so a connector
// can start checks and read results and never sign off on one.
//
// WHY NOTHING IS STORED. Clients register dynamically (RFC 7591) or by Client ID Metadata Document, and
// both are answered without a table:
//   - a dynamically registered client_id is its own registration, signed: "vrc_" + the redirect URIs and
//     name + an HMAC. Tampering with either breaks the signature.
//   - a metadata-document client_id is an https URL, fetched (SSRF-guarded) when it is used.
// The authorization code carries the minted key ENCRYPTED (AES-256-GCM), bound to the client, the redirect
// URI and the PKCE challenge, and dies after five minutes. Replaying a code inside that window needs the
// PKCE verifier and returns the SAME key, so it cannot mint a second one or reach anyone new.
//
// The secret is derived from AUTH_SECRET, which the session layer already requires in every environment.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { safeFetch } from "@/lib/safe-fetch";

export const MCP_SCOPE = "vraelis:verify";
const CODE_TTL_MS = 5 * 60 * 1000;
const AUTH_REQUEST_TTL_MS = 30 * 60 * 1000;

function secret(purpose: string): Buffer {
  const base = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (!base) throw new Error("AUTH_SECRET is not set; the MCP OAuth server cannot sign anything.");
  return createHash("sha256").update(`vraelis-mcp-oauth:${purpose}:${base}`).digest();
}

export const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");
const unb64url = (s: string) => Buffer.from(s, "base64url");

function hmac(purpose: string, data: string): string {
  return createHmac("sha256", secret(purpose)).update(data).digest("base64url");
}
function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The public origin a request arrived on, which is also this server's issuer and resource origin. */
export function publicOrigin(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  // The console subdomain is a second door to the same server. One issuer, the brand host, so a token
  // minted through either is described the same way.
  const h = host.toLowerCase() === "app.vraelis.com" ? "vraelis.com" : host;
  return `${proto}://${h}`;
}

export const mcpResourceUrl = (origin: string) => `${origin}/mcp`;

// ── Redirect URIs ─────────────────────────────────────────────────────────────────────────────────────
/** https anywhere, or plain http only to this machine (MCP Inspector, local CLIs). Never a fragment. */
export function validRedirectUri(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 500) return false;
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.hash || u.username || u.password) return false;
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
}

// ── Clients ───────────────────────────────────────────────────────────────────────────────────────────
export type OAuthClient = { clientId: string; name: string; redirectUris: string[] };

const cleanName = (raw: unknown) => (typeof raw === "string" ? raw : "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40) || "MCP client";

/** RFC 7591: register a public client. The returned id is the registration. */
export function registerClient(meta: { redirect_uris?: unknown; client_name?: unknown }): OAuthClient | { error: string } {
  const uris = Array.isArray(meta.redirect_uris) ? meta.redirect_uris : [];
  if (!uris.length || uris.length > 10 || !uris.every(validRedirectUri)) return { error: "invalid_redirect_uri" };
  const name = cleanName(meta.client_name);
  const body = b64url(JSON.stringify({ n: name, r: uris }));
  return { clientId: `vrc_${body}.${hmac("client", body).slice(0, 32)}`, name, redirectUris: uris as string[] };
}

/** Resolve a client_id to its registration: a signed vrc_ id, or an https metadata document URL. */
export async function resolveClient(clientId: string): Promise<OAuthClient | null> {
  if (clientId.startsWith("vrc_")) {
    const [body, sig] = clientId.slice(4).split(".");
    if (!body || !sig || !safeEqual(sig, hmac("client", body).slice(0, 32))) return null;
    try {
      const d = JSON.parse(unb64url(body).toString("utf8")) as { n: string; r: string[] };
      return { clientId, name: cleanName(d.n), redirectUris: (d.r ?? []).filter(validRedirectUri) };
    } catch { return null; }
  }
  // Client ID Metadata Document: the id is an https URL serving the client's own metadata.
  if (/^https:\/\//.test(clientId) && clientId.length <= 500) {
    try {
      const res = await safeFetch(clientId, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const text = await res.text();
      if (text.length > 20_000) return null;
      const d = JSON.parse(text) as { client_id?: string; client_name?: string; redirect_uris?: unknown };
      if (d.client_id !== clientId) return null;
      const uris = Array.isArray(d.redirect_uris) ? d.redirect_uris.filter(validRedirectUri) : [];
      if (!uris.length) return null;
      return { clientId, name: cleanName(d.client_name ?? new URL(clientId).hostname), redirectUris: uris };
    } catch { return null; }
  }
  return null;
}

// ── The authorization request, carried across sign-in ─────────────────────────────────────────────────
//
// /signin only returns to a plain path (lib/return-urls.ts refuses encoded slashes, and every redirect_uri
// is full of them), so the request is packed into one signed, opaque, base64url token that survives the
// round trip untouched.
export type AuthRequest = {
  clientId: string; redirectUri: string; state: string | null;
  codeChallenge: string; scope: string; resource: string | null; exp: number;
};

export function packAuthRequest(r: Omit<AuthRequest, "exp">, nowMs = Date.now()): string {
  const body = b64url(JSON.stringify({ ...r, exp: nowMs + AUTH_REQUEST_TTL_MS }));
  return `${body}.${hmac("authreq", body)}`;
}

export function unpackAuthRequest(token: string, nowMs = Date.now()): AuthRequest | null {
  const [body, sig] = (token || "").split(".");
  if (!body || !sig || !safeEqual(sig, hmac("authreq", body))) return null;
  try {
    const r = JSON.parse(unb64url(body).toString("utf8")) as AuthRequest;
    return r.exp > nowMs ? r : null;
  } catch { return null; }
}

/** Validate the query an /oauth/authorize request arrived with. Errors name the RFC 6749 code. */
export async function parseAuthorizeQuery(q: URLSearchParams): Promise<{ req: Omit<AuthRequest, "exp">; client: OAuthClient } | { error: string; description: string; redirectable: boolean }> {
  const clientId = q.get("client_id") ?? "";
  const redirectUri = q.get("redirect_uri") ?? "";
  const client = clientId ? await resolveClient(clientId) : null;
  if (!client) return { error: "invalid_client", description: "Unknown client. Add the connector again.", redirectable: false };
  // Without a registered redirect_uri there is nowhere safe to send an error, so these never redirect.
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) return { error: "invalid_request", description: "That redirect address is not registered for this client.", redirectable: false };
  if (q.get("response_type") !== "code") return { error: "unsupported_response_type", description: "Only the authorization code flow is supported.", redirectable: true };
  const codeChallenge = q.get("code_challenge") ?? "";
  if (q.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge)) {
    return { error: "invalid_request", description: "PKCE with S256 is required.", redirectable: true };
  }
  return {
    client,
    req: {
      clientId, redirectUri, codeChallenge,
      state: q.get("state"),
      scope: MCP_SCOPE,
      resource: q.get("resource"),
    },
  };
}

// ── Consent proof (CSRF) ──────────────────────────────────────────────────────────────────────────────
//
// The Allow button mints a key, so a POST to /api/oauth/authorize must prove it came from the consent page
// this signed-in person was shown for THIS request. The page renders consentProof(email, token) into the
// form; the handler recomputes it for the session's email and refuses on mismatch. Another site can build
// a valid request token (anyone can start an authorization) but cannot produce the proof for someone
// else's session, so an auto-submitted cross-site form mints nothing. This does not lean on the site-wide
// CSRF check in proxy.ts or on the session cookie's SameSite setting; it holds on its own.
export function consentProof(email: string, token: string): string {
  return hmac("consent", `${email.trim().toLowerCase()}|${token}`);
}
export function consentProofValid(email: string, token: string, proof: string): boolean {
  return !!proof && safeEqual(proof, consentProof(email, token));
}

// ── Codes ─────────────────────────────────────────────────────────────────────────────────────────────
type CodePayload = { k: string; c: string; r: string; p: string; exp: number };

export function issueCode(input: { apiKey: string; clientId: string; redirectUri: string; codeChallenge: string }, nowMs = Date.now()): string {
  const payload: CodePayload = { k: input.apiKey, c: input.clientId, r: input.redirectUri, p: input.codeChallenge, exp: nowMs + CODE_TTL_MS };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret("code"), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return b64url(Buffer.concat([iv, cipher.getAuthTag(), ct]));
}

export const pkceS256 = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

/** Exchange a code. Every binding must match: client, redirect URI, PKCE verifier, and the clock. */
export function redeemCode(code: string, input: { clientId: string; redirectUri: string; codeVerifier: string }, nowMs = Date.now()): { apiKey: string } | { error: string } {
  let p: CodePayload;
  try {
    const raw = unb64url(code);
    const decipher = createDecipheriv("aes-256-gcm", secret("code"), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    p = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")) as CodePayload;
  } catch { return { error: "invalid_grant" }; }
  if (p.exp <= nowMs) return { error: "invalid_grant" };
  if (p.c !== input.clientId || p.r !== input.redirectUri) return { error: "invalid_grant" };
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(input.codeVerifier) || !safeEqual(pkceS256(input.codeVerifier), p.p)) return { error: "invalid_grant" };
  return { apiKey: p.k };
}

/** Where to send the browser back to, with the code or an error, carrying the client's state. */
export function redirectBack(redirectUri: string, params: Record<string, string | null | undefined>): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  return u.toString();
}
