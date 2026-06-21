import type { Metadata } from "next";

// Consistent Open Graph + Twitter metadata for Vraelis public pages. The OG
// image is the dynamic 1200×630 card at /og (see app/og/route.tsx).
const OG_IMAGE = { url: "/og", width: 1200, height: 630, alt: "Vraelis — test generated content with real users" };

export function ogMeta({ title, description, path = "/", index = true, image }: { title: string; description: string; path?: string; index?: boolean; image?: string }): Metadata {
  const url = `https://vraelis.com${path}`;
  const img = image ? { url: image, width: 1200, height: 630, alt: title } : OG_IMAGE;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, siteName: "Vraelis", title, description, images: [img] },
    twitter: { card: "summary_large_image", title, description, images: [image || "/og"] },
    robots: { index, follow: index },
  };
}
