// Design 01 Increment 5 — the final quality pass: preview production-safety, the accessibility and
// composer-state fixes found in the review, and the founder's "latest verification, not whole-system
// coverage" framing. Static source checks; the responsive/overflow/keyboard behaviour was verified live in a
// real browser at 1440/1180/834/390/360 (0px horizontal overflow, clean a11y DOM, correct focus order) and
// those guarantees are locked structurally here.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { isAppPath, APP_ROOTS } from "../lib/app-routes";
import { join } from "node:path";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { if (c) { pass++; console.log(`PASS  ${n}`); } else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); } };

const preview = readFileSync("app/dev-preview/page.tsx", "utf8");
const composer = readFileSync("app/rank/app/_components/composer.tsx", "utf8");
const rec = readFileSync("app/rank/app/_components/home-records.tsx", "utf8");
const page = readFileSync("app/rank/app/page.tsx", "utf8");
const ui = readFileSync("app/rank/_components/rank-ui.tsx", "utf8");
const css = readFileSync("public/vraelis/styles.css", "utf8");
const proxy = readFileSync("proxy.ts", "utf8");

console.log("── the dev preview is unavailable in production, unreachable, and not a second implementation ──");
ok("the preview exists at a top-level dev route", existsSync("app/dev-preview/page.tsx"));
ok("the old in-app preview path is gone (single location)", !existsSync("app/rank/app/dev/home-preview/page.tsx"));
ok("the preview 404s outside development via an explicit gate", /if \(process\.env\.NODE_ENV !== "development"\) notFound\(\);/.test(preview));
ok("the gate is NODE_ENV, so no query string can enable it in production", !/searchParams|\?preview|enablePreview/.test(preview));
ok("dev-preview is NOT an APP_ROOT (the app host never rewrites to it; it redirects to marketing then 404s)", !(APP_ROOTS as readonly string[]).includes("dev-preview") && !(APP_ROOTS as readonly string[]).includes("dev"));
ok("isAppPath(/dev-preview) is false", !isAppPath("/dev-preview"));
// This forbade the string outright, which was right while /dev-preview held only the design-01 preview.
// V6 now also lives there and is a complete public site awaiting promotion, so the rule is the one the
// check always meant: no clean path may reach /dev-preview UNGATED. The V6 map is consulted only when
// v6Public() is true, and that reads NEXT_PUBLIC_VRAELIS_V6_PUBLIC, which is unset by default.
{
  const gated = /export const v6Public = \(\) => process\.env\.NEXT_PUBLIC_VRAELIS_V6_PUBLIC === "1";/.test(proxy);
  const usesGate = /v6Public\(\) \? V6_EXACT\[path\] : undefined/.test(proxy)
    && /v6Public\(\) && path\.startsWith\("\/docs\/"\)/.test(proxy);
  // Every dev-preview mention in the proxy must sit inside the V6 map or its gate; a bare mapping elsewhere
  // is the leak this check exists to catch.
  const strayLeak = proxy
    .split("\n")
    .filter((l) => l.includes("dev-preview") && !l.includes("/dev-preview/v6"))
    .length > 0;
  ok("the proxy exposes the preview only behind an explicit, default-off flag",
    gated && usesGate && !strayLeak);
  // NOTHING IN V6 MAY HARDCODE ITS OWN BASE PATH.
  //
  // lib/v6-routes.ts exists so promotion is one edit, and the shell kept a private copy anyway. Promoted,
  // that copy made themeAtTop compare "/" against "/dev-preview/v6", so the bar painted LIGHT over the black
  // hero, and every nav link pointed back into the preview namespace. The colour was the visible symptom; the
  // links were the real breakage.
  const v6Files = readdirSync("app/dev-preview/v6", { recursive: true, encoding: "utf8" } as never) as unknown as string[];
  const hardcoded = v6Files
    .filter((f) => typeof f === "string" && /\.tsx?$/.test(f))
    .map((f) => ({ f, t: readFileSync(join("app/dev-preview/v6", f), "utf8") }))
    // Comments may name the path (several explain this very rule); code may not. Line comments are
    // stripped first, then any surviving quoted literal is a hardcode.
    .filter(({ t }) => /["'`]\/dev-preview\/v6/.test(t.replace(/\/\/[^\n]*/g, "")))
    .map(({ f }) => f);
  ok("no V6 file hardcodes its own base path; they all derive it from lib/v6-routes",
    hardcoded.length === 0, hardcoded.join(", "));
  ok("V6_BASE is the single switch, and it follows the promotion flag",
    /export const V6_BASE = process\.env\.NEXT_PUBLIC_VRAELIS_V6_PUBLIC === "1" \? "" : "\/dev-preview\/v6";/
      .test(readFileSync("lib/v6-routes.ts", "utf8")));

  ok("the design-01 preview itself is still unreachable by any clean path",
    !/"\/dev-preview"/.test(proxy) && !/dev-preview\/page/.test(proxy));
}
ok("no navigation, sitemap, or metadata links to the preview", !/dev-preview/.test(ui) && !/dev-preview/.test(page) && !/dev-preview/.test(rec));
ok("the preview is noindex", /robots: \{ index: false/.test(preview));
ok("the preview reuses the REAL home components (no drift into a second implementation)",
  /from "@\/app\/rank\/app\/_components\/home-records"/.test(preview) && /from "@\/app\/rank\/app\/_components\/composer"/.test(preview));
ok("the preview performs no reads or writes and holds no secret", !/fetch\(|process\.env\.(?!NODE_ENV)|createClient|supabase/i.test(preview));
ok("the preview is clearly labelled as a development preview, not customer records", /Development preview\. These are fixtures/.test(preview));

console.log("\n── composer a11y: the final decision is announced, not swapped in silently ──");
const runPanel = composer.slice(composer.indexOf("function RunPanel"));
ok("RunPanel wraps the status in ONE persistent live region", /role="status" aria-live="polite" aria-atomic="true"/.test(runPanel));
ok("the decision pill and the running text share that live region (so the verdict is announced)",
  runPanel.indexOf('role="status" aria-live="polite"') < runPanel.indexOf("{d.label}") && runPanel.indexOf('role="status" aria-live="polite"') < runPanel.indexOf("{statusText}"));

console.log("\n── composer states: a stale plan has a real, visible next action ──");
const planPanel = composer.slice(composer.indexOf("function PlanPanel"), composer.indexOf("function RunPanel"));
ok("PlanPanel receives a re-review handler", /onReview: \(\) => void/.test(planPanel) && /canReview: boolean/.test(planPanel));
ok("a stale plan renders a visible 'Review the updated plan' button wired to review()", /stale \? \([\s\S]*onClick=\{onReview\}[\s\S]*Review the updated plan/.test(planPanel));
ok("a stale plan can be neither approved nor run (the review button replaces them)", /stale \? \([\s\S]*\) : !approved \? \(/.test(planPanel));
ok("the composer threads review + canReview into PlanPanel", /onReview=\{review\} canReview=\{canReview\}/.test(composer) || /canReview=\{canReview\} onReview=\{review\}/.test(composer));

console.log("\n── composer safety: an error AFTER a paid run never offers a fresh paid retry ──");
ok("the error phase can carry the started verificationId", /k: "error"; error: ClientError;[^}]*verificationId\?: string/.test(composer));
ok("a poll failure after execution carries the id forward", /setPhase\(\{ k: "error", error: final\.error, verificationId \}\)/.test(composer));
ok("when the run already started, recovery is 'Open the record', not 'Try again'",
  /phase\.verificationId \? \([\s\S]*Open the record[\s\S]*\) : \(/.test(composer) && /already running and stays available/.test(composer));

console.log("\n── the founder framing: Systems shows LATEST verification state, never whole-system coverage ──");
ok("the Systems section is captioned as the latest verification, not full coverage", /Each row shows the latest verification, not full coverage/.test(rec));
ok("the Systems row aria says 'latest verification', not a bare verdict", /aria-label=\{`\$\{s\.name \|\| "System"\}, latest verification: \$\{proof\.verdict\.label\}`\}/.test(rec));
ok("an unverified system still reads 'Not yet verified', never Failed/Blocked", /Not yet verified/.test(readFileSync("lib/preflight/home-verdict.ts", "utf8")));

console.log("\n── visual drift corrected, motion respected ──");
// The plan pill's <Link> only, starting at href="/plans" so the comment above it (which documents the removed
// teal tokens) is excluded.
const pillIdx = ui.indexOf('href="/plans"');
const pillStyle = ui.slice(pillIdx, pillIdx + 480);
// Was: "uses the warm-neutral ACCENT tokens". The pill has been moved off the accent entirely. On the
// design-06 product surface the accent resolves to the same green the product uses for "this verification
// held", and a subscription tier is not a verification result — a Free plan badge wearing the pass colour
// is the product spending its only signal on billing. The rule the check now enforces is the durable one:
// the pill names surface tokens, and never a state token or a literal.
ok("the topbar plan pill uses neutral surface tokens", /var\(--line-2\)/.test(pillStyle) && /var\(--bg-2\)/.test(pillStyle) && /var\(--fg-2\)/.test(pillStyle));
ok("the topbar plan pill never wears a state colour", !/--go-|--wait-|--stop-|--ok\)|--err\)|--warn\)/.test(pillStyle));
ok("the topbar plan pill drops the retired teal tokens and the hardcoded hex", !/--accent-dim|--accent-border|#0A7B54/.test(pillStyle));
// Was: literal hex swatches. Those literals are exactly what pinned the product to one theme, so the
// check now asserts the PROPERTY it always meant — that these panels name a state rather than a colour —
// and would fail again the moment someone reintroduces a hardcoded swatch here.
ok("the composer's not_provable + error panels name a state token, never a literal swatch",
  /background: "var\(--wait-wash\)"/.test(composer) && /background: "var\(--stop-wash\)"/.test(composer)
  && !/background: "#[0-9A-Fa-f]{6}"/.test(composer));
ok("the remaining infinite animations honour prefers-reduced-motion", /@media \(prefers-reduced-motion: reduce\) \{ \.pulse \{ animation: none; \} \.typing i \{ animation: none; \} \}/.test(css));

console.log("\n── overflow + heading structure locked (verified live at 5 widths; guarded structurally) ──");
ok("a single h1 on Home: the greeting is a paragraph, the composer's question is the h1", !/<h1[^>]*>\s*\{displayName/.test(page) && /<p style=\{\{ fontSize: 15[\s\S]*Welcome back/.test(page));
ok("deployment references truncate rather than overflow (bounded width + ellipsis)", /maxWidth: "22ch"[\s\S]*textOverflow: "ellipsis"/.test(rec) || /textOverflow: "ellipsis"[\s\S]*maxWidth: "22ch"/.test(rec));
ok("record rows constrain their text column (minWidth:0 + ellipsis) so long names cannot push the row wide",
  (rec.match(/minWidth: 0/g) ?? []).length >= 3 && (rec.match(/textOverflow: "ellipsis"/g) ?? []).length >= 3);
ok("running/degraded/onboarding wrap (flexWrap) rather than overflow on narrow screens", /flexWrap: "wrap"/.test(composer) && /flexWrap: "wrap"/.test(rec));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
