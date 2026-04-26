import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signAutoSigninToken } from "../../../../lib/auto-signin-token";
import {
  SIGNUP_CLAIM_COOKIE,
  verifySignupClaim,
} from "../../../../lib/signup-claim-cookie";
import { getUserCredentialByEmail } from "../../../../lib/user-credentials";

/**
 * Polled by the /auth/verify-email "waiting" screen every few seconds.
 *
 * Trusts the signed sx_signup_claim cookie that /api/auth/register set
 * on the initiating browser, so only the device that *started* signup
 * can ask "did verification happen yet?" and get an auto-signin token
 * back.  Random visitors without the cookie always get `{ verified:
 * false }`.
 *
 * When the credentials row exists (verification completed somewhere
 * usually the email-link device, possibly this same one), we mint a
 * short-lived auto-signin token, clear the claim cookie so the poll
 * stops, and the client redirects through /auth/auto-signin.
 */
export async function GET() {
  const jar   = await cookies();
  const claim = verifySignupClaim(jar.get(SIGNUP_CLAIM_COOKIE)?.value);

  if (!claim) {
    return NextResponse.json({ verified: false });
  }

  const cred = await getUserCredentialByEmail(claim.email);
  if (!cred) {
    return NextResponse.json({ verified: false });
  }

  const autoSigninToken = signAutoSigninToken(claim.email);
  const response = NextResponse.json({
    verified: true,
    email:    claim.email,
    autoSigninToken,
  });
  // Stop future polls from this browser, the token we just minted is
  // the only thing it needs, and it's short-lived on its own.
  response.cookies.delete(SIGNUP_CLAIM_COOKIE);
  return response;
}
