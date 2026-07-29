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

// STATED, NOT INFERRED. The tags carried a bare image URL, so every scraper had to fetch the file and
// decode it before it knew the shape — and a scraper on a short timeout that does not get there renders
// the card with no picture at all, which is what an empty box on a shared link actually is. LinkedIn in
// particular sizes its tile from these. They are the real dimensions of the PNG in public/, and
// scripts/email-embeds-verify.ts reads the file header to prove they still are.
export const SOCIAL_IMAGE_WIDTH = 1024;
export const SOCIAL_IMAGE_HEIGHT = 1024;

/** Alt text for the mark. A link preview is content; it gets described like any other image. */
export const SOCIAL_IMAGE_ALT = "The Vraelis mark";

// A FEW EMBEDS, NOT NINETEEN AND NOT ONE.
//
// One sentence for everything was the correction to five surfaces that each invented their own, and it
// worked. But it also means a link to a specific verification result says the same thing as a link to the
// company, and those are not the same thing to anybody clicking.
//
// So: a SMALL FIXED SET, declared here. The property that mattered is preserved — a rewrite opens one file
// and sees every embed the company has — while a page can still say what it actually is. What is NOT
// offered is a free-form per-page description, because that is exactly how the five drifted apart.
//
// Every variant uses the same mark and the same small summary card, so all of them render identically
// everywhere: a square logo tile beside a title and a sentence. That is the "universal" half. Discord, X,
// LinkedIn, Slack and iMessage all lay that out correctly without per-platform special cases.
//
// Each sentence describes the WHOLE product or the specific artifact being shared. None of them elevates a
// single feature into the definition of the company.
export const SOCIAL_EMBEDS = {
  /** The company, and the default for every marketing page. */
  site: { title: SOCIAL_TITLE, description: SOCIAL_DESCRIPTION },
  /** The developer surfaces: the same product, named by how you reach it. */
  developers: {
    title: "Vraelis for developers",
    description: "Verify a deployed application from your CI, the command line, or the API.",
  },
} as const;

// ONLY WHAT SOMETHING USES. A variant nobody imports is the same trap as a route nobody links: it looks
// maintained, drifts quietly, and gets reintroduced by the next person who finds it. A shared-verification
// embed belonged here until the per-token share pages were retired to redirects, and it went with them.
// scripts/email-embeds-verify.ts fails if a declared variant has no consumer.

export type SocialEmbed = keyof typeof SOCIAL_EMBEDS;

/**
 * The complete Open Graph + Twitter block. ONE builder, so every embed is identical in shape and only the
 * two sentences differ. `card: "summary"` is deliberate: it renders the small square thumbnail a logo is
 * meant for, where "summary_large_image" would stretch the mark across a 2:1 banner.
 */
function build(title: string, description: string) {
  const image = { url: SOCIAL_IMAGE, width: SOCIAL_IMAGE_WIDTH, height: SOCIAL_IMAGE_HEIGHT, alt: SOCIAL_IMAGE_ALT };
  return {
    openGraph: { title, description, siteName: SOCIAL_TITLE, images: [image] },
    twitter: { card: "summary" as const, title, description, images: [image] },
  };
}

/** The complete block for one of the few named embeds. */
export function socialCardFor(kind: SocialEmbed) {
  const { title, description } = SOCIAL_EMBEDS[kind];
  return build(title, description);
}

/**
 * The default embed. `title` may be overridden for a specific page; the description and image never are.
 * A page that needs a different SENTENCE takes one of the named embeds above rather than inventing one.
 */
export function socialCard(title: string = SOCIAL_TITLE) {
  return build(title, SOCIAL_DESCRIPTION);
}
