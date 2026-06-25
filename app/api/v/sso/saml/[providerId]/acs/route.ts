// POST /api/v/sso/saml/[providerId]/acs — SAML Assertion Consumer Service.
// SCAFFOLD ONLY in v1: real SAML assertion validation (XML-DSig signature + canonicalization)
// requires a vetted library that isn't in this stack, and hand-rolling it is unsafe. So we do NOT
// consume assertions here — SAML providers cannot be enabled, and this endpoint never authenticates
// anyone. Use OIDC for live SSO. Returns 501 to make the unimplemented state explicit.
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_req: Request, context: { params: Promise<{ providerId: string }> }) {
  await context.params;
  return NextResponse.redirect("https://vraelis.com/sso?error=saml_not_enabled", { status: 302 });
}
