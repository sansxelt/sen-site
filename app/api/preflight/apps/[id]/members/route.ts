// Preflight team members for a shared application.
//   GET    -> { members: [{ id, email, role, status, you }], canManage, role }   (owner/admin: full list; others: 404)
//   POST   { email, role }        -> invite a teammate to the application's workspace         (owner/admin)
//   PATCH  { memberId, role }     -> change a member's role                                    (owner/admin)
//   DELETE ?memberId=<id>         -> revoke a member                                           (owner/admin)
//
// The application's workspace IS the owner's personal workspace (backfilled by migration 14, or healed here
// on first invite). Member management delegates to the existing Rank workspace machinery (lib/v-workspace),
// which re-checks the actor's authority and enforces seat limits. A non-member/non-manager gets a uniform
// 404 (indistinguishable from "no such app"). The invited email accepts via the existing /invite/[token]
// flow and then shares the app + its runs/contracts/flows by role.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { applicationWorkspaceForManage } from "@/lib/preflight/team-access";
import {
  inviteMember, changeMemberRole, revokeMember, listMembers,
  INVITABLE_ROLES, canManageMembers, type Role,
} from "@/lib/v-workspace";

export const runtime = "nodejs";

const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });
const asRole = (v: unknown): Role | null => (typeof v === "string" && (INVITABLE_ROLES as string[]).includes(v) ? (v as Role) : null);

// Resolve the caller + the application's manageable workspace. Returns the caller email + workspace + role,
// or a 404 response when the caller cannot manage members (owner/admin only; else indistinguishable 404).
async function manageCtx(appId: string): Promise<{ actor: string; workspaceId: string; role: Role } | NextResponse> {
  if (!preflightEnabled()) return notFound();
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const ws = await applicationWorkspaceForManage(email, appId);
  if (!ws) return notFound(); // not a manager (or team accounts unavailable pre-migration) -> uniform 404
  return { actor: email.trim().toLowerCase(), workspaceId: ws.workspaceId, role: ws.role };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await manageCtx(id);
  if (c instanceof NextResponse) return c;
  const members = (await listMembers(c.workspaceId))
    .filter((m) => m.status !== "revoked")
    .map((m) => ({ id: m.id, email: m.email, role: m.role, status: m.status, you: m.email === c.actor }));
  return NextResponse.json({ members, canManage: canManageMembers(c.role), role: c.role });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await manageCtx(id);
  if (c instanceof NextResponse) return c;
  const body = await req.json().catch(() => ({}));
  const inviteEmail = typeof body?.email === "string" ? body.email : "";
  const role = asRole(body?.role) ?? "viewer";
  if (!inviteEmail.includes("@")) return NextResponse.json({ error: "invalid_email", message: "Enter a valid email address." }, { status: 400 });
  // inviteMember re-checks the actor owns/admins the workspace and enforces seat limits.
  const r = await inviteMember(c.actor, c.workspaceId, inviteEmail, role);
  if (!r.ok) {
    const map: Record<string, { status: number; message: string }> = {
      forbidden: { status: 403, message: "Only the application owner or an admin can invite teammates." },
      already_member: { status: 409, message: "That person is already on this team." },
      seat_limit: { status: 402, message: "You've reached your plan's paid-seat limit. Upgrade or free a seat to invite more." },
      invalid_email: { status: 400, message: "Enter a valid email address." },
      invalid_role: { status: 400, message: "Choose a valid role." },
      rate_limited: { status: 429, message: "Too many invites just now. Try again shortly." },
      unavailable: { status: 503, message: "Team accounts are not available right now." },
    };
    const e = map[r.error ?? "unavailable"] ?? { status: 400, message: "Could not send the invite." };
    return NextResponse.json({ error: r.error, message: e.message }, { status: e.status });
  }
  return NextResponse.json({ ok: true, email: r.email });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await manageCtx(id);
  if (c instanceof NextResponse) return c;
  const body = await req.json().catch(() => ({}));
  const memberId = typeof body?.memberId === "string" ? body.memberId : "";
  const role = asRole(body?.role);
  if (!memberId || !role) return NextResponse.json({ error: "bad_request", message: "Provide a member and a valid role." }, { status: 400 });
  // changeMemberRole re-verifies the member belongs to a workspace the actor manages.
  const r = await changeMemberRole(c.actor, memberId, role);
  if (!r.ok) return NextResponse.json({ error: r.error, message: r.error === "forbidden" ? "You can't change this member's role." : "Could not update the role." }, { status: r.error === "forbidden" ? 403 : 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await manageCtx(id);
  if (c instanceof NextResponse) return c;
  const memberId = new URL(req.url).searchParams.get("memberId") || "";
  if (!memberId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const r = await revokeMember(c.actor, memberId);
  if (!r.ok) return NextResponse.json({ error: r.error, message: r.error === "forbidden" ? "You can't remove this member." : "Could not remove the member." }, { status: r.error === "forbidden" ? 403 : 400 });
  return NextResponse.json({ ok: true });
}
