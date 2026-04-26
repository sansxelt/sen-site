import type { ReactNode } from "react";
import { ZoneShell } from "@/components/zone-shell";

// Checkout always lands on chat.sansxel.ai (the proxy redirects
// apex /checkout there), so this shell renders the workshop
// identity 99% of the time. Falls back gracefully on other hosts.
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return <ZoneShell>{children}</ZoneShell>;
}
