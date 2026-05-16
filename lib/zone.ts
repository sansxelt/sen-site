// Server-side helper that resolves the current request's host into
// a "zone", vraelis.ai (apex), chat.vraelis.ai (workshop), or
// platform.vraelis.ai (developer console).
//
// Used by ZoneShell + auth pages to render zone-specific chrome,
// copy, and accents so each subdomain feels native instead of
// stamped with the same marketing brand.

import { headers } from "next/headers";

export type Zone = "apex" | "chat" | "platform";

export async function getZone(): Promise<Zone> {
  try {
    const h = await headers();
    const host = (h.get("host") ?? "").toLowerCase();
    if (host.startsWith("chat.")) return "chat";
    if (host.startsWith("platform.")) return "platform";
    // localhost + Vercel previews + apex/www all fall here.
    return "apex";
  } catch {
    return "apex";
  }
}

// Small per-zone identity bundle so a single shell component can
// adapt without reinventing colors / labels each time.
export const ZONE_THEME: Record<Zone, {
  label: string;        // Brand wordmark suffix shown in the shell
  tagline: string;      // Subtitle under the wordmark
  accent: string;       // Tailwind accent for buttons + dots
  accentSoft: string;   // Lighter accent for backgrounds
  bg: string;           // Page bg (Tailwind class)
  font: string;         // Tailwind font class for headings
  signInLabel: string;  // "Sign in to ___" verb destination
  logoSrc: string;      // Pinwheel SVG path. One geometry, accent
                        // triangle changes per zone.
}> = {
  apex: {
    label: "vraelis",
    tagline: "The AI workshop for makers",
    accent: "text-purple-400",
    accentSoft: "bg-purple-400/[0.08]",
    bg: "bg-[#080809]",
    font: "",
    signInLabel: "Sign in to vraelis",
    logoSrc: "/logo-violet.svg",
  },
  chat: {
    label: "vraelis",
    tagline: "Workshop · pick up where you left off",
    accent: "text-purple-400",
    accentSoft: "bg-purple-400/[0.08]",
    bg: "bg-[#080809]",
    font: "",
    signInLabel: "Sign in to the workshop",
    logoSrc: "/logo-emerald.svg",
  },
  platform: {
    label: "vraelis",
    tagline: "Platform · developer console",
    accent: "text-amber-300",
    accentSoft: "bg-amber-400/[0.06]",
    bg: "bg-[#060810]",
    font: "font-mono",
    signInLabel: "Sign in to platform",
    logoSrc: "/logo-amber.svg",
  },
};
