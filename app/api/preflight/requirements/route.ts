// Contract-requirement editing for the Production Contract (Phase 1, manual editing — no discovery yet).
//   POST   /api/preflight/requirements   { contract_id, requirement, category?, severity?, role?, area? }  add
//   PATCH  /api/preflight/requirements   { id, enabled?|severity?|requirement? }                            edit
//   DELETE /api/preflight/requirements?id=...                                                               remove
//   POST   /api/preflight/requirements   { contract_id, approve: true }                                     approve contract
// Session-authenticated + Preflight-flag gated; every mutation is owner-scoped in the data layer.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { addRequirement, updateRequirement, deleteRequirement, approveContract, type Severity } from "@/lib/v-applications";

export const runtime = "nodejs";

const SEVERITIES: Severity[] = ["critical", "important", "informational"];
const sev = (v: unknown): Severity | undefined => (typeof v === "string" && (SEVERITIES as string[]).includes(v) ? (v as Severity) : undefined);

async function owner() { return (await auth())?.user?.email || null; }

export async function POST(req: Request) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = await owner();
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const contractId = typeof body?.contract_id === "string" ? body.contract_id : "";
  if (!contractId) return NextResponse.json({ error: "missing_contract" }, { status: 400 });

  if (body?.approve === true) {
    const ok = await approveContract(email, contractId);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "approve_failed", message: "Enable at least one requirement before approving." }, { status: 400 });
  }
  const r = await addRequirement(email, contractId, {
    requirement: typeof body?.requirement === "string" ? body.requirement : "",
    category: typeof body?.category === "string" ? body.category : undefined,
    severity: sev(body?.severity), role: typeof body?.role === "string" ? body.role : undefined, area: typeof body?.area === "string" ? body.area : undefined,
  });
  return r ? NextResponse.json({ requirement: r }) : NextResponse.json({ error: "add_failed" }, { status: 400 });
}

export async function PATCH(req: Request) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = await owner();
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const ok = await updateRequirement(email, id, {
    enabled: typeof body?.enabled === "boolean" ? body.enabled : undefined,
    severity: sev(body?.severity),
    requirement: typeof body?.requirement === "string" ? body.requirement : undefined,
  });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "update_failed" }, { status: 400 });
}

export async function DELETE(req: Request) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = await owner();
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const ok = await deleteRequirement(email, id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "delete_failed" }, { status: 400 });
}
