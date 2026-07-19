// Connection-OAuth provider registry. ONE static config per provider; the initiate/callback routes and
// the vault writers are generic and read everything they need from here. This is the ONLY file that
// differs per provider — adding Vercel/Sentry/Stripe/Supabase later is a new entry, not new plumbing.
//
// This is CONNECTION OAuth (authorize a provider to read a user's data, token stored per application),
// deliberately separate from SIGN-IN OAuth (auth.ts, AUTH_GITHUB_*). Different app, different callback,
// different scopes, different env vars.

export type OAuthProvider = {
  // The connection kind (must be a CONNECTION_KINDS value so the row provider column is valid).
  kind: string;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;                       // space-delimited, provider-specific
  clientIdEnv: string;                  // env var holding the OAuth app client id
  clientSecretEnv: string;              // env var holding the OAuth app client secret
  // GitHub returns form-encoded unless you send Accept: application/json; most others are JSON.
  tokenExchangeAccept: "application/json";
  // Tokens that expire + issue a refresh token need the refresh path (Sentry ~8h, Supabase ~1d).
  // GitHub OAuth-app + Stripe Connect tokens don't refresh.
  refreshable: boolean;
  // Optional identity endpoint to label the connected account (e.g. GitHub /user -> login). Purely for
  // display; never required for the connection to succeed.
  identity?: { url: string; field: string };
};

// GITHUB — Phase 1. Simplest token model: OAuth-app tokens don't expire, no refresh, JSON exchange when
// Accept: application/json is sent. Read-only scope to honor the "no code write access" promise.
const GITHUB: OAuthProvider = {
  kind: "github",
  label: "GitHub",
  authorizeUrl: "https://github.com/login/oauth/authorize",
  tokenUrl: "https://github.com/login/oauth/access_token",
  scopes: "read:user public_repo",
  clientIdEnv: "GITHUB_CONNECT_CLIENT_ID",
  clientSecretEnv: "GITHUB_CONNECT_CLIENT_SECRET",
  tokenExchangeAccept: "application/json",
  refreshable: false,
  identity: { url: "https://api.github.com/user", field: "login" },
};

// The registry. Phase 2+ providers (vercel, sentry, stripe, supabase) are added here as their OAuth apps
// are registered and their consumers wired — see the OAuth blueprint for the order and per-provider quirks.
const REGISTRY: Record<string, OAuthProvider> = {
  github: GITHUB,
};

// Providers offered as a "Connect with X" button in the UI (only those with configured credentials render
// live — see providerConfigured). Kept as an ordered list for stable UI.
export const OAUTH_PROVIDER_KINDS = ["github"] as const;

// Resolve a provider by kind; null on an unknown/unregistered kind (routes fail closed on null).
export function resolveOAuthProvider(kind: string): OAuthProvider | null {
  return REGISTRY[kind] ?? null;
}

// A provider is only usable when its OAuth app credentials are present in the environment. Missing
// credentials => the button is hidden and the initiate route 302s back with a server_misconfigured reason,
// never a half-broken redirect to the provider.
export function providerConfigured(p: OAuthProvider): boolean {
  return !!process.env[p.clientIdEnv] && !!process.env[p.clientSecretEnv];
}

// The fixed, non-app-scoped callback path per provider. Registered verbatim as the OAuth app's redirect
// URI; the appId travels in signed state, NOT here, so one registered URI serves every application.
export function callbackPath(kind: string): string {
  return `/api/preflight/apps/oauth/callback/${kind}`;
}

// The account-level callback path (no app scope at all — connect once for the whole account). A separate
// registered redirect URI from callbackPath so the two flows never collide.
export function accountCallbackPath(kind: string): string {
  return `/api/preflight/connections/oauth/callback/${kind}`;
}
