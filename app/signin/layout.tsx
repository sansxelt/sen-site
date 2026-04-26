import type { ReactNode } from "react";
import { ZoneShell } from "@/components/zone-shell";

// /signin gets the zone-aware shell so visiting from chat.sansxel.ai
// shows workshop chrome, platform.sansxel.ai shows the dev console
// chrome, etc. Same component, different identity per host.
//
// hideBackLink: the default ZoneShell back link points to the zone
// home (workshop / platform / apex), but on chat + platform that
// destination is itself auth-gated, so an unauth visitor clicking
// the link gets bounced right back to /signin. Hiding the link
// here removes the dead-end loop.
export default function SignInLayout({ children }: { children: ReactNode }) {
  return <ZoneShell hideBackLink wide>{children}</ZoneShell>;
}
