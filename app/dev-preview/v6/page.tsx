import type { Metadata } from "next";
import Home from "./home";
import { v6meta } from "./_system/meta";
import { robotsMeta } from "@/lib/stealth";
import { META_TITLE, META_DESCRIPTION, OG_TITLE, OG_DESCRIPTION } from "./_system/positioning";

export const metadata: Metadata = {
  // Positioning strings are provisional and centralized in _system/positioning.ts. Change them there.
  ...v6meta({
    title: META_TITLE,
    description: META_DESCRIPTION,
    path: "/",
    ogTitle: OG_TITLE,
    ogDescription: OG_DESCRIPTION,
  }),
  // THE FRONT DOOR CARRIES THE COMPANY LINE (plan C, 2026-10-02): "Vraelis | Know what you built does what you
  // meant", replacing "Home | Vraelis". A search result and a tab both say what the company does, not "Home".
  //
  // ABSOLUTE, BECAUSE THE TEMPLATE CANNOT REACH THIS PAGE. The layout's "%s | Vraelis" applies to CHILD
  // segments, and this page sits in the same segment as the layout that declares it, so a bare title here
  // renders without the suffix. META_TITLE already carries the company name, which is also why it must not be
  // suffixed: "Vraelis | ... | Vraelis".
  //
  // THE LINK PREVIEW IS UNAFFECTED. v6meta builds the social card from ogTitle, which is passed explicitly
  // above. This is the browser tab and the search result, and only those.
  title: { absolute: META_TITLE },
  // THE ONE PAGE THAT STAYS INDEXABLE WHILE THE CURTAIN IS DOWN.
  //
  // Asked for through robotsMeta rather than written as a robots object here, so indexing stays one
  // decision in one file. The first attempt hardcoded it and email-embeds-verify rejected it, which is the
  // guard doing precisely its job: two places deciding this is how a page ends up serving index,follow
  // over a body that says "Not open yet".
  //
  // Page metadata is the deepest segment and wins the merge, so this overrides the veto the layouts apply
  // without loosening it for anything else. proxy.ts makes the matching exception for the X-Robots-Tag
  // header, and BOTH are required: the more restrictive of the two always wins, so exempting one alone
  // changes nothing at all.
  robots: robotsMeta(true, { curtainVisible: true }),
};

export default function Page() {
  return <Home />;
}
