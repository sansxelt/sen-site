// What a coding agent sees from Vraelis over MCP: the three tools, the server instructions, and the words
// every state renders as.
//
// TWO COPIES EXIST, ON PURPOSE. cli/vraelis.mjs carries the same definitions for the local stdio server,
// because the CLI is one file served as plain text and cannot import from the app. scripts/mcp-verify.ts
// fails if the tool names, required inputs, or the rules that matter (never approve, only VERIFIED means
// done) drift between them. Change both together.

export const MCP_INSTRUCTIONS = [
  "Vraelis independently checks whether something you built works on the live, deployed web app, in a real browser.",
  "Use vraelis_verify after you finish a change a user can see or do in a deployed web app, before you tell the user it is done.",
  "Tell the user it works only if the result is VERIFIED. If it is FAILED, fix the cause, redeploy to the same site, and call vraelis_recheck.",
  "The first check of a claim needs the user to approve Vraelis's plan. You cannot approve it yourself: give the user the approval link.",
  "Each run is billed to the user's Vraelis account as one verification.",
].join(" ");

export const MCP_TOOLS = [
  {
    name: "vraelis_verify",
    title: "Verify on the live app",
    description: "Independently check that a change you made works on the deployed web app, in a real browser, before you tell the user it is done. "
      + "Give the public https URL where the change is live and ONE sentence saying what a user can now do and what should be true afterwards, "
      + "for example \"A signed-in user can cancel their plan from Billing and then sees Cancelled\". "
      + "The first check of a claim needs the user to approve Vraelis's plan; this tool returns the approval link, and the check starts once they approve and you call vraelis_status. "
      + "Ends in VERIFIED, FAILED (with what broke, expected vs observed, and a repair prompt) or BLOCKED (could not decide). Billed as one verification.",
    inputSchema: {
      type: "object",
      properties: {
        deployment_url: { type: "string", description: "Public https URL where the change is deployed, e.g. a preview or production URL. Not localhost." },
        claim: { type: "string", description: "One sentence: what a user can now do and what should be true afterwards. The outcome, not the steps." },
      },
      required: ["deployment_url", "claim"],
      additionalProperties: false,
    },
    annotations: { title: "Verify on the live app", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "vraelis_status",
    title: "Check status",
    description: "Get where a Vraelis check is: PREPARING, WAITING FOR APPROVAL, RUNNING, or its decision. Waits briefly for news before answering. "
      + "Pass the id vraelis_verify or vraelis_recheck gave you (job_... or vrf_...). Call again while it is still going.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "The job_... or vrf_... id from vraelis_verify or vraelis_recheck." } },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: { title: "Check status", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "vraelis_recheck",
    title: "Re-check after a fix",
    description: "Run the same approved check again after you fixed something that FAILED. Deploy the fix first: Vraelis tests what is live, not your local code. "
      + "No new approval is needed for 24 hours after the user approved the plan (at most 10 re-checks); after that, use vraelis_verify again. "
      + "It runs on the same site the plan was approved for. Billed as one verification.",
    inputSchema: {
      type: "object",
      properties: {
        verification_id: { type: "string", description: "The vrf_... id of the verification to run again." },
        deployment_url: { type: "string", description: "Optional. A different URL on the SAME site, if the fix is live at another path." },
      },
      required: ["verification_id"],
      additionalProperties: false,
    },
    annotations: { title: "Re-check after a fix", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
] as const;

type Failure = { severity?: string | null; title?: string | null; expected?: string | null; observed?: string | null; reproduce?: string | null };
type Evidence = { checking?: string | null; result?: string | null; failed_at_step?: number | null };
export type VerificationView = {
  verification_id: string; decision?: string; claim?: string | null; requirements?: string[];
  failures?: Failure[]; evidence?: Evidence[]; repair_prompt?: string | null; console_url?: string;
};

export function renderResult(v: VerificationView): string {
  const id = v.verification_id;
  const claim = v.claim ? `"${v.claim}"` : "the claim";
  const out: string[] = [];
  if (v.decision === "verified") {
    out.push(`VERIFIED: ${claim}`);
    out.push(`Vraelis checked ${(v.requirements ?? []).length} requirement(s) on the live app in a real browser and saw no failures. Verification ${id}.`);
    for (const r of v.requirements ?? []) out.push(`  - ${r}`);
    if (v.console_url) out.push(`Record: ${v.console_url}`);
    out.push("You can tell the user this is verified on the deployed app. Share the record link if they want the evidence.");
    return out.join("\n");
  }
  if (v.decision === "failed") {
    out.push(`FAILED: ${claim}. Verification ${id}.`);
    out.push("What broke:");
    (v.failures ?? []).forEach((f, i) => {
      out.push(`${i + 1}. [${f.severity ?? "issue"}] ${f.title ?? ""}`);
      if (f.expected) out.push(`   expected: ${f.expected}`);
      if (f.observed) out.push(`   observed: ${f.observed}`);
      if (f.reproduce) out.push(`   reproduce: ${f.reproduce}`);
    });
    if (v.repair_prompt) out.push("", "Repair prompt from Vraelis:", v.repair_prompt);
    if (v.console_url) out.push("", `Record: ${v.console_url}`);
    out.push("", `Next: fix the cause, deploy it to the same site, then call vraelis_recheck with verification_id "${id}". Do not tell the user this works until a check comes back VERIFIED.`);
    return out.join("\n");
  }
  out.push(`BLOCKED: Vraelis could not reach a decision for ${claim}. Verification ${id}.`);
  for (const e of v.evidence ?? []) if (e.result && e.result !== "passed") out.push(`  - ${e.checking}: ${e.result}${e.failed_at_step ? ` (step ${e.failed_at_step})` : ""}`);
  out.push("This is not a pass. Common causes: a page needs a sign-in Vraelis has no test account for, a bot check, or the site did not respond.");
  if (v.console_url) out.push(`Record: ${v.console_url}`);
  out.push("Tell the user it could not be verified and show them the record. Do not say it works.");
  return out.join("\n");
}

export function renderApproval(input: { id: string; claim: string; url: string; approveUrl: string; requirements: string[]; flows: { name?: string; goal?: string }[] }): string {
  const out = [`WAITING FOR APPROVAL (id "${input.id}").`, `Vraelis wrote this plan for "${input.claim}" on ${input.url}. A person has to approve it before it runs. You cannot approve it yourself.`, "", "Requirements it will check:"];
  input.requirements.forEach((r, i) => out.push(`${i + 1}. ${r}`));
  if (input.flows.length) {
    out.push("", "What a real browser will do:");
    for (const f of input.flows) out.push(`- ${f.name ?? "Journey"}${f.goal ? `: ${f.goal}` : ""}`);
  }
  out.push("", `Ask the user to open this link and approve the plan: ${input.approveUrl}`);
  out.push("If the requirements do not match what you built, tell the user before they approve.");
  out.push(`Once they approve, call vraelis_status with id "${input.id}" to start the check.`);
  return out.join("\n");
}

export function renderError(title: string, message: string, extra: { repair_prompt?: string | null; remaining_obligations?: unknown[] } = {}): string {
  const out = [`${title}: ${message}`];
  if (title === "NOT SIGNED IN") out.push("Ask the user to reconnect Vraelis, or to run `vraelis login` if you use the CLI.");
  if (title === "NO BALANCE") out.push("Ask the user to add balance or a plan at https://app.vraelis.com/billing, then try again.");
  if (title === "CANNOT BUILD A CHECK FOR THIS") {
    for (const o of extra.remaining_obligations ?? []) out.push(`  - ${typeof o === "string" ? o : (o as { text?: string })?.text ?? JSON.stringify(o)}`);
    if (extra.repair_prompt) out.push("", extra.repair_prompt);
    out.push("Nothing was charged. Rewrite the claim as something a user can see or do on the site, or tell the user.");
  }
  return out.join("\n");
}

/** The error title an agent sees for an API refusal, the same mapping the CLI's MCP server uses. */
export function errorTitle(status: number, code: string, fallback = "ERROR"): string {
  if (status === 401 || code === "invalid_api_key" || code === "signin_required") return "NOT SIGNED IN";
  if (status === 402) return "NO BALANCE";
  if (code === "claim_not_provable") return "CANNOT BUILD A CHECK FOR THIS";
  if (code === "plan_requires_human") return "NEEDS A PERSON";
  if (code === "recheck_window_closed" || code === "recheck_limit_reached") return "NEEDS A NEW APPROVAL";
  return fallback;
}
