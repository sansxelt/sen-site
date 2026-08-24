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
  // NAME THE PAGE, LIKE EVERY OTHER ROUTE DOES.
  //
  // This was absolute, which existed to stop the site template suffixing a title that already ended in the
  // company name and producing "Vraelis | ... | Vraelis". The real problem was upstream: every other page
  // on the site reads "Platform | Vraelis", "Pricing | Vraelis", "Company | Vraelis", and the homepage was
  // the single route that broke the pattern, with a title long enough to truncate in a tab to
  // "Vraelis | Verification for AI-built sof...". A visitor with several tabs open could identify any page
  // of this site except its front door.
  //
  // Naming it "Home" lets the layout's own "%s | Vraelis" template do the work, so the homepage now follows
  // the same rule as everything else and the absolute override is no longer needed for anything.
  //
  // WRITTEN OUT IN FULL, BECAUSE THE TEMPLATE CANNOT REACH THIS PAGE. The layout's "%s | Vraelis" applies
  // to CHILD segments, and this page sits in the same segment as the layout that declares it, so a bare
  // "Home" here renders a tab that says only "Home". That is also the original reason this field was
  // absolute and the reason META_TITLE carries the company name inside itself. Verified by rendering, not
  // by reading the docs: /platform gets the suffix from the template, this route has to carry its own.
  //
  // THE LINK PREVIEW IS UNAFFECTED. v6meta builds the social card from ogTitle, which is passed explicitly
  // above; SOCIAL_TITLE is "Vraelis" and the one positioning sentence lives in SOCIAL_DESCRIPTION, neither
  // of which this touches. Nothing shared to X, LinkedIn or Slack changes. This is the browser tab and the
  // search result, and only those.
  title: { absolute: "Home | Vraelis" },
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
