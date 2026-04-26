import type { ReactNode } from "react";
import { ZoneShell } from "@/components/zone-shell";

// /signin gets the zone-aware shell so visiting from chat.sansxel.ai
// shows workshop chrome, platform.sansxel.ai shows the dev console
// chrome, etc. Same component, different identity per host.
export default function SignInLayout({ children }: { children: ReactNode }) {
  return <ZoneShell>{children}</ZoneShell>;
}
