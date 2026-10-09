import type { MetadataRoute } from "next";
import { PUBLIC_SITE_PATHS } from "@/lib/public-site";
import { stealthConfigured } from "@/lib/stealth";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths: readonly string[] = stealthConfigured() ? ["/"] : PUBLIC_SITE_PATHS;
  return paths.map(path => ({
    url: `https://vraelis.com${path}`,
    changeFrequency: path === "/" || path === "/beta" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : ["/company", "/contour", "/research", "/docs"].includes(path) ? .8 : .5,
  }));
}
