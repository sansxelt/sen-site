// Import a found business as a lead (owner-only). The owner approves each
// one — nothing is auto-contacted here.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { createLead } from "@/lib/vraelis-db";

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ ok: false, needSignin: true }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(body.name);
  const phone = str(body.phone);
  const website = str(body.website);
  const address = str(body.address);
  if (!name) return NextResponse.json({ ok: false, error: "No name" }, { status: 400 });

  try {
    const snippet = [website, address].filter(Boolean).join(" · ") || "Found via search";
    const lead = await createLead({
      ownerEmail: email,
      name,
      contactPhone: phone,
      source: "found",
      snippet,
    });
    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (error) {
    console.error("import found lead failed:", error);
    return NextResponse.json({ ok: false, error: "Could not add" }, { status: 500 });
  }
}
