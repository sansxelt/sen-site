import type { Metadata } from "next";
import { socialCard, SOCIAL_DESCRIPTION } from "@/lib/social-card";
import { robotsMeta } from "@/lib/stealth";
import { getDoc } from "../v6/_content/docs";
import { GUIDES } from "../v6/_content/guides";
import { SECURITY_PAGES } from "../v6/_content/security-direction";
import { SCOPE_CONTENT } from "./scope-content";
import { LANDSCAPE } from "./landscape";
import { PROVIDERS } from "./content";

const pages: Record<string, [string, string]> = {
  "": ["Vraelis | AI security for physical systems", SOCIAL_DESCRIPTION],
  company: ["About Vraelis", "Who we are, our AI cybersecurity scope in defense, critical infrastructure and robotics, and Vraelis Contour as our first product direction."],
  contour: ["Vraelis Contour | Model release security", "Model release security for robotics suppliers and system integrators. Connect approved releases to managed service reports. In private development."],
  contact: ["Join us | Vraelis", "Talk with Vraelis about AI security in defense, infrastructure and robotics. Share your system, role and requirements with our team."],
  beta: ["Development status | Vraelis", "Review Vraelis Contour's private reference experiment, current foundations, integration work and development limits. Public workspace access is closed."],
  solutions: ["Application areas | Vraelis", "AI security for governments, contractors, suppliers, system integrators and operators in defense, critical infrastructure and robotics."],
  research: ["Research | Vraelis", "Explore Vraelis's research into model integrity, adversarial threats, machine trust and security evidence, with guides and primary references."],
  docs: ["Documentation | Vraelis", "Current Vraelis engineering references: company scope, Vraelis Contour model release security and recorded evidence. Product access remains closed."],
  technology: ["Technology in use | Vraelis", "Explore the hosting and engineering dependencies used in Vraelis's website, backend code and private ONNX CPU reference experiment."],
  landscape: ["Industry landscape | Vraelis", "Editorial references to public work in AI, autonomy and security. Explore Palantir, Anduril, Google DeepMind, Cloudflare and NVIDIA."],
  changelog: ["Changelog | Vraelis", "Current website and documentation updates, with dated earlier implementation history. Vraelis Contour remains in private development."],
  "image-sources": ["Image sources | Vraelis", "Sources and credits for Vraelis photography, original illustrative artwork and context footage."],
  security: ["Security | Vraelis", "Vraelis security information, current development limits and how to report a security issue."],
  limitations: ["Scope and limitations | Vraelis", "Understand the boundaries of Vraelis's private development, supplied evidence and managed service reports. No universal AI security or safety certification is claimed."],
  privacy: ["Privacy | Vraelis", "What Vraelis collects, how information is used and the privacy rights that may apply to you."],
  terms: ["Terms | Vraelis", "Terms for using the Vraelis website and references, including availability, limitations and applicable responsibilities."],
  cookies: ["Cookies | Vraelis", "Vraelis cookies and browser storage, their purposes and how to change your privacy choices."],
  "acceptable-use": ["Acceptable use | Vraelis", "The acceptable use policy for Vraelis services and website."],
  refunds: ["Refunds | Vraelis", "Vraelis refund policy and contact information. Public product access is currently closed."],
  subprocessors: ["Subprocessors | Vraelis", "Third-party service providers used in Vraelis's implementation and their data processing roles."],
  "data-rights": ["Data rights | Vraelis", "How to contact Vraelis about access, correction, deletion and other applicable privacy rights."],
  trademark: ["Trademark | Vraelis", "Information about the Vraelis name, marks and use of brand materials."],
};
export function pageInfo(path: string[]) {
  const key = path.join("/");
  if (path[0] === "docs" && path[1]) {
    const doc = getDoc(path[1]); if (doc) return { title: `${doc.title} | Documentation`, description: doc.summary };
  }
  if (path[0] === "guides" && path[1]) {
    const guide = GUIDES.find(g => g.slug === path[1]); if (guide) return { title: `${guide.title} | Vraelis`, description: guide.intro };
  }
  if (path[0] === "landscape" && path[1]) {
    const company = LANDSCAPE.find(c => c.slug === path[1]); if (company) return { title: `${company.name} | Industry landscape`, description: `${company.headline} An editorial reference to public technology, with context for Vraelis's research.` };
  }
  if (path[0] === "technology" && path[1]) {
    const provider = PROVIDERS.find(c => c.slug === path[1]); if (provider) return { title: `${provider.name} | Vraelis technology`, description: provider.body };
  }
  const direction = SCOPE_CONTENT[key] ?? SECURITY_PAGES[key];
  const [title, description] = pages[key] ?? (direction ? [`${direction.title.replace(/\.$/, "")} | Vraelis`, direction.intro] : ["Page not found | Vraelis", "This page could not be found."]);
  return { title, description };
}
export function publicMetadata(path: string[], exists: boolean): Metadata {
  const { title, description } = pageInfo(path);
  const url = `https://vraelis.com/${path.join("/")}`;
  const card = socialCard(title, description);
  return { title: { absolute: title }, description, robots: robotsMeta(exists), alternates: { canonical: exists ? url : null }, ...card, openGraph: { ...card.openGraph, type: "website", url } };
}
export function pageJsonLd(path: string[]) {
  const { title, description } = pageInfo(path);
  const url = `https://vraelis.com/${path.join("/")}`;
  const crumbs = [{ "@type": "ListItem", position: 1, name: "Vraelis", item: "https://vraelis.com/" }];
  if (path.length) crumbs.push({ "@type": "ListItem", position: 2, name: title.split(" | ")[0], item: url });
  return JSON.stringify({ "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", "@id": `${url}#page`, url, name: title, description, isPartOf: { "@id": "https://vraelis.com/#website" }, about: { "@id": "https://vraelis.com/#organization" } },
    { "@type": "BreadcrumbList", itemListElement: crumbs },
  ] }).replace(/</g, "\\u003c");
}
