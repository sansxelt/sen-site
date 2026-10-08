/** Run against a dev/preview site: I18N_TEST_BASE_URL=http://localhost:3100/dev-preview/v6 npm run i18n:coverage:test.
 * Audits the rendered UI rather than unused historical source. Never submits a form or translates legal records.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CATALOGUE_VERSION } from "../lib/i18n/catalogue-version";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { DOCS } from "../app/dev-preview/v6/_content/docs";
import { GUIDES } from "../app/dev-preview/v6/_content/guides";
import { LOCALE_KEYS } from "../lib/i18n/locales";

const base = process.env.I18N_TEST_BASE_URL ?? "http://localhost:3100/dev-preview/v6";
const codes = LOCALE_KEYS.filter(l => l !== "en");
const catalogues = codes.map(locale => ({locale, copy:JSON.parse(readFileSync(`public/locales/${locale}.json`, "utf8")) as Record<string,string>}));
const protectedText = new Set(["Vraelis", "Reddit", "ByteDance", "TikTok", "GitHub", "Google", "Vercel", "Stripe", "Supabase", "Sentry", "Slack", "MCP", "CLI", "API", "CLI:", "API:", "MCAP", "vraelis.com"]);
const routes = ["", "platform", "contour", "model-integrity", "adversarial-security", "zero-trust", "recorded-evidence", "solutions", "solutions/defense", "solutions/fleets", "infrastructure", "government", "integrators", "enterprise", "contact", "beta", "integrations", "agents", "problems", "goals", "company", "security", "developers", "docs", "research", "changelog", "limitations", "data-rights", "privacy", "cookies", "terms", "acceptable-use", "subprocessors", "refunds", "trademark", ...DOCS.map(d => `docs/${d.slug}`)];
routes.push(...GUIDES.map(guide => `guides/${guide.slug}`));
const strings = new Set<string>();
async function collect(page:Page) {
  const copy = await page.evaluate<string[]>(String.raw`(() => {
    const skip = "[data-no-translate],script,style,noscript,code,pre,kbd,samp,[contenteditable=true],input,textarea,nextjs-portal";
    const norm = (s) => s.replace(/\s+/g," ").trim();
    const found = new Set();
    for (const word of document.querySelectorAll(".v6-title-word")) found.add(norm(word.parentElement?.textContent ?? ""));
    const walker = document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()) {const node=walker.currentNode;if(!node.parentElement?.closest(skip+",.v6-title-word"))found.add(norm(node.textContent ?? ""));}
    for(const el of document.querySelectorAll("*")) if(!el.closest(skip)) for(const name of ["aria-label","title","placeholder","alt","data-text"]) {const value=el.getAttribute(name);if(value)found.add(norm(value));}
    return [...found].filter(Boolean);
  })()`);
  for(const s of copy) if(/[a-z]/i.test(s) && !protectedText.has(s))strings.add(s);
}
async function main() {
  const hash=createHash("sha256");
  for(const locale of [...codes].sort())hash.update(readFileSync(`public/locales/${locale}.json`));
  assert.equal(CATALOGUE_VERSION,hash.digest("hex").slice(0,16),"Run npm run i18n:version after updating the catalogues.");
  const executablePath = process.env.CHROMIUM_PATH ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  const browser=await chromium.launch({executablePath,args:["--no-sandbox"]});
  try {
    const page=await browser.newPage();
    for(const route of routes) {
      await page.goto(`${base}/${route}`,{waitUntil:"networkidle"});
      const privacy=page.getByRole("button",{name:"Essential only",exact:true});
      if(await privacy.isVisible())await privacy.click();
      await collect(page);
      if(route==="contact") {
        for(const audience of ["government","industry","integrator","research","individual","privacy"]) {await page.locator("[name=audience]").selectOption(audience);await collect(page);}
        await page.goto(`${base}/contact?topic=ai-security`,{waitUntil:"networkidle"});
        await page.locator("[name=audience]").selectOption("industry");
        await collect(page);
      }
      if(route==="")for(const trigger of await page.locator("button.v6-nav__item").all()) {await trigger.hover();await page.locator(".v6-mega").first().waitFor();await collect(page);}
    }
    for(const suffix of ["/workspace-entry", "/auth/reset-password", "/auth/reset-password/confirm"]) {
      await page.goto(new URL(suffix, base).href,{waitUntil:"networkidle"});
      await collect(page);
    }
    for(const topic of ["physical systems","defense systems","mission systems","robotics","connected systems","infrastructure"])strings.add(`AI security for ${topic}.`);
    const missing = catalogues.flatMap(({locale,copy})=>[...strings].filter(s=>!copy[s]?.trim()).map(s=>`${locale}: ${s}`));
    if(missing.length)writeFileSync("/tmp/vraelis-i18n-missing.json",JSON.stringify(missing,null,2));
    assert.equal(missing.length,0,`Missing UI translations (${missing.length}):\n${missing.slice(0,40).join("\n")}`);
    console.log(`PASS ${strings.size} rendered UI strings across ${routes.length} routes and all ${codes.length} non-English catalogues, including menus and contact variants.`);
  } finally {await browser.close();}
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
