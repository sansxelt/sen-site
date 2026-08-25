// Finding H2 — reflected XSS in the OAuth callback popup.
//
// The bug: app/api/preflight/apps/oauth/callback/[provider]/route.ts echoed the RAW [provider] path
// segment into `oauth=error&provider=${provider}&reason=…`, and popupClose() dropped that string into an
// inline <script> via `var msg = ${JSON.stringify(...)}`. JSON.stringify escapes quotes and backslashes but
// NOT "</script", so the script element could be terminated and a new one opened. Next's route matcher
// decodes %2F, so an encoded payload survived into the param. The branch that echoed the segment fired
// precisely when it did not resolve — i.e. only when attacker-chosen.
//
// Three independent layers are asserted here:
//   1. the raw segment never reaches the document (safeProviderLabel + a static "unknown" at the callsite)
//   2. scriptJson() neutralises <, >, &, U+2028 and U+2029 for inline-script embedding
//   3. a per-response nonce CSP means an injected <script> or inline handler cannot execute even if 1 and 2
//      were ever bypassed
// Pure: no DB, no network.
import { readFileSync } from "node:fs";
import { OAUTH_PROVIDER_KINDS } from "../lib/preflight/oauth/providers";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (p: string) => readFileSync(p, "utf8");

const ROUTE = "app/api/preflight/apps/oauth/callback/[provider]/route.ts";
const src = read(ROUTE);

const SEP28 = String.fromCharCode(0x2028);
const SEP29 = String.fromCharCode(0x2029);

// Reimplementations kept byte-identical to the route's own, so the payload table below is exercised
// against the real algorithm. Guarded by source assertions at the end.
function scriptJson(value: unknown): string {
  return JSON.stringify(value ?? null)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/[\u2028\u2029]/g, (c) => (c === "\u2028" ? "\\u2028" : "\\u2029"));
}
function safeProviderLabel(provider: string): string {
  return (OAUTH_PROVIDER_KINDS as readonly string[]).includes(provider) ? provider : "unknown";
}

// ── 1. The raw segment never becomes the echoed label ───────────────────────
console.log("── attacker-chosen segments collapse to \"unknown\" ──");
const PAYLOADS = [
  "</script><img src=x onerror=alert(1)>",
  "</SCRIPT><IMG SRC=x ONERROR=alert(1)>",
  "</ScRiPt><svg/onload=alert(1)>",
  "%3C/script%3E%3Cimg%20src=x%20onerror=alert(1)%3E",
  "%3c%2fscript%3e%3cscript%3ealert(1)%3c%2fscript%3e",
  "</script\t>",
  "</script\n>",
  "</script >",
  "</script/>",
  "</script><script>alert(1)</script>",
  "github</script><script>alert(1)</script>",
  "GitHub",
  "GITHUB",
  "constructor",
  "__proto__",
  "toString",
  "prototype",
  "valueOf",
  SEP28 + "alert(1)",
  SEP29 + "alert(1)",
  "",
  "  ",
  "a".repeat(5000),
];
for (const payload of PAYLOADS) {
  const label = safeProviderLabel(payload);
  const shown = payload.length > 28 ? payload.slice(0, 28) + "…" : payload;
  ok(`segment ${JSON.stringify(shown)} → "unknown"`, label === "unknown");
}
// Prototype keys are the specific trap: REGISTRY[kind] returns inherited members truthily, so a
// resolveOAuthProvider() check would have passed them through.
for (const proto of ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"]) {
  ok(`prototype key ${JSON.stringify(proto)} is not treated as a provider`, safeProviderLabel(proto) === "unknown");
}
// Real providers still pass through unchanged — the fix must not break the working flows.
for (const kind of OAUTH_PROVIDER_KINDS) {
  ok(`real provider ${JSON.stringify(kind)} is preserved`, safeProviderLabel(kind) === kind);
}

// ── 2. scriptJson neutralises every script-breaking construct ───────────────
console.log("── scriptJson output is inert inside <script> ──");
for (const payload of PAYLOADS) {
  const params = new URLSearchParams({ oauth: "error", provider: safeProviderLabel(payload), reason: "unknown_provider" }).toString();
  const emitted = scriptJson({ source: "vraelis-oauth", params });
  const lower = emitted.toLowerCase();
  ok(`no "<" survives for ${JSON.stringify(payload.slice(0, 22))}`, !emitted.includes("<"));
  ok(`no ">" survives for ${JSON.stringify(payload.slice(0, 22))}`, !emitted.includes(">"));
  ok(`no "</script" survives for ${JSON.stringify(payload.slice(0, 22))}`, !lower.includes("</script"));
  ok(`no raw U+2028/U+2029 survives for ${JSON.stringify(payload.slice(0, 22))}`, !emitted.includes(SEP28) && !emitted.includes(SEP29));
}
// Direct: even if a hostile value reached scriptJson, it stays a single inert JS string literal.
for (const hostile of ["</script><script>alert(1)</script>", "</SCRIPT >", SEP28 + "alert(1)", SEP29, "&lt;", "a&b<c>d"]) {
  const out = scriptJson(hostile);
  ok(`scriptJson(${JSON.stringify(hostile.slice(0, 20))}) emits no angle bracket`, !out.includes("<") && !out.includes(">"));
  ok(`scriptJson(${JSON.stringify(hostile.slice(0, 20))}) emits no raw ampersand`, !out.includes("&"));
  ok(`scriptJson(${JSON.stringify(hostile.slice(0, 20))}) round-trips to the original value`, JSON.parse(out) === hostile);
}
ok("scriptJson escapes U+2028 as a 6-char sequence", scriptJson(SEP28).includes("\\u2028"));
ok("scriptJson escapes U+2029 as a 6-char sequence", scriptJson(SEP29).includes("\\u2029"));
ok("scriptJson(null) is the literal null", scriptJson(null) === "null");
ok("scriptJson(undefined) is the literal null", scriptJson(undefined) === "null");

// ── 3. Source guarantees: the route cannot regress ──────────────────────────
console.log("── route source guarantees ──");
ok("the unknown-provider branch echoes a static string, not the segment",
  /if \(!p\) return backGeneric\(req, "unknown", "unknown_provider", popup\);/.test(src));
ok("no template still interpolates the raw provider into a param string",
  !/provider=\$\{provider\}/.test(src));
ok("params are built with URLSearchParams", src.includes("new URLSearchParams({"));
ok("the echoed label is allowlisted", src.includes("function safeProviderLabel"));
ok("the allowlist is the explicit kind list, not the registry",
  src.includes("(OAUTH_PROVIDER_KINDS as readonly string[]).includes(provider)"));
ok("scriptJson exists", src.includes("function scriptJson"));
ok("scriptJson escapes <", src.includes('.replace(/</g, "\\\\u003c")'));
ok("scriptJson escapes >", src.includes('.replace(/>/g, "\\\\u003e")'));
ok("scriptJson escapes &", src.includes('.replace(/&/g, "\\\\u0026")'));
ok("scriptJson escapes the line separators", src.includes("[\\u2028\\u2029]"));
ok("the route source carries no RAW U+2028/U+2029 (they would be a syntax error in a regex literal)",
  !src.includes(SEP28) && !src.includes(SEP29));
ok("the popup payload uses scriptJson, not bare JSON.stringify",
  src.includes("const payload = scriptJson({ source:"));
ok("postMessage origin uses scriptJson", src.includes("${scriptJson(origin)}"));
ok("handoff uses scriptJson", src.includes("${scriptJson(handoff ?? null)}"));
ok("anchor href uses scriptJson", src.includes("${scriptJson(target)}"));
ok("no bare JSON.stringify interpolation remains in the popup document",
  !/\$\{JSON\.stringify\(/.test(src));
ok("a per-response nonce is generated", src.includes('randomBytes(16).toString("base64")'));
ok("the inline script carries the nonce", src.includes('<script nonce="${nonce}">'));
ok("a CSP is sent", src.includes('"content-security-policy":'));
ok("the CSP is nonce-based", src.includes("script-src 'nonce-${nonce}'"));
// Assert on the CSP STRING the route actually emits, not on the whole file — the surrounding comments
// legitimately mention both "script-src" and "unsafe-inline" and would otherwise trip this check.
const cspMatch = src.match(/"content-security-policy":\s*`([^`]*)`\s*\+\s*`([^`]*)`/);
const csp = cspMatch ? cspMatch[1] + cspMatch[2] : "";
ok("the emitted CSP string could be extracted from the source", csp.length > 0, csp);
ok("the CSP script-src is nonce-only, with no unsafe-inline", !/script-src[^;]*unsafe-inline/.test(csp));
ok("the CSP script-src carries the nonce", /script-src\s+'nonce-\$\{nonce\}'/.test(csp));
ok("the CSP has no unsafe-eval anywhere", !csp.includes("unsafe-eval"));
ok("style-src is the only unsafe-inline, and styles cannot execute", /style-src\s+'unsafe-inline'/.test(csp));
ok("the CSP defaults to none", csp.includes("default-src 'none'"));
ok("the CSP blocks framing", csp.includes("frame-ancestors 'none'"));
ok("the CSP pins base-uri", csp.includes("base-uri 'none'"));
ok("the CSP pins form-action", csp.includes("form-action 'none'"));

const pkg = read("package.json");
ok("package.json exposes oauth:xss:test", pkg.includes(`"oauth:xss:test"`) && pkg.includes("oauth-callback-xss-verify.ts"));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
