import type { ReactNode } from "react";

/* THE PRODUCT THEME BOUNDARY.
 *
 * One component, three mount points: the signed-in app (app/rank/app), the auth round-trip (app/auth), and
 * sign-in itself (app/signin). Everything inside renders on the design-06 graphite token layer in
 * public/vraelis/authenticated.css; everything outside keeps the public tokens from styles.css.
 *
 * It exists as a component rather than as three copies of a <link> and a <div> because the previous
 * arrangement drifted apart without anyone noticing: the app layout mounted a boundary, the two auth
 * layouts never did, and the theme file they pointed at had gone dead anyway. A single import means a
 * fourth surface cannot be added while quietly forgetting the theme.
 *
 * The stylesheet is loaded here rather than globally so the authenticated tokens never reach a public
 * document. It carries a `precedence`, which is what actually buys the hoisting and de-duplication this
 * note used to claim came for free: nested boundaries cost one request, and the tree waits for the sheet.
 *
 * VERSION QUERY: bump on every edit to authenticated.css. It is served from /public, so a stale copy
 * otherwise survives in browser caches and the CDN, which shows up as a half-themed page rather than a
 * clean failure.
 */
export const AUTHENTICATED_CSS = "/vraelis/authenticated.css?v=8";

export function ProductSurface({ children }: { children: ReactNode }) {
  return (
    <>
      {/* THE CANVAS, PINNED IN THE DOCUMENT ITSELF, not in the linked sheet below.
       *
       * authenticated.css already sets --canvas and --canvas-scheme, which the root layout's inline paint
       * reads. That is correct once the sheet has applied — and it is a LINKED stylesheet, so until it does
       * the same inline paint falls back to cream and color-scheme:light. That gap is a real white frame
       * every time someone arrives here from a dark page, which is exactly the walk from the site to
       * sign-in. Being render-blocking does not help: the browser still paints its own canvas from the
       * colour scheme before it has any of the page.
       *
       * This <style> is part of the HTML payload, so it applies while the document is being parsed, with no
       * network in the way. Same device the v6 shell uses for its route canvas, for the same reason. */}
      <style>{"html, body { background: #0A0A0B !important; color-scheme: dark !important; }"}</style>
      {/* precedence IS WHAT MAKES THE SHEET BLOCKING. Without it React treats this as an ordinary element:
          no hoisting into the head, and no suspending the tree that needs it. On a hard load that is
          survivable, because the inline <style> above has already pinned the canvas. On a SOFT navigation
          from the public site (the v6 nav links at _system/shell.tsx:460-461 are next/link) there is no
          document swap, so the auth tree can commit and paint while authenticated.css is still in flight,
          against the cream tokens the previous route left resolved, inside a canvas the rule above has
          already forced to black. Cream type on black is the same one-frame wrongness the inline <style>
          exists to prevent, arriving through the other door. With a precedence React hoists the tag and
          suspends on it, so the first frame of the authenticated tree is the first frame that has its
          tokens. "high" only orders this sheet against other precedence-carrying sheets; it is the presence
          of the prop that matters. */}
      <link rel="stylesheet" href={AUTHENTICATED_CSS} precedence="high" />
      <div data-surface="app">{children}</div>
    </>
  );
}
