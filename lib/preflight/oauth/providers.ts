// Connection-OAuth provider registry. ONE static config per provider; the initiate/callback routes and the
// vault writers are generic and read everything they need from here. This is the ONLY file that differs per
// provider — the plumbing (routes, state, vault, refresh) is shared.
//
// This is CONNECTION OAuth (authorize a provider to read a user's data, token stored at the account level),
// deliberately separate from SIGN-IN OAuth (auth.ts, AUTH_GITHUB_*). Different app, different callback,
// different scopes, different env vars.

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

// SUPABASE — OAuth with PKCE, management-API scopes (read projects/orgs). GATED: this scope is broader than
// the written "No database credentials, no rows" promise, so it stays behind SUPABASE_OAUTH_ENABLED until the
// scope is approved and the NEVER_ACCESSES.supabase copy is rewritten. Tokens expire (~1d) and refresh.
const SUPABASE: OAuthProvider = {
  kind: "supabase", label: "Supabase",
  authorizeUrl: "https://api.supabase.com/v1/oauth/authorize",
  tokenUrl: "https://api.supabase.com/v1/oauth/token",
  scopes: "",
  clientIdEnv: "SUPABASE_OAUTH_CLIENT_ID", clientSecretEnv: "SUPABASE_OAUTH_CLIENT_SECRET",
  tokenExchangeAccept: "application/json", refreshable: true,
  gatedByEnv: "SUPABASE_OAUTH_ENABLED",
};

const REGISTRY: Record<string, OAuthProvider> = {
  github: GITHUB, vercel: VERCEL, sentry: SENTRY, stripe_test: STRIPE, supabase: SUPABASE,
};

// Display order for the "Connect" buttons. A provider only renders when its credentials are present AND it
// isn't gated off (see providerAvailable), so listing all here is safe — unconfigured ones simply hide.
export const OAUTH_PROVIDER_KINDS = ["github", "vercel", "sentry", "stripe_test", "supabase"] as const;

// Resolve a provider by kind; null on an unknown/unregistered kind (routes fail closed on null).
export function resolveOAuthProvider(kind: string): OAuthProvider | null {
  return REGISTRY[kind] ?? null;
}

// A provider's OAuth app credentials are present in the environment.
export function providerConfigured(p: OAuthProvider): boolean {
  return !!process.env[p.clientIdEnv] && !!process.env[p.clientSecretEnv];
}

// A gated provider is only available when its gate flag is explicitly enabled (Supabase, until its broader
// scope is approved). Non-gated providers are always available once configured.
export function providerGateOpen(p: OAuthProvider): boolean {
  return !p.gatedByEnv || process.env[p.gatedByEnv] === "1";
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
export function buildAuthorizeUrl(p: OAuthProvider, opts: { state: string; redirectUri: string }): string | null {
  if (p.authorizeStyle === "install") {
    const slug = p.installSlugEnv ? process.env[p.installSlugEnv] : undefined;
    if (!slug) return null;
    const u = new URL(`https://vercel.com/integrations/${slug}/new`);
    u.searchParams.set("state", opts.state);
    return u.toString();
  }
  const u = new URL(p.authorizeUrl);
  u.searchParams.set("client_id", process.env[p.clientIdEnv] as string);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  if (p.scopes) u.searchParams.set("scope", p.scopes);
  u.searchParams.set("state", opts.state);
  u.searchParams.set("response_type", "code");
  return u.toString();
}
