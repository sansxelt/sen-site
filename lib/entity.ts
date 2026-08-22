import { SOCIAL_DESCRIPTION, SOCIAL_IMAGE, SOCIAL_TITLE } from "./social-card";

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
// CHECKED AGAINST THE LIVE PROFILES, because this comment used to assert the opposite and was wrong.
// It said the retired positioning was still live on them and that a crawler reconciling them against this
// file would find them disagreeing. Both profiles resolve, both link back to vraelis.com, and neither
// mentions the retired product: LinkedIn reads "Stealth." and X reads "Stealth Mode".
//
// So the disagreement is gone and a different gap is in its place, and it is the one that matters for
// entity resolution. This file publishes a real sentence; both corroborating profiles publish nothing.
// sameAs only corroborates if the thing it points at says something to corroborate, so an identity graph
// with two silent endpoints is a claim with no second source. That is why a search for the name still
// returns an unrelated game character: nothing outside this repo says what the company is.
//
// Still not a deploy. Fixing it is a login on each profile and one sentence, the same sentence this file
// publishes, which is why SOCIAL_DESCRIPTION is the single place it is written.
export const ORGANIZATION = {
  name: SOCIAL_TITLE,
  url: "https://vraelis.com",
  logo: SOCIAL_IMAGE,
  description: SOCIAL_DESCRIPTION,
  sameAs: [
    "https://www.linkedin.com/company/vraelis",
    "https://x.com/vraelis",
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
