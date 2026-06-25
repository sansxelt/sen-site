// GET /api/v/sso/oidc/[providerId]/start — begin the OIDC Authorization Code flow. Builds a
// state+nonce, stores them in a short-lived signed httpOnly cookie, and redirects to the IdP.
import { NextResponse } from "next/server";
import { startOidcLogin, signOidcState } from "@/lib/v-sso";

export const runtime = "nodejs";

export async function GET(_req: Request, context: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await context.params;
  const res = await startOidcLogin(providerId);
  if (!res.ok) return NextResponse.redirect("https://vraelis.com/sso?error=sso_unavailable", { status: 302 });
  const redirect = NextResponse.redirect(res.url, { status: 302 });
  // Bind state+nonce+providerId to this browser; verified on callback.
  redirect.cookies.set({ name: "v_sso_oidc", value: signOidcState({ state: res.state, nonce: res.nonce, providerId }), httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return redirect;
}
