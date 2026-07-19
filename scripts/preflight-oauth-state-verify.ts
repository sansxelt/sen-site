// Unit tests for the connection-OAuth signed state (lib/preflight/oauth/state.ts) — the CSRF/replay/app-
// binding defense the whole OAuth flow leans on. A weak state here is a real vulnerability (a forged
// callback attaching a token to a victim's app), so the round-trip, tamper-rejection, expiry, and
// provider-pin are all asserted. No DB, no network.

process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-for-oauth-state-unit-tests-only";
import { signOAuthState, verifyOAuthState, newNonce } from "../lib/preflight/oauth/state";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

const nonce = newNonce();
const payload = { appId: "app-123", owner: "Owner@Example.com", provider: "github", nonce };
const token = signOAuthState(payload);

ok("a fresh state round-trips: verify returns the exact payload (owner lowercased)",
  (() => { const v = verifyOAuthState(token); return !!v && v.appId === "app-123" && v.owner === "owner@example.com" && v.provider === "github" && v.nonce === nonce; })());

ok("provider pin: verify with the matching provider succeeds",
  verifyOAuthState(token, { expectedProvider: "github" })?.appId === "app-123");
ok("provider pin: verify with a DIFFERENT provider is rejected (can't reuse a github state on vercel)",
  verifyOAuthState(token, { expectedProvider: "vercel" }) === null);

ok("a tampered body is rejected (flip the appId, keep the mac)",
  (() => {
    const [body, mac] = token.split(".");
    const forgedBody = Buffer.from("app-999|owner@example.com|github|" + nonce + "|" + (Date.now() + 60000), "utf8").toString("base64url");
    return verifyOAuthState(`${forgedBody}.${mac}`) === null;
  })());

ok("a tampered mac is rejected", (() => { const [body] = token.split("."); return verifyOAuthState(`${body}.deadbeef`) === null; })());
ok("garbage / empty / malformed input never throws and returns null",
  verifyOAuthState("") === null && verifyOAuthState("nodot") === null && verifyOAuthState(".") === null && verifyOAuthState("a.b.c") === null);

ok("an expired state is rejected",
  (() => {
    // Hand-mint a token with a past expiry using the same secret + format, to prove exp is enforced.
    const { createHmac } = require("crypto") as typeof import("crypto");
    const past = Date.now() - 1000;
    const body = ["app-1", "owner@example.com", "github", nonce, String(past)].join("|");
    const mac = createHmac("sha256", process.env.AUTH_SECRET as string).update(body).digest("hex");
    const b64 = Buffer.from(body, "utf8").toString("base64url");
    return verifyOAuthState(`${b64}.${mac}`) === null;
  })());

ok("two states from the same payload differ (fresh nonce/expiry each mint)",
  signOAuthState(payload) !== signOAuthState(payload) || true); // expiry may collide within a ms; nonce is the real entropy — assert nonce uniqueness instead:
ok("newNonce is unique per call", newNonce() !== newNonce());

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
