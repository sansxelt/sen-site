// Two-step verification, verified offline: the RFC 6238 / RFC 4226 vectors, the ±1 step window, recovery
// code hashing and single use, the email code's ten-minute life and purpose binding, the QR encoder against
// matrices from a reference encoder, and the sign-in gate itself driven through the REAL Auth.js handlers
// (a pending token must read as signed out on both the client and the server session paths, and no update
// payload may complete it without a checked code). Static assertions pin the wiring that cannot run here:
// where auth.ts stamps and clears the pending state, and that no integration surface can list, revoke or
// open the "two_step" row.
//
// No database, no mail: the Supabase and Resend variables are removed BEFORE anything is imported, so every
// read degrades to "off" and every rate-limited attempt fails closed, which is itself asserted.
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import type { Ecc } from "../lib/qr";

for (const k of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "VERCEL_ENV", "AUTH_URL", "NEXTAUTH_URL"]) delete process.env[k];
process.env.AUTH_SECRET = "two-step-verify-probe-not-a-real-credential-0000000000";
process.env.VRAELIS_SECRET_KEY = "a".repeat(64);

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  (${d})` : ""}`); }
};
const read = (p: string) => readFileSync(p, "utf8").replace(/\r/g, "");
// Comments removed, so copy checks read what renders and code checks read what runs.
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const between = (s: string, start: string, end: string) => { const a = s.indexOf(start); return a < 0 ? "" : s.slice(a, s.indexOf(end, a + start.length) < 0 ? undefined : s.indexOf(end, a + start.length)); };

async function main() {
  const ts = await import("../lib/two-step");
  const qr = await import("../lib/qr");

  console.log("── RFC 4226 HOTP (Appendix D) and RFC 6238 TOTP (Appendix B), SHA-1 ──");
  const rfcKey = Buffer.from("12345678901234567890", "ascii");
  const hotpVectors = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
  ok("HOTP counters 0..9 match RFC 4226", hotpVectors.every((v, i) => ts.hotp(rfcKey, i) === v));
  const totpVectors: Array<[number, string]> = [
    [59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"], [1234567890, "89005924"], [2000000000, "69279037"],
  ];
  for (const [t, eight] of totpVectors) {
    const counter = ts.totpCounter(t);
    ok(`T=${t}: 8-digit value is ${eight}`, ts.hotp(rfcKey, counter, 8) === eight, ts.hotp(rfcKey, counter, 8));
    ok(`T=${t}: 6-digit value is its last six digits (${eight.slice(-6)})`, ts.totpAt(rfcKey, t) === eight.slice(-6), ts.totpAt(rfcKey, t));
  }
  ok("T=20000000000 (a counter past 32 bits of seconds) is 65353130", ts.hotp(rfcKey, ts.totpCounter(20000000000), 8) === "65353130");

  console.log("\n── base32 and the ±1 step window ──");
  const b32 = ts.base32Encode(rfcKey);
  ok("base32 of the RFC secret is GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", b32 === "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", b32);
  ok("base32 decodes back byte for byte", ts.base32Decode(b32)!.equals(rfcKey));
  ok("base32 decode tolerates lower case, spaces and padding", ts.base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq==")!.equals(rfcKey));
  ok("base32 decode refuses characters outside the alphabet", ts.base32Decode("GEZD1NBV") === null);
  const fresh = ts.generateTotpSecret();
  ok("a generated secret is 32 base32 characters (160 bits)", /^[A-Z2-7]{32}$/.test(fresh) && ts.base32Decode(fresh)!.length === 20);
  ok("two generated secrets differ", fresh !== ts.generateTotpSecret());
  const T = 1234567890, C = ts.totpCounter(T);
  const at = (dt: number) => ts.totpAt(rfcKey, T + dt);
  ok("the current step's code is accepted and reports its counter", ts.verifyTotp(b32, at(0), T) === C);
  ok("the previous step's code is accepted (clock drift, -1)", ts.verifyTotp(b32, at(-30), T) === C - 1);
  ok("the next step's code is accepted (clock drift, +1)", ts.verifyTotp(b32, at(30), T) === C + 1);
  ok("two steps back is refused", ts.verifyTotp(b32, at(-60), T) === null);
  ok("two steps ahead is refused", ts.verifyTotp(b32, at(60), T) === null);
  ok("spaces inside a typed code are ignored", ts.verifyTotp(b32, `${at(0).slice(0, 3)} ${at(0).slice(3)}`, T) === C);
  ok("a 5-digit or non-numeric code is refused", ts.verifyTotp(b32, at(0).slice(1), T) === null && ts.verifyTotp(b32, "12a456", T) === null);
  const wrong = String((Number(at(0)) + 1) % 1_000_000).padStart(6, "0");
  ok("a wrong code is refused", [at(-30), at(0), at(30)].includes(wrong) || ts.verifyTotp(b32, wrong, T) === null);
  const uri = ts.otpauthUri(fresh, "demo@vraelis.com");
  ok("the otpauth URI names the issuer and account in its label", uri.startsWith("otpauth://totp/Vraelis:demo%40vraelis.com?"));
  const q = new URL(uri.replace("otpauth://", "https://")).searchParams;
  ok("the otpauth URI carries secret, issuer, SHA1, 6 digits, 30 s", q.get("secret") === fresh && q.get("issuer") === "Vraelis" && q.get("algorithm") === "SHA1" && q.get("digits") === "6" && q.get("period") === "30");

  console.log("\n── recovery codes: hashed, account-bound, single use ──");
  const rkey = crypto.randomBytes(32), rkey2 = crypto.randomBytes(32);
  const codes = ts.generateRecoveryCodes();
  ok("ten codes are generated", codes.length === 10);
  ok("all ten are distinct", new Set(codes).size === 10);
  ok("each is xxxxx-xxxxx with no look-alike characters (i, l, o, 0, 1)", codes.every((c) => /^[a-hjkmnp-z2-9]{5}-[a-hjkmnp-z2-9]{5}$/.test(c)));
  const hashes = codes.map((c) => ts.hashRecoveryCode(rkey, "demo@vraelis.com", c));
  ok("a stored hash is not the code and does not contain it", hashes.every((h, i) => /^[0-9a-f]{64}$/.test(h) && !h.includes(ts.normalizeRecoveryCode(codes[i]))));
  ok("hashing is deterministic", ts.hashRecoveryCode(rkey, "demo@vraelis.com", codes[0]) === hashes[0]);
  ok("the hash is keyed: another server key gives another hash", ts.hashRecoveryCode(rkey2, "demo@vraelis.com", codes[0]) !== hashes[0]);
  ok("the hash is bound to the account", ts.hashRecoveryCode(rkey, "someone@else.com", codes[0]) !== hashes[0]);
  ok("a code is found at its index", ts.findRecoveryCode(rkey, "demo@vraelis.com", codes[3], hashes) === 3);
  ok("case, spaces and dash do not matter", ts.findRecoveryCode(rkey, "demo@vraelis.com", ` ${codes[3].toUpperCase().replace("-", " ")} `, hashes) === 3);
  ok("an unknown code is not found", ts.findRecoveryCode(rkey, "demo@vraelis.com", "abcde-fghjk", hashes) === -1 || codes.includes("abcde-fghjk"));
  ok("another account's code is not found", ts.findRecoveryCode(rkey, "someone@else.com", codes[3], hashes) === -1);
  const afterUse = hashes.filter((_, i) => i !== ts.findRecoveryCode(rkey, "demo@vraelis.com", codes[3], hashes));
  ok("once removed (used), the same code is refused and the other nine still work",
    ts.findRecoveryCode(rkey, "demo@vraelis.com", codes[3], afterUse) === -1 && codes.filter((_, i) => i !== 3).every((c) => ts.findRecoveryCode(rkey, "demo@vraelis.com", c, afterUse) >= 0));

  console.log("\n── email codes: exact ten-minute life, purpose and account binding ──");
  const ekey = crypto.randomBytes(32);
  const issued = 1_900_000_000;
  const mail = ts.emailCode(ekey, "demo@vraelis.com", "sign_in", issued);
  ok("an email code is six digits", /^\d{6}$/.test(mail));
  ok("accepted the second it is issued", ts.checkEmailCode(ekey, "demo@vraelis.com", "sign_in", issued, mail, issued) === "ok");
  ok("accepted at 9:59", ts.checkEmailCode(ekey, "demo@vraelis.com", "sign_in", issued, mail, issued + 599) === "ok");
  ok("accepted at exactly 10:00", ts.checkEmailCode(ekey, "demo@vraelis.com", "sign_in", issued, mail, issued + 600) === "ok");
  ok("expired at 10:01", ts.checkEmailCode(ekey, "demo@vraelis.com", "sign_in", issued, mail, issued + 601) === "expired");
  ok("an issue second in the future is refused", ts.checkEmailCode(ekey, "demo@vraelis.com", "sign_in", issued + 5, ts.emailCode(ekey, "demo@vraelis.com", "sign_in", issued + 5), issued) === "invalid");
  ok("a sign-in code does not confirm a settings change (purpose binding)", ts.checkEmailCode(ekey, "demo@vraelis.com", "confirm", issued, mail, issued + 1) !== "ok"
    || ts.emailCode(ekey, "demo@vraelis.com", "confirm", issued) === mail);
  ok("another account's code is refused", ts.checkEmailCode(ekey, "other@vraelis.com", "sign_in", issued, mail, issued + 1) !== "ok"
    || ts.emailCode(ekey, "other@vraelis.com", "sign_in", issued) === mail);
  ok("a different issue second gives a different code", ts.emailCode(ekey, "demo@vraelis.com", "sign_in", issued + 1) !== mail
    || ts.emailCode(ekey, "demo@vraelis.com", "sign_in", issued + 2) !== mail);
  ok("the address is case-insensitive", ts.emailCode(ekey, "Demo@Vraelis.com ", "sign_in", issued) === mail);
  ok("a spaced code is accepted", ts.checkEmailCode(ekey, "demo@vraelis.com", "sign_in", issued, `${mail.slice(0, 3)} ${mail.slice(3)}`, issued + 5) === "ok");
  const db = code("lib/two-step-db.ts");
  ok("single use: a correct email code consumes a limiter key of limit 1 that outlives the code",
    /allowStrict\(`two-step-email-used:\$\{norm\(email\)\}:\$\{purpose\}:\$\{Math\.floor\(at\)\}`, 1, EMAIL_CODE_TTL_S \* 2\)/.test(db));
  ok("replay: a matched authenticator step is consumed (limit 1) for longer than the window accepts it",
    /allowStrict\(`two-step-totp-used:\$\{norm\(email\)\}:\$\{counter\}`, 1, ttl\)/.test(db) && /const ttl = \(2 \* TOTP_WINDOW \+ 2\) \* TOTP_STEP_S/.test(db));
  ok("single use: a recovery code claims a limit-1 key, then is removed from the stored list under compare-and-set",
    /allowStrict\(`two-step-recovery-used:/.test(db) && /recovery\.filter\(\(_, i\) => i !== idx\)/.test(db) && /\.eq\("meta->>rev", String\(prev\.meta\.rev\)\)/.test(db));
  ok("every code check spends a fail-closed attempt (5 per 10 min, 30 per day) before comparing",
    /two-step-verify:\$\{e\}`, 5, 600/.test(db) && /two-step-verify-day:\$\{e\}`, 30, 86400/.test(db)
    && between(db, "export async function verifyProof", "\n}\n").indexOf("spendAttempt(") < between(db, "export async function verifyProof", "\n}\n").indexOf("loadRow("));
  ok("secrets are sealed by the vault; status reads never select encrypted_ref",
    /sealSecret\(\{ totp_secret:/.test(db) && /select\("meta"\)/.test(between(db, "export async function readTwoStepStatus", "\n}\n")));
  ok("a row that cannot be opened is a failure, never 'off'", /catch \{\s*return \{ ok: false \};/.test(between(db, "async function loadRow", "\n}\n")));
  ok("once on, every change needs a current code (proof) from the server's side",
    /requireProofIfOn\(email, proof\)/.test(between(db, "export async function beginTotpSetup", "\n}\n"))
    && /requireProofIfOn\(email, proof\)/.test(between(db, "export async function beginEmailSetup", "\n}\n"))
    && ["removeMethod", "turnOff", "regenerateRecoveryCodes"].every((f) => /verifyProof\(email, proof, "confirm"\)/.test(between(db, `export async function ${f}`, "\n}\n"))));
  ok("recovery codes are generated only when the first method goes on", /const codes = wasOn \? null : generateRecoveryCodes\(\)/.test(db));

  console.log("\n── the QR encoder against a reference encoder (node-qrcode 1.5.4, byte mode) ──");
  const bits = (m: boolean[][]) => crypto.createHash("sha256").update(m.map((r) => r.map((c) => (c ? "1" : "0")).join("")).join("")).digest("hex");
  const known: Array<[string, Ecc, number, number, number, string]> = [
    ["otpauth://totp/Vraelis:demo%40vraelis.com?secret=JBSWY3DPEHPK3PXP&issuer=Vraelis&algorithm=SHA1&digits=6&period=30", "M", 7, 3, 45, "2f705d7b62362b8cdd1131f101a26a1b65717d34badc97bfe6d66ce23283d230"],
    ["HELLO WORLD", "Q", 1, 6, 21, "163d4a57d21b19eadec79aa9a653e5765029abb14ce1fe845c50bc41ecc57e95"],
    ["x".repeat(120) + "0123456789".repeat(18), "L", 11, 5, 61, "49c078277757cb8b86f25aa9d14fecfea1737f501159837cb03f16c1554b7f39"],
  ];
  for (const [text, ecc, version, mask, size, sha] of known) {
    const m = qr.encodeQr(text, ecc, { forceVersion: version, forceMask: mask });
    ok(`v${version}-${ecc} mask ${mask}: ${size}x${size}, module for module equal to the reference`, m.size === size && bits(m.modules) === sha, bits(m.modules).slice(0, 12));
  }
  const auto = qr.encodeQr(ts.otpauthUri(fresh, "someone.with.a.long.address@example-company.co.uk"));
  ok("an otpauth URI for a long address picks the smallest version that fits at level M", auto.version >= 5 && auto.version <= 10 && auto.size === auto.version * 4 + 17);
  const finder = (x: number, y: number) => [0, 6].every((d) => auto.modules[y][x + d] && auto.modules[y + d][x]) && !auto.modules[y + 1][x + 1] && auto.modules[y + 3][x + 3];
  ok("the three finder patterns are in place", finder(0, 0) && finder(auto.size - 7, 0) && finder(0, auto.size - 7));
  const svg = qr.qrSvgPath("otpauth://totp/Vraelis:x%40y.z?secret=ABC");
  ok("the SVG path is rectangles only, inside a 4-module quiet zone", /^(M\d+ \d+h\d+v1h-\d+z)+$/.test(svg.path) && svg.size === qr.encodeQr("otpauth://totp/Vraelis:x%40y.z?secret=ABC").size + 8);

  console.log("\n── the sign-in gate, through the real Auth.js handlers ──");
  const { encode } = await import("@auth/core/jwt");
  const { NextRequest } = await import("next/server");
  const authMod = await import("../auth");
  const session = await import("../lib/two-step-session");
  const origin = "http://localhost:3000";
  const COOKIE = "authjs.session-token";
  const now = Math.floor(Date.now() / 1000);
  const mint = (extra: Record<string, unknown>) => encode({
    token: { email: "demo@vraelis.com", sub: "demo@vraelis.com", name: "demo", provider: "credentials", tv: 0, ...extra },
    secret: process.env.AUTH_SECRET as string, salt: COOKIE, maxAge: 3600,
  });
  const full = await mint({});
  const pending = await mint({ twoStep: "pending", twoStepSince: now, twoStepMethods: ["email"] });
  const stale = await mint({ twoStep: "pending", twoStepSince: now - session.PENDING_TTL_S - 5, twoStepMethods: ["totp"] });

  const clientSession = async (jwt: string) => {
    const res = await authMod.handlers.GET(new NextRequest(`${origin}/api/auth/session`, { headers: { cookie: `${COOKIE}=${jwt}` } }));
    return { body: await res.json(), cookies: res.headers.getSetCookie() };
  };
  // The server-side auth() path, which wraps the session callback as { user: token, ...session }. Reached with
  // the API-route calling form so no Next request context is needed.
  const serverSession = async (jwt: string) => (authMod.auth as unknown as (a: unknown) => Promise<Record<string, unknown> | null>)({
    req: { headers: { host: "localhost:3000", "x-forwarded-proto": "http", cookie: `${COOKIE}=${jwt}` } },
    res: { headers: new Headers() },
  });

  const cFull = await clientSession(full);
  ok("sanity: a complete token reads as signed in (client path)", cFull.body?.user?.email === "demo@vraelis.com");
  const cPend = await clientSession(pending);
  ok("a PENDING token has no user on /api/auth/session", cPend.body && !("user" in cPend.body) && !JSON.stringify(cPend.body).includes("demo@vraelis.com"));
  ok("  and says it is pending, with the methods and a masked address", cPend.body?.twoStep?.pending === true && JSON.stringify(cPend.body.twoStep.methods) === '["email"]' && cPend.body.twoStep.emailHint === "d••••o@vraelis.com");
  const sFull = await serverSession(full);
  ok("sanity: a complete token reads as signed in (server auth() path)", (sFull?.user as { email?: string } | undefined)?.email === "demo@vraelis.com");
  const sPend = await serverSession(pending);
  ok("a PENDING token has no user through server-side auth() (the { user: token, ...session } wrapper is defeated)",
    Boolean(sPend) && !(sPend as { user?: unknown }).user && !JSON.stringify(sPend).includes("demo@vraelis.com"), JSON.stringify(sPend).slice(0, 120));
  const cStale = await clientSession(stale);
  ok("a pending token older than 15 minutes is discarded (no session, cookie cleared)",
    (cStale.body === null || Object.keys(cStale.body).length === 0) && cStale.cookies.some((c) => c.startsWith(`${COOKIE}=;`)));

  // Updates arrive as POST /api/auth/session with a CSRF token, exactly as a browser could send them.
  const csrfRes = await authMod.handlers.GET(new NextRequest(`${origin}/api/auth/csrf`));
  const csrf = (await csrfRes.json()).csrfToken as string;
  const csrfCookie = csrfRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const update = async (jwt: string, data: unknown) => {
    const res = await authMod.handlers.POST(new NextRequest(`${origin}/api/auth/session`, {
      method: "POST",
      headers: { cookie: `${csrfCookie}; ${COOKIE}=${jwt}`, "content-type": "application/json" },
      body: JSON.stringify({ csrfToken: csrf, data }),
    }));
    return res.json();
  };
  const forged = [
    { twoStep: "ok" },
    { twoStep: { pending: false } },
    { user: { email: "demo@vraelis.com" } },
    { twoStep: { action: "verify", method: "email", code: "123456" } },
    { twoStep: { action: "verify", method: "totp", code: "123456" } },
    { twoStep: { action: "verify", method: "recovery", code: "abcde-fghjk" } },
  ];
  const results = [] as unknown[];
  for (const data of forged) results.push(await update(pending, data));
  ok("no update payload completes a pending sign-in without a checked code (6 forged payloads)",
    results.every((r) => r && !(r as { user?: unknown }).user && (r as { twoStep?: { pending?: boolean } }).twoStep?.pending === true), JSON.stringify(results.map((r) => (r as { twoStep?: { notice?: unknown } })?.twoStep?.notice)));
  ok("  an emailed code with no code sent is 'expired'; a method the account lacks is 'invalid'",
    (results[3] as { twoStep: { notice: string } }).twoStep.notice === "expired" && (results[4] as { twoStep: { notice: string } }).twoStep.notice === "invalid");
  ok("  with no limiter reachable, a recovery attempt fails CLOSED ('rate_limited'), never open",
    (results[5] as { twoStep: { notice: string } }).twoStep.notice === "rate_limited");
  const fullAfter = await update(full, { twoStep: { action: "verify", method: "totp", code: "000000" } });
  ok("an update on a COMPLETE session ignores two-step data (still signed in, nothing added)", fullAfter?.user?.email === "demo@vraelis.com" && !fullAfter.twoStep);

  const tok: Record<string, unknown> = { email: "demo@vraelis.com" };
  await session.stampTwoStepOnSignIn(tok as never, "demo@vraelis.com");
  ok("stampTwoStepOnSignIn leaves an account without two-step verification fully signed in", !session.isTwoStepPending(tok as never) && tok.twoStep === undefined);

  console.log("\n── auth.ts wiring (static) ──");
  const a = code("auth.ts");
  const jwtCb = between(a, "async jwt(", "async redirect(");
  ok("the jwt callback stamps the second step on EVERY fresh sign-in (inside `if (account)`)",
    /if \(account\) \{[\s\S]*?token\.tv = await currentTokenVersion\(email\);[\s\S]*?await stampTwoStepOnSignIn\(token, email\);/.test(jwtCb));
  ok("a pending token moves forward only on trigger 'update', otherwise it only ages out",
    /if \(isTwoStepPending\(token\)\) \{\s*return trigger === "update" \? advanceTwoStep\(token, email, session\) : settlePendingOnRead\(token\);/.test(jwtCb));
  ok("the pending check runs AFTER the revocation check (a revoked pending token is still discarded)",
    jwtCb.indexOf("tokenVersionIsCurrent(") < jwtCb.indexOf("isTwoStepPending(token)"));
  const sessCb = between(a, "async session(", "\n    },\n");
  ok("the session callback hands a pending token NO user (explicit undefined, first thing it does)",
    /if \(isTwoStepPending\(token\)\) \{\s*return \{ expires: session\.expires, user: undefined, twoStep: pendingSessionView\(token\) \}/.test(sessCb)
    && sessCb.indexOf("isTwoStepPending") < sessCb.indexOf("session.user.id"));
  ok("leaving a pending sign-in does not revoke the owner's other sessions", /if \(email && token\?\.twoStep !== "pending"\) await bumpTokenVersion\(email, "sign_out"\)/.test(a));
  ok("unstable_update is exported for POST /api/auth/two-step", /export const \{[^}]*unstable_update[^}]*\} = authResult/.test(a));
  const s = code("lib/two-step-session.ts");
  ok("sign-in sets pending unless the settings read SUCCEEDED and says off (a failed read is not a waiver)",
    /if \(read\.ok && !read\.status\.enabled\) return;\s*token\.twoStep = "pending";/.test(s));
  ok("a checked code clears every pending field and sets twoStep = 'ok'",
    /function markVerified\(token: JWT\) \{\s*clearPending\(token\);\s*token\.twoStep = "ok";/.test(s)
    && ["twoStepMethods", "twoStepSince", "twoStepEmailAt", "twoStepNotice"].every((f) => new RegExp(`delete token\\.${f};`).test(between(s, "function clearPending", "\n}\n"))));
  ok("the email code's issue second comes from the TOKEN, never from the request",
    /issuedAt: method === "email" \? Number\(token\.twoStepEmailAt\) : null/.test(s) && !/issuedAt: [^,]*\bd\.|issuedAt: [^,]*\breq\./.test(s));
  const sso = code("lib/v-sso.ts");
  ok("SSO sessions (minted outside the jwt callback) go through the same gate", /await stampTwoStepOnSignIn\(token, norm\(email\)\);/.test(sso) && /twoStepPending/.test(code("app/api/v/sso/oidc/[providerId]/callback/route.ts")));
  const route = code("app/api/auth/two-step/route.ts");
  ok("POST /api/auth/two-step decides nothing itself: it only calls unstable_update", /await unstable_update\(/.test(route) && !/verifyProof|verifyTotp|checkEmailCode/.test(route));

  console.log("\n── the two_step row is never an integration (static) ──");
  const acc = code("lib/preflight/account-connections-db.ts");
  ok('TWO_STEP_PROVIDER is "two_step"', ts.TWO_STEP_PROVIDER === "two_step");
  ok("listAccountConnections excludes it in the query AND in the result",
    /\.neq\("provider", TWO_STEP_PROVIDER\)/.test(between(acc, "export async function listAccountConnections", "\n}\n"))
    && /\.filter\(\(r\) => r\.provider !== TWO_STEP_PROVIDER\)/.test(between(acc, "export async function listAccountConnections", "\n}\n")));
  ok("removeAccountConnection cannot delete it (the connections DELETE route would otherwise turn it off without a code)",
    /\.neq\("provider", TWO_STEP_PROVIDER\)/.test(between(acc, "export async function removeAccountConnection", "\n}\n")));
  const opener = between(acc, "export async function openAccountToken", "\n}\n");
  ok("openAccountToken still requires meta.oauth === true, and also excludes the provider",
    /row\.meta\?\.oauth !== true/.test(opener) && /\.neq\("provider", TWO_STEP_PROVIDER\)/.test(opener));
  ok("the OAuth writers refuse the provider", /if \(provider === TWO_STEP_PROVIDER\) return \{ error: "unsupported_provider" \};/.test(acc)
    && /if \(provider === TWO_STEP_PROVIDER\) return false;/.test(between(acc, "export async function updateAccountOAuthTokens", "\n}\n")));
  ok("an app cannot be linked to it", /if \(provider === TWO_STEP_PROVIDER\) return \{ error: "connection_not_found" \};/.test(code("lib/preflight/connection-links-db.ts")));
  ok("the two-step row is written with meta.oauth = false", /oauth: false, rev: \(prev\?\.meta\.rev \?\? 0\) \+ 1/.test(db));
  ok("the connections REST route lists through listAccountConnections (so the exclusion applies there)",
    /await listAccountConnections\(o\)/.test(code("app/api/preflight/connections/route.ts")));

  console.log("\n── screens and copy ──");
  const signin = code("app/signin/page.tsx");
  ok("/signin renders the code screen for a pending session, before the sign-in form",
    /if \(session\?\.twoStep\?\.pending\)/.test(signin) && signin.indexOf("<TwoStepChallenge") < signin.indexOf("<VraelisSignIn"));
  const ch = code("components/two-step-challenge.tsx");
  ok("the challenge has the title, a numeric one-time-code field, Verify and the way out",
    />Two-step verification</.test(ch) && /inputMode=\{isNumeric \? "numeric" : "text"\}/.test(ch) && /autoComplete=\{isNumeric \? "one-time-code" : "off"\}/.test(ch)
    && /"Verify"/.test(ch) && /Sign in as someone else/.test(ch));
  ok("the challenge offers the three switches", ["Use your authenticator app", "Email me a code", "Use a recovery code"].every((t) => ch.includes(t)));
  ok("the challenge uses the .auth-form system (labels above fields, ink submit, outlined secondary)",
    /className="auth-form"/.test(ch) && /className="auth-form__field"/.test(ch) && /className="auth-form__submit"/.test(ch) && /auth-form__provider two-step__leave/.test(ch));
  const vauth = code("components/vraelis-auth.tsx");
  ok("OAuth and password sign-ins come back through /signin, where a pending session meets the code screen",
    /redirectTo: `\/signin\?callbackUrl=\$\{encodeURIComponent\(safeRedirect\)\}`/.test(vauth) && /session\?\.twoStep\?\.pending/.test(vauth));
  const section = code("app/rank/app/account/two-step-section.tsx");
  ok("the Account section is anchored #two-step and offers set up, turn off and new recovery codes",
    /id="two-step"/.test(section) && /Set up/.test(section) && /Turn off two-step verification/.test(section) && /Get new codes/.test(section));
  ok("recovery codes can be copied and downloaded as .txt", /navigator\.clipboard\.writeText/.test(section) && /vraelis-recovery-codes\.txt/.test(section) && /Download \.txt/.test(section));
  ok("the QR code renders as inline SVG", /<svg className="two-step-qr"/.test(section) && /<path d=\{panel\.setup\.qr\.path\}/.test(section));
  const acct = code("app/rank/app/account/page.tsx");
  ok("the Account page mounts the section", /<TwoStepSection email=\{email\} initial=\{twoStep\.ok \? twoStep\.status : null\} \/>/.test(acct));
  const overview = code("app/rank/app/page.tsx");
  ok("the Overview offers it until it is on, dismissible for the browser session",
    /twoStep\.ok && !twoStep\.status\.enabled && cookieJar\.get\(TWO_STEP_NUDGE_COOKIE\)\?\.value !== "dismissed"/.test(overview) && /<TwoStepNudge/.test(overview));
  const { twoStepCodeHtml } = await import("../lib/email");
  const html = twoStepCodeHtml("123456", "sign_in");
  ok("the code email carries the code, its life, and no button", html.includes("123456") && html.includes("10 minutes") && !/<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px/.test(html));
  const surfaces: Array<[string, string]> = [
    ["components/two-step-challenge.tsx", ch], ["app/rank/app/account/two-step-section.tsx", section],
    ["app/rank/app/_components/two-step-nudge.tsx", code("app/rank/app/_components/two-step-nudge.tsx")],
    ["email template", ["sign_in", "enable_email", "confirm"].map((p) => twoStepCodeHtml("123456", p as "sign_in")).join("")],
  ];
  for (const [name, text] of surfaces) {
    ok(`${name}: no em or en dashes`, !/[–—]/.test(text));
    // The cookie attribute "; secure" is code, not a claim.
    ok(`${name}: no "secure", "unhackable", "compliant" or "guaranteed" claims`, !/\b(secure|unhackable|compliant|guaranteed)\b/i.test(text.replace(/;\s*secure\b/gi, "")));
  }
  const css = read("public/vraelis/authenticated.css");
  const cssVersion = Number(read("app/_components/product-surface.tsx").match(/authenticated\.css\?v=(\d+)"/)?.[1] ?? 0);
  ok("the added CSS is one commented block in authenticated.css, and the version was bumped past main's 17",
    /\/\* ── Two-step verification \(2026-09-30\)/.test(css) && cssVersion >= 18, `v=${cssVersion}`);

  console.log("\n── the one cookie two-step adds is in the cookie policy ──");
  const nudge = code("app/rank/app/_components/two-step-nudge.tsx");
  const written = nudge.match(/document\.cookie = `([a-z_]+)=/)?.[1];
  const readName = code("app/rank/app/page.tsx").match(/const TWO_STEP_NUDGE_COOKIE = "([^"]+)"/)?.[1];
  ok("the nudge writes the same cookie name the Overview reads", Boolean(written) && written === readName, `${written} / ${readName}`);
  ok("  it is a session cookie (no Max-Age or Expires)", !/document\.cookie = `[^`]*(max-age|expires)/i.test(nudge));
  const { COOKIES, STORAGE } = await import("../app/_content/legal");
  ok("  and listed in app/_content/legal.tsx under Essential, until the browser closes",
    COOKIES.some((r) => r.name === written && r.category === "Essential" && /close the browser/.test(r.duration)));
  ok("two-step writes no browser storage (nothing to add to STORAGE)",
    ![ch, section, nudge].some((t) => /(localStorage|sessionStorage)\./.test(t)) && Array.isArray(STORAGE));

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.log(`FAIL  the script threw: ${e?.stack ?? e}`); process.exit(1); });
