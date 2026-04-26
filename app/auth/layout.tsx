import type { ReactNode } from "react";
import { ZoneShell } from "@/components/zone-shell";

// All /auth/* pages (verify-email, confirm-signup, error,
// reset-password, verified, auto-signin) inherit the zone-aware
// shell so the auth round-trip stays in the user's current zone
// visually.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <ZoneShell>{children}</ZoneShell>;
}
