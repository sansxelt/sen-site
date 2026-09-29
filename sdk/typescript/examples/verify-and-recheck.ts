// Example: the loop a coding agent runs after it deploys.
//   1. prepare: Vraelis builds the plan that would check the claim. Nothing runs, nothing is charged.
//   2. A person opens approve_url and approves the plan. An API key cannot.
//   3. run the approved plan and wait for verified, failed or blocked.
//   4. On failed: fix, redeploy, re-check the same approved plan, and wait again.
//
// Run: VRAELIS_API_KEY=vr_live_... DEPLOYMENT_URL=https://app.example.com npx tsx examples/verify-and-recheck.ts
// (Locally, "@vraelis/sdk" resolves to ../src through examples/tsconfig.json.)
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { Vraelis, VraelisAPIError, type VerificationCompleted } from "@vraelis/sdk";

const vraelis = new Vraelis({ apiKey: process.env.VRAELIS_API_KEY! });

const input = {
  deployment_url: process.env.DEPLOYMENT_URL ?? "https://app.example.com",
  claim: "A signed-in customer can upgrade to Pro and still has Pro after signing out and back in.",
};

function report(result: VerificationCompleted): void {
  console.log(`\n${result.verification_id}: ${result.decision}`);
  for (const e of result.evidence) console.log(`  ${e.result ?? "unknown"}  ${e.checking ?? ""}`);
  for (const f of result.failures) {
    console.log(`  failure: ${f.title ?? ""}`);
    console.log(`    expected: ${f.expected ?? ""}`);
    console.log(`    observed: ${f.observed ?? ""}`);
  }
  console.log(`  record: ${result.console_url}`);
}

async function waitForRedeploy(repairPrompt: string | null): Promise<void> {
  // In an agent, this is where repair_prompt goes back to the model, which fixes the code and redeploys.
  if (repairPrompt) console.log(`\nRepair prompt for the coding agent:\n${repairPrompt}\n`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question("Fix the code, redeploy, then press Enter to re-check. ");
  rl.close();
}

async function main(): Promise<void> {
  // 1. Build the plan. Nothing runs and nothing is charged.
  const plan = await vraelis.verifications.prepare(input, { idempotencyKey: randomUUID() });
  if (!plan.reviewed_plan_id || !plan.approve_url) throw new Error(plan.message);
  console.log("Vraelis will check these requirements:");
  for (const r of plan.requirements) console.log(`  - ${r}`);

  // 2. A person approves the plan in the browser. The agent's API key cannot approve it.
  console.log(`\nAsk a person to open this link and approve the plan:\n  ${plan.approve_url}\n`);
  await vraelis.verifications.waitForApproval(plan.reviewed_plan_id);
  console.log("Approved. Running it.");

  // 3. Run exactly the approved plan and wait for the decision.
  const run = await vraelis.verifications.run({ ...input, reviewed_plan_id: plan.reviewed_plan_id });
  let result = await vraelis.verifications.waitForResult(run.verification_id);
  report(result);

  // 4. Failed: fix, redeploy, and re-check the same approved plan. No new approval is needed within
  //    24 hours of the approval, for up to 10 re-checks.
  while (result.decision === "failed") {
    await waitForRedeploy(result.repair_prompt);
    const again = await vraelis.verifications.recheck(result.verification_id);
    console.log(`Re-checking as ${again.verification_id}. Re-checks left on this approval: ${again.rechecks_left ?? "unknown"}.`);
    result = await vraelis.verifications.waitForResult(again.verification_id);
    report(result);
  }

  if (result.decision === "blocked") {
    console.log("\nBlocked: Vraelis could not reach a verdict. Open the record to see why.");
  }
}

main().catch((err) => {
  if (err instanceof VraelisAPIError) {
    console.error(`Vraelis error ${err.status} ${err.code}: ${err.message}`, err.requestId ?? "");
    const body = err.body as { repair_prompt?: string | null; approve_url?: string } | null;
    if (err.code === "claim_not_provable" && body?.repair_prompt) console.error(body.repair_prompt);
    if (body?.approve_url) console.error(`A person can approve it at ${body.approve_url}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
