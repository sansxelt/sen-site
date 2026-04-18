import { NextResponse } from "next/server";
import { checkDevAccess } from "@/lib/dev-gate";
import { findSample } from "@/lib/email-samples";

export async function POST(req: Request) {
  const access = await checkDevAccess();
  if (access.kind !== "ok") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { key?: string; to?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key : null;
  const to  = typeof body.to  === "string" ? body.to.trim()  : null;

  if (!key || !to) {
    return NextResponse.json({ error: "key and to are required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "Recipient doesn't look like a valid email" }, { status: 400 });
  }

  const sample = findSample(key);
  if (!sample) {
    return NextResponse.json({ error: `Unknown template key: ${key}` }, { status: 404 });
  }

  try {
    await sample.send(to);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
