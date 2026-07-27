// Single-domain architecture — vraelis.com hosts everything.
// Zone is now path-based rather than host-based:
//   /chat/*      → "chat"  (workshop)
//   /platform/*  → "platform" (developer console)
//   everything else → "apex" (marketing)
//
// getZone() always returns "apex" from the host (there's only one host now).
// Layouts that want chat/platform theming pass zoneOverride to ZoneShell.

export type Zone = "apex" | "chat" | "platform";

export async function getZone(): Promise<Zone> {
  return "apex";
}

export const ZONE_THEME: Record<Zone, {
  label: string;
  tagline: string;
  accent: string;
  accentSoft: string;
  bg: string;
  font: string;
  signInLabel: string;
}> = {
  apex: {
    label: "Vraelis",
    tagline: "The AI workshop for makers",
    accent: "text-purple-400",
    accentSoft: "bg-purple-400/[0.08]",
    bg: "bg-[#080809]",
    font: "",
    signInLabel: "Sign in to Vraelis",
  },
  chat: {
    label: "Vraelis",
    tagline: "Workshop · pick up where you left off",
    accent: "text-purple-400",
    accentSoft: "bg-purple-400/[0.08]",
    bg: "bg-[#080809]",
    font: "",
    signInLabel: "Sign in to the workshop",
  },
  platform: {
    label: "Vraelis",
    tagline: "Platform · developer console",
    accent: "text-amber-300",
    accentSoft: "bg-amber-400/[0.06]",
    bg: "bg-[#060810]",
    font: "font-mono",
    signInLabel: "Sign in to platform",
  },
};
