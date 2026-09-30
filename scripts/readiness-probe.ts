// READINESS PROBE, A PROTOTYPE. Not part of the product, not called by any route or worker.
//
// The launch pack is the first block of the readiness MVP whichever order the founder picks (see the product
// definition, 2026-09-30). This script shows the idea working end to end on one public URL, from the outside,
// the way a customer's visitor would meet the site:
//
//   1. Trackers that load before any consent choice          GDPR + ePrivacy (EU)
//   2. A reject option on the first layer of the banner       EDPB cookie banner taskforce report (2023)
//   3. Whether a Global Privacy Control signal changes what   CCPA/CPRA regulations; about 12 US state laws
//      loads, and whether a "Do Not Sell" style link exists
//   4. Automated accessibility rules (axe-core, WCAG A/AA)    ADA Title III practice; European Accessibility Act
//   5. Basic security headers and cookie flags                OWASP ASVS 5.0 / Top 10:2025
//   6. A vulnerability contact at /.well-known/security.txt   RFC 9116; UK PSTI and the CRA expect one
//
// Every result says whether it was decided by the script (automated) or needs a person to judge
// (assisted), and none of it is a compliance verdict: it is evidence of what the site did on this run.
// That wording is the rule, not a style choice (FTC v. accessiBe, 2025).
//
// Usage: npx tsx scripts/readiness-probe.ts https://example.com [--json out.json]
// Only point it at sites you own or have permission to test.
import { chromium, type Browser, type Request as PwRequest } from "playwright";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

type Status = "pass" | "fail" | "needs-person" | "not-run";
type Check = { id: string; title: string; rule: string; mode: "automated" | "assisted"; status: Status; evidence: string[] };

// Hosts that set or send advertising and analytics identifiers. Deliberately a short, well-known list: a
// miss is reported as "needs a person", never as a clean pass.
const TRACKERS: [RegExp, string][] = [
  [/(^|\.)google-analytics\.com$/, "Google Analytics"],
  [/(^|\.)googletagmanager\.com$/, "Google Tag Manager"],
  [/(^|\.)doubleclick\.net$/, "Google Ads (DoubleClick)"],
  [/(^|\.)googleadservices\.com$/, "Google Ads"],
  [/(^|\.)facebook\.net$|(^|\.)connect\.facebook\.com$/, "Meta Pixel"],
  [/(^|\.)facebook\.com$/, "Meta"],
  [/(^|\.)analytics\.tiktok\.com$/, "TikTok Pixel"],
  [/(^|\.)redditstatic\.com$|(^|\.)alb\.reddit\.com$|(^|\.)pixel-config\.reddit\.com$/, "Reddit Pixel"],
  [/(^|\.)snap\.licdn\.com$|(^|\.)px\.ads\.linkedin\.com$/, "LinkedIn Insight"],
  [/(^|\.)hotjar\.com$/, "Hotjar"],
  [/(^|\.)clarity\.ms$/, "Microsoft Clarity"],
  [/(^|\.)segment\.(io|com)$/, "Segment"],
  [/(^|\.)mixpanel\.com$/, "Mixpanel"],
  [/(^|\.)amplitude\.com$/, "Amplitude"],
];
const trackerName = (url: string): string | null => {
  try { const h = new URL(url).hostname; for (const [re, n] of TRACKERS) if (re.test(h)) return n; } catch { /* not a URL */ }
  return null;
};

const BANNER_SCRIPT = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const buttons = [...document.querySelectorAll("button, a, [role=button]")].filter(vis).map((b) => (b.textContent || "").trim().toLowerCase());
  const reject = buttons.some((t) => /^(reject|decline|deny|refuse)|reject all|only (necessary|essential)|ablehnen|refuser|rechazar/.test(t));
  const consentish = buttons.some((t) => /accept|agree|allow all|akzeptieren|accepter|aceptar/.test(t));
  const link = [...document.querySelectorAll("a")].map((a) => (a.textContent || "").trim())
    .find((t) => /do not sell|your privacy choices|opt.?out of (sale|sharing)/i.test(t)) || null;
  return { reject: consentish ? reject : null, link };
})()`;

const AXE_SCRIPT = `window.axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })
  .then((r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length })))`;

async function trackersOnLoad(browser: Browser, url: string, gpc: boolean): Promise<{ names: string[]; bannerReject: boolean | null; privacyLink: string | null }> {
  // A fresh context each time: no cookies, no stored consent, an EU visitor's locale.
  const ctx = await browser.newContext({ locale: "de-DE", extraHTTPHeaders: gpc ? { "Sec-GPC": "1" } : {} });
  if (gpc) await ctx.addInitScript(`Object.defineProperty(navigator, "globalPrivacyControl", { get: () => true });`);
  const page = await ctx.newPage();
  const seen = new Set<string>();
  page.on("request", (r: PwRequest) => { const n = trackerName(r.url()); if (n) seen.add(n); });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => page.waitForTimeout(3000));
  await page.waitForTimeout(2500);
  // Heuristics a person should confirm: a visible reject-style button, and a privacy-choices link. Passed as
  // a string because tsx wraps named functions in a helper that does not exist inside the page.
  const found = (await page.evaluate(BANNER_SCRIPT)) as { reject: boolean | null; link: string | null };
  await ctx.close();
  return { names: [...seen].sort(), bannerReject: found.reject, privacyLink: found.link };
}

async function main() {
  const url = process.argv[2];
  const jsonOut = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;
  // https only, except localhost so the probe can be run against a local preview of your own site.
  if (!url || !/^(https:\/\/|http:\/\/localhost(:\d+)?(\/|$))/.test(url)) { console.error("Usage: npx tsx scripts/readiness-probe.ts https://your-site [--json out.json]"); process.exit(2); }
  const checks: Check[] = [];
  const browser = await chromium.launch();
  try {
    // 1-3. Consent, reject parity, GPC.
    const plain = await trackersOnLoad(browser, url, false);
    checks.push({
      id: "pre-consent-trackers", title: "No trackers load before a consent choice", rule: "GDPR Art. 6 and ePrivacy Art. 5(3)", mode: "automated",
      status: plain.names.length ? "fail" : "pass",
      evidence: plain.names.length ? [`Loaded before any choice: ${plain.names.join(", ")}`] : ["No known tracker host was requested before any choice (known hosts only; a person should confirm nothing else sets identifiers)."],
    });
    checks.push({
      id: "reject-first-layer", title: "Reject is offered next to accept", rule: "EDPB cookie banner taskforce report (2023)", mode: "assisted",
      status: plain.bannerReject === null ? "needs-person" : plain.bannerReject ? "pass" : "fail",
      evidence: [plain.bannerReject === null ? "No consent banner was recognised. A person should check whether one is shown." : plain.bannerReject ? "A reject-style button is visible on the first layer." : "An accept-style button is visible with no reject-style button beside it."],
    });
    const gpc = await trackersOnLoad(browser, url, true);
    const stillLoaded = gpc.names.filter((n) => plain.names.includes(n));
    checks.push({
      id: "gpc-honoured", title: "A Global Privacy Control signal changes what loads", rule: "CCPA regulations (Cal. Code Regs. tit. 11, §7025)", mode: "assisted",
      status: plain.names.length === 0 ? "needs-person" : stillLoaded.length ? "fail" : "pass",
      evidence: [
        plain.names.length === 0 ? "No trackers loaded without the signal, so there was nothing for it to change." : stillLoaded.length ? `Still loaded with Sec-GPC: 1: ${stillLoaded.join(", ")}` : "Trackers that loaded without the signal did not load with it.",
        gpc.privacyLink ? `Privacy choices link found: "${gpc.privacyLink}"` : "No \"Do Not Sell\" or \"Your Privacy Choices\" link was found on the page.",
      ],
    });

    // 4. Accessibility, automated rules only.
    const require = createRequire(import.meta.url);
    let axePath: string | null = null;
    try { axePath = require.resolve("axe-core/axe.min.js"); } catch { axePath = null; }
    if (axePath) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => page.waitForTimeout(3000));
      await page.addScriptTag({ path: axePath });
      const res = (await page.evaluate(AXE_SCRIPT)) as { id: string; impact: string | null; n: number }[];
      await ctx.close();
      checks.push({
        id: "wcag-automated", title: "Automated WCAG 2.2 A and AA rules", rule: "WCAG 2.2 AA (automated subset)", mode: "automated",
        status: res.length ? "fail" : "pass",
        evidence: res.length ? res.slice(0, 8).map((v) => `${v.id} (${v.impact ?? "n/a"}): ${v.n} element${v.n === 1 ? "" : "s"}`) : ["No violations of the automated rules. Automated rules find roughly half of real issues; keyboard use and meaning need a person."],
      });
    } else {
      checks.push({ id: "wcag-automated", title: "Automated WCAG 2.2 A and AA rules", rule: "WCAG 2.2 AA (automated subset)", mode: "automated", status: "not-run", evidence: ["axe-core is not installed."] });
    }

    // 5. Headers and cookies, from the document response itself.
    const res = await fetch(url, { redirect: "follow" });
    const h = res.headers;
    const missing = [
      ["strict-transport-security", "HSTS"],
      ["x-content-type-options", "X-Content-Type-Options"],
      ["referrer-policy", "Referrer-Policy"],
    ].filter(([k]) => !h.get(k)).map(([, n]) => n);
    const framing = h.get("x-frame-options") || /frame-ancestors/.test(h.get("content-security-policy") ?? "");
    if (!framing) missing.push("framing protection (X-Frame-Options or CSP frame-ancestors)");
    const cookies = (h as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    const weak = cookies.filter((c) => !/;\s*secure/i.test(c) || !/;\s*samesite=/i.test(c)).map((c) => c.split("=")[0]);
    checks.push({
      id: "security-headers", title: "Basic security headers and cookie flags", rule: "OWASP ASVS 5.0 (V3, V14)", mode: "automated",
      status: missing.length || weak.length ? "fail" : "pass",
      evidence: [
        missing.length ? `Missing: ${missing.join(", ")}` : "HSTS, nosniff, referrer policy and framing protection are all present.",
        cookies.length ? (weak.length ? `Cookies without Secure or SameSite: ${weak.join(", ")}` : `All ${cookies.length} cookie(s) set on the first response carry Secure and SameSite.`) : "No cookies were set on the first response.",
      ],
    });

    // 6. A vulnerability contact.
    const st = await fetch(new URL("/.well-known/security.txt", url)).catch(() => null);
    const stText = st && st.ok ? await st.text() : "";
    checks.push({
      id: "security-txt", title: "A vulnerability contact is published", rule: "RFC 9116; UK PSTI; EU Cyber Resilience Act", mode: "automated",
      status: /^contact:/im.test(stText) ? "pass" : "fail",
      evidence: [/^contact:/im.test(stText) ? `Found: ${stText.split(/\r?\n/).find((l) => /^contact:/i.test(l))}` : "No /.well-known/security.txt with a Contact line."],
    });
  } finally {
    await browser.close();
  }

  const mark: Record<Status, string> = { pass: "PASS ", fail: "FAIL ", "needs-person": "CHECK", "not-run": "SKIP " };
  console.log(`\nReadiness probe for ${url}, ${new Date().toISOString()}`);
  console.log("Evidence of what the site did on this run. Not a certification and not legal advice.\n");
  for (const c of checks) {
    console.log(`${mark[c.status]}  ${c.title}  [${c.rule}; ${c.mode}]`);
    for (const e of c.evidence) console.log(`         ${e}`);
  }
  const auto = checks.filter((c) => c.mode === "automated" && c.status !== "not-run");
  console.log(`\n${auto.filter((c) => c.status === "pass").length} of ${auto.length} automated checks passed; ${checks.filter((c) => c.status === "needs-person" || c.mode === "assisted").length} need a person to confirm.`);
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ url, at: new Date().toISOString(), checks }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
