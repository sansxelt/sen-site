import type { ReactNode } from "react";
import { auth } from "@/auth";
import { FlipShell } from "./_components/flip-ui";

// Wraps every flip page in the shared shell (promo bar + nav + footer). The
// vraelis design stylesheets are already loaded by the root layout, so this
// group renders in the same light/green system as the whole site. Session is
// read once here so the nav can show Account vs Sign in.
export default async function FlipLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);
  return <FlipShell signedIn={signedIn}>{children}</FlipShell>;
}
