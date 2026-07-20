// Sanity tests for the OAuth provider registry (lib/preflight/oauth/providers.ts). Confirms every provider
// resolves, availability honors both credentials AND the gate, and the per-provider quirks are wired (Stripe
// reuses STRIPE_SECRET_KEY; Supabase is gated). No DB, no network.

import { resolveOAuthProvider, providerConfigured, providerGateOpen, providerAvailable, OAUTH_PROVIDER_KINDS, callbackPath, buildAuthorizeUrl } from "../lib/preflight/oauth/providers";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

ok("every listed kind resolves to a provider", OAUTH_PROVIDER_KINDS.every((k) => !!resolveOAuthProvider(k)));
ok("unknown kind resolves to null (routes fail closed)", resolveOAuthProvider("nope") === null && resolveOAuthProvider("") === null);
ok("the 5 expected providers are present", ["github", "vercel", "sentry", "stripe_test", "supabase"].every((k) => !!resolveOAuthProvider(k)));

// Stripe reuses the existing STRIPE_SECRET_KEY as its exchange secret (no new secret env).
ok("stripe reuses STRIPE_SECRET_KEY as the client secret env", resolveOAuthProvider("stripe_test")?.clientSecretEnv === "STRIPE_SECRET_KEY");
// Sentry + Supabase are refreshable; GitHub/Vercel/Stripe are not.
ok("refreshable flags are correct (sentry+supabase yes; github/vercel/stripe no)",
  resolveOAuthProvider("sentry")?.refreshable === true && resolveOAuthProvider("supabase")?.refreshable === true &&
  resolveOAuthProvider("github")?.refreshable === false && resolveOAuthProvider("vercel")?.refreshable === false && resolveOAuthProvider("stripe_test")?.refreshable === false);
// Vercel + Stripe persist extra callback params.
ok("vercel persists teamId/configurationId; stripe persists stripe_user_id",
  (resolveOAuthProvider("vercel")?.persistCallbackParams ?? []).includes("teamId") &&
  (resolveOAuthProvider("stripe_test")?.persistCallbackParams ?? []).includes("stripe_user_id"));

// Gating: Supabase is gated by SUPABASE_OAUTH_ENABLED; the others are not.
const supabase = resolveOAuthProvider("supabase")!;
delete process.env.SUPABASE_OAUTH_ENABLED;
ok("supabase gate is CLOSED without the flag", providerGateOpen(supabase) === false);
process.env.SUPABASE_OAUTH_ENABLED = "1";
ok("supabase gate OPENS with the flag = 1", providerGateOpen(supabase) === true);
ok("non-gated providers are always gate-open", providerGateOpen(resolveOAuthProvider("github")!) === true);

// Availability = configured AND gate-open. With no creds, nothing is available.
delete process.env.GITHUB_CONNECT_CLIENT_ID; delete process.env.GITHUB_CONNECT_CLIENT_SECRET;
ok("a provider with no creds is not configured and not available",
  providerConfigured(resolveOAuthProvider("github")!) === false && providerAvailable(resolveOAuthProvider("github")!) === false);
process.env.GITHUB_CONNECT_CLIENT_ID = "x"; process.env.GITHUB_CONNECT_CLIENT_SECRET = "y";
ok("configured + non-gated => available", providerAvailable(resolveOAuthProvider("github")!) === true);
// Even configured, a gated provider is unavailable until the flag opens.
process.env.SUPABASE_OAUTH_CLIENT_ID = "x"; process.env.SUPABASE_OAUTH_CLIENT_SECRET = "y";
delete process.env.SUPABASE_OAUTH_ENABLED;
ok("configured BUT gated => not available (Supabase safety)", providerAvailable(supabase) === false);

// Everything authorizes in a popup; Vercel's multi-step install just gets a bigger one.
ok("all providers use a popup (no redirect-only), vercel with a larger window",
  resolveOAuthProvider("vercel")?.authorizeWindow === undefined &&
  resolveOAuthProvider("github")?.authorizeWindow === undefined &&
  (resolveOAuthProvider("vercel")?.popupSize?.w ?? 0) > 620 &&
  resolveOAuthProvider("github")?.popupSize === undefined);

// One shared callback path per provider (the same URL serves per-app + account).
ok("callback path is the shared /apps/oauth/callback/<kind>", callbackPath("vercel") === "/api/preflight/apps/oauth/callback/vercel");

// buildAuthorizeUrl: standard style appends client_id + state; Vercel install style builds the /new URL from
// the slug and sends ONLY state (no client_id/scope on the authorize URL).
process.env.GITHUB_CONNECT_CLIENT_ID = "gh_id";
const ghAuth = buildAuthorizeUrl(resolveOAuthProvider("github")!, { state: "S", redirectUri: "https://app.vraelis.com/cb" });
ok("standard authorize URL has client_id + state + response_type",
  !!ghAuth && ghAuth.includes("client_id=gh_id") && ghAuth.includes("state=S") && ghAuth.includes("response_type=code"));

process.env.VERCEL_INTEGRATION_SLUG = "vraelis";
const vAuth = buildAuthorizeUrl(resolveOAuthProvider("vercel")!, { state: "S", redirectUri: "https://app.vraelis.com/cb" });
ok("vercel install authorize URL is /integrations/<slug>/new with ONLY state (no client_id)",
  vAuth === "https://vercel.com/integrations/vraelis/new?state=S");
delete process.env.VERCEL_INTEGRATION_SLUG;
ok("vercel install authorize URL is null without the slug (fails closed)",
  buildAuthorizeUrl(resolveOAuthProvider("vercel")!, { state: "S", redirectUri: "https://app.vraelis.com/cb" }) === null);

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
