import { SOCIAL_DESCRIPTION, SOCIAL_TITLE } from "./social-card";

// WHO THIS COMPANY IS, STATED IN A FORM MACHINES READ.
//
// A search for "nvidia" returns a panel: the logo, "American technology company", tabs, sitelinks. A search
// for "vraelis" returns a paragraph a model assembled from whatever it could find, which at the time of
// writing described the RETIRED product, in the retired vocabulary, having stitched it together with an
// unrelated religious term.
//
// That gap is not one setting. A knowledge panel is an ENTITY, and an entity is built from three things:
// structured self-description, third-party corroboration, and time. This file is the first of the three,
// and it is the only one that lives in a repo. Publishing it does not produce a panel, and pretending
// otherwise would be the kind of claim this company exists to disprove. What it does is make the machine
// readable answer to "what is Vraelis" a single unambiguous statement from the company itself, so that when
// anything does re-read the site there is nothing to infer and nothing to confuse with a similarly spelled
// word.
//
// The description is not written here. It is the ONE sentence from lib/social-card, the same string the
// link preview uses, because a company that describes itself differently in two machine-readable places has
// given the machine a reason to prefer its own summary.
//
// sameAs is the corroboration hook: the profiles that are demonstrably the same entity. Only accounts the
// company actually controls belong here.
//
// CHECKED AGAINST THE LIVE PROFILES, and corrected twice. An earlier version of this comment said the
// retired positioning was still live on them; it was not. A later one listed the X profile beside LinkedIn.
// On 2026-09-28 that profile's address returned 404, so it was corroborating nothing and pointing crawlers at a
// missing page. LinkedIn is the only profile confirmed to exist, so it is the only one listed. Facebook and
// Instagram are unconfirmed and are not listed either. Add a profile here only after opening it and seeing
// that it is the company's own.
//
// The gap that matters for entity resolution is unchanged: sameAs only corroborates if the profile it
// points at says something to corroborate. Fixing that is a login on the profile and one sentence, the same
// sentence this file publishes, which is why SOCIAL_DESCRIPTION is the single place it is written.
export const ORGANIZATION = {
  name: SOCIAL_TITLE,
  url: "https://vraelis.com",
  logo: "https://vraelis.com/social/vraelis-wordmark.png",
  description: SOCIAL_DESCRIPTION,
  sameAs: [
    "https://www.linkedin.com/company/vraelis",
  ],
} as const;

/** schema.org Organization + WebSite, as one graph.
 *
 *  WebSite carries the site name so a result can be labelled with it rather than a bare domain. Organization
 *  carries the identity. They are emitted together, with @id references between them, because two loose
 *  objects describing the same thing is precisely the ambiguity this is meant to remove. */
export function entityJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${ORGANIZATION.url}/#organization`,
        name: ORGANIZATION.name,
        url: ORGANIZATION.url,
        logo: { "@type": "ImageObject", url: ORGANIZATION.logo },
        description: ORGANIZATION.description,
        sameAs: [...ORGANIZATION.sameAs],
      },
      {
        "@type": "WebSite",
        "@id": `${ORGANIZATION.url}/#website`,
        url: ORGANIZATION.url,
        name: ORGANIZATION.name,
        description: ORGANIZATION.description,
        publisher: { "@id": `${ORGANIZATION.url}/#organization` },
      },
    ],
  });
}
