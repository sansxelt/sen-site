import type { Metadata } from "next";
import { socialCard } from "@/lib/social-card";
import { robotsMeta } from "@/lib/stealth";

const v6Public = process.env.NEXT_PUBLIC_VRAELIS_V6_PUBLIC === "1";

// One metadata system for design 06. Preview routes stay noindex, but every value is real and inspectable.
//
// The shared social-card builder owns the description, versioned image and platform card type.
export const V6_ORIGIN = "https://vraelis.com";

export function v6meta(o: {
  title: string;
  description: string;
  path: string; // clean production path this route will live at, e.g. "/platform"
  ogTitle?: string;
  ogDescription?: string;
  type?: "website" | "article";
  published?: string;
  modified?: string;
  index?: boolean;
}): Metadata {
  const url = `${V6_ORIGIN}${o.path}`;
  // Search and social previews describe the same page. The shared builder still owns imagery and shape.
  const card = socialCard(o.ogTitle ?? o.title, o.ogDescription ?? o.description);
  return {
    title: o.title.startsWith("Vraelis") ? { absolute: o.title } : o.title,
    description: o.description,
    alternates: { canonical: url },
    // INDEXABLE ONLY WHEN PROMOTED, AND NEVER WHILE THE CURTAIN IS DOWN. While V6 serves from
    // /dev-preview/v6 it must stay out of the index: a preview competing with the live site for the same
    // queries is worse than either alone. Promoted, it IS the live site, and a noindex would quietly remove
    // the company from search the moment the flag flipped. Same variable as the routing, so the two can
    // never disagree about which site is public. The stealth veto is NOT applied here; robotsMeta owns it,
    // because this helper is the deepest metadata on twenty-six pages and therefore the one that wins.
    robots: robotsMeta(v6Public && o.index !== false),
    openGraph: {
      ...card.openGraph,
      type: o.type ?? "website",
      url,
      ...(o.type === "article" && (o.published || o.modified)
        ? { publishedTime: o.published, modifiedTime: o.modified }
        : {}),
    },
    twitter: card.twitter,
  };
}
