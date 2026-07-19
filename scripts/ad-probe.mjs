// Ad-readiness probe for the signed-out app surface.
// Drives /signin (brand host) and app.vraelis.com/ (unauth) at desktop + mobile 390px.
// Checks: HTTP status, console-fatal errors, horizontal overflow, NEW ring logo vs old "V",
// retired-product copy (human evaluation / lead-gen / Flip).
import { chromium, devices } from "@playwright/test";

const TARGETS = [
  { name: "signin-desktop", url: "https://vraelis.com/signin", vp: { width: 1280, height: 900 }, mobile: false },
  { name: "signin-mobile", url: "https://vraelis.com/signin", vp: { width: 390, height: 844 }, mobile: true },
  { name: "apphost-desktop", url: "https://app.vraelis.com/", vp: { width: 1280, height: 900 }, mobile: false },
  { name: "apphost-mobile", url: "https://app.vraelis.com/", vp: { width: 390, height: 844 }, mobile: true },
];

const RETIRED = [
  "human evaluation", "human eval", "human qa", "expert review", "evaluator",
  "flip", "lead agent", "lead-agent", "vraelis rank", "human panel", "panel of experts",
];

function run() {}

const results = [];

const browser = await chromium.launch({ headless: true });

for (const t of TARGETS) {
  const ctx = await browser.newContext({
    viewport: t.vp,
    userAgent: t.mobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
      : undefined,
    deviceScaleFactor: t.mobile ? 3 : 1,
    isMobile: t.mobile,
    hasTouch: t.mobile,
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  let status = null, finalUrl = null, redirectChain = [];
  try {
    const resp = await page.goto(t.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    status = resp ? resp.status() : null;
    // walk redirect chain
    let r = resp ? resp.request() : null;
    while (r) {
      const rr = r.redirectedFrom();
      if (rr) { const rp = rr.response(); redirectChain.unshift({ url: rr.url(), status: rp ? rp.status() : null }); r = rr; }
      else break;
    }
    finalUrl = page.url();
    await page.waitForTimeout(1500);
  } catch (e) {
    results.push({ ...t, error: String(e), status, finalUrl });
    await ctx.close();
    continue;
  }

  const probe = await page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - doc.clientWidth;
    const bodyText = (document.body.innerText || "").toLowerCase();
    const title = document.title;
    const h1 = Array.from(document.querySelectorAll("h1")).map(e => e.innerText.trim()).filter(Boolean);
    // logo detection
    const svgCount = document.querySelectorAll("svg").length;
    const imgs = Array.from(document.querySelectorAll("img")).map(i => i.currentSrc || i.src).filter(Boolean);
    // any element whose text is exactly "V" that looks like a logo mark
    const vMarks = Array.from(document.querySelectorAll("a,span,div"))
      .filter(el => el.children.length === 0 && el.textContent.trim() === "V")
      .map(el => (el.className || "") + "|" + (el.getAttribute("style") || "").slice(0, 60));
    const wordmarks = Array.from(document.querySelectorAll("a,span,div,h1,h2"))
      .filter(el => el.children.length === 0 && /^vraelis$/i.test(el.textContent.trim()))
      .map(el => el.textContent.trim());
    // ring-logo: look for svg with circle/ring geometry near top
    const topSvgs = Array.from(document.querySelectorAll("header svg, [class*=head] svg, a svg")).slice(0, 5).map(s => {
      return { hasCircle: !!s.querySelector("circle"), hasPath: !!s.querySelector("path"), viewBox: s.getAttribute("viewBox") };
    });
    const bodyLen = bodyText.length;
    return { overflow, bodyLen, title, h1, svgCount, imgs, vMarks, wordmarks, topSvgs, bodySnippet: bodyText.slice(0, 400) };
  });

  const retiredHits = RETIRED.filter(w => probe.bodySnippet.includes(w) || (probe.bodyLen && probe.h1.join(" ").toLowerCase().includes(w)));
  // fuller body scan
  const fullBody = await page.evaluate(() => (document.body.innerText || "").toLowerCase());
  const retiredHitsFull = RETIRED.filter(w => fullBody.includes(w));

  const shot = `scripts/probe-${t.name}.png`;
  await page.screenshot({ path: shot, fullPage: false });

  results.push({
    name: t.name, url: t.url, status, finalUrl, redirectChain,
    consoleErrors, pageErrors, ...probe, retiredHitsFull,
    fullBodyLen: fullBody.length, shot,
  });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
