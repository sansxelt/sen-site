// Contract-requirement editing for the Production Contract (Phase 1, manual editing — no discovery yet).
//   POST   /api/preflight/requirements   { contract_id, requirement, category?, severity?, role?, area? }  add
//   PATCH  /api/preflight/requirements   { id, enabled?|severity?|requirement? }                            edit
//   DELETE /api/preflight/requirements?id=...                                                               remove
//   POST   /api/preflight/requirements   { contract_id, approve: true }                                     approve contract
// Session-authenticated + Preflight-flag gated; every mutation is owner-scoped in the data layer.
// APPROVED contracts are IMMUTABLE: every mutating path (add/update/delete) loads the requirement's
// contract owner-scoped first and returns 409 contract_approved when it is approved. Re-approving an
// already-approved contract is an idempotent no-op (200) so approved_at is never rewritten.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import {
  addAuthoredRequirement, updateRequirement, deleteRequirement, approveContract,
  getContractById, contractStatusForRequirement, type Severity,
} from "@/lib/v-applications";
import { snapshotIfChanged, pinSnapshotToContract } from "@/lib/preflight/context-snapshots";
import { applicationAccessForContract, applicationAccessForRequirement } from "@/lib/preflight/team-access";
import { hasAtLeastRole } from "@/lib/v-workspace";

export const runtime = "nodejs";

const SEVERITIES: Severity[] = ["critical", "important", "informational"];
const sev = (v: unknown): Severity | undefined => (typeof v === "string" && (SEVERITIES as string[]).includes(v) ? (v as Severity) : undefined);

const approvedImmutable = () => NextResponse.json(
  { error: "contract_approved", message: "Approved contracts are immutable. Create a new draft to make changes." },
  { status: 409 },
);
const forbidden = () => NextResponse.json({ error: "forbidden", message: "You have view-only access to this application." }, { status: 403 });

export async function POST(req: Request) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const callerEmail = (await auth())?.user?.email;
  if (!callerEmail) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const contractId = typeof body?.contract_id === "string" ? body.contract_id : "";
  if (!contractId) return NextResponse.json({ error: "missing_contract" }, { status: 400 });

  // TEAM ACCESS: resolve the contract to the app OWNER + caller role. Editing requirements / approving the
  // contract is EDITOR+. owner = app owner (data-plane key); a non-member 404s, a view-only member 403s.
  const access = await applicationAccessForContract(callerEmail, contractId);
  if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!hasAtLeastRole(access.role, "editor")) return forbidden();
  const email = access.owner;

  // Owner-scoped read; null means not-found/not-owned and falls through to the normal failure paths.
  const contract = await getContractById(email, contractId);

  if (body?.approve === true) {
    if (contract?.status === "approved") return NextResponse.json({ ok: true }); // idempotent; approved_at untouched
    // The PERSON who clicked, not the app owner. On a team those are routinely different people, and the
    // review record has to name whoever actually made the decision.
    const ok = await approveContract(email, contractId, { kind: "human_direct", email: callerEmail });
    if (ok && contract) {
      // Pin the exact context this approval was made against (S3). Best-effort per the migration rule:
      // snapshotIfChanged and pinSnapshotToContract both warn (naming migration 7's sql file) and no-op
      // while it is unapplied, and the try/catch guarantees an approval NEVER fails or unwinds here.
      try {
        const snap = await snapshotIfChanged(email, contract.application_id, "owner");
        if (snap) await pinSnapshotToContract(email, contractId, snap.id);
      } catch { /* the approval stands, unpinned */ }
    }
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "approve_failed", message: "Enable at least one requirement before approving." }, { status: 400 });
  }

  if (contract?.status === "approved") return approvedImmutable();
  // A PERSON typed this, which records human authorship and nothing else. The row lands `suggested`: typing
  // text is not the same act as deciding it should bind, and a generic "Add requirement" button must never
  // silently approve. The person approves it through the explicit review action below.
  const r = await addAuthoredRequirement(email, contractId, {
    requirement: typeof body?.requirement === "string" ? body.requirement : "",
    category: typeof body?.category === "string" ? body.category : undefined,
    severity: sev(body?.severity), role: typeof body?.role === "string" ? body.role : undefined, area: typeof body?.area === "string" ? body.area : undefined,
  });
  return r ? NextResponse.json({ requirement: r }) : NextResponse.json({ error: "add_failed" }, { status: 400 });
}

export async function PATCH(req: Request) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const callerEmail = (await auth())?.user?.email;
  if (!callerEmail) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  // Resolve the requirement -> app owner + role. Editing a requirement is EDITOR+.
  const access = await applicationAccessForRequirement(callerEmail, id);
  if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!hasAtLeastRole(access.role, "editor")) return forbidden();
  const email = access.owner;
  if ((await contractStatusForRequirement(email, id)) === "approved") return approvedImmutable();
  // review: "approve" folds a discovery suggestion into the contract (approved + enabled); "reject" marks it
  // rejected + disabled (sticky — a future discovery re-run won't resurface it). Any other patch is a normal edit.
  const reviewState = body?.review === "approve" ? "approved" : body?.review === "reject" ? "rejected" : undefined;
  const ok = await updateRequirement(email, id, {
    enabled: typeof body?.enabled === "boolean" ? body.enabled : undefined,
    severity: sev(body?.severity),
    requirement: typeof body?.requirement === "string" ? body.requirement : undefined,
    reviewState,
    // The reviewer is the caller, not the app owner: an accept is a human review and must name the human.
  }, callerEmail);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "update_failed" }, { status: 400 });
}

export async function DELETE(req: Request) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const callerEmail = (await auth())?.user?.email;
  if (!callerEmail) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const access = await applicationAccessForRequirement(callerEmail, id);
  if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!hasAtLeastRole(access.role, "editor")) return forbidden();
  const email = access.owner;
  if ((await contractStatusForRequirement(email, id)) === "approved") return approvedImmutable();
  const ok = await deleteRequirement(email, id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "delete_failed" }, { status: 400 });
}
