// Shared connection brand marks + honest "coming later" chips, extracted from the connect workspace so
// the connection management page renders the exact same visual language. No "use client" directive on
// purpose (same convention as app/rank/_components/icons.tsx): server components render these as static
// SVG, and client components can import them too.
//
// Real integration icons, fully inline (no CDN, no broken images): official brand marks from Simple
// Icons (CC0), plus hand-drawn glyphs for the generic kinds, all on one tile.
//
// COLOURS ARE THE ON-DARK MARKS. Both importers live under app/rank/app, so these only ever render inside
// the product, which is graphite. GitHub's #181717 and Vercel's #000000 are their marks for LIGHT grounds
// and are all but invisible on #121214, so each brand's own on-dark mark is used instead: white for the
// monochrome logos, unchanged for the ones that already carry on dark. This is the brands' documented
// behaviour, not a recolour of them. If one of these ever renders on a light surface again, it needs the
// light value back.
export const BRAND_PATHS: Record<string, { d: string; color: string }> = {
  github: { color: "#FFFFFF", d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" },
  vercel: { color: "#FFFFFF", d: "M24 22.525H0l12-21.05 12 21.05z" },
  supabase: { color: "#3FCF8E", d: "M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z" },
  stripe: { color: "#635BFF", d: "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" },
  sentry: { color: "#FFFFFF", d: "M13.91 2.505c-.873-1.448-2.972-1.448-3.844 0L6.904 7.92a15.478 15.478 0 0 1 8.53 12.811h-2.221A13.301 13.301 0 0 0 5.784 9.814l-2.926 5.06a7.65 7.65 0 0 1 4.435 5.848H2.194a.365.365 0 0 1-.298-.534l1.413-2.402a5.16 5.16 0 0 0-1.614-.913L.296 19.275a2.182 2.182 0 0 0 .812 2.999 2.24 2.24 0 0 0 1.086.288h6.983a9.322 9.322 0 0 0-3.845-8.318l1.11-1.922a11.47 11.47 0 0 1 4.95 10.24h5.915a17.242 17.242 0 0 0-7.885-15.28l2.244-3.845a.37.37 0 0 1 .504-.13c.255.14 9.75 16.708 9.928 16.9a.365.365 0 0 1-.327.543h-2.287c.029.612.029 1.223 0 1.831h2.297a2.206 2.206 0 0 0 1.922-3.31z" },
};

const GLYPH = { fill: "none", stroke: "var(--fg-2)", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
export const GLYPHS: Record<string, React.ReactNode> = {
  deploy: <svg width="16" height="16" viewBox="0 0 24 24" {...GLYPH}><rect x="3" y="4" width="18" height="7" rx="1.5" /><rect x="3" y="13" width="18" height="7" rx="1.5" /><path d="M7 7.5h.01M7 16.5h.01" /></svg>,
  auth: <svg width="16" height="16" viewBox="0 0 24 24" {...GLYPH}><path d="M12 3l7 3v5c0 4.4-3 8.4-7 10-4-1.6-7-5.6-7-10V6z" /></svg>,
  key: <svg width="16" height="16" viewBox="0 0 24 24" {...GLYPH}><circle cx="7.5" cy="15.5" r="3.5" /><path d="M10.5 12.5 21 3M16 5l3 3" /></svg>,
  webhook: <svg width="16" height="16" viewBox="0 0 24 24" {...GLYPH}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>,
  code: <svg width="16" height="16" viewBox="0 0 24 24" {...GLYPH}><path d="M8 9l-3 3 3 3M16 9l3 3-3 3" /></svg>,
};

// provider kind -> the mark name Mark() knows (brand path or glyph).
export const PROVIDER_MARK: Record<string, string> = {
  github: "github", vercel: "vercel", supabase: "supabase", stripe_test: "stripe", sentry: "sentry",
  custom_deploy: "deploy", custom_auth: "auth", webhook: "webhook", test_account: "key", openapi: "code",
};

export function Mark({ text }: { text: string }) {
  const brand = BRAND_PATHS[text];
  return (
    <span aria-hidden style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: "var(--bg-1)", border: "1px solid var(--line-2)", display: "grid", placeItems: "center" }}>
      {brand ? <svg width="16" height="16" viewBox="0 0 24 24" fill={brand.color}><path d={brand.d} /></svg> : (GLYPHS[text] ?? null)}
    </span>
  );
}

// Honest "not built yet" chips: compact, never button-shaped, never dominating a section.
export function ComingLater({ names }: { names: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 2 }}>
      <span style={{ fontSize: 11.5, color: "var(--fg-5)" }}>Coming later:</span>
      {names.map((n) => <span key={n} className="pill" style={{ fontSize: 10, color: "var(--fg-4)", background: "var(--bg-2)", borderColor: "var(--line-2)" }}>{n}</span>)}
    </div>
  );
}
