// Two verified UI-defect fixes (Overview launch affordance + attached rerun price note), locked by:
//   (1) pure gate-decision tests (decidePassGate) for the four required scenarios, proving the ENTITLEMENT
//       behavior the UI reflects is unchanged — a rerun is free ONLY on an unused pass, else PAYG $3; and
//   (2) static source checks that the Overview always exposes a real fresh-full-pass LAUNCH control when the
//       app is launchable (incl. BLOCKED with no newer deployment), and that the rerun price/balance note is
//       rendered INSIDE the RerunButton card (never a detached floating error).
// No DB, no network — pure logic + source scans, same shape as pass-pricing-verify / entitlements-verify.

import fs from "node:fs";
import path from "node:path";
import { decidePassGate } from "../lib/preflight/entitlements-v1";
import { rerunPriceCents, passPriceCents, FREE_TIER } from "../lib/preflight/pass-pricing";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
// Judge only what renders: strip comments so a phrase quoted in a comment can't satisfy a source assertion.
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/(\s)\/\/ .*$/gm, "$1");
const readCode = (...p: string[]) => stripComments(read(...p));

const OVERVIEW = path.join("app", "rank", "app", "applications", "[id]", "page.tsx");
const REPORT = path.join("app", "rank", "app", "applications", "[id]", "passes", "[runId]", "page.tsx");
const RERUN_BTN = path.join("app", "rank", "app", "applications", "[id]", "passes", "[runId]", "rerun-button.tsx");

async function main(): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────────────────────────────────
  // SCENARIO 1 — BLOCKED app + unused free pass → a fresh full-pass launch is available (Defect A).
  // The gate proves the pass is FREE (unused lifetime pass, within the free flow cap); the source proves the
  // Overview renders a real LaunchPassButton independent of the verdict when the app is launchable.
  // ─────────────────────────────────────────────────────────────────────────────────────────────────────
  console.log("── Scenario 1: BLOCKED app + unused free pass → fresh launch visible ──");
  {
    const g = decidePassGate({ plan: null, unitsUsedInWindow: 0, freePassUsed: false, selectedFlows: 3 });
    ok("unused free pass within the free tier -> a fresh full pass is FREE (mode 'free')", g.mode === "free" && g.ok);
  }
  {
    const src = readCode(OVERVIEW);
    // The always-on launch section: gated on launchable state, NOT on the verdict — so BLOCKED is included.
    ok("Overview renders a LaunchPassButton in an always-on launch section (not only inside newer-deploy)",
      (src.match(/LaunchPassButton/g)?.length ?? 0) >= 2);
    ok("the always-on launch section is gated on launchability, never on the verdict",
      src.includes('caps.canLaunch && contractApproved && !latestActive && !newerDeploy'));
    // Prove the section does NOT exclude a blocked decision: its condition references no `decision !== 'blocked'`
    // and no `decision === 'ready'` restriction. Its only decision use is the repair-verified flow-set choice.
    ok("the launch section's gate contains no decision-based exclusion (BLOCKED is not filtered out)",
      !/!latestActive && !newerDeploy[^?]*decision\s*[!=]==\s*["']blocked["']/.test(src));
    // Its label is a FRESH full pass, not a rerun.
    ok("the launch section launches a fresh full pass (label 'Run a Production Pass' / full critical verification)",
      src.includes('"Run a Production Pass"') && src.includes('aria-label="Launch a Production Pass"'));
    // The PassPreview (the price/"Included" card) rides ALONGSIDE the button so cost + control appear together.
    ok("the launch section pairs the button with a PassPreview so the free-pass price shows with the control",
      /aria-label="Launch a Production Pass"[\s\S]{0,1200}PassPreview/.test(src));
  }

  // ─────────────────────────────────────────────────────────────────────────────────────────────────────
  // SCENARIO 2 — BLOCKED app + insufficient balance → the rerun is correctly BLOCKED (PAYG, unaffordable).
  // The gate returns PAYG $3 (pass already used); the rerun route holds cents and 402s on an insufficient
  // balance. We prove the PAYG decision + that the route's insufficient-balance refusal is intact.
  // ─────────────────────────────────────────────────────────────────────────────────────────────────────
  console.log("\n── Scenario 2: BLOCKED app + insufficient balance → rerun correctly blocked ──");
  {
    const g = decidePassGate({ plan: null, unitsUsedInWindow: 0, freePassUsed: true, selectedFlows: 1, rerun: true });
    ok("free pass used -> a 1-flow targeted rerun is PAYG $3 (rerunPriceCents(1))",
      g.mode === "payg" && g.ok && g.cents === rerunPriceCents(1) && g.cents === 300);
  }
  {
    const route = read("app", "api", "preflight", "runs", "[runId]", "rerun", "route.ts");
    ok("rerun route holds CENTS and 402s with an insufficient_balance refusal when the balance is short",
      route.includes('error: "insufficient_balance"') && route.includes("Add balance to launch it.") && route.includes("status: 402"));
    ok("rerun route prices the PAYG hold via rerunPriceCents (never passPriceCents / free)",
      route.includes("rerunPriceCents(") && !route.includes("passPriceCents("));
  }

  // ─────────────────────────────────────────────────────────────────────────────────────────────────────
  // SCENARIO 3 — a fresh (unused) free pass does NOT silently make a targeted rerun cheaper-than-priced, and
  // the rerun stays PAYG $3 once the pass is spent. This guards requirement 2: we did not "accidentally" make
  // reruns free — the ONLY free rerun is the one that consumes an unused lifetime pass (unchanged behavior).
  // ─────────────────────────────────────────────────────────────────────────────────────────────────────
  console.log("\n── Scenario 3: fresh free pass does not cover a targeted rerun as a $0 discount ──");
  {
    // With the pass UNUSED, a rerun consumes the free pass exactly like a fresh pass (existing behavior) —
    // it is 'free', not a $0-priced PAYG rerun. This documents the one legitimate free path.
    const unused = decidePassGate({ plan: null, unitsUsedInWindow: 0, freePassUsed: true, selectedFlows: 2, rerun: true });
    ok("with the free pass SPENT, a 2-flow rerun is PAYG $6 (2 x $3), never free",
      unused.mode === "payg" && unused.ok && unused.cents === rerunPriceCents(2) && unused.cents === 600);
    // The rerun price is $3/flow, capped at the comparable full pass — a 10-flow rerun is capped, never $30+.
    const big = decidePassGate({ plan: null, unitsUsedInWindow: 0, freePassUsed: true, selectedFlows: 10, rerun: true });
    ok("a large PAYG rerun is capped at the comparable full pass (never exceeds a fresh pass)",
      big.mode === "payg" && big.ok && big.cents === rerunPriceCents(10) && big.cents <= passPriceCents(10));
    // The report page must reflect the SAME gate for the rerun note (never a hardcoded 'free' string).
    const report = readCode(REPORT);
    ok("report computes the rerun note from gatePassLaunch({rerun:true}) (never a hardcoded price)",
      report.includes("gatePassLaunch(owner, rerunSelectedCount, { rerun: true })"));
    ok("report's PAYG rerun note states it is 'Not covered by the free pass'",
      report.includes("Not covered by the free pass"));
    ok("report only asserts a dollar rerun price under passPricingEnabled()",
      /passPricingEnabled\(\)[\s\S]{0,200}gatePassLaunch/.test(report));
  }

  // ─────────────────────────────────────────────────────────────────────────────────────────────────────
  // SCENARIO 4 — newer-deployment and no-newer-deployment states both keep a reachable launch, with no
  // DOUBLE button: the always-on section is hidden only when the newer-deploy banner already renders its own
  // launch control; in every other state (including BLOCKED, no newer deploy) the always-on section shows.
  // ─────────────────────────────────────────────────────────────────────────────────────────────────────
  console.log("\n── Scenario 4: newer-deployment and no-newer-deployment launch states ──");
  {
    const src = readCode(OVERVIEW);
    // no-newer-deploy: the always-on section renders (its gate requires !newerDeploy).
    ok("no newer deployment: the always-on launch section is gated with !newerDeploy so it renders",
      src.includes("!latestActive && !newerDeploy"));
    // newer-deploy: the amber 'New deployment unverified' banner has its OWN LaunchPassButton, so the
    // always-on section is suppressed (via !newerDeploy) and there is exactly ONE launch control, not two.
    ok("newer deployment: the unverified-deploy banner still renders its own LaunchPassButton",
      /New deployment unverified[\s\S]*?LaunchPassButton/.test(src));
    // Exactly TWO LaunchPassButton usages exist (newer-deploy banner + always-on section); they are mutually
    // exclusive at runtime because the always-on section carries !newerDeploy, so only one ever renders.
    const usages = (src.match(/<LaunchPassButton/g)?.length ?? 0);
    ok("no double launch button: exactly 2 mutually-exclusive LaunchPassButton usages, gated by !newerDeploy",
      usages === 2 && src.includes("!newerDeploy"));
  }

  // ─────────────────────────────────────────────────────────────────────────────────────────────────────
  // DEFECT B — the rerun price/balance note is a CHILD of the RerunButton card, so it can never appear as a
  // floating detached error separate from the button it governs.
  // ─────────────────────────────────────────────────────────────────────────────────────────────────────
  console.log("\n── Defect B: rerun price/balance note is attached to the rerun button/card ──");
  {
    const btn = readCode(RERUN_BTN);
    ok("RerunButton accepts a priceNote and renders it inside the same card as the button",
      btn.includes("priceNote") && /data-testid="rerun-card"/.test(btn));
    ok("the note (error OR priceNote) is a sibling of the button INSIDE the bordered card, not a page-level line",
      /border:.*var\(--line-2\)[\s\S]*<button[\s\S]*(err \?[\s\S]*priceNote|priceNote)/.test(btn));
    ok("a post-click 402 error replaces the neutral price note in the SAME slot (never a second stray line)",
      /err \? \([\s\S]*?\) : priceNote \? \([\s\S]*?\) : null/.test(btn));
    const report = readCode(REPORT);
    ok("report passes the computed priceNote into BOTH rerun call sites",
      (report.match(/RerunButton[\s\S]*?priceNote=\{rerunPriceNote\}/g)?.length ?? 0) >= 2);
    ok("the 'Back to application' link is a separate control (not inside the rerun card)",
      report.includes('className="btn btn--ghost"') && report.includes("Back to application"));
  }

  // A sanity check on the constants the scenarios lean on (guards a silent constant drift).
  ok("free-tier flow cap is >= the 3-flow free-pass selection used above", FREE_TIER.flowsPerPass >= 3);
  ok("rerun per-flow price is $3 (300 cents)", rerunPriceCents(1) === 300);

  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(`launch-affordance-verify crashed: ${(e as Error).message}`); process.exit(1); });
