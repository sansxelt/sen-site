// Tests for lib/preflight/discover-synthesis.ts. Pure mapping always; a REAL-MODEL synthesis case runs
// when a key is present (proves the nested structured-output schema is not "too complex" + that the model
// grounds items in evidence and does not invent auth/payments). Run: npx tsx scripts/preflight-synthesis-verify.ts
import { loadEnvConfig } from "@next/env";
import { extractSnapshot } from "../lib/preflight/discover-extract";
import { synthesize, synthesisConfigured, enabledDefault, toSuggestions, type Synthesis } from "../lib/preflight/discover-synthesis";
loadEnvConfig(process.cwd());

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

// ── Pure mapping ──
ok("enabledDefault: explicit -> enabled", enabledDefault("explicit") === true);
ok("enabledDefault: strong_inference -> enabled", enabledDefault("strong_inference") === true);
ok("enabledDefault: best_practice -> disabled", enabledDefault("best_practice") === false);
{
  const s = { requirements: [{ text: "Project persists after refresh", category: "state_integrity", severity: "critical", confidence: 0.9, support: "explicit", sources: [{ type: "original_prompt", reference: "projects" }] }], flows: [], product_summary: "", product_type: "", roles: [], capabilities: [], data_entities: [], integrations: [], uncertainties: [] } as unknown as Synthesis;
  const sug = toSuggestions(s);
  ok("toSuggestions: carries text/category/severity/support/sources", sug.length === 1 && sug[0].requirement.includes("Project persists") && sug[0].severity === "critical" && sug[0].support === "explicit" && sug[0].source_refs.length === 1 && sug[0].enabledDefault === true);
}

// ── Real-model synthesis (grounded, no invention) ──
async function real() {
  if (!synthesisConfigured()) { console.log("SKIP  real synthesis (no model key)"); return; }
  // A projects app with a create form and NO login/pricing anywhere in the evidence.
  const html = `<!doctype html><html><head><title>TaskBoard</title><meta name="description" content="Create and track projects"></head>
  <body><nav><a href="/projects">Projects</a><a href="/settings">Settings</a></nav><h1>Your projects</h1>
  <form method="post" action="/api/projects"><input name="name" type="text"><button>Create project</button></form></body></html>`;
  const pages = [extractSnapshot(html, "https://taskboard.example/", 200)];
  const s = await synthesize(pages, "A tool where users create and manage projects. Projects should persist.");
  ok("real: synthesis returned (schema not too complex)", !!s, s ? `${s.requirements.length} reqs, ${s.flows.length} flows` : "null");
  if (!s) return;
  ok("real: every requirement cites >=1 source (provenance)", s.requirements.length > 0 && s.requirements.every((r) => r.sources.length >= 1));
  ok("real: product understood (mentions project)", /project/i.test(s.product_summary + " " + s.capabilities.join(" ")));
  ok("real: a persistence/state-integrity requirement exists", s.requirements.some((r) => /persist|refresh|state/i.test(r.text) || r.category.includes("state")));
  // No login/pricing in the evidence -> must not invent password reset or payment as an EXPLICIT fact.
  ok("real: does NOT invent password reset as explicit", !s.requirements.some((r) => /password reset/i.test(r.text) && r.support === "explicit"));
  ok("real: does NOT invent payment as explicit", !s.requirements.some((r) => /payment|billing|checkout|subscription/i.test(r.text) && r.support === "explicit"));
  ok("real: flows use only the allowlisted actions + semantic targets", s.flows.every((f) => f.steps.every((st) => ["navigate", "click", "fill", "select", "check", "uncheck", "press", "wait_for", "assert_visible", "assert_text", "assert_url", "refresh", "screenshot"].includes(st.action))));
}

real().then(() => { console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0); }).catch((e) => { console.error(e); process.exit(1); });
