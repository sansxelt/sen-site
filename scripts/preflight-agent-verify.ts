// Agent substrate + discovery agent safety proof — zero real spend (no live SDK call, no key used).
//
// Verifies the gates that make a BILLABLE capability safe: flag OFF by default, no call without a key,
// governor pause blocks spend, output is validated/clamped, and the key is never surfaced. The live SDK
// path is NOT exercised here (that would cost money + need a key); it activates only when VRAELIS_AGENT=1
// with a real key — which the operator flips knowingly.

import { agentEnabled, agentConfigured } from "../lib/preflight/agent/agent-client";
import { sanitizeProposal, proposeContract } from "../lib/preflight/agent/discovery-agent";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") { if (cond) { pass++; console.log(`PASS  ${name}`); } else { fail++; console.log(`FAIL  ${name}${detail ? `  — ${detail}` : ""}`); } }

async function main() {
  console.log("── the gate: agents are OFF unless explicitly enabled ──");
  const prevFlag = process.env.VRAELIS_AGENT;
  const prevKey = process.env.ANTHROPIC_API_KEY;
  const prevLlm = process.env.VRAELIS_LLM_API_KEY;

  delete process.env.VRAELIS_AGENT;
  ok("agentEnabled() is FALSE when VRAELIS_AGENT is unset (default OFF)", agentEnabled() === false);
  process.env.VRAELIS_AGENT = "0";
  ok("agentEnabled() is FALSE when VRAELIS_AGENT=0", agentEnabled() === false);
  process.env.VRAELIS_AGENT = "1";
  ok("agentEnabled() is TRUE only when VRAELIS_AGENT=1", agentEnabled() === true);

  // agentConfigured requires BOTH the flag AND a key.
  process.env.VRAELIS_AGENT = "1";
  delete process.env.ANTHROPIC_API_KEY; delete process.env.VRAELIS_LLM_API_KEY;
  ok("agentConfigured() is FALSE when the flag is on but no key is present", agentConfigured() === false);
  process.env.VRAELIS_AGENT = "0"; process.env.ANTHROPIC_API_KEY = "sk-test-not-real";
  ok("agentConfigured() is FALSE when a key exists but the flag is OFF", agentConfigured() === false);

  console.log("\n── the discovery agent never calls the model when disabled (no spend) ──");
  // Flag OFF + a (fake) key present -> proposeContract must return null WITHOUT any SDK call. If it tried to
  // call, it would throw/hit the network; returning null proves the gate short-circuits before the SDK.
  process.env.VRAELIS_AGENT = "0"; process.env.ANTHROPIC_API_KEY = "sk-test-not-real";
  const disabled = await proposeContract({ owner: "t@e.com", appName: "X", appUrl: "https://x.test" });
  ok("proposeContract returns null (no model call) when the agent flag is OFF", disabled === null);

  // Flag ON but NO key -> also null, no call.
  process.env.VRAELIS_AGENT = "1"; delete process.env.ANTHROPIC_API_KEY; delete process.env.VRAELIS_LLM_API_KEY;
  const noKey = await proposeContract({ owner: "t@e.com", appName: "X", appUrl: "https://x.test" });
  ok("proposeContract returns null (no model call) when there is no API key", noKey === null);

  console.log("\n── output validation: model output is clamped to the exact shape, never trusted raw ──");
  ok("a well-formed proposal is accepted + normalized",
    (() => {
      const p = sanitizeProposal({ requirements: [{ requirement: "Projects persist after refresh", category: "state", severity: "critical" }], flows: [{ name: "Create + persist", goal: "g", priority: "critical", steps: [{ action: "navigate", target: "/" }, { action: "refresh" }] }] });
      return !!p && p.requirements.length === 1 && p.requirements[0].severity === "critical" && p.flows[0].steps.length === 2;
    })());
  ok("a bad severity is clamped to 'important' (never a garbage value)",
    sanitizeProposal({ requirements: [{ requirement: "x", category: "c", severity: "EXTREME" }], flows: [] })?.requirements[0].severity === "important");
  ok("empty requirements are dropped (a blank requirement is not proposed)",
    sanitizeProposal({ requirements: [{ requirement: "", category: "c", severity: "critical" }], flows: [] }) === null);
  ok("flows with no steps are dropped", (sanitizeProposal({ requirements: [{ requirement: "x", category: "c", severity: "critical" }], flows: [{ name: "empty", goal: "g", priority: "critical", steps: [] }] })?.flows.length ?? 0) === 0);
  ok("over-long output is clamped (<=8 requirements, <=6 flows)",
    (() => {
      const reqs = Array.from({ length: 20 }, (_, i) => ({ requirement: `r${i}`, category: "c", severity: "important" }));
      const flows = Array.from({ length: 20 }, (_, i) => ({ name: `f${i}`, goal: "g", priority: "important", steps: [{ action: "navigate" }] }));
      const p = sanitizeProposal({ requirements: reqs, flows });
      return !!p && p.requirements.length <= 8 && p.flows.length <= 6;
    })());
  ok("garbage input returns null (never a crash)", sanitizeProposal(null) === null && sanitizeProposal("nope") === null && sanitizeProposal({}) === null);

  console.log("\n── key safety: the source never embeds/prints the key ──");
  const src = readFileSync("lib/preflight/agent/agent-client.ts", "utf8");
  ok("the agent client reads the key from process.env, never a literal", /process\.env\.ANTHROPIC_API_KEY/.test(src) && !/sk-ant-/.test(src));
  ok("the agent client never console.log/console.error's the key value", !/console\.\w+\([^)]*apiKey/i.test(src) && !/console\.\w+\([^)]*key\b/i.test(src));
  ok("metering rides the EXISTING cost governor (recordProviderCost aiTokens)", /recordProviderCost\(\{ owner:[^}]*aiTokens/.test(src));
  ok("the governor pause blocks agent spend (isRunsGovernorPaused checked before the call)", /isRunsGovernorPaused\(\)/.test(src) && /governor_paused/.test(src));
  ok("output tokens are hard-capped (bounded cost per call)", /Math\.min\(Math\.max\(256,[^)]*\), 4096\)/.test(src));

  // restore env
  if (prevFlag === undefined) delete process.env.VRAELIS_AGENT; else process.env.VRAELIS_AGENT = prevFlag;
  if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prevKey;
  if (prevLlm === undefined) delete process.env.VRAELIS_LLM_API_KEY; else process.env.VRAELIS_LLM_API_KEY = prevLlm;

  console.log(`\n${pass}/${pass + fail} passed`);
  if (fail > 0) process.exit(1);
}

import { readFileSync } from "node:fs";
main().catch((e) => { console.error(e); process.exit(1); });
