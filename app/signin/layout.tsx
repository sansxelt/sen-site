import type { ReactNode } from "react";
import { ZoneShell } from "@/components/zone-shell";

// /signin gets the zone-aware shell so visiting from chat.vraelis.ai
// shows workshop chrome, platform.vraelis.ai shows the dev console
// chrome, etc. Same component, different identity per host.
//
// The back link is forced to the apex marketing site instead of
// the per-zone home, because the per-zone home (workshop/platform)
// is itself auth-gated and would just bounce an unauth visitor
// right back to /signin. Marketing is always reachable.
export default function SignInLayout({ children }: { children: ReactNode }) {
  return (
    <ZoneShell
      wide
      backHrefOverride="https://vraelis.ai/home"
      backLabelOverride="← vraelis.ai"
    >
      {children}
    </ZoneShell>
  );
}
