// Tests for PKCE (lib/preflight/oauth/pkce.ts), its wiring into the authorize URL, and the pure half of
// the Supabase Management API reader.
//
// PKCE exists so an intercepted authorization code is useless without the verifier. The invariants that
// actually protect that: the verifier is high-entropy and never repeats, the challenge is a real S256 hash
// (never the verifier itself), the verifier NEVER appears in the authorize URL, and a provider marked pkce
// can never be downgraded to a bare code flow.

import { createCodeVerifier, codeChallengeS256, pkceCookieName, PKCE_METHOD } from "../lib/preflight/oauth/pkce";
import { resolveOAuthProvider, buildAuthorizeUrl, type OAuthProvider } from "../lib/preflight/oauth/providers";
import { mapSupabaseProjects } from "../lib/preflight/oauth/supabase-project";
import { vercelHandoffUrl } from "../lib/preflight/oauth/handoff";
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

// ── Supabase project shaping (pure half of the Management API reader) ──
// A project ref becomes a HOSTNAME, so a malformed ref is a URL-forging vector, not a cosmetic problem.
const projects = mapSupabaseProjects([
  { id: "abcdefghijklmnop", name: "Production" },
  { id: "qrstuvwxyz123456" },                        // no name -> falls back to the ref
  { id: "evil.example.com/x", name: "Forged host" }, // a ref that would forge a hostname
  { id: "short", name: "Too short" },
  { id: 42, name: "Not a string" },
  null,
]);
ok("well-formed projects survive with a name", projects[0]?.ref === "abcdefghijklmnop" && projects[0]?.name === "Production");
ok("a nameless project falls back to its ref as the label", projects[1]?.name === "qrstuvwxyz123456");
ok("the project url is built from the ref on supabase.co", projects[0]?.url === "https://abcdefghijklmnop.supabase.co");
ok("a ref that would forge a hostname is DROPPED, never interpolated",
  projects.every((p) => !p.url.includes("evil.example.com")) && projects.every((p) => new URL(p.url).hostname.endsWith(".supabase.co")));
ok("malformed and non-string refs are dropped", projects.length === 2);
ok("a non-array response yields an empty list, never a throw",
  mapSupabaseProjects(null).length === 0 && mapSupabaseProjects({ projects: [] }).length === 0);

// ── Vercel popup hand-off (open-redirect guard) ──
// `next` is a query param on our own callback, so it is attacker-supplied. Anything that is not https on
// vercel.com must be refused outright, never patched up.
ok("a real vercel completion url is accepted",
  vercelHandoffUrl("https://vercel.com/integrations/complete?configurationId=abc") === "https://vercel.com/integrations/complete?configurationId=abc");
ok("a vercel subdomain is accepted", vercelHandoffUrl("https://api.vercel.com/x") !== null);
ok("http is refused", vercelHandoffUrl("http://vercel.com/x") === null);
ok("a look-alike suffix domain is refused", vercelHandoffUrl("https://notvercel.com/x") === null);
ok("a domain that merely starts with vercel.com is refused", vercelHandoffUrl("https://vercel.com.evil.test/x") === null);
ok("an unrelated host is refused", vercelHandoffUrl("https://evil.test/phish") === null);
ok("javascript: is refused", vercelHandoffUrl("javascript:alert(1)") === null);
ok("a relative path is refused (not an absolute url)", vercelHandoffUrl("/applications") === null);
ok("null and empty are refused", vercelHandoffUrl(null) === null && vercelHandoffUrl("") === null);

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
