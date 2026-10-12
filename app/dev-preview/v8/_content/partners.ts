// VRAELIS PARTNERSHIPS (founder, 2026-10-10: preserve both; both were official. 2026-10-13: add Stripe Startups,
// "it's official").
//
// Facts come from the published partnership records (git: app/dev-preview/v6/partnerships/* before 79ec4b28, and
// the changelog entries of 2026-09-17 and 2026-09-27). Logos are the official files each company serves:
//   reddit-lockup.svg         https://redditinc.com/hubfs/Reddit%20Inc/Content/Brand%20Page/Reddit_Lockup_Logo.svg
//   bytedance-logo-white.svg  the logo in the header of https://www.bytedance.com/en/ (retrieved 2026-10-10)
//   stripe-startups-white.svg the Stripe Startups program lockup (flag mark and STRIPE STARTUPS) on
//                             https://stripe.com/startups (retrieved 2026-10-13), its one colour set to white
// Stripe Startups: Stripe's startup program. Vraelis joined it through Supabase Select; Stripe's Startups lead granted
// its Stripe fee credits on acct_1TLKsqIHI0UhMM0R on 2026-10-08 (founder confirmed they landed).
// No written logo-use permission is on record for any of the three. Reddit's brand system says partnership lockups
// apply "if we have agreed for our brands to appear together". Get each company's written OK before the public switch.
//
// No partnership covers Vraelis Contour, and neither is an endorsement of it or a validation of its security
// capabilities. Nothing here may say otherwise unless an agreement establishes it.

export type Partner = {
  slug: "bytedance" | "reddit" | "stripe-startups";
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
  /** True only once the company has given written permission to show its logo. */
  logoCleared?: boolean;
  /** The founder's decision to show the official logo (2026-10-11: "use logos and names"), recorded separately so
   *  logoCleared keeps meaning that permission is on record. It is not, yet, for either company. */
  logoShown?: boolean;
  /** The logo is one colour, white: shown in black on a light page (light theme). */
  logoMono?: boolean;
  glow: string;
  photo: { src: string; alt: string; credit: string; href: string };
  links: { label: string; href: string }[];
  changelogId?: string;
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
    logoShown: true,
    logoMono: true,
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
    logoShown: true,
    glow: "radial-gradient(80% 90% at 75% 15%, rgba(255,69,0,.42), transparent 65%), radial-gradient(60% 70% at 10% 100%, rgba(255,97,1,.22), transparent 70%), #160A06",
    photo: { src: "/home/menu/pics/reddit-partnership.jpg", alt: "An aerial view of a city at night.", credit: "Denys Mikhalevych, Pexels", href: "https://www.pexels.com/photo/an-aerial-photography-of-city-buildings-at-night-12534226/" },
    links: [{ label: "Reddit", href: "https://www.reddit.com/" }, { label: "Reddit for Business", href: "https://www.business.reddit.com/" }],
    changelogId: "2026-09-17-vraelis-and-reddit",
  },
  {
    slug: "stripe-startups",
    name: "Stripe Startups",
    title: "Vraelis and Stripe Startups",
    established: "2026-10-08",
    firstContact: "2026-10-06",
    focus: "Startup program: Stripe Startups",
    summary: "Vraelis is part of Stripe Startups, Stripe's program for startups, joined through Supabase Select.",
    lede: "Vraelis is part of Stripe Startups, the program Stripe runs for startups.",
    means: [
      "Membership in the Stripe Startups program",
      "Stripe fee credits on Vraelis's Stripe account",
      "Stripe's startup benefits and resources",
    ],
    boundary: [
      "Does not cover or endorse Vraelis Contour or our security work",
      "Stripe does not review or certify Vraelis",
      "No exclusivity",
    ],
    logo: { src: "/v8/partners/stripe-startups-white.svg", w: 127, h: 15, alt: "Stripe Startups" },
    logoShown: true,
    logoMono: true,
    glow: "radial-gradient(80% 90% at 75% 20%, rgba(99,91,255,.5), transparent 65%), radial-gradient(60% 70% at 10% 100%, rgba(0,212,255,.2), transparent 70%), #0D0B26",
    photo: { src: "/home/menu/pics/stripe-partnership.jpg", alt: "A hand holding a black card.", credit: "cottonbro studio, Pexels", href: "https://www.pexels.com/photo/hand-holding-a-black-card-8657364/" },
    links: [{ label: "Stripe Startups", href: "https://stripe.com/startups" }, { label: "Stripe", href: "https://stripe.com/" }],
  },
];

export const PARTNERS_NOTE = "No partnership covers Vraelis Contour or endorses its security capabilities.";
export const partner = (slug: string) => PARTNERS.find((p) => p.slug === slug);

/** Whether a partner's official logo is shown: written permission on record, or the founder's decision to show it. */
export const showsLogo = (p: Partner) => !!(p.logoCleared || p.logoShown);
