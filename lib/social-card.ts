// THE LINK PREVIEW, WRITTEN ONCE.
//
// Every platform we post to had a different retired positioning pinned at the same time: LinkedIn showing
// "Production validation for AI-built systems", X still showing "Human QA for AI output" from two pivots
// ago. The cause was not the caches. It was that five surfaces each declared their own title, description
// and image, so a rewrite had to find all five, and never did.
//
// So there is one sentence and one image, here, and every surface imports them. A new route that wants a
// social card gets the same card as everything else or it does not get one.
//
// The image is the MARK, not artwork with copy baked into it. A rendered headline card is the worst kind of
// stale: platforms cache the PNG far longer than the page, so the picture keeps saying the old thing after
// the words around it have been fixed. A logo says the same thing in every positioning we will ever have.

export const SOCIAL_TITLE = "Vraelis";

/** One sentence. Every embed. Do not fork this per page. */
export const SOCIAL_DESCRIPTION = "Verifies software built with AI actually works.";

/** The square Vraelis mark, the same artwork the favicon is generated from. */
export const SOCIAL_IMAGE = "https://vraelis.com/icon-original.png";

/**
 * The complete Open Graph + Twitter block. `card: "summary"` is deliberate: it renders the small square
 * thumbnail a logo is meant for, where "summary_large_image" would stretch the mark across a 2:1 banner.
 *
 * `title` may be overridden for a specific page; the description and image never are.
 */
export function socialCard(title: string = SOCIAL_TITLE) {
  return {
    openGraph: {
      title,
      description: SOCIAL_DESCRIPTION,
      siteName: SOCIAL_TITLE,
      images: [SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary" as const,
      title,
      description: SOCIAL_DESCRIPTION,
      images: [SOCIAL_IMAGE],
    },
  };
}
