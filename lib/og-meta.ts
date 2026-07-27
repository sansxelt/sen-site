import type { Metadata } from "next";
import { SOCIAL_DESCRIPTION, SOCIAL_IMAGE, socialCard } from "./social-card";
import { robotsMeta } from "./stealth";

// Page metadata for the public marketing pages.
//
// THE EMBED IS NOT PER-PAGE. This helper used to own its own link preview: a per-page og:description plus a
// rendered 1200x630 headline card at /og?v=N, served as summary_large_image. Nineteen pages import it, so
// nineteen surfaces each shipped a different embed, and the rendered card was the worst part — platforms
// cache the PNG far longer than the page, so the picture kept announcing an old positioning after the words
// around it had been corrected. That is the exact failure lib/social-card.ts was written to end, and it was
// only ever applied to the root layout and to V6. These nineteen pages were missed.
//
// So the embed now comes from ONE place for every surface: one sentence, and the square Vraelis mark as the
// only image, in a small summary card. There is no per-page override and there is no headline artwork.
//
// What stays per-page is everything that is NOT an embed: the browser title, the HTML meta description that
// a search result shows, the canonical URL, and whether the page is indexable.
//
// The `image` and `noImage` parameters are gone rather than deprecated. Left in place they were an invitation
// to reintroduce exactly what was removed, and `noImage` existed only to work around LinkedIn hard-caching a
// rendered card, which stops being a problem once nothing renders one.

export function ogMeta({
  title,
  description,
  path = "/",
  index = true,
}: {
  title: string;
  description: string;
  path?: string;
  index?: boolean;
}): Metadata {
  const url = `https://vraelis.com${path}`;
  const card = socialCard(title);
  return {
    title,
    // The page's own description, which is what a search result shows. The EMBED description is the single
    // shared sentence, deliberately not this one.
    description,
    alternates: { canonical: url },
    openGraph: { ...card.openGraph, type: "website", url },
    twitter: card.twitter,
    // The caller's preference, vetoed by stealth. These are the PREVIOUS generation's marketing pages, which
    // are the public site until V6 is promoted, so they index normally; they just must not do so from behind
    // the curtain.
    robots: robotsMeta(index),
  };
}

// Re-exported so a caller that wants the shared sentence in body copy reads it from the same constant the
// embed uses, rather than retyping it and drifting.
export { SOCIAL_DESCRIPTION, SOCIAL_IMAGE };
