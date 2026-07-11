// GET /api/preflight/runs/[runId]/artifacts/[artifactId] — private evidence access (screenshot / trace).
// Guards, in order: Preflight flag (404 when dark) -> session auth (401) -> owner-check the run AND the
// artifact (the artifact's user_id == owner AND its preflight_run_id belongs to the run). On any ownership
// mismatch: 404. On success, mint a FRESH short-TTL (120s) signed URL from the private storage path and
// 307-redirect to it. The storage_path is never exposed; no public URL is ever produced; the only URL that
// leaves this route is the freshly-minted, owner-authorized, expiring one (set no-store so no shared cache
// retains it).
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { getRunArtifactPath } from "@/lib/preflight/runs-db";
import { signedArtifactUrl } from "@/lib/preflight/artifacts";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ runId: string; artifactId: string }> }) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { runId, artifactId } = await params;

  const path = await getRunArtifactPath(email.toLowerCase(), runId, artifactId);
  if (!path) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const url = await signedArtifactUrl(path, 120);
  if (!url) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return new NextResponse(null, { status: 307, headers: { Location: url, "cache-control": "no-store" } });
}
