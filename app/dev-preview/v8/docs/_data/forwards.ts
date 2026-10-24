// DOCS PAGES THAT LIVE ON THE SITE (founder, 2026-10-18: the docs must not repeat anything; where they would, they
// forward to the site page). Each slug here restated a vraelis.com page from the same data, so it is no longer a docs
// page: its old address redirects permanently (308) to the site page, and every docs link to it goes there directly
// (docsLink in links.ts). The sidebar, search, llms.txt, Markdown twins and Ask AI read PAGES, which leaves these out.
export const SITE_FORWARDS: Record<string, string> = {
  "company-and-brands": "/company",
  "partner-scope": "/partners",
  "security-and-disclosure": "/security",
  "privacy-and-data": "/privacy",
  "where-vraelis-is-offered": "/terms",
  "application-areas": "/applications",
  defense: "/applications/defense",
  "critical-infrastructure": "/applications/critical-infrastructure",
  "autonomous-systems": "/applications/autonomous-systems",
  government: "/applications/government",
  integrators: "/applications/integrators",
  status: "/status",
  sources: "/status",
  "release-notes": "/changelog",
  "model-integrity": "/research/model-integrity",
  "adversarial-threats": "/research/adversarial-threats",
  "machine-trust": "/research/machine-trust",
  "security-evidence": "/research/security-evidence",
};

/** The site page a docs path now forwards to, or null when it is still a docs page. */
export function siteForward(path: string): string | null {
  const m = /^\/docs\/([^/?#]+)/.exec(path);
  return m ? SITE_FORWARDS[m[1]] ?? null : null;
}
