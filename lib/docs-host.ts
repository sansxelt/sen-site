// THE DOCS HOST (docs.vraelis.com), founder 2026-10-10: "docs are a different part".
//
// The v8 docs are one route tree (app/dev-preview/v8/docs). proxy.ts serves that same tree at the root of the docs
// host, so docs.vraelis.com/overview renders exactly what /dev-preview/v8/docs/overview renders. The page cannot see
// which address the visitor used once the request has been rewritten, so the proxy says so in a request header whose
// value is the main site's origin (where "back to Vraelis" and every non-docs link must go). The proxy deletes any
// incoming copy of the header first, so a visitor cannot claim to be on the docs host from the main one.
//
// Recognised hosts:
//   docs.vraelis.com           -> https://vraelis.com            (production; needs the CNAME in docs/strategy/docs-subdomain.md)
//   docs.localhost[:port]      -> http://localhost[:port]        (local testing; browsers and curl resolve *.localhost)
//   VRAELIS_DOCS_HOSTS entries -> as written                     (a preview domain, e.g. "docs-preview.example.com=https://preview.example.com")

export const DOCS_MAIN_HEADER = "x-vraelis-docs-main";

/** Where the docs live once the host is set up: canonical links and the Markdown twins point here. */
export const DOCS_ORIGIN = "https://docs.vraelis.com";

/** The physical route tree both hosts render. */
export const DOCS_TREE = "/dev-preview/v8/docs";

const ORIGIN_RE = /^https?:\/\/[a-z0-9.-]+(?::\d{1,5})?$/i;

function extraHosts(): Map<string, string> {
  const out = new Map<string, string>();
  for (const pair of (process.env.VRAELIS_DOCS_HOSTS ?? "").split(",")) {
    const [h, o] = pair.split("=").map((s) => s?.trim().toLowerCase());
    if (h && o && ORIGIN_RE.test(o)) out.set(h, o.replace(/\/$/, ""));
  }
  return out;
}

/** The main site's origin when `host` is a docs host, else null. */
export function docsMainOrigin(host: string): string | null {
  const h = host.trim().toLowerCase();
  if (h === "docs.vraelis.com") return "https://vraelis.com";
  const local = /^docs\.(localhost(?::\d{1,5})?)$/.exec(h);
  if (local) return `http://${local[1]}`;
  return extraHosts().get(h) ?? null;
}

/** A header value is only trusted when it looks like an origin (the proxy is the only writer). */
export function validMainOrigin(v: string | null | undefined): string | null {
  return v && ORIGIN_RE.test(v) ? v : null;
}
