import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { createApiKey, listApiKeys } from "../../../../lib/api-keys";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email ?? null;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const keys = await listApiKeys(email);
  return NextResponse.json({ keys });
}

type CreateKeyPayload = {
  name?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email ?? null;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: CreateKeyPayload;

  try {
    payload = (await request.json()) as CreateKeyPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = (payload.name ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Key name is required." }, { status: 400 });
  }

  if (name.length > 64) {
    return NextResponse.json(
      { error: "Key name must be 64 characters or fewer." },
      { status: 400 },
    );
  }

  try {
    const { record, rawKey } = await createApiKey(email, name);
    return NextResponse.json({ key: record, rawKey });
  } catch (error) {
    console.error("API key creation failed:", error);
    return NextResponse.json(
      { error: "Could not create API key. Please try again." },
      { status: 500 },
    );
  }
}
