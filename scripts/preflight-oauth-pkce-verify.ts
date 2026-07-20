// Tests for PKCE (lib/preflight/oauth/pkce.ts) and its wiring into the authorize URL.
//
// PKCE exists so an intercepted authorization code is useless without the verifier. The invariants that
// actually protect that: the verifier is high-entropy and never repeats, the challenge is a real S256 hash
// (never the verifier itself), the verifier NEVER appears in the authorize URL, and a provider marked pkce
// can never be downgraded to a bare code flow.

import { createCodeVerifier, codeChallengeS256, pkceCookieName, PKCE_METHOD } from "../lib/preflight/oauth/pkce";
import { resolveOAuthProvider, buildAuthorizeUrl, type OAuthProvider } from "../lib/preflight/oauth/providers";
import { createHash } from "crypto";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

const v = createCodeVerifier();

ok("verifier is inside the RFC 7636 length range (43-128)", v.length >= 43 && v.length <= 128);
ok("verifier uses only the unreserved base64url alphabet", /^[A-Za-z0-9\-._~]+$/.test(v));
ok("verifiers do not repeat across calls",
  new Set(Array.from({ length: 50 }, () => createCodeVerifier())).size === 50);

const challenge = codeChallengeS256(v);
ok("challenge is the base64url SHA-256 of the verifier, computed independently",
  challenge === createHash("sha256").update(v).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
ok("challenge is NOT the verifier (never a 'plain' downgrade)", challenge !== v);
ok("challenge is base64url with no padding", /^[A-Za-z0-9\-_]+$/.test(challenge));
ok("the method we advertise is S256", PKCE_METHOD === "S256");
ok("the verifier cookie is namespaced per provider", pkceCookieName("supabase") !== pkceCookieName("github"));

// ── wiring into the authorize URL ──
const supabase = resolveOAuthProvider("supabase") as OAuthProvider;
ok("supabase is registered as a PKCE provider", supabase?.pkce === true);

process.env.SUPABASE_OAUTH_CLIENT_ID = "test-client-id";
const url = buildAuthorizeUrl(supabase, {
  state: "signed-state", redirectUri: "https://app.vraelis.com/api/preflight/apps/oauth/callback/supabase", codeChallenge: challenge,
});
ok("authorize url is built when a challenge is supplied", typeof url === "string");
const q = new URL(url as string).searchParams;
ok("authorize url carries the challenge and the S256 method",
  q.get("code_challenge") === challenge && q.get("code_challenge_method") === "S256");

// THE invariant: the secret half never leaves our origin in the authorize step.
ok("the verifier appears NOWHERE in the authorize url", !(url as string).includes(v));
ok("no code_verifier param is sent at authorize time", q.get("code_verifier") === null);

// Fail closed: a PKCE provider with no challenge must NOT fall back to a plain code flow.
ok("a PKCE provider with no challenge returns null (no silent downgrade)",
  buildAuthorizeUrl(supabase, { state: "s", redirectUri: "https://app.vraelis.com/cb" }) === null);

// Non-PKCE providers are untouched: no stray challenge params.
process.env.GITHUB_OAUTH_CLIENT_ID = "gh-client-id";
const gh = resolveOAuthProvider("github") as OAuthProvider;
const ghUrl = buildAuthorizeUrl(gh, { state: "s", redirectUri: "https://app.vraelis.com/cb" });
ok("a non-PKCE provider still builds without a challenge", typeof ghUrl === "string");
ok("a non-PKCE authorize url carries no challenge params",
  !new URL(ghUrl as string).searchParams.has("code_challenge") && !new URL(ghUrl as string).searchParams.has("code_challenge_method"));

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
