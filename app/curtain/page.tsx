import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { robotsMeta, stealthConfigured } from "@/lib/stealth";
import { CURTAIN_PATH_HEADER } from "@/proxy";

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

// AND THE ONE THING THAT CAME BACK WITH IT.
//
// Rewriting here took the homepage's metadata out of the tree. app/dev-preview/v6/page.tsx carries
// `robots: robotsMeta(true, { curtainVisible: true })`, and Next merges metadata by depth with the deepest
// segment winning, so before the rewrite that page was what made "/" indexable. Afterwards the deepest
// segment was this one, which declared nothing, and the root layout's restrictive default became the only
// signal. The header said indexable and the meta tag said noindex, and the two are combined restrictively,
// so the exemption robotsMeta() argues for at length quietly stopped applying.
//
// scripts/stealth-index-verify.ts already warned about this exact shape: "Exempting the header while the
// meta still says noindex changes nothing at all." It asserted the v6 homepage asked correctly and could not
// see that the v6 homepage was no longer the page being rendered.
//
// The exemption is decided from the path the VISITOR asked for, forwarded by proxy.ts, never from this
// route's own path, which is the same for every curtained request. Everything except "/" stays noindex.
export async function generateMetadata(): Promise<Metadata> {
  const asked = (await headers()).get(CURTAIN_PATH_HEADER);
  return { robots: robotsMeta(true, { curtainVisible: asked === "/" }) };
}
