import { ImageResponse } from "next/og";
import { MARK_PATH, MARK_VIEWBOX } from "@/lib/brand-mark";

// Favicon: the Vraelis mark in white on an ink tile, matching the icon as designed.
//
// A full-bleed tile rather than the mark alone, because a lone glyph on a transparent background vanishes
// against dark browser chrome and the silhouette then differs per theme. Every edge of the mark is
// axis-aligned, so it stays crisp at 16px instead of turning to mush the way a thin stroke does at
// favicon size.
//
// Drawn from lib/brand-mark rather than a PNG: one definition shared with the iOS icon, the site header
// and the OG card, and a few hundred bytes instead of the 694KB source file. Served at a hashed URL, so
// the tab icon cache-busts whenever this changes.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#141310",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="26" height="26" viewBox={MARK_VIEWBOX}>
          <path d={MARK_PATH} fill="#FFFFFF" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
