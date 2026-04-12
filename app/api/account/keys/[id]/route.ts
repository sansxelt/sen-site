import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { revokeApiKey } from "../../../../../lib/api-keys";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  const email = session?.user?.email ?? null;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: "Key ID is required." }, { status: 400 });
  }

  try {
    await revokeApiKey(id, email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("API key revocation failed:", error);
    return NextResponse.json(
      { error: "Could not revoke API key. Please try again." },
      { status: 500 },
    );
  }
}
