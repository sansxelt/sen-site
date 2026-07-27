import { ImageResponse } from "next/og";
import { MARK_FACETS, MARK_VIEWBOX } from "@/lib/brand-mark";

// Favicon: the Vraelis mark, on nothing.
//
// It used to sit on an ink tile. The founder supplied the mark with no background and asked for that
// version, which is the better call in a browser tab: a tile is a rectangle competing with every other
// tile in the strip, while a bare silhouette reads as a shape and lets the browser's own chrome be the
// background in whichever theme the reader is using.
//
// A favicon is one PNG at a fixed URL and cannot answer prefers-color-scheme, so a transparent mark has to
// survive both themes on its own. This one does, and it was CHECKED rather than assumed: rendered at 32px
// over graphite, over Chrome's light tab strip (#DEE1E6) and over pure white. The stone is lit from the
// upper left, so its left facets do fade on a pale ground, but the right side runs to #6C6C6E and holds the
// silhouette in every case. It reads as a cut stone on all three.
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="31" height="31" viewBox={MARK_VIEWBOX}>
          {MARK_FACETS.map((f) => <path key={f.fill} d={f.d} fill={f.fill} />)}
        </svg>
      </div>
    ),
    { ...size },
  );
}
