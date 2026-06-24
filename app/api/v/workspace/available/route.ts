// GET /api/v/workspace/available — workspaces the signed-in user can switch to,
// plus the currently-selected id (from the `vws` cookie, validated). Powers the
// workspace switcher. No private data — workspace name + the user's role only.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { resolveWorkspaceSelection } from "@/lib/v-workspace";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const selectedId = (await cookies()).get("vws")?.value;
  const { available, selected } = await resolveWorkspaceSelection(email, selectedId);
  return NextResponse.json({ available, selectedId: selected?.id ?? null });
}
