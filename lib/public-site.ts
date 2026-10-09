/** Canonical routes for the current public site. Private workspace routes are separate. */
export const PUBLIC_SITE_PATHS = [
  "/", "/company", "/contour", "/contact", "/beta", "/solutions", "/research", "/docs",
  "/defense", "/infrastructure", "/robotics", "/government", "/integrators", "/enterprise",
  "/model-integrity", "/adversarial-security", "/zero-trust", "/recorded-evidence", "/platform", "/problems", "/goals",
  "/guides/model-release-security", "/guides/operating-constraints", "/guides/ai-security-evaluation",
  "/docs/ai-security", "/docs/contour-release-security", "/docs/recorded-reports",
  "/technology", "/technology/vercel", "/technology/supabase", "/technology/onnx-runtime",
  "/landscape", "/landscape/palantir", "/landscape/anduril", "/landscape/googledeepmind", "/landscape/cloudflare", "/landscape/nvidia",
  "/security", "/limitations", "/privacy", "/terms", "/cookies", "/acceptable-use", "/refunds", "/subprocessors", "/data-rights", "/trademark", "/changelog", "/image-sources",
] as const;
export const PUBLIC_SITE_ROUTES: Record<string, string> = Object.fromEntries(
  PUBLIC_SITE_PATHS.map(path => [path, `/dev-preview/v7${path === "/" ? "" : path}`]),
);
export const PUBLIC_SITE_REDIRECTS: Record<string, string> = {
  "/solutions/defense": "/defense", "/solutions/fleets": "/robotics", "/solutions/public-sector": "/infrastructure",
  "/developers": "/docs", "/developers/api": "/docs", "/developers/cli": "/docs", "/integrations": "/technology",
  "/ai-workloads": "/platform", "/agents": "/zero-trust", "/method": "/company", "/readme": "/company",
  "/how-it-works": "/contour", "/guides": "/research", "/free-report": "/contour", "/demo": "/contact",
};
