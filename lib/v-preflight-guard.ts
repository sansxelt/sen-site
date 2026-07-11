import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { preflightEnabled } from "./v-preflight-flags";

// Server-side gate for every /app/apps/* page. Preflight is dark unless a flag is set (route access is the
// real security boundary — the nav item is separate), so a guessed URL redirects to the normal dashboard.
// Returns the owner email (lowercased) or redirects to sign-in. redirect() throws, so callers get a
// non-null string.
export async function requirePreflightOwner(returnPath: string): Promise<string> {
  if (!preflightEnabled()) redirect("/app");
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect(`/signin?callbackUrl=${encodeURIComponent(returnPath)}`);
  return email.toLowerCase();
}
