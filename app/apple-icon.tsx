import { ImageResponse } from "next/og";
import { MARK_FACETS, MARK_VIEWBOX } from "@/lib/brand-mark";

// iOS home-screen icon (180x180): the Vraelis mark, on nothing.
//
// Transparency costs nothing here and matches the favicon. iOS does not honour alpha in a home-screen
// icon: it composites the icon onto black before rounding the corners itself. Since the tile this replaced
// was near-black graphite already, the rendered result on a device is the same picture, reached with one
// fewer thing to keep in step.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
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
