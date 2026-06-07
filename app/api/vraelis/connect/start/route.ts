// Stripe Connect onboarding. Creates the workspace's Express account on
// first use, then redirects the owner to Stripe's hosted onboarding (KYC +
// bank details). Stripe returns them to /v/account?connect=done.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrCreateWorkspace, setWorkspaceConnect } from "@/lib/vraelis-db";
import { createConnectAccount, createAccountLink } from "@/lib/vraelis-connect";

const ORIGIN = "https://vraelis.com";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.redirect(`${ORIGIN}/signin?callbackUrl=%2Faccount`);
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.redirect(`${ORIGIN}/v/account?connect=error`);

  try {
    const ws = await getOrCreateWorkspace(email);
    let accountId = ws?.connect_account_id ?? null;
    if (!accountId) {
      accountId = await createConnectAccount(email);
      await setWorkspaceConnect(email, { accountId, status: "pending" });
    }
    const url = await createAccountLink(accountId, ORIGIN);
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("connect/start failed:", err);
    return NextResponse.redirect(`${ORIGIN}/v/account?connect=error`);
  }
}
