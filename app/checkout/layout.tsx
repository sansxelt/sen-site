import type { ReactNode } from "react";
import { ZoneShell } from "@/components/zone-shell";

// Checkout always lands on chat.vraelis.ai (the proxy redirects
// apex /checkout there), so this shell renders the workshop
// identity 99% of the time. Falls back gracefully on other hosts.
//
// `wide` because the checkout grid wants max-w-5xl for the
// two-column order summary + payment layout. ZoneShell defaults to
// max-w-3xl which was clipping the grid into a narrower column.
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return <ZoneShell wide>{children}</ZoneShell>;
}
