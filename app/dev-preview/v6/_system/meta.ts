import type { Metadata } from "next";
import { socialCard } from "@/lib/social-card";

// One metadata system for design 06. Preview routes stay noindex, but every value is real and inspectable.
//
// NO OPEN GRAPH IMAGE, ANYWHERE. Every link preview is text only, carrying the single sentence in
// positioning.ts. A generated card bakes its copy into a PNG that platforms cache far longer than the page,
// which is how LinkedIn and X each ended up pinned to a different retired positioning at the same time.
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
}): Metadata {
  const url = `${V6_ORIGIN}${o.path}`;
  // The shared card decides the description and the image. A page may name itself in the card title; it may
  // not describe itself differently, because a per-page sentence is how five surfaces drifted apart before.
  const card = socialCard(o.ogTitle ?? o.title);
  return {
    title: o.title,
    description: o.description,
    alternates: { canonical: url },
    robots: { index: false, follow: false },
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
