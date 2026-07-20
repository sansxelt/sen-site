// The Vraelis mark. ONE definition, used by the favicon, the iOS icon, the site header and the OG card, so
// the shape can never drift between surfaces.
//
// A corner bracket: a full-width bar with a leg descending on the right. It survives at 16px in a browser
// tab, which a thin or detailed mark does not, and it reads at any size without antialiasing mush because
// every edge is axis-aligned.
export const MARK_VIEWBOX = "0 0 24 24";

// M5,5 H19 V19 H13 V11 H5 Z
//   top bar   x 5..19, y 5..11
//   right leg x 13..19, y 11..19
export const MARK_PATH = "M5 5 H19 V19 H13 V11 H5 Z";
