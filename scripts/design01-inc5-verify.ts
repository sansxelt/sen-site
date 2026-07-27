// Design 01 Increment 5 — the final quality pass: preview production-safety, the accessibility and
// composer-state fixes found in the review, and the founder's "latest verification, not whole-system
// coverage" framing. Static source checks; the responsive/overflow/keyboard behaviour was verified live in a
// real browser at 1440/1180/834/390/360 (0px horizontal overflow, clean a11y DOM, correct focus order) and
// those guarantees are locked structurally here.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { before } from "./_source-order";
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
  //
  // COMMENTS ARE STRIPPED FIRST. proxy.ts explains this rule in prose, and prose that names /dev-preview/*
  // while describing what is NOT claimed was failing the check that the prose exists to document. A test
  // that its own documentation breaks teaches people to delete the explanation instead of fixing the code.
  const proxyCode = proxy.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const strayLeak = proxyCode
    .split("\n")
    .filter((l) => l.includes("dev-preview") && !l.includes("/dev-preview/v6"))
    .length > 0;
  ok("the proxy exposes the preview only behind an explicit, default-off flag",
    gated && usesGate && !strayLeak);
  // PROMOTED, THE PREVIEW PATH IS NOT A SECOND ADDRESS FOR THE SITE.
  //
  // The clean paths rewrite ONTO /dev-preview/v6, so after promotion every page answered at two URLs, both
  // returning 200 and both emitting index,follow. The canonical already pointed at the clean path, so the
  // duplication would have been consolidated rather than penalised, but a canonical is a hint and there is
  // no reason to publish a second address. Promoted, the preview path 308s to the clean one.
  ok("promoted, /dev-preview/v6 permanently redirects to the clean path",
    /v6Public\(\) && \(path === "\/dev-preview\/v6" \|\| path\.startsWith\("\/dev-preview\/v6\/"\)\)/.test(proxyCode)
    && /NextResponse\.redirect\(url, 308\)/.test(proxyCode));
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

  // ── A SECTION THAT DECLARES ITSELF DARK MUST ACTUALLY BE DARK ──────────────────────────────────────
  //
  // v6.css splits the two halves of "dark" across two markers, and they are easy to mix up:
  //   .v6-dark          paints the graphite BACKGROUND
  //   [data-nav-dark]   sets the dark-surface TEXT colours, and flips the nav
  //
  // Six page sections carried data-nav-dark WITHOUT v6-dark, so they rendered near-white headings on a
  // white ground. The author had declared the intent; the class that paints it was simply missing, and
  // nothing failed — the text was invisible rather than wrong-coloured, so it did not look broken, it
  // looked absent. A rendered contrast audit found it; this keeps it found.
  //
  // Chapter sections (.v6-h, .v6-st, .v6-tm, .v6-rg, .v6-dr, .v6-end, .v6-docsenv) paint their own ground
  // in chapters.css, so they are allowed to carry the marker without .v6-dark.
  const OWN_GROUND = /v6-h\b|v6-st\b|v6-tm\b|v6-rg\b|v6-dr\b|v6-end\b|v6-docsenv\b/;
  const darkMismatch: string[] = [];
  for (const f of v6Files.filter((x) => typeof x === "string" && /\.tsx$/.test(x))) {
    const src = readFileSync(join("app/dev-preview/v6", f), "utf8");
    for (const line of src.split("\n")) {
      if (!line.includes("data-nav-dark")) continue;
      if (line.includes("v6-dark") || OWN_GROUND.test(line)) continue;
      // Multi-line JSX elements: the className may sit on a neighbouring line, so only flag a line that
      // carries a className of its own and still has no ground.
      if (!/className=/.test(line)) continue;
      darkMismatch.push(`${f}: ${line.trim().slice(0, 70)}`);
    }
  }
  ok("every section that declares data-nav-dark also paints a dark ground",
    darkMismatch.length === 0, darkMismatch.join(" | "));

  // ── NO V6 FILE MAY READ A CUSTOM PROPERTY THAT DOES NOT EXIST ──────────────────────────────────────
  //
  // An undefined custom property is invalid at computed-value time, so the declaration is dropped and the
  // element silently inherits instead. That is how the contact page's four email addresses — the entire
  // content of the page — ended up at 1.40:1 on a graphite card: they asked for --g-brand, which was never
  // a token. Legal-page links did the same with --go-dp. Neither produced an error anywhere.
  const DEFINES = [
    "app/dev-preview/v6/_system/v6.css", "app/dev-preview/v6/_system/pagekit.css",
    "app/dev-preview/v6/_system/chapters.css",
    "public/vraelis/tokens.css", "public/vraelis/styles.css", "public/vraelis/authenticated.css",
  ];
  const defined = new Set<string>(["--font-geist-sans", "--font-geist-mono"]);
  for (const f of DEFINES) {
    if (!existsSync(f)) continue;
    for (const m of readFileSync(f, "utf8").matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) defined.add(m[1]);
  }
  // The scroll-driven chapters set some properties at RUNTIME as React style props ("--i", "--sv"), so the
  // rule that reads one lives in a .css while the value is set in a .tsx. Those count as defined, and the
  // scope for that has to be the whole V6 tree rather than one file.
  const v6Sources = v6Files
    .filter((x): x is string => typeof x === "string" && /\.(tsx?|css)$/.test(x))
    .map((f) => ({ f, src: readFileSync(join("app/dev-preview/v6", f), "utf8") }));
  const runtimeSet = new Set<string>();
  for (const { src } of v6Sources) {
    for (const m of src.matchAll(/["'`](--[a-zA-Z0-9-]+)["'`]/g)) runtimeSet.add(m[1]);
    for (const m of src.matchAll(/^\s*(--[a-zA-Z0-9-]+)\s*:/gm)) runtimeSet.add(m[1]);
  }
  const undef: string[] = [];
  for (const { f, src } of v6Sources) {
    for (const m of src.matchAll(/var\((--[a-zA-Z0-9-]+)\s*(,|\))/g)) {
      const [, tok, next] = m;
      // A fallback is a deliberate degradation, so var(--x, y) is always fine.
      if (next === "," || defined.has(tok) || runtimeSet.has(tok)) continue;
      undef.push(`${tok} in ${f}`);
    }
  }
  ok("every var() in the V6 tree resolves to a token that exists", undef.length === 0,
    [...new Set(undef)].join(", "));
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
  before(runPanel, 'role="status" aria-live="polite"', "{d.label}") && before(runPanel, 'role="status" aria-live="polite"', "{statusText}"));

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
// THE PLAN PILL IS NO LONGER IN THE TOP BAR AT ALL, so the checks that policed its colour are gone with it.
// It used to open the product: a plan badge and a credit balance were the two most prominent things on every
// screen, which made "what you pay" and "what you have left" the headline facts of a verification product.
// Both moved into the account menu. Neither was removed.
//
// The rule that replaces the colour checks is the placement one, because that is what actually regressed:
// billing must not be the first thing in the chrome, and it must still be reachable.
const topbarIdx = ui.indexOf("function AppTopbar");
const topbar = ui.slice(topbarIdx, ui.indexOf("function WorkspaceSwitcher"));
const topbarHeader = topbar.slice(topbar.indexOf("<header"));
ok("the top bar does not lead with the plan or the balance",
  !/href="\/plans"[\s\S]{0,400}?height: 34/.test(topbarHeader.slice(0, topbarHeader.indexOf("acct-menu"))));
// The founder asked for them back in the bar: a number people check constantly should not need a click.
// So the rule is no longer WHERE they live but HOW they carry themselves. They may not lead the bar, and
// they may not wear a state colour, because on this surface green means "this verification held" and a
// subscription tier is not a verification result.
ok("plan and balance are visible in the bar", /vra-acct-readout/.test(topbar) && /href="\/plans"/.test(topbar));
ok("they do not lead it: the command surface comes first",
  before(topbarHeader, "<CommandPalette", "vra-acct-readout"));
ok("the readout is plain text, not a pill competing with the primary action",
  !/vra-acct-readout[\s\S]{0,300}?border-radius:99px/.test(ui));
ok("the readout never wears a state colour",
  !/\.vra-acct-readout[^"]*(--go-|--wait-|--stop-)/.test(ui));
ok("the top bar leads with the command surface and the primary action",
  /<CommandPalette/.test(topbar) && /New verification/.test(topbar));
// The one thing in the bar allowed a state colour is the review indicator, because it is the only thing in
// the bar reporting a state, and it renders only when a plan is genuinely waiting.
ok("the review indicator appears only when a plan is really waiting", /pendingReviews > 0 &&/.test(topbar));
// Was: literal hex swatches. Those literals are exactly what pinned the product to one theme, so the
// check now asserts the PROPERTY it always meant — that these panels name a state rather than a colour —
// and would fail again the moment someone reintroduces a hardcoded swatch here.
ok("the composer's not_provable + error panels name a state token, never a literal swatch",
  /background: "var\(--wait-wash\)"/.test(composer) && /background: "var\(--stop-wash\)"/.test(composer)
  && !/background: "#[0-9A-Fa-f]{6}"/.test(composer));
ok("the remaining infinite animations honour prefers-reduced-motion", /@media \(prefers-reduced-motion: reduce\) \{ \.pulse \{ animation: none; \} \.typing i \{ animation: none; \} \}/.test(css));

console.log("\n── overflow + heading structure locked (verified live at 5 widths; guarded structurally) ──");
// The greeting is gone. "Welcome back" is a fact about the door, not the business, and it occupied the line
// a reader looks at first; the h1 is now the operational state. The invariant that mattered is unchanged and
// still checked: the page carries exactly ONE h1 for a signed-in reader.
{
  const sections = readFileSync("app/rank/app/_components/overview-sections.tsx", "utf8");
  ok("the overview no longer greets the reader instead of reporting", !/Welcome back/.test(page));
  ok("the operational state is the h1", /<h1 className="display"[^>]*>Operational state<\/h1>/.test(sections));
  // Two h1s in page.tsx is correct: one for the signed-OUT hero and one for the signed-in overview, and a
  // request only ever renders one of them. What must never happen is a second h1 inside the signed-in tree.
  ok("exactly one h1 in the signed-in overview tree",
    (sections.match(/<h1/g) ?? []).length === 1
    && (readFileSync("app/rank/app/_components/composer.tsx", "utf8").match(/<h1/g) ?? []).length <= 1);
}
ok("deployment references truncate rather than overflow (bounded width + ellipsis)", /maxWidth: "22ch"[\s\S]*textOverflow: "ellipsis"/.test(rec) || /textOverflow: "ellipsis"[\s\S]*maxWidth: "22ch"/.test(rec));
ok("record rows constrain their text column (minWidth:0 + ellipsis) so long names cannot push the row wide",
  (rec.match(/minWidth: 0/g) ?? []).length >= 3 && (rec.match(/textOverflow: "ellipsis"/g) ?? []).length >= 3);
ok("running/degraded/onboarding wrap (flexWrap) rather than overflow on narrow screens", /flexWrap: "wrap"/.test(composer) && /flexWrap: "wrap"/.test(rec));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
