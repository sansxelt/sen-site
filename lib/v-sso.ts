// Organization SSO (SAML/OIDC, v1). OIDC is the LIVE path — the IdP id_token is validated with
// `jose` (signature via JWKS, iss, aud, nonce, exp, email_verified, email). SAML is a CONFIG
// SCAFFOLD only (public metadata + SP metadata endpoint; assertion validation is NOT enabled —
// hand-rolling XML-DSig without a vetted library is unsafe). SSO authenticates a user into the
// ORGANIZATION layer only — it never grants workspace/project/billing/API access. The OIDC client
// secret is stored ENCRYPTED (AES-256-GCM, key derived from AUTH_SECRET) and never returned/logged.

import crypto from "crypto";
import { currentTokenVersion } from "./v-session-revocation";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { logEvent } from "./v-events";
import { getPrimaryOrganization, canManageOrganization, applyDomainProvisioning, emailDomain, domainTrustState, type ProvOrg, type DomainDefaultRole } from "./v-organization";
import { safeFetch, unsafeHttpsUrlReason } from "./safe-fetch";

const norm = (e: string) => e.trim().toLowerCase();
const SESSION_COOKIE = "__Secure-authjs.session-token";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type SsoType = "saml" | "oidc";
export type SsoStatus = "disabled" | "active" | "error";
export type SsoProviderSafe = {
  id: string; type: SsoType; status: SsoStatus; domain: string; display_name: string | null;
  issuer: string | null; sso_url: string | null; certificate_fingerprint: string | null; metadata_url: string | null;
  client_id: string | null; oidc_discovery_url: string | null; hasSecret: boolean;
};
type ProviderRow = SsoProviderSafe & { organization_id: string; client_secret_encrypted: string | null };

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

// ── Secret encryption (AES-256-GCM, key = sha256(AUTH_SECRET)) ────────────────
// SECURITY: no empty-string fallback. sha256("") is a fixed, publicly known 32-byte value, so an unset
// AUTH_SECRET meant every stored SSO client secret was encrypted under a key anyone can compute — the
// ciphertext looked encrypted and was not. Failing loudly is correct: a deployment that cannot protect
// these secrets must not store them.
//
// MIGRATION NOTE: this changes nothing while AUTH_SECRET is set, which is the supported configuration —
// the derived key is identical and existing ciphertext decrypts as before. It only converts the
// unset case from "silently weak" into a startup-visible error.
const encKey = () => {
  const secret = (process.env.AUTH_SECRET || "").trim();
  if (!secret) {
    throw new Error("AUTH_SECRET is not set; refusing to encrypt or decrypt SSO client secrets.");
  }
  return crypto.createHash("sha256").update(secret).digest();
};
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `${iv.toString("hex")}:${c.getAuthTag().toString("hex")}:${enc.toString("hex")}`;
}
export function decryptSecret(blob: string | null): string | null {
  if (!blob) return null;
  try {
    const [ivh, tagh, ench] = blob.split(":");
    const d = crypto.createDecipheriv("aes-256-gcm", encKey(), Buffer.from(ivh, "hex"));
    d.setAuthTag(Buffer.from(tagh, "hex"));
    return Buffer.concat([d.update(Buffer.from(ench, "hex")), d.final()]).toString("utf8");
  } catch { return null; }
}

// The HMAC key for the OIDC state cookie. Same rule as encKey: no empty-string fallback. An unset
// AUTH_SECRET meant the state was signed with the empty key, so ANY caller could forge a state token
// and the nonce/issuer binding it carries proved nothing.
function stateKey(): string {
  const secret = (process.env.AUTH_SECRET || "").trim();
  if (!secret) throw new Error("AUTH_SECRET is not set; refusing to sign or verify SSO state.");
  return secret;
}

// ── State/nonce cookie (HMAC-signed, short-lived) ─────────────────────────────
export function signOidcState(obj: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify({ ...obj, exp: Date.now() + 10 * 60 * 1000 })).toString("base64url");
  const mac = crypto.createHmac("sha256", stateKey()).update(body).digest("base64url");
  return `${body}.${mac}`;
}
export function verifyOidcState(token: string | undefined): Record<string, unknown> | null {
  if (!token || !token.includes(".")) return null;
  try {
    const [body, mac] = token.split(".");
    const expect = crypto.createHmac("sha256", stateKey()).update(body).digest("base64url");
    if (mac.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null;
    const obj = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof obj.exp !== "number" || obj.exp < Date.now()) return null;
    return obj;
  } catch { return null; }
}

const toSafe = (r: ProviderRow): SsoProviderSafe => ({
  id: r.id, type: r.type, status: r.status, domain: r.domain, display_name: r.display_name,
  issuer: r.issuer, sso_url: r.sso_url, certificate_fingerprint: r.certificate_fingerprint, metadata_url: r.metadata_url,
  client_id: r.client_id, oidc_discovery_url: r.oidc_discovery_url, hasSecret: !!r.client_secret_encrypted,
});
const COLS = "id,organization_id,type,status,domain,display_name,issuer,sso_url,certificate_fingerprint,metadata_url,client_id,client_secret_encrypted,oidc_discovery_url";

// ── Verified domains of an org (for SSO eligibility) ──────────────────────────
async function verifiedDomains(orgId: string): Promise<string[]> {
  try {
    const { data } = await getSupabaseAdminClient().from("v_organization_domains" as never).select("domain").eq("organization_id", orgId).eq("status", "verified");
    return ((data as unknown as { domain: string }[]) ?? []).map((d) => d.domain);
  } catch { return []; }
}

// ── Admin-facing reads ────────────────────────────────────────────────────────
export type SsoView = { providers: SsoProviderSafe[]; verifiedDomains: string[]; redirectUriBase: string; acsUrlBase: string; metadataUrlBase: string };

export async function getSsoView(email: string): Promise<SsoView | null> {
  const org = await getPrimaryOrganization(email);
  if (!org || !(await canManageOrganization(email, org.id))) return null;
  try {
    const { data, error } = await getSupabaseAdminClient().from("v_organization_sso_providers" as never).select(COLS).eq("organization_id", org.id).order("created_at", { ascending: true });
    if (error) return { providers: [], verifiedDomains: await verifiedDomains(org.id), redirectUriBase: "https://vraelis.com/api/v/sso/oidc", acsUrlBase: "https://vraelis.com/api/v/sso/saml", metadataUrlBase: "https://vraelis.com/api/v/sso/saml" };
    return {
      providers: ((data as unknown as ProviderRow[]) ?? []).map(toSafe),
      verifiedDomains: await verifiedDomains(org.id),
      redirectUriBase: "https://vraelis.com/api/v/sso/oidc",
      acsUrlBase: "https://vraelis.com/api/v/sso/saml",
      metadataUrlBase: "https://vraelis.com/api/v/sso/saml",
    };
  } catch { return { providers: [], verifiedDomains: [], redirectUriBase: "https://vraelis.com/api/v/sso/oidc", acsUrlBase: "https://vraelis.com/api/v/sso/saml", metadataUrlBase: "https://vraelis.com/api/v/sso/saml" }; }
}

// ── Provider CRUD (owner/admin only, org-scoped) ──────────────────────────────
export type SsoInput = { type: SsoType; domain: string; displayName?: string; oidcDiscoveryUrl?: string; clientId?: string; clientSecret?: string; issuer?: string; ssoUrl?: string; certificateFingerprint?: string; metadataUrl?: string };

export async function upsertSsoProvider(email: string, input: SsoInput): Promise<Result<{ id: string }>> {
  const org = await getPrimaryOrganization(email);
  if (!org) return { ok: false, error: "no_organization" };
  if (!(await canManageOrganization(email, org.id))) return { ok: false, error: "forbidden" };
  if (input.type !== "saml" && input.type !== "oidc") return { ok: false, error: "invalid_type" };
  const domain = norm(input.domain || "");
  if (!(await verifiedDomains(org.id)).includes(domain)) return { ok: false, error: "domain_not_verified" };
  if (input.type === "oidc" && unsafeHttpsUrlReason(input.oidcDiscoveryUrl || "")) return { ok: false, error: "invalid_discovery_url" };
  try {
    const s = getSupabaseAdminClient();
    const { data: existing } = await s.from("v_organization_sso_providers" as never).select("id,client_secret_encrypted").eq("organization_id", org.id).eq("domain", domain).maybeSingle();
    const ex = existing as unknown as { id: string; client_secret_encrypted: string | null } | null;
    const row: Record<string, unknown> = {
      organization_id: org.id, type: input.type, domain, display_name: (input.displayName || "").trim().slice(0, 80) || null,
      issuer: input.issuer?.trim() || null, sso_url: input.ssoUrl?.trim() || null, certificate_fingerprint: input.certificateFingerprint?.trim() || null, metadata_url: input.metadataUrl?.trim() || null,
      client_id: input.clientId?.trim() || null, oidc_discovery_url: input.oidcDiscoveryUrl?.trim() || null, updated_at: new Date().toISOString(),
    };
    // Encrypt a NEW secret only when provided; otherwise keep the existing one. Changing config
    // always drops the provider back to 'disabled' so it must be re-enabled deliberately.
    if (input.clientSecret && input.clientSecret.trim()) row.client_secret_encrypted = encryptSecret(input.clientSecret.trim());
    else if (ex) row.client_secret_encrypted = ex.client_secret_encrypted;
    row.status = "disabled";
    let id: string;
    if (ex) { await s.from("v_organization_sso_providers" as never).update(row as never).eq("id", ex.id); id = ex.id; }
    else { const ins = await s.from("v_organization_sso_providers" as never).insert(row as never).select("id").single(); id = (ins.data as unknown as { id: string }).id; }
    await logEvent({ userId: norm(email), eventType: "organization_sso_provider_updated", actorType: "owner", source: "app", metadata: { organization_id: org.id, provider_id: id, provider_type: input.type, status: "disabled" } });
    return { ok: true, id };
  } catch { return { ok: false, error: "save_failed" }; }
}

export async function setSsoProviderStatus(email: string, providerId: string, status: "active" | "disabled"): Promise<Result> {
  const org = await getPrimaryOrganization(email);
  if (!org) return { ok: false, error: "no_organization" };
  if (!(await canManageOrganization(email, org.id))) return { ok: false, error: "forbidden" };
  try {
    const s = getSupabaseAdminClient();
    const { data } = await s.from("v_organization_sso_providers" as never).select(COLS).eq("id", providerId).eq("organization_id", org.id).maybeSingle();
    const p = data as unknown as ProviderRow | null;
    if (!p) return { ok: false, error: "not_found" };
    if (status === "active") {
      if (p.type === "saml") return { ok: false, error: "saml_not_enabled" }; // scaffold only
      if (!(await verifiedDomains(org.id)).includes(p.domain)) return { ok: false, error: "domain_not_verified" };
      if (!p.oidc_discovery_url || !p.client_id || !p.client_secret_encrypted) return { ok: false, error: "incomplete_config" };
    }
    await s.from("v_organization_sso_providers" as never).update({ status, updated_at: new Date().toISOString() } as never).eq("id", providerId).eq("organization_id", org.id);
    await logEvent({ userId: norm(email), eventType: status === "active" ? "organization_sso_provider_enabled" : "organization_sso_provider_disabled", actorType: "owner", source: "app", metadata: { organization_id: org.id, provider_id: providerId, provider_type: p.type, status } });
    return { ok: true };
  } catch { return { ok: false, error: "update_failed" }; }
}

export async function deleteSsoProvider(email: string, providerId: string): Promise<Result> {
  const org = await getPrimaryOrganization(email);
  if (!org) return { ok: false, error: "no_organization" };
  if (!(await canManageOrganization(email, org.id))) return { ok: false, error: "forbidden" };
  try {
    const { error } = await getSupabaseAdminClient().from("v_organization_sso_providers" as never).delete().eq("id", providerId).eq("organization_id", org.id);
    return error ? { ok: false, error: "delete_failed" } : { ok: true };
  } catch { return { ok: false, error: "delete_failed" }; }
}

// ── Login resolution (account-enumeration-safe) ───────────────────────────────
// Returns an ACTIVE provider whose domain == the email domain AND is still a verified org domain.
export async function resolveSsoForEmail(email: string): Promise<{ providerId: string; type: SsoType } | null> {
  if (!isDatabaseConfigured()) return null;
  const dom = emailDomain(email);
  if (!dom) return null;
  try {
    const s = getSupabaseAdminClient();
    const { data } = await s.from("v_organization_sso_providers" as never).select("id,type,organization_id,domain,status").eq("domain", dom).eq("status", "active").limit(1).maybeSingle();
    const p = data as unknown as { id: string; type: SsoType; organization_id: string; domain: string } | null;
    if (!p) return null;
    if ((await domainTrustState(p.organization_id, dom)) !== "trusted") return null; // verified + not paused for re-verification
    return { providerId: p.id, type: p.type };
  } catch { return null; }
}

// ── OIDC (live) ───────────────────────────────────────────────────────────────
async function getActiveOidcProvider(providerId: string): Promise<ProviderRow | null> {
  try {
    const { data } = await getSupabaseAdminClient().from("v_organization_sso_providers" as never).select(COLS).eq("id", providerId).eq("type", "oidc").eq("status", "active").maybeSingle();
    return (data as unknown as ProviderRow | null) ?? null;
  } catch { return null; }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}
type Discovery = { authorization_endpoint: string; token_endpoint: string; jwks_uri: string; issuer: string };
async function oidcDiscovery(url: string): Promise<Discovery | null> {
  try {
    const r = await withTimeout(safeFetch(url, { headers: { accept: "application/json" }, redirect: "manual" }), 6000);
    if (!r.ok) return null;
    const j = (await r.json()) as Discovery;
    if (!j.authorization_endpoint || !j.token_endpoint || !j.jwks_uri || !j.issuer) return null;
    // Validate the endpoints the IdP just handed us BEFORE we ever fetch/POST to them. safeFetch
    // re-checks at call time, but rejecting here also stops the browser being redirected to an
    // unsafe authorization_endpoint.
    if (unsafeHttpsUrlReason(j.authorization_endpoint) || unsafeHttpsUrlReason(j.token_endpoint) || unsafeHttpsUrlReason(j.jwks_uri)) return null;
    return j;
  } catch { return null; }
}

// Build the OIDC authorization redirect. Returns the URL + the state/nonce the caller signs into a cookie.
export async function startOidcLogin(providerId: string): Promise<Result<{ url: string; state: string; nonce: string }>> {
  const p = await getActiveOidcProvider(providerId);
  if (!p || !p.oidc_discovery_url || !p.client_id) return { ok: false, error: "provider_unavailable" };
  if ((await domainTrustState(p.organization_id, p.domain)) !== "trusted") return { ok: false, error: "domain_paused" }; // re-verification pending

  const disc = await oidcDiscovery(p.oidc_discovery_url);
  if (!disc) return { ok: false, error: "discovery_failed" };
  const state = crypto.randomBytes(16).toString("hex");
  const nonce = crypto.randomBytes(16).toString("hex");
  const redirectUri = `https://vraelis.com/api/v/sso/oidc/${p.id}/callback`;
  const url = `${disc.authorization_endpoint}?${new URLSearchParams({ response_type: "code", client_id: p.client_id, redirect_uri: redirectUri, scope: "openid email", state, nonce })}`;
  await logEvent({ userId: "system", eventType: "organization_sso_login_started", actorType: "system", source: "sso", metadata: { organization_id: p.organization_id, provider_id: p.id, provider_type: "oidc" } });
  return { ok: true, url, state, nonce };
}

// Exchange the code and validate the id_token (signature via JWKS, iss, aud=client_id, nonce, email).
export async function completeOidcCallback(providerId: string, code: string, expectedNonce: string): Promise<Result<{ email: string; organizationId: string }>> {
  const p = await getActiveOidcProvider(providerId);
  if (!p || !p.oidc_discovery_url || !p.client_id) return { ok: false, error: "provider_unavailable" };
  const secret = decryptSecret(p.client_secret_encrypted);
  if (!secret) return { ok: false, error: "provider_unavailable" };
  const disc = await oidcDiscovery(p.oidc_discovery_url);
  if (!disc) return { ok: false, error: "discovery_failed" };
  const redirectUri = `https://vraelis.com/api/v/sso/oidc/${p.id}/callback`;
  try {
    const tr = await withTimeout(safeFetch(disc.token_endpoint, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: p.client_id, client_secret: secret }).toString(),
      redirect: "manual",
    }), 8000);
    if (!tr.ok) return { ok: false, error: "token_exchange_failed" };
    const tok = (await tr.json()) as { id_token?: string };
    if (!tok.id_token) return { ok: false, error: "no_id_token" };
    // Fetch the JWKS ourselves through the SSRF-safe fetcher and verify against a LOCAL key set,
    // so jose can never be pointed at an internal jwks_uri.
    const jr = await withTimeout(safeFetch(disc.jwks_uri, { headers: { accept: "application/json" }, redirect: "manual" }), 6000);
    if (!jr.ok) return { ok: false, error: "jwks_failed" };
    const jwks = (await jr.json()) as { keys?: unknown[] };
    if (!jwks || !Array.isArray(jwks.keys) || jwks.keys.length === 0) return { ok: false, error: "jwks_failed" };
    const { jwtVerify, createLocalJWKSet } = await import("jose");
    const JWKS = createLocalJWKSet(jwks as never);
    // Explicit asymmetric-only allowlist (defense-in-depth against alg confusion / alg:none).
    const { payload } = await jwtVerify(tok.id_token, JWKS, { issuer: disc.issuer, audience: p.client_id, algorithms: ["RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512"] });
    if (expectedNonce && payload.nonce !== expectedNonce) return { ok: false, error: "nonce_mismatch" };
    const tokenEmail = typeof payload.email === "string" ? norm(payload.email) : "";
    if (!tokenEmail) return { ok: false, error: "no_email" };
    if (payload.email_verified === false) return { ok: false, error: "email_unverified" };
    // The id_token email domain MUST equal this provider's domain (which is a verified org domain).
    if (emailDomain(tokenEmail) !== p.domain) return { ok: false, error: "domain_mismatch" };
    if ((await domainTrustState(p.organization_id, p.domain)) !== "trusted") return { ok: false, error: "domain_not_verified" };
    return { ok: true, email: tokenEmail, organizationId: p.organization_id };
  } catch { return { ok: false, error: "validation_failed" }; }
}

// After a validated SSO identity: provision into org membership per provisioning settings (safe role
// only; revoked users routed to pending). Returns the provisioning outcome. SSO-specific events.
export async function provisionSsoLogin(email: string, organizationId: string): Promise<Result<{ outcome: string; role: DomainDefaultRole }>> {
  try {
    const s = getSupabaseAdminClient();
    const { data: orgRow } = await s.from("v_organizations" as never).select("id,owner_user_id,domain_join_mode,domain_default_role").eq("id", organizationId).maybeSingle();
    const org = orgRow as unknown as ProvOrg | null;
    if (!org) return { ok: false, error: "org_not_found" };
    const res = await applyDomainProvisioning(norm(email), org, norm(email));
    if (res.outcome === "disabled" || res.outcome === "failed") {
      await logEvent({ userId: "system", eventType: "organization_sso_login_failed", actorType: "system", source: "sso", metadata: { organization_id: organizationId, status: res.outcome === "failed" ? "provision_failed" : "join_disabled" } });
      return { ok: false, error: res.outcome === "failed" ? "provision_failed" : "join_disabled" };
    }
    await logEvent({ userId: "system", eventType: "organization_sso_user_provisioned", actorType: "system", source: "sso", metadata: { organization_id: organizationId, role: res.role, mode: res.mode, status: res.outcome } });
    await logEvent({ userId: "system", eventType: "organization_sso_login_succeeded", actorType: "system", source: "sso", metadata: { organization_id: organizationId, status: res.outcome } });
    return { ok: true, outcome: res.outcome, role: res.role };
  } catch { return { ok: false, error: "provision_failed" }; }
}

// Mint a NextAuth-compatible session JWT for a validated SSO email (the IdP is the authority).
//
// SECURITY: the token carries `tv`, the account's revocation counter, exactly as a token minted through
// the jwt callback does. This path encodes the cookie DIRECTLY and never passes through that callback, so
// without this the claim was simply absent.
//
// That was not only a bypass — it was also a latent outage. tokenVersionIsCurrent treats an absent claim
// as 0, so once an account had ever been revoked (any sign-out bumps the counter) its stored version was
// >= 1 and every freshly minted SSO session was born STALE: the user would sign in through the IdP and be
// rejected on their next request, permanently. Stamping the current value fixes both halves at once.
//
// Enforcement is unchanged and lives where it belongs — the jwt callback in auth.ts validates `tv` on
// every request, so this is a stronger guarantee than checking only at mint time: revoking mid-session
// still kills the session on its next use.
export async function mintSsoSession(email: string): Promise<{ name: string; value: string; options: Record<string, unknown> }> {
  const { encode } = await import("@auth/core/jwt");
  const tv = await currentTokenVersion(norm(email));
  const value = await encode({
    token: { email: norm(email), sub: norm(email), name: norm(email).split("@")[0], provider: "sso", tv },
    secret: process.env.AUTH_SECRET as string,
    salt: SESSION_COOKIE,
    maxAge: SESSION_MAX_AGE,
  });
  return { name: SESSION_COOKIE, value, options: { httpOnly: true, secure: true, sameSite: "lax", path: "/", domain: ".vraelis.com", maxAge: SESSION_MAX_AGE } };
}
