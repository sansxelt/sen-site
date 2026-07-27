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

// THE GEOMETRY IS MEASURED FROM THE OFFICIAL ARTWORK, NOT EYEballed.
//
// The founder supplied the mark as a 500x500 transparent PNG and said every Vraelis icon must be it. So the
// vertices below were extracted from that file rather than approximated: the alpha bounding box gives the
// silhouette (313 x 294, so the stone is WIDER than it is tall, which a from-memory redraw gets wrong), the
// widest scanline gives the girdle at 0.337 of the height, and scanning the colour runs either side of the
// girdle gives where each facet edge lands. Every number here is one of those measurements mapped onto the
// 24x24 box, which is why they are not round.
//
// Redrawing it by hand would have produced a mark that is nearly this one, and "nearly" is how a logo drifts.
//   table   y = 2.15    the flat top
//   girdle  y = 8.79    the widest line, where crown meets pavilion  (0.337 of the height)
//   culet   y = 21.85   the point
const L = "1.5 8.79";     // left girdle corner
const R = "22.5 8.79";    // right girdle corner
const TL = "6.27 2.15";   // table, left    (0.227 across)
const TR = "17.73 2.15";  // table, right   (0.773 across)
const ML = "8.07 8.79";   // girdle, below the table's left edge   (0.313)
const MR = "15.99 8.79";  // girdle, below the table's right edge  (0.690)
const C = "12 8.79";      // girdle, centre
const B = "12 21.85";     // culet

export const MARK_PATH = `M${L} L${TL} L${TR} L${R} L${B} Z`;

/** The cut stone, back to front. Fills sampled from the official artwork. They are neutral, which is not
 *  only a description but a rule: on this product green means "this verification held", and a logo must
 *  never spend that signal. */
export const MARK_FACETS: { d: string; fill: string }[] = [
  { d: `M${TL} L${TR} L${MR} L${ML} Z`, fill: "#EDEDEF" },   // table
  { d: `M${L} L${TL} L${ML} Z`, fill: "#BDBCC1" },           // crown, left
  { d: `M${TR} L${R} L${MR} Z`, fill: "#7E7E80" },           // crown, right
  { d: `M${L} L${ML} L${B} Z`, fill: "#D7D7D9" },            // pavilion, far left
  { d: `M${ML} L${C} L${B} Z`, fill: "#F8F8FA" },            // pavilion, centre left
  { d: `M${C} L${MR} L${B} Z`, fill: "#98979C" },            // pavilion, centre right
  { d: `M${MR} L${R} L${B} Z`, fill: "#6C6C6E" },            // pavilion, far right
];

/** The ground the mark is set on where it needs one (favicon tile, iOS icon). Design 06 graphite, the same
 *  value the product paints, so the tab icon and the app are the same black. */
export const MARK_GROUND = "#0A0A0B";
