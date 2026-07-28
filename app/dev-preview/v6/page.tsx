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
  // Absolute so the homepage title is not suffixed by the site template (avoids a doubled "Vraelis").
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
