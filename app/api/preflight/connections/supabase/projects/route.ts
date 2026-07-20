// GET /api/preflight/connections/supabase/projects
//
// The project picker's data source: the Supabase projects the caller's own account connection can see.
// This is the read the connection card promises and nothing more — a read-only Management API list, so an
// owner picks a real project instead of typing an opaque project ref and hoping it matches.
//
// Account-scoped and self-only: the owner is taken from the session, never from a parameter, so this can
// only ever list the caller's own projects. Fails soft to an empty list — a picker with no options is a
// recoverable state; an error page is not.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { listSupabaseProjects } from "@/lib/preflight/oauth/supabase-project";

export const runtime = "nodejs";

export async function GET() {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const projects = await listSupabaseProjects(email.trim().toLowerCase()).catch(() => []);
  // ref + name + url only. Region and everything else the API returns stays server-side.
  return NextResponse.json(
    { projects: projects.map((p) => ({ ref: p.ref, name: p.name, url: p.url })) },
    { headers: { "cache-control": "no-store" } },
  );
}
