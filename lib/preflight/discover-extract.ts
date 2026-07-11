// Deterministic HTML -> sanitized structured snapshot. Pure (no network/DB/deps). Extracts the observable
// product signals discovery needs (title, meta, headings, nav, forms, inputs, buttons, CTAs, capability
// indicators, roles, route paths, same-origin API refs, framework hints) WITHOUT persisting raw HTML,
// scripts, styles, tokens, or emails. Regex-based on purpose: dependency-free + bounded + testable. All
// output is size-capped so a hostile page cannot blow up storage.
// Path-only cleaner that works for RELATIVE paths too (drop fragment + query; keep the path).
const pathOnly = (h: string) => (h || "").split("#")[0].split("?")[0];

export type PageSnapshot = {
  url: string; status: number; title: string; metaDescription: string;
  headings: string[]; navLinks: { label: string; href: string }[]; links: string[];
  forms: { method: string; action: string; inputs: { name: string; type: string }[]; submitLabels: string[] }[];
  buttons: string[]; ctas: string[]; indicators: string[]; roles: string[]; apiRefs: string[]; framework: string | null;
};

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const clip = (s: string, n: number) => (s || "").replace(/\s+/g, " ").trim().replace(EMAIL, "[email]").slice(0, n);
const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean)));

// Capability indicators inferred from visible text/attributes (deterministic keyword presence, not AI).
const INDICATORS: [string, RegExp][] = [
  ["login", /\b(log ?in|sign ?in)\b/i], ["signup", /\b(sign ?up|register|create account|get started)\b/i],
  ["logout", /\b(log ?out|sign ?out)\b/i], ["pricing", /\b(pricing|plans?|subscribe|upgrade)\b/i],
  ["dashboard", /\bdashboard\b/i], ["create", /\b(create|new|add)\b/i], ["delete", /\b(delete|remove|trash)\b/i],
  ["upload", /\b(upload|drag and drop|choose file)\b/i], ["search", /\b(search|find)\b/i],
  ["billing", /\b(billing|invoice|payment|checkout|card)\b/i], ["settings", /\b(settings|preferences|account)\b/i],
  ["projects", /\bprojects?\b/i], ["export", /\b(export|download)\b/i], ["invite", /\b(invite|members?|team)\b/i],
];
const ROLES: RegExp[] = [/\b(admin|administrator)\b/i, /\b(owner)\b/i, /\b(member)\b/i, /\b(viewer|guest)\b/i, /\b(editor)\b/i, /\b(customer|client)\b/i];

function frameworkHint(html: string): string | null {
  if (/__NEXT_DATA__|\/_next\//.test(html)) return "nextjs";
  if (/data-reactroot|react/i.test(html) && /\bvite\b/i.test(html)) return "react-vite";
  if (/\/_nuxt\//.test(html)) return "nuxt";
  if (/data-sveltekit|__sveltekit/.test(html)) return "sveltekit";
  return null;
}

export function extractSnapshot(rawHtml: string, pageUrl: string, status = 200): PageSnapshot {
  // Strip scripts/styles/comments FIRST so their contents never leak into signals.
  const html = (rawHtml || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const framework = frameworkHint(rawHtml);
  const text = (s: string) => clip(s.replace(/<[^>]+>/g, " "), 120);

  const title = clip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ""), 200);
  const metaDescription = clip((html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] || ""), 300);
  const headings = uniq([...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => text(m[1]))).slice(0, 20);

  const anchors = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const navLinks = anchors.map((m) => ({ label: text(m[2]), href: clip(m[1], 300) })).filter((l) => l.label && !l.href.startsWith("javascript:")).slice(0, 40);
  const links = uniq(anchors.map((m) => m[1]).filter((h) => /^https?:\/\//.test(h) || h.startsWith("/"))).slice(0, 60);

  const forms = [...html.matchAll(/<form[\s\S]*?<\/form>/gi)].slice(0, 8).map((fm) => {
    const block = fm[0];
    const method = clip((block.match(/method=["']([^"']+)["']/i)?.[1] || "get").toUpperCase(), 8);
    const action = clip(pathOnly(block.match(/action=["']([^"']+)["']/i)?.[1] || "") || "self", 300);
    const inputs = [...block.matchAll(/<input[^>]*>/gi)].slice(0, 20).map((i) => ({ name: clip(i[0].match(/name=["']([^"']+)["']/i)?.[1] || "", 60), type: clip(i[0].match(/type=["']([^"']+)["']/i)?.[1] || "text", 20) })).filter((x) => x.name || x.type);
    const submitLabels = uniq([...block.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)].map((b) => text(b[1])).concat([...block.matchAll(/<input[^>]+type=["'](?:submit|button)["'][^>]+value=["']([^"']+)["']/gi)].map((b) => clip(b[1], 60)))).slice(0, 8);
    return { method, action, inputs, submitLabels };
  });

  const buttons = uniq([...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)].map((b) => text(b[1]))).filter(Boolean).slice(0, 30);
  const ariaLabels = [...html.matchAll(/aria-label=["']([^"']+)["']/gi)].map((m) => clip(m[1], 60));
  const ctas = uniq([...buttons, ...navLinks.map((l) => l.label), ...ariaLabels]).filter(Boolean).slice(0, 40);

  const hay = [title, metaDescription, ...headings, ...ctas, ...buttons].join(" ").toLowerCase();
  const indicators = INDICATORS.filter(([, re]) => re.test(hay)).map(([k]) => k);
  const roles = uniq(ROLES.filter((re) => re.exec(hay)).map((re) => (re.exec(hay)?.[1] || "").toLowerCase())).filter(Boolean).slice(0, 8);
  // Same-origin API references from static HTML: anchor links AND form actions that hit an /api path.
  const apiRefs = uniq([...links, ...forms.map((f) => f.action)].filter((h) => /\/api(\/|$)/.test(h)).map(pathOnly)).slice(0, 30);

  return { url: pageUrl, status, title, metaDescription, headings, navLinks, links, forms, buttons, ctas, indicators, roles, apiRefs, framework };
}
