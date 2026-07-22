// Vraelis-controlled email + social embeds: current product language, honest delivery, safe escaping.
//
// The audit that produced this found the whole email surface still saying "Production Pass" and "the
// production layer for AI-built software", and the social cards plus the root-layout meta still carrying the
// retired homepage headline. Link previews and lifecycle emails are the two places a stale product identity
// travels furthest, so this keeps them pinned to the current one.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const email = readFileSync("lib/email.ts", "utf8");
const ogMain = readFileSync("app/og/route.tsx", "utf8");
const ogReport = readFileSync("app/og/r/route.tsx", "utf8");
const rootLayout = readFileSync("app/layout.tsx", "utf8");

console.log("── emails speak the current product, not the retired one ──");
// Retired product vocabulary. "Production Pass" was the old unit; the product now runs verifications.
for (const [term, where] of [
  ["Production Pass", "the old unit name"],
  ["production layer for AI", "the retired positioning"],
] as [string, string][]) {
  ok(`no "${term}" in Vraelis emails (${where})`, !email.includes(term));
}
// The current identity should actually appear, not just the absence of the old one.
ok("emails carry the current positioning", /independent verification layer for work performed by AI/.test(email));
ok('emails use the "verify an outcome" action', /Verify an outcome/i.test(email));

console.log("\n── emails claim nothing the product does not do ──");
// The standing rule: no automation the engine does not perform. A lifecycle nudge is the easiest place to
// imply continuous monitoring or automatic repair, and it must not.
for (const re of [
  /continuously monitor/i, /automatic(ally)? (repair|reverif|re-verif|redeploy)/i,
  /watches your deploy/i, /deployment hook/i, /github check/i,
]) {
  ok(`emails do not claim: ${re.source}`, !re.test(email));
}
// Vraelis provides a repair PROMPT; the agent repairs. Emails must not say Vraelis repaired anything.
ok("emails never say Vraelis repaired the application", !/Vraelis (repairs|repaired|fixes|fixed) your/i.test(email));

console.log("\n── delivery is honest: never claim delivered when unconfigured ──");
// getResend() returns null without RESEND_API_KEY, and every sender returns early on null rather than
// reporting success. Log-only / unconfigured must never read as delivered.
ok("sends gate on a configured Resend client", /if \(!resend\)/.test(email));
ok("no sender claims 'delivered'", !/\bdelivered\b/i.test(email.replace(/webhook_delivered/g, "")));

console.log("\n── user content is escaped before it enters HTML email ──");
// A name/subject placed raw into an HTML body is an injection vector. The welcome path escapes the name.
ok("user-supplied name is escaped in email HTML", /escapeHtml\(name\)/.test(email));
ok("an escapeHtml helper exists and is used widely", (email.match(/escapeHtml\(/g) || []).length >= 5);

console.log("\n── links point at the right host ──");
// App actions belong on app.vraelis.com; public/marketing on vraelis.com. A verify CTA that points at the
// marketing host would dump a signed-in user out of the product.
ok("the verify CTA points at the app host", /https:\/\/app\.vraelis\.com\/app/.test(email));
ok("public references point at the marketing host", /https:\/\/vraelis\.com\/(how-it-works|pricing|privacy|terms)/.test(email));

console.log("\n── social embeds carry the current headline, not the retired one ──");
const RETIRED_HEADLINE = /Nobody checked it/;
ok("the main OG card is updated", !RETIRED_HEADLINE.test(ogMain) && /Vraelis proves it/.test(ogMain));
ok("the report OG card is updated", !RETIRED_HEADLINE.test(ogReport) && /Vraelis proves it/.test(ogReport));
ok("the root-layout default meta is updated (the site-wide embed fallback)",
  !RETIRED_HEADLINE.test(rootLayout) && /Vraelis proves it/.test(rootLayout));
// The OG image version must bump when the card changes, or platforms serve the cached old render.
ok("the OG image cache version was bumped past v4", /\/og\?v=([5-9]|\d\d)/.test(readFileSync("lib/og-meta.ts", "utf8")));
// The official 50-character company description must appear in the card and the site meta, so link previews
// and search snippets say the one sanctioned thing.
const OFFICIAL_DESC = "Verifies software built with AI actually works";
ok("the OG card carries the official description", ogMain.includes(OFFICIAL_DESC));
ok("the root-layout meta leads with the official description", rootLayout.includes(OFFICIAL_DESC));
ok("the official description fits the 50-character limit", OFFICIAL_DESC.length <= 50, `${OFFICIAL_DESC.length} chars`);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
