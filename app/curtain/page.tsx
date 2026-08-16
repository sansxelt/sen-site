import { notFound } from "next/navigation";
import { stealthConfigured } from "@/lib/stealth";

// THE CURTAIN'S OWN ROUTE, WHICH DELIBERATELY RENDERS NOTHING.
//
// proxy.ts rewrites every curtained request here so that the page Next composes and serializes is this one
// rather than the real one. The visible curtain still comes from the root layout, which returns
// <StealthScreen /> in place of children; this exists purely so that the segment BELOW that layout has no
// content to stream into the RSC flight payload.
//
// That distinction is the whole point. The layout controls what is displayed. It does not control what is
// serialized: Next renders the matched page segment regardless and streams it into the payload, which is how
// a curtained /platform came to return 90KB of readable marketing copy to anyone with curl. Returning null
// from a page that was never the real one is what makes the promise in lib/stealth.ts true.
//
// With stealth OFF nothing rewrites here, so a direct visit is a path that should not exist: 404 rather than
// a blank page, so it never becomes an accidental public URL.
export default function Curtain() {
  if (!stealthConfigured()) notFound();
  return null;
}
