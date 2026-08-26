// Connection-OAuth provider registry. ONE static config per provider; the initiate/callback routes and the
// vault writers are generic and read everything they need from here. This is the ONLY file that differs per
// provider — the plumbing (routes, state, vault, refresh) is shared.
//
// This is CONNECTION OAuth (authorize a provider to read a user's data, token stored at the account level),
// deliberately separate from SIGN-IN OAuth (auth.ts, AUTH_GITHUB_*). Different app, different callback,
// different scopes, different env vars.
import { PKCE_METHOD } from "./pkce";

export type OAuthProvider = {
  // The connection kind (must be a CONNECTION_KINDS value so the row provider column is valid).
  kind: string;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;                       // space-delimited, provider-specific (empty = configured on the provider's integration, e.g. Vercel)
  clientIdEnv: string;                  // env var holding the OAuth app client id
  clientSecretEnv: string;              // env var holding the OAuth app client secret
  // Token exchange response format. GitHub/Sentry return JSON when asked (Accept header); Vercel/Stripe
  // return form-encoded or their own JSON. We always POST form-encoded; this is the Accept we send.
  tokenExchangeAccept: "application/json";
  // Tokens that expire + issue a refresh token need the refresh path (Sentry ~8h, Supabase ~1d). GitHub
  // OAuth-app + Vercel + Stripe Connect tokens are long-lived / don't refresh.
  refreshable: boolean;
  // Optional identity endpoint to label the connected account (e.g. GitHub /user -> login). Display only.
  identity?: { url: string; field: string };
  // Extra params the provider returns on the callback that must be persisted in meta to be useful later
  // (Vercel: teamId/configurationId to resolve projects; Stripe: stripe_user_id, the connected account).
  persistCallbackParams?: string[];
  // Gated behind an env flag until a product decision is made (Supabase: its scope is broader than the
  // written "no database credentials" promise). A gated provider never renders a Connect button and its
  // routes fail closed unless the flag is set.
  gatedByEnv?: string;
  // How the authorize URL is built. "standard" appends client_id/redirect_uri/scope/state/response_type
  // (GitHub/Sentry/Stripe/Supabase). "install" is Vercel's integration model: send the user to
  // vercel.com/integrations/<slug>/new?state=<state>; Vercel already knows the redirect + config and appends
  // code/configurationId/teamId on the way back, so we DON'T send client_id/scope/redirect_uri here.
  authorizeStyle?: "standard" | "install";
  // For "install" style: the env var holding the integration slug used to build the install URL.
  installSlugEnv?: string;
  // How the user should be sent to the provider. "popup" (default) keeps them on the page; "redirect" takes
  // the full window for flows that genuinely need it.
  authorizeWindow?: "popup" | "redirect";
  // Popup dimensions when a provider's authorization needs more room than the default 620x760 (Vercel's
  // integration install is multi-step: team -> project access -> permissions).
  popupSize?: { w: number; h: number };
  // Requires PKCE (RFC 7636): the authorize URL carries code_challenge (S256 of a secret verifier) and the
  // token exchange must send the matching code_verifier. Supabase mandates it. The verifier NEVER goes to the
  // provider in the authorize step — it's held in an httpOnly cookie until the exchange.
  pkce?: boolean;
};

// GITHUB — OAuth-app token: no expiry, no refresh, JSON exchange when Accept: application/json is sent.
// Read-only scope honors the "no code write access" promise.
const GITHUB: OAuthProvider = {
  kind: "github", label: "GitHub",
  authorizeUrl: "https://github.com/login/oauth/authorize",
  tokenUrl: "https://github.com/login/oauth/access_token",
  scopes: "read:user public_repo",
  clientIdEnv: "GITHUB_CONNECT_CLIENT_ID", clientSecretEnv: "GITHUB_CONNECT_CLIENT_SECRET",
  tokenExchangeAccept: "application/json", refreshable: false,
  identity: { url: "https://api.github.com/user", field: "login" },
};

// VERCEL — GATED until its integration OAuth flow is finished. Vercel Integration OAuth is NOT standard
// OAuth: the install/authorize flow lives at vercel.com/integrations/<slug>/new and the redirect + config
// model differ (the "app ID is invalid" error came from treating it as standard OAuth). Kept in the registry
// but gated by VERCEL_OAUTH_ENABLED so it never renders a broken Connect button until the flow is built
// correctly. Token exchange (api.vercel.com/v2/oauth/access_token) is correct and stays.
const VERCEL: OAuthProvider = {
  kind: "vercel", label: "Vercel",
  authorizeUrl: "https://vercel.com/integrations", // + /<slug>/new, built by buildAuthorizeUrl (install style)
  tokenUrl: "https://api.vercel.com/v2/oauth/access_token",
  scopes: "",
  clientIdEnv: "VERCEL_CLIENT_ID", clientSecretEnv: "VERCEL_CLIENT_SECRET",
  tokenExchangeAccept: "application/json", refreshable: false,
  identity: { url: "https://api.vercel.com/v2/user", field: "user.username" },
  persistCallbackParams: ["teamId", "configurationId"],
  authorizeStyle: "install",
  installSlugEnv: "VERCEL_INTEGRATION_SLUG",
  // Popup, but a large one: the install flow (team -> project access -> permissions) needs real room.
  popupSize: { w: 980, h: 900 },
  gatedByEnv: "VERCEL_OAUTH_ENABLED", // needs creds AND the slug; on when VERCEL_OAUTH_ENABLED=1
};

// SENTRY — OAuth via a Sentry Integration. Tokens expire (~8h) and DO refresh, so this is where the
// refresh-and-reseal path first matters. Read-only issue/event scopes for the reliability signal.
const SENTRY: OAuthProvider = {
  kind: "sentry", label: "Sentry",
  authorizeUrl: "https://sentry.io/oauth/authorize/",
  tokenUrl: "https://sentry.io/oauth/token/",
  scopes: "org:read project:read event:read",
  clientIdEnv: "SENTRY_CLIENT_ID", clientSecretEnv: "SENTRY_CLIENT_SECRET",
  tokenExchangeAccept: "application/json", refreshable: true,
};

// STRIPE — Stripe Connect (Standard) OAuth, read-only, test-mode. Uses Stripe's own OAuth endpoints and
// returns a connected-account id (stripe_user_id) rather than a classic refreshable token — the grant IS
// the account. Reuses the existing STRIPE_SECRET_KEY as the exchange secret (no new secret env).
// Stripe requires the read_write scope value unless your account is explicitly approved for read_only Connect
// (a support request). We request read_write to work on any account, but Vraelis only ever READS — no write
// endpoint is ever called. Test-mode only.
const STRIPE: OAuthProvider = {
  kind: "stripe_test", label: "Stripe",
  authorizeUrl: "https://connect.stripe.com/oauth/authorize",
  tokenUrl: "https://connect.stripe.com/oauth/token",
  scopes: "read_write",
  clientIdEnv: "STRIPE_CONNECT_CLIENT_ID", clientSecretEnv: "STRIPE_SECRET_KEY",
  tokenExchangeAccept: "application/json", refreshable: false,
  persistCallbackParams: ["stripe_user_id"],
};

// SUPABASE — OAuth with PKCE (the only provider that mandates it), management-API scopes. Tokens expire
// (~1d) and refresh, which the refresh path handles. Still GATED behind SUPABASE_OAUTH_ENABLED: connecting
// grants Vraelis management-API READ access to the user's Supabase org/projects, which is genuinely broader
// than a stored project URL, so it stays opt-in and the connection copy says exactly what it can reach.
const SUPABASE: OAuthProvider = {
  kind: "supabase", label: "Supabase",
  authorizeUrl: "https://api.supabase.com/v1/oauth/authorize",
  tokenUrl: "https://api.supabase.com/v1/oauth/token",
  scopes: "",
  clientIdEnv: "SUPABASE_OAUTH_CLIENT_ID", clientSecretEnv: "SUPABASE_OAUTH_CLIENT_SECRET",
  tokenExchangeAccept: "application/json", refreshable: true,
  pkce: true,
  gatedByEnv: "SUPABASE_OAUTH_ENABLED",
};

const REGISTRY: Record<string, OAuthProvider> = {
  github: GITHUB, vercel: VERCEL, sentry: SENTRY, stripe_test: STRIPE, supabase: SUPABASE,
};

// Display order for the "Connect" buttons. A provider only renders when its credentials are present AND it
// isn't gated off (see providerAvailable), so listing all here is safe — unconfigured ones simply hide.
export const OAUTH_PROVIDER_KINDS = ["github", "vercel", "sentry", "stripe_test", "supabase"] as const;

// Own-key lookup table. A Map has NO prototype chain for its entries, so a key like "constructor",
// "__proto__", "toString" or "valueOf" simply is not present — unlike a plain object, where REGISTRY[kind]
// returns the inherited member and reads as truthy.
//
// This matters because three routes pass an attacker-controlled path segment straight into
// resolveOAuthProvider: /api/preflight/apps/oauth/callback/[provider],
// /api/preflight/apps/[id]/connections/oauth/[provider] and /api/preflight/connections/[provider]/oauth.
// Each treats a truthy result as "this is a real provider" and then reads p.pkce, p.tokenUrl, p.clientIdEnv
// and so on — all undefined on Object.prototype.constructor — and callbackPath() interpolates the same
// unvalidated kind into a redirect_uri. Failing closed here fixes every caller at once rather than relying
// on each one to pre-validate.
const REGISTRY_BY_KIND: ReadonlyMap<string, OAuthProvider> = new Map(Object.entries(REGISTRY));

// Resolve a provider by kind; null on an unknown/unregistered kind (routes fail closed on null).
// Fails closed for: inherited/prototype keys, non-string input (a symbol or object from untyped JS),
// the empty string, mixed-case variants, and anything not registered. Valid kinds are unchanged.
export function resolveOAuthProvider(kind: string): OAuthProvider | null {
  if (typeof kind !== "string" || kind === "") return null;
  return REGISTRY_BY_KIND.get(kind) ?? null;
}

// The registered kinds, derived from the registry itself so it can never drift from REGISTRY.
// OAUTH_PROVIDER_KINDS above is the DISPLAY ORDER; a test asserts the two hold the same set.
export function registeredOAuthKinds(): readonly string[] {
  return [...REGISTRY_BY_KIND.keys()];
}

// Credential reads, ALWAYS trimmed. Every one of these values arrives by someone copying it out of a
// provider dashboard and pasting it into a hosting env field, and that paste routinely carries a trailing
// newline or space. Providers compare client ids literally, so an untrimmed value fails with a message
// ("unrecognized client_id") that points at the value being wrong rather than at the invisible character
// after it — hours of chasing a correct-looking credential. Read env credentials through these, never raw.
export function clientId(p: OAuthProvider): string {
  return (process.env[p.clientIdEnv] ?? "").trim();
}
export function clientSecret(p: OAuthProvider): string {
  return (process.env[p.clientSecretEnv] ?? "").trim();
}

// A provider's OAuth app credentials are present in the environment.
export function providerConfigured(p: OAuthProvider): boolean {
  return !!clientId(p) && !!clientSecret(p);
}

// A gated provider is only available when its gate flag is explicitly enabled (Supabase, until its broader
// scope is approved). Non-gated providers are always available once configured.
export function providerGateOpen(p: OAuthProvider): boolean {
  return !p.gatedByEnv || (process.env[p.gatedByEnv] ?? "").trim() === "1"; // trimmed: a pasted "1\n" is still on
}

// The provider can be offered/used right now: configured AND not gated off. The UI shows a Connect button
// only for available providers; the routes fail closed for anything else.
export function providerAvailable(p: OAuthProvider): boolean {
  return providerConfigured(p) && providerGateOpen(p);
}

// The single, fixed callback path per provider — registered verbatim as the OAuth app's ONE redirect URI.
// It serves BOTH the per-app and account-level flows; the signed state (appId present or not) selects which.
export function callbackPath(kind: string): string {
  return `/api/preflight/apps/oauth/callback/${kind}`;
}

// Build the provider's authorize URL to redirect the user to. Two styles:
//  - "install" (Vercel): vercel.com/integrations/<slug>/new?state=<state>. The redirect URL + scopes live on
//    the Integration Console, so we send ONLY state; Vercel appends code/configurationId/teamId on return.
//    Returns null if the slug env is missing (caller fails closed with server_misconfigured).
//  - "standard" (default): appends client_id + redirect_uri + scope + state + response_type.
// PKCE providers additionally carry code_challenge (the S256 hash); the verifier itself stays in an httpOnly
// cookie and is only revealed at token exchange. A pkce provider with no challenge supplied fails closed.
export function buildAuthorizeUrl(
  p: OAuthProvider,
  opts: { state: string; redirectUri: string; codeChallenge?: string },
): string | null {
  if (p.authorizeStyle === "install") {
    const slug = p.installSlugEnv ? (process.env[p.installSlugEnv] ?? "").trim() : undefined;
    if (!slug) return null;
    const u = new URL(`https://vercel.com/integrations/${slug}/new`);
    u.searchParams.set("state", opts.state);
    return u.toString();
  }
  if (p.pkce && !opts.codeChallenge) return null; // never downgrade a PKCE provider to a bare code flow
  const u = new URL(p.authorizeUrl);
  u.searchParams.set("client_id", clientId(p));
  u.searchParams.set("redirect_uri", opts.redirectUri);
  if (p.scopes) u.searchParams.set("scope", p.scopes);
  u.searchParams.set("state", opts.state);
  u.searchParams.set("response_type", "code");
  if (p.pkce && opts.codeChallenge) {
    u.searchParams.set("code_challenge", opts.codeChallenge);
    u.searchParams.set("code_challenge_method", PKCE_METHOD);
  }
  return u.toString();
}
