// Regression tests for the production-context onboarding: the secret vault, the connection graph rules,
// the conservative boundary defaults, and the honesty of the workspace UI (three connection states, no
// fake OAuth, masked credentials). Pure unit tests + static source checks; no DB, no network, no browser.
import { readFileSync } from "node:fs";
import { sealSecret, openSecret, maskSecretValue, vaultConfigured, VaultUnconfiguredError } from "../lib/preflight/secret-vault";
import { sanitizeConnectionMeta, redactSecretyValue, normalizeBoundaries, normalizeContextSources, DEFAULT_BOUNDARIES, CONNECTION_KINDS } from "../lib/preflight/connections-db";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

// ── Secret vault (key injected only for this process; never a real secret) ──
const TEST_KEY = "a".repeat(64);
delete process.env.VRAELIS_SECRET_KEY;
ok("vault reports unconfigured without a key", !vaultConfigured());
let threwWithoutKey = false;
try { sealSecret({ username: "u", password: "p" }); } catch (e) { threwWithoutKey = e instanceof VaultUnconfiguredError; }
ok("sealing REFUSES without a key (fail closed, never plaintext fallback)", threwWithoutKey);

process.env.VRAELIS_SECRET_KEY = TEST_KEY;
ok("vault reports configured with a 64-hex key", vaultConfigured());
const sealed1 = sealSecret({ username: "tester@example.com", password: "hunter2!" });
const sealed2 = sealSecret({ username: "tester@example.com", password: "hunter2!" });
ok("sealed blob is versioned and opaque", sealed1.startsWith("v1:") && !sealed1.includes("hunter2"));
ok("identical payloads seal to DIFFERENT blobs (fresh IV per seal)", sealed1 !== sealed2);
const opened = openSecret(sealed1);
ok("roundtrip returns the exact credentials", opened.username === "tester@example.com" && opened.password === "hunter2!");
let tampered = false;
try { openSecret(sealed1.slice(0, -4) + (sealed1.endsWith("AAAA") ? "BBBB" : "AAAA")); } catch { tampered = true; }
ok("a tampered blob throws (GCM auth) instead of decrypting to garbage", tampered);
ok("mask shows at most 2 characters and never the length", maskSecretValue("tester@example.com") === "te••••" && maskSecretValue("") === "••••");
process.env.VRAELIS_SECRET_KEY = "";

// ── Connection metadata: the non-secret half stays non-secret ──
const dirty = sanitizeConnectionMeta({
  repo: "acme/dashboard", branch: "main", api_key: "sk_live_123", password: "oops",
  Authorization_Token: "Bearer xyz", stripe_secret: "sk_test_1", nested: { deep: "x" } as unknown as string,
  urls: ["https://a.example", "https://b.example"], count: 3, enabled: true,
});
ok("secret-looking keys are DROPPED from connection metadata, never stored",
  !("api_key" in dirty) && !("password" in dirty) && !("Authorization_Token" in dirty) && !("stripe_secret" in dirty));
ok("safe metadata survives sanitization (strings, arrays, numbers, booleans)",
  dirty.repo === "acme/dashboard" && Array.isArray(dirty.urls) && dirty.count === 3 && dirty.enabled === true);
ok("nested objects are dropped (metadata stays flat and auditable)", !("nested" in dirty));
ok("test_account is a known kind but only reachable via the sealed path", (CONNECTION_KINDS as readonly string[]).includes("test_account"));

// ── Adversarial-review fixes locked in ──
// 1. VALUE-channel guard: recognizable credential formats pasted into benign-keyed free text are redacted.
ok("a Stripe key pasted into a notes VALUE is redacted before storage",
  String(sanitizeConnectionMeta({ notes: "use sk_live_abcdEFGH12345678 to test" }).notes).includes("[redacted"));
ok("password:value pairs in free text are redacted", redactSecretyValue("log in with password: hunter2!").includes("[redacted"));
ok("JWTs, GitHub tokens, AWS keys, private-key blocks are redacted",
  [redactSecretyValue("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.x"), redactSecretyValue("ghp_abcdefghijklmnopqrstuv1234567890"), redactSecretyValue("AKIAIOSFODNN7EXAMPLE"), redactSecretyValue("-----BEGIN RSA PRIVATE KEY-----")].every((v) => v.includes("[redacted")));
ok("ordinary prose survives the value guard untouched", redactSecretyValue("magic links go to the inbox") === "magic links go to the inbox");
// 2 + 3. Honest revocation: deletes report success only when a row was removed.
const connDbSrc = readFileSync("lib/preflight/connections-db.ts", "utf8");
ok("removeConnection counts deleted rows (no false 'revoked' on a zero-row delete)",
  /removeConnection[\s\S]{0,600}\.select\("id"\)[\s\S]{0,200}data\.length > 0/.test(connDbSrc));
ok("deleteApplication counts deleted rows too", /deleteApplication[\s\S]{0,600}\.select\("id"\)/.test(readFileSync("lib/v-applications.ts", "utf8")));
ok("secrets DELETE returns 404 when nothing was revoked", readFileSync("app/api/preflight/apps/[id]/secrets/route.ts", "utf8").includes("Nothing was revoked"));
// 2. No credential loss on partial failure: every account attempted, failures stay on-page for retry.
const uiSrc = readFileSync("app/rank/app/applications/new/connect-form.tsx", "utf8");
// The summary's REQUIRED set must include EVERY field the submit button gates on — otherwise the panel
// shows "all required complete" while the button is still disabled (the app name was the hidden gate).
ok("the connect button gates on url + name + ownership (canSubmit)",
  /canSubmit = urlOk && nameOk && own/.test(uiSrc));
ok("the REQUIRED summary lists Application name (so it can't say complete while the button is disabled)",
  uiSrc.includes('summaryRow("Application name", nameOk)') && /requiredDone = .*nameOk \? 1 : 0/.test(uiSrc));
ok("a disabled connect button explains the first unmet requirement (never a dead button with no reason)",
  uiSrc.includes("!canSubmit && !busy") && uiSrc.includes("Add an application name to continue"));
ok("secret storage attempts EVERY account and keeps failures in state for retry",
  uiSrc.includes("storeAccounts") && uiSrc.includes("Retry storing test accounts") && /failed\.map\(\(f\) => f\.account\)/.test(uiSrc));
const failStart = uiSrc.indexOf("if (failed.length) {");
const failBranch = failStart >= 0 ? uiSrc.slice(failStart, uiSrc.indexOf("return;", failStart) + 7) : "";
ok("a partial secret failure never navigates away (plaintext would be lost)",
  failBranch.length > 0 && !failBranch.includes("router.push") && failBranch.includes("setBusy(false)"));
ok("free-text fields warn against credentials next to where they are typed", uiSrc.includes("no passwords here") || uiSrc.includes("Never put a password"));

// ── Boundaries: conservative by default ──
ok("DEFAULT_BOUNDARIES denies every permit", Object.entries(DEFAULT_BOUNDARIES).every(([k, v]) => k === "allowed_domains" ? Array.isArray(v) && v.length === 0 : v === false));
const b = normalizeBoundaries({ permit_db_writes: true, permit_email: "yes", allowed_domains: ["App.Example.com ", 7, ""] });
ok("normalizeBoundaries: only explicit true enables a permit (\"yes\" string does not)", b.permit_db_writes === true && b.permit_email === false);
ok("normalizeBoundaries: domains lowercased, trimmed, non-strings dropped", b.allowed_domains.length === 1 && b.allowed_domains[0] === "app.example.com");
ok("missing boundaries normalize to full denial", JSON.stringify(normalizeBoundaries(undefined)) === JSON.stringify({ ...DEFAULT_BOUNDARIES }));

// ── Context sources: bounded, typed, honest truncation ──
const src = normalizeContextSources([
  { kind: "prd", name: "spec.md", content: "x".repeat(70_000) },
  { kind: "unknown_kind", name: "bad", content: "hello" },
  { kind: "requirements", content: "  " },
  { kind: "readme", content: "hello" },
]);
ok("URL-only connection is valid: no sources normalize to an empty list", normalizeContextSources(undefined).length === 0);
ok("unknown kinds and empty content are rejected", src.length === 2);
ok("oversized sources are truncated with an honest marker", src[0].content.includes("[truncated by Vraelis"));

// ── Static source checks: the routes and UI hold the security lines ──
const secretsRoute = readFileSync("app/api/preflight/apps/[id]/secrets/route.ts", "utf8");
ok("secrets route never echoes the password back (no password value in any response body)",
  !/NextResponse\.json\([^)]*\bpassword\s*:/.test(secretsRoute) && !/json\(\{[^}]*body\?*\.password/.test(secretsRoute));
ok("secrets route returns masks only on list", secretsRoute.includes("username_mask") && !secretsRoute.includes("encrypted_ref"));
ok("secrets route fails closed when the vault is unconfigured (503, nothing stored)", secretsRoute.includes("vault_unconfigured"));
// Owner-gating is now the gate()/gatePreflightApp() helper: every handler gates first, short-circuits to the
// gate's (owner-scoped 404/403) response on failure, and runs every data-plane op on the gated owner g.owner.
ok("secrets route is owner-gated before any read or write",
  secretsRoute.includes("gatePreflightApp(")
  && /if \(g instanceof NextResponse\) return g;/.test(secretsRoute)
  && /addTestAccount\(g\.owner/.test(secretsRoute)
  && /listConnections\(g\.owner/.test(secretsRoute)
  && /removeConnection\(g\.owner/.test(secretsRoute));

const connDb = readFileSync("lib/preflight/connections-db.ts", "utf8");
ok("list reads NEVER select the ciphertext column",
  !/listConnections[\s\S]{0,400}encrypted_ref/.test(connDb));
ok("every connections-db query is owner-scoped (eq user_id)", (connDb.match(/eq\("user_id"/g) ?? []).length >= 6);
ok("openTestAccount is documented worker-only and never IMPORTED by the secrets route",
  connDb.includes("WORKER-ONLY") && !/import[^;]*openTestAccount/.test(secretsRoute));

// The chips + manual forms were extracted to the shared _connections modules (S2) so the management
// page reuses them; the honesty assertions follow the code.
const ui = readFileSync("app/rank/app/applications/new/connect-form.tsx", "utf8");
const sharedBrand = readFileSync("app/rank/app/applications/_connections/brand.tsx", "utf8");
const sharedForms = readFileSync("app/rank/app/applications/_connections/forms.tsx", "utf8");
ok("UI: unbuilt integrations say Coming later (never fake active buttons)",
  ui.includes("<ComingLater") && sharedBrand.includes("Coming later") && !/function ComingLater[\s\S]*?<button/.test(sharedBrand) && !ui.includes("SoonButton"));
// OAuth is honestly deferred: the manual form labels itself "Manual connection" (metadata only) and points
// the user at the real post-setup authorization path (Connect GitHub on the Connections tab), never faking an
// inline OAuth. The exact wording is not pinned; the honest deferral to the real connect path is.
ok("UI: manual connections are labeled as manual, OAuth honestly deferred (and the shared forms actually render the connect path)",
  sharedForms.includes("Manual connection")
  && /Connect GitHub[\s\S]{0,80}Connections tab[\s\S]{0,40}after setup/.test(sharedForms)
  && ui.includes('from "../_connections/forms"'));
ok("UI: credentials are masked client-side and excluded from the persisted draft payload",
  ui.includes("••••") && ui.includes("excluded from saved drafts") && !/JSON\.stringify\(\{[^}]*\baccounts\b/.test(ui));
ok("UI: conservative boundary defaults (every permit starts false)",
  ui.includes("account_creation: false") && ui.includes("test_purchases: false"));
ok("UI: the fixed never-rules are shown", ui.includes("never performs destructive actions") && ui.includes("never uses live payment methods"));
ok("UI: ownership attestation is required to submit", ui.includes("own && !busy") || /canSubmit[^;]*own/.test(ui));
ok("UI: sticky summary rail with required/recommended states", ui.includes("Connection summary") && ui.includes("sticky"));
ok("UI: never asks for a Stripe secret key", ui.includes("Never enter a secret key"));

const appsRoute = readFileSync("app/api/preflight/apps/route.ts", "utf8");
ok("app create accepts connections but refuses test_account on that payload (secrets go to the sealed route)",
  appsRoute.includes('provider === "test_account"') && appsRoute.includes("continue"));
ok("migration 1 cascades connection + secret deletion with the application",
  readFileSync("sql/vraelis-preflight.sql", "utf8").includes("references v_applications(id) on delete cascade"));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
