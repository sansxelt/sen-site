// The guarantee lane must plan with the SAME evidence the discovery lane plans with.
//
// THE DEFECT THIS GUARDS. synthesizeClaim used to pass the literal `{ sources: [], connections: [] }` to
// the synthesis model, while discover-run.ts passed the maker's product context and the app's connected
// services. The crawler cannot sign in, so for any claim about signed-in behavior the only pages in
// evidence were the logged-out ones, and the prompt's own rule ("do NOT invent ROUTES that are not in the
// evidence") then forced the model to build the flow out of the marketing page.
//
// Measured on the Notewell demo system: the approved plan navigated to "/" and clicked "Create free
// account" (a link to signup) in order to create a note, then asserted the note's title on the marketing
// page. Notes live on /dashboard. The app satisfies the guarantee by hand, so that plan could only ever
// have produced a false failure - the worst defect class this product has.
//
// Two halves are proven here. The BEHAVIOURAL half uses the pure prompt builder to show that a context
// source actually changes the prompt (otherwise wiring it through would be worthless). The WIRING half is
// static, because assembling the context needs a database: it proves the lane derives its context from the
// system and that the guarantee prepare route passes one.
import { readFileSync } from "node:fs";
import { buildSynthesisPrompt } from "../lib/preflight/discover-synthesis";
import type { PageSnapshot } from "../lib/preflight/discover-extract";
import { normalizeContextSources } from "../lib/preflight/connections-db";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const read = (p: string) => readFileSync(p, "utf8");
const lane = read("lib/preflight/verification-lane.ts");
const prepare = read("app/api/preflight/apps/[id]/guarantees/[gid]/prepare/route.ts");

// A slice between two anchors that FAILS LOUDLY when either anchor is gone, instead of silently becoming
// the whole file or an empty string (which is how an assertion ends up unable to fail).
function between(src: string, startAnchor: string, endAnchor: string, label: string): string {
  const a = src.indexOf(startAnchor);
  const b = src.indexOf(endAnchor, a + 1);
  // An empty slice makes every .includes() below false, so a missing anchor fails the assertions that
  // depend on it instead of quietly widening to the whole file (which would let them pass on nothing).
  if (a === -1) { ok(`${label}: start anchor ${JSON.stringify(startAnchor)} exists`, false); return ""; }
  if (b === -1) { ok(`${label}: end anchor ${JSON.stringify(endAnchor)} exists`, false); return ""; }
  return src.slice(a, b);
}

// The same, for a function that runs to the end of its file. Still fails loudly when the anchor is gone.
function fromAnchor(src: string, startAnchor: string, label: string): string {
  const a = src.indexOf(startAnchor);
  if (a === -1) { ok(`${label}: anchor ${JSON.stringify(startAnchor)} exists`, false); return ""; }
  return src.slice(a);
}

// ── Behavioural: a context source reaches the model, an empty context adds nothing ──────────────────────
const page: PageSnapshot = {
  url: "https://example.test/", status: 200, title: "Example", metaDescription: "",
  headings: ["Welcome"], navLinks: [], links: [], forms: [], buttons: [], ctas: [],
  indicators: [], roles: [], apiRefs: [], framework: null,
};
const MARKER = "NOTES LIVE ON /dashboard, NEVER ON THE ROOT PAGE";
const withContext = buildSynthesisPrompt([page], "a claim", { sources: [{ kind: "workflows", content: MARKER }], connections: ["supabase"] });
const withoutContext = buildSynthesisPrompt([page], "a claim", { sources: [], connections: [] });

ok("a workflows context source reaches the synthesis prompt verbatim", withContext.includes(MARKER));
ok("the prompt announces its PRODUCT CONTEXT section when there is one", withContext.includes("PRODUCT CONTEXT"));
ok("a connected service reaches the prompt as a CONNECTED SERVICES signal", withContext.includes("CONNECTED SERVICES") && withContext.includes("supabase"));
ok("an EMPTY context contributes no product context at all (this is what the lane used to send)",
  !withoutContext.includes("PRODUCT CONTEXT") && !withoutContext.includes("CONNECTED SERVICES"));
ok("context therefore changes the prompt, so wiring it through is not cosmetic", withContext !== withoutContext);

// ── Wiring: the lane derives its context from the system rather than hard-coding an empty one ──────────
ok("the lane no longer hands synthesize() a hard-coded empty context literal",
  !/synthesize\(\s*snapshot\.pages\s*,\s*claim\s*,\s*\{\s*sources:\s*\[\s*\]\s*,\s*connections:\s*\[\s*\]\s*\}\s*\)/.test(lane));
ok("the lane builds its synthesis context from the system when it has one",
  /const\s+context\s*=\s*system\s*\?\s*await\s+systemSynthContext\(/.test(lane));
ok("that derived context is what reaches synthesize()",
  /synthesize\(\s*snapshot\.pages\s*,\s*claim\s*,\s*context\s*\)/.test(lane));
ok("synthesizeClaim accepts the system the claim belongs to",
  /export\s+async\s+function\s+synthesizeClaim\([\s\S]{0,400}?system\?\s*:\s*\{\s*owner:\s*string;\s*applicationId:\s*string\s*\}/.test(lane));

// systemSynthContext must read all three inputs discover-run reads. Scoped to the function body so an
// unrelated mention of the same helper elsewhere in the file cannot satisfy these.
const ctxFn = between(lane, "export async function systemSynthContext", "export async function synthesizeClaim", "systemSynthContext");
ok("systemSynthContext reads the maker's product context sources", ctxFn.includes("readContextSources("));
ok("systemSynthContext reads the system's own connections", ctxFn.includes("listConnections("));
ok("systemSynthContext reads account-level connection links", ctxFn.includes("listAppLinks("));
ok("systemSynthContext degrades to empty rather than failing the request that wanted a plan",
  (ctxFn.match(/\.catch\(\(\)\s*=>\s*\[\]\)/g) ?? []).length >= 3);

// ── Wiring: the guarantee prepare route hands its system down ──────────────────────────────────────────
ok("the guarantee prepare route passes its owner + application to synthesizeClaim",
  /synthesizeClaim\(\s*app\.app_url\s*,\s*g\.title\s*,\s*\{\s*owner\s*,\s*applicationId:\s*id\s*\}\s*\)/.test(prepare));

// ── The context has to be writable, or the wiring above is inert ──────────────────────────────────────
// context_sources used to be accepted only by POST /api/preflight/apps, at creation. Every system created
// before a maker knew what to write was stuck with what it had, and for a system whose behaviour is behind
// a login this is the planner's only channel to the signed-in surface.
const appPatch = read("app/api/preflight/apps/[id]/route.ts");
const patchFn = fromAnchor(appPatch, "export async function PATCH", "apps/[id] PATCH");
ok("an existing system's product context can be updated, not only set at creation",
  /Array\.isArray\(body\?\.context_sources\)/.test(patchFn));
ok("the update normalizes through the SAME normalizer creation uses", patchFn.includes("normalizeContextSources(body.context_sources)"));
ok("the update persists through the SAME writer creation uses", patchFn.includes("applySetupExtras("));
ok("creation still writes context the same way, so the two paths cannot drift",
  read("app/api/preflight/apps/route.ts").includes("normalizeContextSources(body?.context_sources)"));

// Behavioural: the normalizer fails closed on a kind nobody declared, so a PATCH cannot smuggle in a
// context kind the synthesis prompt has no tag for.
const normalized = normalizeContextSources([
  { kind: "workflows", name: "w", content: "notes live on /dashboard" },
  { kind: "not_a_real_kind", name: "x", content: "should be dropped" },
  { kind: "auth_expect", name: "a", content: "   " },
]);
ok("a declared context kind with content survives normalization",
  normalized.some((s) => s.kind === "workflows" && s.content.includes("/dashboard")));
ok("an undeclared context kind is dropped rather than stored", !normalized.some((s) => s.kind === "not_a_real_kind"));
ok("a declared kind with only whitespace contributes nothing", !normalized.some((s) => s.kind === "auth_expect"));

// ── The parity this exists to hold ─────────────────────────────────────────────────────────────────────
const discover = read("lib/preflight/discover-run.ts");
for (const helper of ["readContextSources", "listConnections", "listAppLinks"]) {
  ok(`discover-run still reads ${helper}, so the two lanes remain comparable`, discover.includes(`${helper}(`));
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
