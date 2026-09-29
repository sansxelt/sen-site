// POST /mcp (rewritten here by proxy.ts) — the hosted MCP server, for connectors that cannot run a local
// process: ChatGPT and claude.ai. Local assistants (Claude Code, Codex, Gemini CLI, Copilot, Cursor, Trae)
// use `vraelis mcp` from the CLI instead, which offers the same three tools.
//
// Streamable HTTP, JSON responses only: every tool answers within one request, so there is nothing to
// stream and no session to keep. Auth is a Vraelis API key, as a Bearer token (what the OAuth flow in
// lib/mcp/oauth.ts hands a connector) or as x-api-key (what a developer pastes into a client that takes a
// header). Either way the tools call the same /v1 route handlers the CLI calls over the network, with the
// same key, so this file adds no second path to anything that spends money or decides anything.
//
// NO JOB TABLE. A serverless function forgets everything between requests, so a check is found again by what
// it was about: the job id carries the URL, the claim and when it started, and the newest reviewed plan for
// that pair (findLatestPlanForClaim) says where the check is. Writing a plan can outlast one request; it keeps
// going in after(), and if it fails there the reason is written to the event log for the next status call.
import { after } from "next/server";
import { verifyApiKey } from "@/lib/v-api-keys";
import { findLatestPlanForClaim } from "@/lib/preflight/reviewed-plan-db";
import { getRunLite } from "@/lib/preflight/runs-db";
import { logEvent, recentEventsByType } from "@/lib/v-events";
import { MCP_INSTRUCTIONS, MCP_TOOLS, renderResult, renderApproval, renderError, errorTitle, type VerificationView } from "@/lib/mcp/tools";
import { publicOrigin, b64url } from "@/lib/mcp/oauth";
import { POST as createVerification } from "@/app/api/v1/verifications/route";
import { GET as readVerification } from "@/app/api/v1/verifications/[id]/route";
import { GET as readPlan } from "@/app/api/v1/verifications/plans/[id]/route";
import { POST as recheckVerification } from "@/app/api/v1/verifications/[id]/recheck/route";
import { planApproveUrl } from "@/app/api/v1/verifications/_approve-url";
import { WIDGET_URI, WIDGET_MIME, WIDGET_HTML } from "@/lib/mcp/widget";
import { CORS_HEADERS, preflight } from "../oauth/_cors";

export const runtime = "nodejs";
// Writing a plan (crawl + model + at most two corrections) is allowed 300s on /v1, and it may finish in
// after() here, so this route needs the same budget.
export const maxDuration = 300;

const WAIT_MS = 40_000;
const POLL_MS = 5_000;
const PREPARE_GRACE_MS = 6 * 60 * 1000;
const SERVER_VERSION = "0.3.0";

type Ctx = { req: Request; key: string; email: string };
type Job = { u: string; c: string; t: number };
// What the check card (lib/mcp/widget.ts) draws. The text beside it is what the model reads; this is the
// same facts for the person looking at the conversation.
type CardData = {
  state: "preparing" | "waiting_for_approval" | "starting" | "running" | "verified" | "failed" | "blocked" | "error";
  id?: string; verification_id?: string; claim?: string | null; url?: string | null; approve_url?: string; record_url?: string;
  requirements?: string[]; flows?: { name?: string; goal?: string }[];
  failures?: { title?: string | null; expected?: string | null; observed?: string | null }[];
  message?: string;
};
type ToolResult = { content: { type: "text"; text: string }[]; structuredContent?: CardData; isError?: boolean };

const text = (t: string, isError = false, card?: CardData): ToolResult => {
  const data = card ?? (isError ? { state: "error" as const, message: t.split("\n")[0].replace(/^[A-Z ,']+:\s*/, "") } : undefined);
  return { content: [{ type: "text", text: t }], ...(data ? { structuredContent: data } : {}), ...(isError ? { isError: true } : {}) };
};

/** A finished or running verification, as the card wants it. */
function resultCard(v: Record<string, unknown>): CardData {
  const decision = String(v.decision ?? "");
  return {
    state: decision === "verified" || decision === "failed" || decision === "blocked" ? decision : "running",
    verification_id: String(v.verification_id ?? ""),
    claim: (v.claim as string) ?? null,
    requirements: (v.requirements as string[]) ?? [],
    failures: ((v.failures as { title?: string; expected?: string; observed?: string }[]) ?? []).map((f) => ({ title: f.title, expected: f.expected, observed: f.observed })),
    ...(typeof v.console_url === "string" ? { record_url: v.console_url } : {}),
  };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const encodeJob = (j: Job) => `job_${b64url(JSON.stringify(j))}`;
function decodeJob(id: string): Job | null {
  if (!id.startsWith("job_")) return null;
  try {
    const j = JSON.parse(Buffer.from(id.slice(4), "base64url").toString("utf8")) as Job;
    return typeof j.u === "string" && typeof j.c === "string" && typeof j.t === "number" ? j : null;
  } catch { return null; }
}

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response> | Response;

/** Call one of the /v1 handlers as this key. Same code path as a network call, minus the network. */
async function call(ctx: Ctx, handler: Handler, path: string, init: { method?: string; body?: unknown; idem?: string; params?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { "x-api-key": ctx.key };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.idem) headers["idempotency-key"] = init.idem;
  const r = await handler(
    new Request(new URL(path, ctx.req.url), { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) }),
    { params: Promise.resolve(init.params ?? {}) },
  );
  const json = await r.json().catch(() => null) as Record<string, unknown> | null;
  return { status: r.status, json: json ?? {} };
}

const errCode = (j: Record<string, unknown>) => {
  const e = j.error as { code?: string; message?: string } | string | undefined;
  return typeof e === "object" && e ? String(e.code ?? "") : String(e ?? "");
};
const errMessage = (j: Record<string, unknown>, status: number) => {
  const e = j.error as { code?: string; message?: string } | string | undefined;
  if (typeof e === "object" && e?.message) return e.message;
  return String(j.message ?? (typeof e === "string" ? e : `The request failed (${status}).`));
};
function refusal(status: number, j: Record<string, unknown>, fallback = "ERROR"): ToolResult {
  const code = errCode(j);
  const title = errorTitle(status, code, fallback);
  return text(renderError(title, errMessage(j, status), { repair_prompt: j.repair_prompt as string | null, remaining_obligations: j.remaining_obligations as unknown[] }), true);
}

async function approvalView(ctx: Ctx, jobId: string, job: Job, planId: string, requirements: string[]): Promise<ToolResult> {
  const plan = await call(ctx, readPlan as Handler, `/api/v1/verifications/plans/${planId}`, { params: { id: planId } });
  const view = {
    id: jobId, claim: job.c, url: job.u, approveUrl: planApproveUrl(ctx.req, planId),
    requirements: requirements.length ? requirements : (plan.json.requirements as string[] ?? []),
    flows: (plan.json.flows as { name?: string; goal?: string }[]) ?? [],
  };
  return text(renderApproval(view), false, {
    state: "waiting_for_approval", id: jobId, claim: job.c, url: job.u, approve_url: view.approveUrl,
    requirements: view.requirements, flows: view.flows,
  });
}

/** Read a verification, waiting up to `budgetMs` for it to finish. */
async function verificationStatus(ctx: Ctx, vrf: string, budgetMs: number): Promise<ToolResult> {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    const r = await call(ctx, readVerification as Handler, `/api/v1/verifications/${vrf}`, { params: { id: vrf } });
    if (r.status !== 200) return refusal(r.status, r.json);
    if (r.json.state === "completed") return text(renderResult(r.json as unknown as VerificationView), false, resultCard(r.json));
    if (Date.now() + POLL_MS > deadline) {
      return text(`RUNNING (verification ${vrf}). A real browser is checking the deployment. Call vraelis_status with id "${vrf}".`, false, { state: "running", verification_id: vrf });
    }
    await sleep(POLL_MS);
  }
}

async function verify(ctx: Ctx, a: Record<string, unknown>): Promise<ToolResult> {
  const url = String(a.deployment_url ?? "").trim();
  const claim = String(a.claim ?? "").trim();
  if (!/^https:\/\//i.test(url)) return text("deployment_url must be the public https URL where the change is deployed. Vraelis cannot reach localhost or your local files.", true);
  if (claim.length < 12) return text("claim must be one sentence saying what a user can now do and what should be true afterwards.", true);
  const job: Job = { u: url, c: claim, t: Date.now() };
  const jobId = encodeJob(job);

  const prep = call(ctx, createVerification as Handler, "/api/v1/verifications", { method: "POST", body: { deployment_url: url, claim }, idem: `mcp-${jobId.slice(-24)}-${job.t}` });
  const first = await Promise.race([prep, sleep(WAIT_MS).then(() => null)]);
  if (!first) {
    // Still writing the plan. Let it finish after this response, and leave a note if it fails.
    after(async () => {
      const r = await prep.catch(() => null);
      if (r && r.status >= 400) {
        await logEvent({ userId: ctx.email, eventType: "mcp_prepare_failed", actorType: "api", source: "api", metadata: { job: jobId, status: r.status, code: errCode(r.json), message: errMessage(r.json, r.status), repair_prompt: r.json.repair_prompt ?? null, remaining_obligations: r.json.remaining_obligations ?? null } });
      }
    });
    return text(`PREPARING (id "${jobId}"). Vraelis is reading ${url} and writing a check plan for "${claim}". This usually takes under two minutes. Call vraelis_status with id "${jobId}".`, false, { state: "preparing", id: jobId, claim, url });
  }
  if (first.status >= 400) return refusal(first.status, first.json);
  if (first.json.state === "review_required" && typeof first.json.reviewed_plan_id === "string") {
    return approvalView(ctx, jobId, job, first.json.reviewed_plan_id, (first.json.requirements as string[]) ?? []);
  }
  if (typeof first.json.verification_id === "string") return verificationStatus(ctx, first.json.verification_id, 0);
  return text(renderError("ERROR", "Vraelis answered in a way this tool did not expect. Try again."), true);
}

async function jobStatus(ctx: Ctx, jobId: string, job: Job): Promise<ToolResult> {
  const plan = await findLatestPlanForClaim(ctx.email, job.u, job.c);
  // A plan run BEFORE this job started belongs to an earlier check of the same sentence, not to this one.
  let mine = !!plan;
  if (plan && plan.executionState === "consumed") {
    const run = plan.runId ? await getRunLite(ctx.email, plan.runId) : null;
    mine = !!run && Date.parse(run.created_at) >= job.t - 5_000;
  }

  if (plan && mine) {
    if (plan.executionState === "consumed" && plan.runId) return verificationStatus(ctx, `vrf_${plan.runId}`, 25_000);
    if (plan.executionState === "consuming") return text(`APPROVED, STARTING (id "${jobId}"). Call vraelis_status with id "${jobId}".`, false, { state: "starting", id: jobId, claim: job.c, url: job.u });
    const expired = Date.parse(plan.expiresAt) <= Date.now();
    if (expired) return text(renderError("APPROVAL EXPIRED", "The plan expired before it ran. Call vraelis_verify again for a fresh plan."), true);
    if (plan.approvalState === "pending") return approvalView(ctx, jobId, job, plan.id, (plan.plan.requirements ?? []).map((r) => r.text));
    // Approved and not yet run: this call starts it. The run is bound to the plan's own idempotency, so two
    // status calls racing here cannot start it twice; the loser reads the plan as consuming or consumed.
    const run = await call(ctx, createVerification as Handler, "/api/v1/verifications", { method: "POST", body: { deployment_url: job.u, claim: job.c, reviewed_plan_id: plan.id }, idem: `run-${plan.id}` });
    if (typeof run.json.verification_id === "string") return verificationStatus(ctx, run.json.verification_id, 20_000);
    if (errCode(run.json) === "reviewed_plan_already_consumed") return text(`APPROVED, STARTING (id "${jobId}"). Call vraelis_status with id "${jobId}".`, false, { state: "starting", id: jobId, claim: job.c, url: job.u });
    return refusal(run.status, run.json);
  }

  const failures = await recentEventsByType(ctx.email, "mcp_prepare_failed", new Date(job.t - 1000).toISOString(), 20);
  const failed = failures.find((e) => (e.metadata as { job?: string } | null)?.job === jobId);
  if (failed) {
    const m = failed.metadata as { status: number; code: string; message: string; repair_prompt?: string | null; remaining_obligations?: unknown[] };
    return text(renderError(errorTitle(m.status, m.code), m.message, m), true);
  }
  if (Date.now() - job.t < PREPARE_GRACE_MS) {
    return text(`PREPARING (id "${jobId}"). Vraelis is still writing the plan for "${job.c}". Call vraelis_status with id "${jobId}" in a moment.`, false, { state: "preparing", id: jobId, claim: job.c, url: job.u });
  }
  return text(renderError("ERROR", "Vraelis did not produce a plan for this check. Call vraelis_verify again."), true);
}

async function status(ctx: Ctx, a: Record<string, unknown>): Promise<ToolResult> {
  const id = String(a.id ?? "").trim();
  if (/^vrf_/.test(id)) return verificationStatus(ctx, id, 25_000);
  const job = decodeJob(id);
  if (!job) return text(`No Vraelis check with id "${id}". Use the id vraelis_verify or vraelis_recheck returned.`, true);
  return jobStatus(ctx, id, job);
}

async function recheck(ctx: Ctx, a: Record<string, unknown>): Promise<ToolResult> {
  const vrf = String(a.verification_id ?? "").trim();
  if (!/^vrf_/.test(vrf)) return text("verification_id must be the vrf_... id of the verification to run again.", true);
  const url = String(a.deployment_url ?? "").trim();
  const r = await call(ctx, recheckVerification as Handler, `/api/v1/verifications/${vrf}/recheck`, { method: "POST", body: url ? { deployment_url: url } : {}, params: { id: vrf } });
  if (typeof r.json.verification_id !== "string") {
    const res = refusal(r.status, r.json, "CANNOT RE-CHECK");
    if (errorTitle(r.status, errCode(r.json)) === "NEEDS A NEW APPROVAL") res.content[0].text += "\nCall vraelis_verify with the same URL and claim; the user approves the new plan.";
    return res;
  }
  return verificationStatus(ctx, r.json.verification_id, 20_000);
}

async function callTool(ctx: Ctx, name: string, a: Record<string, unknown>): Promise<ToolResult> {
  if (name === "vraelis_verify") return verify(ctx, a);
  if (name === "vraelis_status") return status(ctx, a);
  if (name === "vraelis_recheck") return recheck(ctx, a);
  return text(`Unknown tool "${name}".`, true);
}

// The check card, as an MCP Apps resource. Every tool points at it: MCP Apps hosts read _meta.ui.resourceUri,
// ChatGPT also reads openai/outputTemplate. The card needs no network access (everything it shows arrives in
// structuredContent), so its CSP declares no domains at all.
const WIDGET_RESOURCE = {
  uri: WIDGET_URI,
  name: "Vraelis check",
  description: "The status, requirements and result of a Vraelis check.",
  mimeType: WIDGET_MIME,
  _meta: {
    ui: { prefersBorder: false, csp: { connectDomains: [], resourceDomains: [] } },
    "openai/widgetDescription": "Shows a Vraelis check: waiting for approval with an approve button, running, or the Verified, Failed or Blocked result with what broke.",
    "openai/widgetPrefersBorder": false,
  },
};
const INVOKING: Record<string, [string, string]> = {
  vraelis_verify: ["Writing a check plan", "Check plan ready"],
  vraelis_status: ["Checking on it", "Status updated"],
  vraelis_recheck: ["Re-checking the live app", "Re-check started"],
};
const TOOLS_WITH_CARD = MCP_TOOLS.map((t) => ({
  ...t,
  _meta: {
    ui: { resourceUri: WIDGET_URI },
    "openai/outputTemplate": WIDGET_URI,
    "openai/toolInvocation/invoking": INVOKING[t.name]?.[0],
    "openai/toolInvocation/invoked": INVOKING[t.name]?.[1],
  },
}));

type RpcMessage = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

async function dispatch(ctx: Ctx, m: RpcMessage): Promise<object | null> {
  const id = m.id ?? null;
  const notification = m.id === undefined || m.id === null;
  if (typeof m.method !== "string") return null;
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
  try {
    switch (m.method) {
      case "initialize":
        return ok({
          protocolVersion: typeof m.params?.protocolVersion === "string" ? m.params.protocolVersion : "2025-06-18",
          capabilities: { tools: { listChanged: false }, resources: { listChanged: false }, extensions: { "io.modelcontextprotocol/ui": {} } },
          serverInfo: { name: "vraelis", title: "Vraelis", version: SERVER_VERSION },
          instructions: MCP_INSTRUCTIONS,
        });
      case "ping": return ok({});
      case "tools/list": return ok({ tools: TOOLS_WITH_CARD });
      case "tools/call": {
        const p = m.params ?? {};
        return ok(await callTool(ctx, String(p.name ?? ""), (p.arguments as Record<string, unknown>) ?? {}));
      }
      case "resources/list": return ok({ resources: [WIDGET_RESOURCE] });
      case "resources/read": {
        if (m.params?.uri !== WIDGET_URI) return fail(-32002, `Resource not found: ${String(m.params?.uri ?? "")}`);
        return ok({ contents: [{ uri: WIDGET_URI, mimeType: WIDGET_MIME, text: WIDGET_HTML, _meta: WIDGET_RESOURCE._meta }] });
      }
      case "resources/templates/list": return ok({ resourceTemplates: [] });
      case "prompts/list": return ok({ prompts: [] });
      default:
        if (notification || m.method.startsWith("notifications/")) return null;
        return fail(-32601, `Method not found: ${m.method}`);
    }
  } catch (e) {
    return notification ? null : fail(-32603, String((e as Error)?.message ?? e));
  }
}

function unauthorized(req: Request, message: string): Response {
  const origin = publicOrigin(req);
  return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message } }, {
    status: 401,
    headers: { ...CORS_HEADERS, "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="vraelis:verify"` },
  });
}

export async function POST(req: Request) {
  const bearer = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const key = bearer || (req.headers.get("x-api-key") ?? "").trim();
  if (!key) return unauthorized(req, "Connect Vraelis to use its tools.");
  const verified = await verifyApiKey(key);
  if (!verified) return unauthorized(req, "That Vraelis connection is no longer valid. Connect again.");
  const ctx: Ctx = { req, key, email: verified.userId };

  const body = await req.json().catch(() => undefined) as RpcMessage | RpcMessage[] | undefined;
  if (body === undefined) {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers: CORS_HEADERS });
  }
  const batch = Array.isArray(body);
  const replies = (await Promise.all((batch ? body : [body]).map((m) => dispatch(ctx, m)))).filter(Boolean);
  if (!replies.length) return new Response(null, { status: 202, headers: CORS_HEADERS });
  return Response.json(batch ? replies : replies[0], { headers: { ...CORS_HEADERS, "cache-control": "no-store" } });
}

// No server-initiated stream: every answer rides the POST that asked for it.
export function GET() {
  return new Response("This MCP server answers POST requests only.", { status: 405, headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS" } });
}
export const DELETE = GET;
export const OPTIONS = preflight;
