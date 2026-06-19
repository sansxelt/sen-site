import type { ReactNode } from "react";
import { FlipShell } from "./_components/flip-ui";

// Wraps every /flip page in the shared shell (promo bar + nav + footer). The
// vraelis design stylesheets are already loaded by the root layout for any
// vraelis.com request, so this page group renders in the same light/green
// system as the rest of the site.
export default function FlipLayout({ children }: { children: ReactNode }) {
  return <FlipShell>{children}</FlipShell>;
}
