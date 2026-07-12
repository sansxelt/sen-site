import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { appHostUrl } from "./app-routes";
import { preflightEnabled } from "./v-preflight-flags";

// Server-side gate for every /applications/* page. Preflight is dark unless a flag is set (route access is the
// real security boundary — the nav item is separate), so a guessed URL redirects to the normal dashboard.
// Returns the owner email (lowercased) or redirects to sign-in. redirect() throws, so callers get a
// non-null string. The signin callback is an absolute app-host URL in production (the product lives on
// app.vraelis.com while /signin lives on vraelis.com), and stays relative in dev.
export async function requirePreflightOwner(returnPath: string): Promise<string> {
  if (!preflightEnabled()) redirect("/app");
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect(`/signin?callbackUrl=${encodeURIComponent(appHostUrl(returnPath))}`);
  return email.toLowerCase();
}
