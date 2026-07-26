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
 * document. Next hoists and de-duplicates the tag, so mounting nested boundaries costs one request.
 *
 * VERSION QUERY: bump on every edit to authenticated.css. It is served from /public, so a stale copy
 * otherwise survives in browser caches and the CDN, which shows up as a half-themed page rather than a
 * clean failure.
 */
export const AUTHENTICATED_CSS = "/vraelis/authenticated.css?v=8";

export function ProductSurface({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href={AUTHENTICATED_CSS} />
      <div data-surface="app">{children}</div>
    </>
  );
}
