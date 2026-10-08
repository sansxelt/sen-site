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
// The public preview uses licensed photography and the homepage headline. Keep a versioned asset URL:
// changing the design or copy requires a new filename so platforms can fetch the new image.

export const SOCIAL_TITLE = "Vraelis";

/** One sentence. Every embed. Do not fork this per page.
 *
 *  It says what the product does and nothing about who it is for (founder, 2026-09-28): a developer, an
 *  agency, a founder and an AI coding agent all read the same card, so it names the function and leaves the
 *  audience open. scripts/email-embeds-verify.ts pins this exact wording and its length. */
export const SOCIAL_DESCRIPTION = "Developing AI security for defense, infrastructure and physical systems.";

/** Wide editorial card for shared links; distinct from the browser favicon. */
export const SOCIAL_IMAGE = "https://vraelis.com/social/vraelis-physical-ai-v1.png";

// STATED, NOT INFERRED. The tags carried a bare image URL, so every scraper had to fetch the file and
// decode it before it knew the shape — and a scraper on a short timeout that does not get there renders
// the card with no picture at all, which is what an empty box on a shared link actually is. LinkedIn in
// particular sizes its tile from these. They are the real dimensions of the PNG in public/, and
// scripts/email-embeds-verify.ts reads the file header to prove they still are.
export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;

/** Alt text for the photographic card. A link preview is content; it gets described like any other image. */
export const SOCIAL_IMAGE_ALT = "Vraelis — Security for AI in the physical world. Industrial robotics photography.";

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
// Every variant uses the same landscape image and card type. Platforms decide the surrounding layout;
// no page forks the image or supplies its own unreviewed product artwork.
//
// Each sentence describes the WHOLE product or the specific artifact being shared. None of them elevates a
// single feature into the definition of the company.
export const SOCIAL_EMBEDS = {
  /** The company, and the default for every marketing page. */
  site: { title: SOCIAL_TITLE, description: SOCIAL_DESCRIPTION },
  /** The developer surfaces: the same product, named by how you reach it. */
  developers: {
    title: "Vraelis for developers",
    description: "Verify a deployed app from the CLI, CI, the API, or an AI assistant over MCP.",
  },
} as const;

// ONLY WHAT SOMETHING USES. A variant nobody imports is the same trap as a route nobody links: it looks
// maintained, drifts quietly, and gets reintroduced by the next person who finds it. A shared-verification
// embed belonged here until the per-token share pages were retired to redirects, and it went with them.
// scripts/email-embeds-verify.ts fails if a declared variant has no consumer.

export type SocialEmbed = keyof typeof SOCIAL_EMBEDS;

/**
 * The complete Open Graph + Twitter block. ONE builder, so every embed is identical in shape and only the
 * two sentences differ. The wide card gives the photograph and headline room to read in shared links.
 */
function build(title: string, description: string) {
  const image = { url: SOCIAL_IMAGE, width: SOCIAL_IMAGE_WIDTH, height: SOCIAL_IMAGE_HEIGHT, alt: SOCIAL_IMAGE_ALT };
  return {
    openGraph: { title, description, siteName: SOCIAL_TITLE, images: [image] },
    twitter: { card: "summary_large_image" as const, title, description, images: [image] },
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
