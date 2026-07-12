// GET /api/v/sso/oidc/[providerId]/callback — OIDC redirect handler. Verifies the state cookie,
// exchanges the code, validates the id_token (jose: signature/iss/aud/nonce/email), enforces the
// email-domain == verified-org-domain rule, provisions org membership per the org's provisioning
// settings (safe role only; revoked → pending), then mints a session and redirects to the org page.
// NOTHING here grants workspace/project/billing/API access.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { completeOidcCallback, provisionSsoLogin, mintSsoSession, verifyOidcState } from "@/lib/v-sso";

export const runtime = "nodejs";

const fail = (reason: string) => NextResponse.redirect(`https://vraelis.com/sso?error=${reason}`, { status: 302 });

export async function GET(req: Request, context: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await context.params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (url.searchParams.get("error")) return fail("idp_error");
  if (!code || !state) return fail("invalid_callback");

  // State cookie must exist, be valid, match this provider, and match the returned state.
  const cookieVal = (await cookies()).get("v_sso_oidc")?.value;
  const st = verifyOidcState(cookieVal);
  if (!st || st.providerId !== providerId || st.state !== state) return fail("state_mismatch");

  const validated = await completeOidcCallback(providerId, code, String(st.nonce ?? ""));
  if (!validated.ok) return fail(validated.error);

  const prov = await provisionSsoLogin(validated.email, validated.organizationId);
  if (!prov.ok) return fail(prov.error === "join_disabled" ? "sso_disabled" : "provision_failed");

  const cookie = await mintSsoSession(validated.email);
  const res = NextResponse.redirect("https://app.vraelis.com/organization", { status: 302 });
  res.cookies.set({ name: cookie.name, value: cookie.value, ...(cookie.options as object) });
  res.cookies.delete("v_sso_oidc");
  return res;
}
