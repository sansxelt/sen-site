// API-beta customer route: author API verification flows (customer vocabulary).
// GET    -> { flows: [...] }
// POST   -> create { name, goal?, priority?, steps:[customer steps] } (validated) -> { id }
// PATCH  -> update { id, ...patch }
// DELETE ?id=<flowId>
// Uniform 404 for any non-allowlisted/non-enabled caller. Validation rejects credential-shaped values,
// unsupported actions, other-origin paths, and unknown credential labels — BEFORE storage.

import { NextResponse } from "next/server";
import { apiBetaOwner } from "@/lib/preflight/api-beta-gate";
import { getApplication, getApprovedContract } from "@/lib/v-applications";
import { getApiTarget, listApiFlows, createApiFlow, updateApiFlow, deleteApiFlow } from "@/lib/preflight/runtime/targets-db";
import { listConnections } from "@/lib/preflight/connections-db";
import { validateApiSteps } from "@/lib/preflight/runtime/api-steps";

export const runtime = "nodejs";
const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });

async function credentialLabels(owner: string, appId: string): Promise<string[]> {
  const all = await listConnections(owner, appId);
  return all.filter((c) => c.provider === "api_credential").map((c) => String((c.meta as { label?: string })?.label ?? "")).filter(Boolean);
}

async function ctx(id: string) {
  const owner = await apiBetaOwner();
  if (!owner) return null;
  const app = await getApplication(owner, id);
  if (!app) return null;
  const target = await getApiTarget(owner, id);
  if (!target) return { owner, app, target: null };
  return { owner, app, target };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await ctx(id);
  if (!c) return notFound();
  if (!c.target) return NextResponse.json({ flows: [] });
  return NextResponse.json({ flows: await listApiFlows(c.owner, id, c.target.id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await ctx(id);
  if (!c) return notFound();
  if (!c.target) return NextResponse.json({ error: "api_target_required", message: "Set up your API target first." }, { status: 400 });

  let body: { name?: string; goal?: string; priority?: string; steps?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ error: "bad_body" }, { status: 400 }); }
  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ error: "invalid", message: "Name the flow." }, { status: 400 });

  const v = validateApiSteps(body.steps, { credentialLabels: await credentialLabels(c.owner, id) });
  if (!v.ok) return NextResponse.json({ error: "invalid_steps", message: v.reason }, { status: 400 });

  const priority = body.priority === "important" || body.priority === "informational" ? body.priority : "critical";
  const contract = await getApprovedContract(c.owner, id);
  const r = await createApiFlow(c.owner, id, c.target.id, contract?.id ?? null, { name, goal: body.goal, priority, steps: v.steps });
  if (!r.ok) return NextResponse.json({ error: "unavailable", message: r.reason }, { status: 503 });
  return NextResponse.json({ id: r.id });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await ctx(id);
  if (!c || !c.target) return notFound();

  let body: { id?: string; name?: string; goal?: string; priority?: string; steps?: unknown; enabled?: boolean };
  try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ error: "bad_body" }, { status: 400 }); }
  const flowId = (body.id || "").trim();
  if (!flowId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const patch: Parameters<typeof updateApiFlow>[4] = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.goal !== undefined) patch.goal = String(body.goal);
  if (body.priority === "critical" || body.priority === "important" || body.priority === "informational") patch.priority = body.priority;
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (body.steps !== undefined) {
    const v = validateApiSteps(body.steps, { credentialLabels: await credentialLabels(c.owner, id) });
    if (!v.ok) return NextResponse.json({ error: "invalid_steps", message: v.reason }, { status: 400 });
    patch.steps = v.steps;
  }
  const ok = await updateApiFlow(c.owner, id, c.target.id, flowId, patch);
  return ok ? NextResponse.json({ ok: true }) : notFound();
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await ctx(id);
  if (!c || !c.target) return notFound();
  const flowId = new URL(req.url).searchParams.get("id") || "";
  if (!flowId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const ok = await deleteApiFlow(c.owner, id, c.target.id, flowId);
  return ok ? NextResponse.json({ ok: true }) : notFound();
}
