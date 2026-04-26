import { ImageResponse } from "next/og";
import { headers } from "next/headers";

// Per-host favicon. Each subdomain gets a different accent color
// so users can tell tabs apart at a glance.
//
//   sansxel.ai          → violet "S"
//   chat.sansxel.ai     → emerald "S" (workshop)
//   platform.sansxel.ai → cyan "$" (terminal/dev)
//
// Replaces the static app/icon.png (moved to public/icon-original.png
// as a backup). Apple touch icon stays static via app/apple-icon.png.

export const size = { width: 64, height: 64 };
export const contentType = "image/png";
export const dynamic = "force-dynamic"; // host-aware, can't be cached statically

export default async function Icon() {
  const h = await headers();
  const host = (h.get("host") ?? "").toLowerCase();
  const zone = host.startsWith("chat.")
    ? "chat"
    : host.startsWith("platform.")
      ? "platform"
      : "apex";

  const config = {
    apex: {
      bg: "#0a0a0c",
      accent: "#a78bfa",
      glow: "rgba(167, 139, 250, 0.55)",
      glyph: "S",
      mono: false,
    },
    chat: {
      bg: "#0a0a0c",
      accent: "#34d399",
      glow: "rgba(52, 211, 153, 0.55)",
      glyph: "S",
      mono: false,
    },
    platform: {
      bg: "#070a10",
      accent: "#22d3ee",
      glow: "rgba(34, 211, 238, 0.55)",
      glyph: "$",
      mono: true,
    },
  }[zone];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: config.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: config.accent,
          fontSize: 42,
          fontWeight: 800,
          fontFamily: config.mono
            ? "ui-monospace, SFMono-Regular, monospace"
            : "system-ui, -apple-system, sans-serif",
          textShadow: `0 0 16px ${config.glow}`,
          borderRadius: 12,
          letterSpacing: config.mono ? "-2px" : "-1px",
        }}
      >
        {config.glyph}
      </div>
    ),
    { ...size },
  );
}
