// API-beta customer route: create/read/update the application's API runtime target + build identity.
// GET  -> { target, build } | { target: null }
// POST -> create the API target (environment) and/or set its build (base URL + version).
// Uniform 404 for any non-allowlisted or non-enabled caller (never reveals the beta exists).

import { NextResponse } from "next/server";
import { gateApiRuntimeApp, gateReasonResponse } from "@/lib/preflight/team-access";
import { getApiTarget, createApiTarget, getLatestApiBuild, setApiBuild } from "@/lib/preflight/runtime/targets-db";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await gateApiRuntimeApp(id, "viewer"); // reading the target is viewer+
  if (!g.ok) return gateReasonResponse(g.reason);
  const owner = g.owner;
  const target = await getApiTarget(owner, id);
  const build = target ? await getLatestApiBuild(owner, target.id) : null;
  return NextResponse.json({ target, build });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await gateApiRuntimeApp(id, "editor"); // creating/updating the target + build is editor+
  if (!g.ok) return gateReasonResponse(g.reason);
  const owner = g.owner;

  let body: { environment?: string; label?: string; baseUrl?: string; version?: string };
  try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ error: "bad_body" }, { status: 400 }); }

  // Ensure the target (idempotent).
  const environment = (body.environment || "").trim().toLowerCase();
  const t = await createApiTarget(owner, id, { environment: environment || "production", label: body.label });
  if (!t.ok) return NextResponse.json({ error: "invalid", message: t.reason }, { status: 400 });

  // Optionally set the build (base URL) in the same call.
  let build = await getLatestApiBuild(owner, t.target.id);
  if (typeof body.baseUrl === "string" && body.baseUrl.trim()) {
    const b = await setApiBuild(owner, t.target.id, { baseUrl: body.baseUrl, version: body.version });
    if (!b.ok) return NextResponse.json({ error: "invalid", message: b.reason }, { status: 400 });
    build = b.build;
  }
  return NextResponse.json({ target: t.target, build });
}
