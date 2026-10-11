// VRAELIS PARTNERSHIPS (founder, 2026-10-10: preserve both; both were official).
//
// Facts come from the published partnership records (git: app/dev-preview/v6/partnerships/* before 79ec4b28, and
// the changelog entries of 2026-09-17 and 2026-09-27). Logos are the official files each company serves:
//   reddit-lockup.svg         https://redditinc.com/hubfs/Reddit%20Inc/Content/Brand%20Page/Reddit_Lockup_Logo.svg
//   bytedance-logo-white.svg  the logo in the header of https://www.bytedance.com/en/ (retrieved 2026-10-10)
// No written logo-use permission is on record for either company. Reddit's brand system says partnership lockups
// apply "if we have agreed for our brands to appear together". Get each company's written OK before the public switch.
//
// Neither partnership covers Vraelis Contour, and neither is an endorsement of it or a validation of its security
// capabilities. Nothing here may say otherwise unless an agreement establishes it.

export type Partner = {
  slug: "bytedance" | "reddit";
  name: string;
  title: string;
  established: string; // ISO day the partnership record carries
  firstContact?: string;
  focus: string;
  summary: string;
  lede: string;
  means: string[];
  boundary: string[];
  logo: { src: string; w: number; h: number; alt: string };
  glow: string;
  photo: { src: string; alt: string; credit: string; href: string };
  links: { label: string; href: string }[];
  changelogId: string;
};

export const PARTNERS: Partner[] = [
  {
    slug: "bytedance",
    name: "ByteDance",
    title: "Vraelis and ByteDance",
    established: "2026-09-27",
    firstContact: "2026-08-17",
    focus: "AI models: the Seed family",
    summary: "An official partnership centred on ByteDance's Seed model family.",
    lede: "An official partnership centred on ByteDance's Seed models.",
    means: [
      "Seedream for images, Seedance for video, Seed language models",
      "A direct line to the team behind them",
      "Projects named only once they exist",
    ],
    boundary: [
      "Does not cover or endorse Vraelis Contour",
      "Seed models are not used in Vraelis Contour or in defense work",
      "No exclusivity, no private data",
    ],
    logo: { src: "/v8/partners/bytedance-logo-white.svg", w: 256, h: 44, alt: "ByteDance" },
    glow: "radial-gradient(80% 90% at 75% 20%, rgba(60,140,255,.55), transparent 65%), radial-gradient(60% 70% at 10% 100%, rgba(50,90,180,.5), transparent 70%), #0B1530",
    photo: { src: "/home/menu/pics/bytedance-partnership.jpg", alt: "A person holding a phone in the dark.", credit: "Jaroslav Maléř, Pexels", href: "https://www.pexels.com/photo/man-holding-a-mobile-phone-in-the-dark-19949818/" },
    links: [{ label: "ByteDance", href: "https://www.bytedance.com/en/" }, { label: "ByteDance Seed", href: "https://seed.bytedance.com/en/" }],
    changelogId: "2026-09-27-vraelis-and-bytedance",
  },
  {
    slug: "reddit",
    name: "Reddit",
    title: "Vraelis and Reddit",
    established: "2026-09-14",
    focus: "Advertising: Reddit Ads",
    summary: "An advertising partnership with Reddit, through Reddit Ads.",
    lede: "An advertising partnership to reach technical communities through Reddit Ads.",
    means: [
      "Advertising through Reddit Ads",
      "Campaigns and results named only once they exist",
    ],
    boundary: [
      "Does not cover or endorse Vraelis Contour or our security work",
      "No campaign performance, exclusivity or private user data",
    ],
    logo: { src: "/v8/partners/reddit-lockup.svg", w: 774, h: 216, alt: "Reddit" },
    glow: "radial-gradient(80% 90% at 75% 15%, rgba(255,69,0,.42), transparent 65%), radial-gradient(60% 70% at 10% 100%, rgba(255,97,1,.22), transparent 70%), #160A06",
    photo: { src: "/home/menu/pics/reddit-partnership.jpg", alt: "An aerial view of a city at night.", credit: "Denys Mikhalevych, Pexels", href: "https://www.pexels.com/photo/an-aerial-photography-of-city-buildings-at-night-12534226/" },
    links: [{ label: "Reddit", href: "https://www.reddit.com/" }, { label: "Reddit for Business", href: "https://www.business.reddit.com/" }],
    changelogId: "2026-09-17-vraelis-and-reddit",
  },
];

export const PARTNERS_NOTE = "Neither partnership covers Vraelis Contour or endorses its security capabilities.";
export const partner = (slug: string) => PARTNERS.find((p) => p.slug === slug);
