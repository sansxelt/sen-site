import type { Metadata } from "next";

// Consistent Open Graph + Twitter metadata for Vraelis public pages. The OG
// image is the dynamic 1200×630 card at /og (see app/og/route.tsx). The ?v= busts the
// IMAGE-level cache (the CDN + platforms that key on the image URL) when the card changes.
// It does NOT force a platform that already cached the PAGE to re-scrape: X and others key
// their card cache on the PAGE URL, so to refresh an already-shared card you version the
// PAGE URL (e.g. /r/check?v=2) or use a platform's re-scrape tool where one exists.
const OG_IMAGE_URL = "/og?v=5";
const OG_IMAGE = { url: OG_IMAGE_URL, width: 1200, height: 630, alt: "Vraelis" };

// noImage: emit a TEXT-ONLY card (no og:image, twitter card 'summary'). Used on the homepage because
// LinkedIn hard-caches a domain's OG image and would not release a stale headline render across several
// ?v bumps; a text card always shows the current title + description instead of a frozen image.
export function ogMeta({ title, description, path = "/", index = true, image, noImage = false }: { title: string; description: string; path?: string; index?: boolean; image?: string; noImage?: boolean }): Metadata {
  const url = `https://vraelis.com${path}`;
  const img = image ? { url: image, width: 1200, height: 630, alt: title } : OG_IMAGE;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: noImage
      ? { type: "website", url, siteName: "Vraelis", title, description }
      : { type: "website", url, siteName: "Vraelis", title, description, images: [img] },
    twitter: noImage
      ? { card: "summary", title, description }
      : { card: "summary_large_image", title, description, images: [image || OG_IMAGE_URL] },
    robots: { index, follow: index },
  };
}
