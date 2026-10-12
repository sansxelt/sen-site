import type { Metadata } from "next";
import { socialCard } from "@/lib/social-card";
import { robotsMeta } from "@/lib/stealth";

// Metadata for v8 pages. While v8 is a preview under /dev-preview/v8 every page is noindex; the values are real
// so link previews can be checked. Canonicals point at the clean production paths the pages will live at.
const v8Public = process.env.NEXT_PUBLIC_VRAELIS_V8_PUBLIC === "1";
const ORIGIN = "https://vraelis.com";

export function v8meta(o: { title: string; description: string; path: string; index?: boolean }): Metadata {
  const url = `${ORIGIN}${o.path}`;
  const docs = o.path === "/docs" || o.path.startsWith("/docs/");
  const title = /vraelis/i.test(o.title) ? o.title : `${o.title} | ${docs ? "Vraelis docs" : "Vraelis"}`;
  const kind = docs ? "docs" : o.path === "/contour" || o.path.startsWith("/contour/") ? "contour" : "site";
  const card = socialCard(title, o.description, kind);
  return {
    title: o.title.startsWith("Vraelis") ? { absolute: o.title } : o.title,
    description: o.description,
    alternates: { canonical: url },
    robots: robotsMeta(v8Public && o.index !== false),
    openGraph: { ...card.openGraph, siteName: docs ? "Vraelis docs" : card.openGraph.siteName, type: "website", url },
    twitter: card.twitter,
  };
}
