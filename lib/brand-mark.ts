// The Vraelis mark. ONE definition, used by the favicon, the iOS icon, the docs rail and the site chapters,
// so the shape can never drift between surfaces.
//
// A cut stone, lit from the upper left: a table, two crown facets, and four pavilion facets meeting at the
// culet. The previous mark was a corner bracket; this is the founder's replacement, and it is expressed as
// geometry rather than as a bitmap for the same reason the bracket was — a few hundred bytes instead of an
// 850KB PNG, crisp at every size, and one place to change it.
//
// TWO FORMS, ON PURPOSE.
//
//   MARK_PATH    the SILHOUETTE, one closed path. This is what monochrome surfaces use (the docs rail and
//                the chapter marks render it with fill="currentColor") and it is what survives at 13px.
//   MARK_FACETS  the full stone, back to front. Used where the mark is drawn large enough to hold facets:
//                the favicon tile and the iOS icon.
//
// Keeping the silhouette as its own path matters. Filling seven facets with currentColor would produce a
// flat shape crossed by hairline seams where the edges meet, which is precisely the antialiasing mush a
// small mark has to avoid.
export const MARK_VIEWBOX = "0 0 24 24";

// The geometry, named once so the facets and the silhouette cannot disagree.
//   table   y = 4       the flat top
//   girdle  y = 10      the widest line, where crown meets pavilion
//   culet   y = 20.5    the point
const L = "1.6 10";       // left girdle corner
const R = "22.4 10";      // right girdle corner
const TL = "6.6 4";       // table, left
const TR = "17.4 4";      // table, right
const ML = "8.9 10";      // girdle, below the table's left edge
const MR = "15.1 10";     // girdle, below the table's right edge
const C = "12 10";        // girdle, centre
const B = "12 20.5";      // culet

export const MARK_PATH = `M${L} L${TL} L${TR} L${R} L${B} Z`;

/** The cut stone, back to front. The fills are neutral by design: the mark carries no hue, because on this
 *  product green means "this verification held" and a logo must never spend that signal. */
export const MARK_FACETS: { d: string; fill: string }[] = [
  { d: `M${TL} L${TR} L${MR} L${ML} Z`, fill: "#F2F3F4" },   // table
  { d: `M${L} L${TL} L${ML} Z`, fill: "#BCBDC1" },           // crown, left
  { d: `M${TR} L${R} L${MR} Z`, fill: "#77797D" },           // crown, right
  { d: `M${L} L${ML} L${B} Z`, fill: "#E4E5E6" },            // pavilion, far left
  { d: `M${ML} L${C} L${B} Z`, fill: "#FAFAFB" },            // pavilion, centre left
  { d: `M${C} L${MR} L${B} Z`, fill: "#9A9CA0" },            // pavilion, centre right
  { d: `M${MR} L${R} L${B} Z`, fill: "#6B6D71" },            // pavilion, far right
];

/** The ground the mark is set on where it needs one (favicon tile, iOS icon). Design 06 graphite, the same
 *  value the product paints, so the tab icon and the app are the same black. */
export const MARK_GROUND = "#0A0A0B";
