// GET /api/v/workspace — the signed-in user's workspace context (personal workspace,
// members, and workspaces shared with them). Session-gated.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkspaceContext } from "@/lib/v-workspace";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  return NextResponse.json(await getWorkspaceContext(email));
}
