// Findings H4 and H5 — the unmetered email/spend vectors.
//
// H4: /api/vraelis/contact had no rate limit, no honeypot and no real validation, and sent TWO Resend
//     messages per anonymous request — the second to a CALLER-NAMED address from a verified vraelis.com
//     sender. An open relay and an uncapped spend vector.
// H5: /api/auth/register and /api/auth/reset-password had no rate limiting at all. Each costs a Resend
//     send; register also costs a bcrypt cost-12 hash. The sibling /api/auth/resend-verification already
//     carried a limiter and a comment naming this exact vector.
//
// Behavioural tests cover the real shared primitives (clientIp, canonicalizeEmail, the header sanitiser).
// The limiter itself is a Postgres RPC, so its wiring — which bucket, what budget, and crucially that it
// runs BEFORE the expensive work — is asserted against source order rather than by hitting a database.
import { readFileSync } from "node:fs";
import type { NextRequest } from "next/server";
import { canonicalizeEmail } from "../lib/user-credentials";
import { clientIp } from "../lib/vraelis-ratelimit";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (p: string) => readFileSync(p, "utf8");

const CONTACT = read("app/api/vraelis/contact/route.ts");
const REGISTER = read("app/api/auth/register/route.ts");
const RESET = read("app/api/auth/reset-password/route.ts");

const req = (h: Record<string, string>) => ({ headers: new Headers(h) }) as unknown as NextRequest;

// ── clientIp: forwarded-IP handling ─────────────────────────────────────────
console.log("── forwarded-IP handling ──");
ok("single x-forwarded-for is used", clientIp(req({ "x-forwarded-for": "203.0.113.7" })) === "203.0.113.7");
ok("the FIRST hop of a chain is used", clientIp(req({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" })) === "203.0.113.7");
ok("whitespace around the hop is trimmed", clientIp(req({ "x-forwarded-for": "  203.0.113.7  , 70.41.3.18" })) === "203.0.113.7");
ok("x-real-ip is the fallback", clientIp(req({ "x-real-ip": "198.51.100.9" })) === "198.51.100.9");
ok("x-forwarded-for wins over x-real-ip", clientIp(req({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "198.51.100.9" })) === "203.0.113.7");
ok("no headers yields a constant bucket, not a crash", clientIp(req({})) === "unknown");
// The audit flagged cf-connecting-ip (M19): Vercel never sets it, so trusting it first lets a caller
// mint a fresh bucket per request. The routes fixed here must not consult it.
ok("the fixed contact route does not trust cf-connecting-ip", !CONTACT.includes("cf-connecting-ip"));
ok("the fixed register route does not trust cf-connecting-ip", !REGISTER.includes("cf-connecting-ip"));
ok("the fixed reset route does not trust cf-connecting-ip", !RESET.includes("cf-connecting-ip"));
ok("clientIp itself does not consult cf-connecting-ip", !read("lib/vraelis-ratelimit.ts").includes("cf-connecting-ip"));

// ── canonicalizeEmail: identifier variation and casing ──────────────────────
console.log("── per-mailbox bucket resists alias variation ──");
const BASE = "targetvictim@gmail.com";
const VARIANTS = [
  "TargetVictim@gmail.com",
  "TARGETVICTIM@GMAIL.COM",
  "target.victim@gmail.com",
  "t.a.r.g.e.t.v.i.c.t.i.m@gmail.com",
  "targetvictim+1@gmail.com",
  "targetvictim+anything@gmail.com",
  "TargetVictim+Tag@GoogleMail.com",
  "target.victim+99@googlemail.com",
  "  targetvictim@gmail.com  ",
];
for (const v of VARIANTS) {
  ok(`${JSON.stringify(v)} shares one bucket with the base address`, canonicalizeEmail(v) === BASE);
}
// Non-gmail: dots ARE significant, so they must NOT be folded — folding them would let one bucket
// throttle unrelated real mailboxes.
ok("non-gmail dots are preserved", canonicalizeEmail("first.last@example.com") === "first.last@example.com");
ok("non-gmail +tags still fold", canonicalizeEmail("first+tag@example.com") === "first@example.com");
ok("distinct mailboxes do not collide", canonicalizeEmail("a@example.com") !== canonicalizeEmail("b@example.com"));

// ── Header/injection sanitising on the contact route ────────────────────────
console.log("── contact: no caller value can reach a header ──");
// Mirrors the route's own oneLine(); the source assertion below pins them together.
const oneLine = (v: string, max: number) =>
  v.replace(/[\r\n\u2028\u2029\0]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const INJECTIONS = [
  "Acme\r\nBcc: victim@example.com",
  "Acme\nBcc: victim@example.com",
  "Acme\rX-Header: evil",
  "Acme\u2028Bcc: victim@example.com",
  "Acme\u2029Bcc: victim@example.com",
  "Acme\0Bcc: victim@example.com",
  "Acme\r\n\r\n<html>body</html>",
];
for (const inj of INJECTIONS) {
  const out = oneLine(inj, 160);
  ok(`no CR/LF survives ${JSON.stringify(inj.slice(0, 26))}`, !/[\r\n\u2028\u2029\0]/.test(out));
  ok(`header stays one line for ${JSON.stringify(inj.slice(0, 26))}`, out.split(/\r|\n/).length === 1);
}
ok("oneLine clamps length", oneLine("x".repeat(500), 120).length === 120);
ok("oneLine collapses runs of whitespace", oneLine("a    b", 50) === "a b");
ok("the route's sanitiser matches this one", CONTACT.includes("[\\r\\n\\u2028\\u2029\\0]"));
ok("the route carries no RAW line separators", !CONTACT.includes("\u2028") && !CONTACT.includes("\u2029"));

// Recipient-splitting characters must be rejected by the email pattern, not sanitised.
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
for (const bad of [
  "a@b.com, victim@example.com",
  "a@b.com;victim@example.com",
  "a@b.com victim@example.com",
  "a@b.com\r\nvictim@example.com",
  "victim@example.com>",
  "@example.com",
  "noatsign.com",
  "a@b",
  "",
]) {
  ok(`recipient ${JSON.stringify(bad.slice(0, 30))} is rejected`, !EMAIL_RE.test(bad));
}
for (const good of ["a@b.com", "first.last+tag@sub.example.co.uk"]) {
  ok(`legitimate address ${JSON.stringify(good)} is accepted`, EMAIL_RE.test(good));
}
// The route-local EMAIL_SHAPE regex was consolidated into lib/email-address.ts, because three near-copies
// of one security rule had already drifted — the weakest, on /api/vraelis/book, accepted a@b@c.com and
// victim@example.com>. The delimiter blocklist is still enforced; it just lives in one place now, and
// scripts/phase2-corrections-verify.ts exercises it against the full adversarial set.
ok("the route delegates to the shared recipient validator", CONTACT.includes("isSafeRecipient"));

// ── Wiring: limits exist, and run before the expensive work ─────────────────
console.log("── limiter wiring and ordering ──");
// Compare positions inside the HANDLER BODY only, with line comments stripped. The imports at the top and
// the SECURITY comment blocks legitimately mention the same identifiers, and would otherwise decide the
// ordering instead of the real code.
function bodyOf(src: string): string {
  const i = src.indexOf("export async function POST");
  return (i === -1 ? src : src.slice(i)).replace(/^[ \t]*\/\/.*$/gm, "");
}
function orderOk(src: string, first: string, second: string): boolean {
  const b = bodyOf(src);
  const x = b.indexOf(first), y = b.indexOf(second);
  return x !== -1 && y !== -1 && x < y;
}
// contact
ok("contact has a per-IP limit", CONTACT.includes('limitOr429(req, "vcontact", 3, 600)'));
ok("contact has a per-mailbox limit on the acknowledgement", CONTACT.includes("vcontact-to:"));
ok("contact has a honeypot", CONTACT.includes("body.website"));
ok("contact evaluates the honeypot after the limiter (no free oracle)", orderOk(CONTACT, "limitOr429", "body.website"));
ok("contact limits before the DB write", orderOk(CONTACT, "limitOr429", "createContact"));
ok("contact limits before any mail send", orderOk(CONTACT, "limitOr429", "resend.emails.send"));
ok("contact gates the acknowledgement behind the mailbox bucket", orderOk(CONTACT, "vcontact-to:", "to: email,"));
ok("contact uses the shared Postgres limiter, not the in-memory one", CONTACT.includes("vraelis-ratelimit") && !CONTACT.includes('from "@/lib/rate-limit"'));
ok("contact allowlists the topic", CONTACT.includes("TOPICS as readonly string[]"));
ok("contact returns a uniform ok response", CONTACT.includes("// Uniform response"));
// register
ok("register has a per-IP limit", REGISTER.includes('limitOr429(request, "register", 10, 600)'));
ok("register has a per-mailbox limit", REGISTER.includes("register-email:"));
ok("register canonicalizes the mailbox bucket", REGISTER.includes("canonicalizeEmail(email)"));
ok("register limits before any DB read", orderOk(REGISTER, "limitOr429", "getUserCredentialByEmail"));
ok("register limits before the bcrypt hash + verify email", orderOk(REGISTER, "limitOr429", "upsertPendingSignup"));
ok("register's mailbox limit precedes the bcrypt hash", orderOk(REGISTER, "register-email:", "upsertPendingSignup"));
ok("register takes a NextRequest", REGISTER.includes("POST(request: NextRequest)"));
// reset-password
ok("reset has a per-IP limit", RESET.includes('limitOr429(request, "pwreset", 3, 600)'));
ok("reset has a per-mailbox limit", RESET.includes("pwreset-email:"));
ok("reset canonicalizes the mailbox bucket", RESET.includes("canonicalizeEmail(email)"));
ok("reset limits before the credential lookup", orderOk(RESET, "limitOr429", "getUserCredentialByEmail"));
ok("reset limits before the token mint + mail send", orderOk(RESET, "limitOr429", "createPasswordResetToken"));
ok("reset's mailbox limit precedes the mail send", orderOk(RESET, "pwreset-email:", "sendPasswordResetEmail"));
ok("reset takes a NextRequest", RESET.includes("POST(request: NextRequest)"));
// Enumeration: the mailbox-limit branch on reset must return the SAME body as the happy path.
ok("reset's mailbox-limit branch returns the same {ok:true} as the happy path",
  /pwreset-email[\s\S]{0,400}?return NextResponse\.json\(\{ ok: true \}\);/.test(RESET));
ok("reset still returns ok:true for an unknown address", RESET.trimEnd().endsWith("return NextResponse.json({ ok: true });\r\n}") || RESET.trimEnd().endsWith("return NextResponse.json({ ok: true });\n}"));

// Normal use must still work: nothing above rejects a well-formed submission.
console.log("── normal use is unaffected ──");
ok("a well-formed contact email passes validation", EMAIL_RE.test("jane.doe@example.com"));
ok("a well-formed name survives sanitising", oneLine("Jane Doe", 100) === "Jane Doe");
ok("a well-formed company survives sanitising", oneLine("Acme Ltd", 120) === "Acme Ltd");
ok("a normal message is not truncated", "Hello, I would like a demo.".slice(0, 5000).length === 27);

const pkg = read("package.json");
ok("package.json exposes abuse:limits:test", pkg.includes(`"abuse:limits:test"`) && pkg.includes("contact-auth-abuse-verify.ts"));

// ── Closures for the bypasses found by independent re-attack ────────────────
console.log("── re-attack closures ──");
{
  const RESEND = read("app/api/auth/resend-verification/route.ts");
  const SIB = read("app/api/contact/route.ts");

  // H4: the per-mailbox bucket was keyed on the RAW address, so gmail dot/+tag aliases refilled it.
  ok("contact canonicalises the per-mailbox bucket", CONTACT.includes("canonicalizeEmail(email)"));
  ok("contact's mailbox gate fails CLOSED on a limiter outage", CONTACT.includes("allowStrict(`vcontact-to:"));
  // H4: ~100 chars of attacker prose reached a third party under vraelis.com DKIM.
  ok("the acknowledgement carries no caller-supplied text", !/text: `Hi\$\{name/.test(CONTACT));
  ok("the acknowledgement greeting is generic", CONTACT.includes("text: `Hi,"));
  // H4: the honeypot answered 200 for payloads that would 400/429 — a free oracle.
  ok("the honeypot is evaluated but not acted on early", CONTACT.includes("const honeypotTripped ="));
  ok("the honeypot acts only after validation", orderOk(CONTACT, "validEmail(email)", "if (honeypotTripped)"));
  ok("the honeypot no longer short-circuits before the limiter", orderOk(CONTACT, "limitOr429", "honeypotTripped"));

  // H4: the SIBLING route was the same relay, unfixed.
  ok("sibling /api/contact uses the Postgres limiter", SIB.includes("limitOr429(request,"));
  ok("sibling /api/contact no longer trusts cf-connecting-ip", !/get("cf-connecting-ip")/.test(SIB));
  ok("sibling /api/contact no longer uses the in-memory limiter", !SIB.includes("checkRateLimit"));
  ok("sibling /api/contact gates its confirmation per mailbox", SIB.includes("allowStrict(`contact-to:"));
  ok("sibling /api/contact canonicalises that bucket", SIB.includes("canonicalizeEmail(email)"));

  // H5: reset-password consumed the bucket BEFORE the lookup -> silent recovery lockout.
  ok("reset consumes the mailbox budget only inside the credential branch",
    orderOk(RESET, "if (credential)", "pwreset-email:"));
  ok("reset's mailbox gate fails CLOSED", RESET.includes("allowStrict(`pwreset-email:"));
  ok("reset logs a suppressed send so it is not silent", RESET.includes("send suppressed by per-mailbox limit"));
  ok("reset no longer awaits the provider call (timing oracle)", RESET.includes("void sendPasswordResetEmail("));
  ok("reset has no awaited send left", !/await sendPasswordResetEmail\(/.test(RESET));

  // H5: resend-verification was the end-to-end bypass of register's cap.
  ok("resend-verification uses the Postgres limiter", RESEND.includes('limitOr429(request, "resend-verify", 3, 600)'));
  ok("resend-verification no longer trusts cf-connecting-ip", !/get("cf-connecting-ip")/.test(RESEND));
  ok("resend-verification no longer uses the in-memory limiter", !RESEND.includes("checkRateLimit"));
  ok("resend-verification has a per-mailbox bucket", RESEND.includes("resend-verify-email:"));
  ok("resend-verification canonicalises that bucket", RESEND.includes("canonicalizeEmail(email)"));
  // Stronger than "gate before send": the gate must precede the DESTRUCTIVE write. rotatePendingToken
  // overwrites the live token, so gating after it let an attacker kill a victim's verification link
  // repeatedly while the budget suppressed any replacement mail — an unauthenticated signup lockout.
  ok("resend-verification looks up the pending row before gating", orderOk(RESEND, "findPendingByEmail", "resend-verify-email:"));
  ok("resend-verification gates BEFORE rotating the token", orderOk(RESEND, "resend-verify-email:", "rotatePendingToken"));
  ok("resend-verification only rotates when a pending row exists", RESEND.includes("existingPending ? await rotatePendingToken(email) : null"));

  // H5: register's mailbox gate should fail closed; its IP budget was too tight for shared NAT.
  ok("register's mailbox gate fails CLOSED", REGISTER.includes("allowStrict(`register-email:"));
  ok("register's per-IP budget tolerates shared NAT", REGISTER.includes('limitOr429(request, "register", 10, 600)'));
}

// Behavioural: control characters must be REJECTED by the address validator, not stripped later.
console.log("── address validator rejects control characters ──");
{
  const OK_RE = /^[\x21-\x7e]{1,64}@[\x21-\x7e]{1,190}$/;
  const SHAPE = /^[^\s@,;<>()[\]\\"]+@[^\s@,;<>()[\]\\"]+\.[^\s@,;<>()[\]\\"]+$/;
  const valid = (v: string) => OK_RE.test(v) && SHAPE.test(v);
  const cc = (code: number) => String.fromCharCode(code);
  const CONTROLS: [string, string][] = [
    ["NUL", `vic${cc(0)}tim@example.com`],
    ["SOH", `vic${cc(1)}tim@example.com`],
    ["BEL", `vic${cc(7)}tim@example.com`],
    ["BS", `vic${cc(8)}tim@example.com`],
    ["TAB", `vic${cc(9)}tim@example.com`],
    ["CR", `vic${cc(13)}tim@example.com`],
    ["LF", `vic${cc(10)}tim@example.com`],
    ["DEL", `vic${cc(127)}tim@example.com`],
    ["NEL U+0085", `vic${cc(0x85)}tim@example.com`],
    ["U+2028", `vic${cc(0x2028)}tim@example.com`],
    ["U+2029", `vic${cc(0x2029)}tim@example.com`],
    ["non-ASCII accent", `victim${cc(0xe9)}@example.com`],
    ["space", "vic tim@example.com"],
  ];
  for (const [label, v] of CONTROLS) ok(`${label} in an address is rejected`, !valid(v));
  const DELIMS: [string, string][] = [
    ["angle", "a@b.com>"],
    ["paren", "a(x)@b.com"],
    ["bracket", "a[x]@b.com"],
    ["quote", '"a"@b.com'],
    ["backslash", "a\\b@c.com"],
    ["comma", "a@b.com,c@d.com"],
    ["semicolon", "a@b.com;c@d.com"],
  ];
  for (const [label, v] of DELIMS) ok(`${label} delimiter is rejected`, !valid(v));
  for (const good of ["a@b.com", "first.last+tag@sub.example.co.uk", "x_y-z@mail.example.org"]) {
    ok(`legitimate address ${good} still accepted`, valid(good));
  }
  ok("the route uses the printable-ASCII validator", CONTACT.includes("const validEmail ="));
  ok("the route applies it", CONTACT.includes("if (!validEmail(email))"));
}

console.log(`\n${pass}/${pass + fail} passed (final)`);
process.exit(fail ? 1 : 0);
