import { ImageResponse } from "next/og";
import { MARK_FACETS, MARK_VIEWBOX, MARK_GROUND } from "@/lib/brand-mark";

// iOS home-screen icon (180x180): the Vraelis mark in white on an ink tile. Monochrome and high contrast,
// which is what survives being shrunk into a home screen next to fifty other icons. iOS rounds the corners
// itself, so a full-bleed tile is correct here.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: MARK_GROUND,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="173" height="173" viewBox={MARK_VIEWBOX}>
          {MARK_FACETS.map((f) => <path key={f.fill} d={f.d} fill={f.fill} />)}
        </svg>
      </div>
    ),
    { ...size },
  );
}
