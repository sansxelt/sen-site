# Public company website release

The public website presents Vraelis as a cybersecurity company focused on AI systems in defense, critical infrastructure and robotics. Vraelis Contour is the first product direction, in private development, for robotics suppliers and system integrators.

## Published surfaces

The reviewed design supplies the homepage, product, company, research, application areas, engineering guides, documentation, contact and trust pages. The homepage retains the newer security views and release comparison. Governments and contractors, suppliers and integrators, and infrastructure operators have separate reading paths. The rotating audience/company bar remains removed.

`lib/public-site.ts` defines canonical routes and redirects. Public requests rewrite into the reviewed design; direct promoted preview addresses redirect to public paths. Metadata supplies unique page titles, current descriptions, canonical URLs, shared wide social cards and WebPage/breadcrumb structured data. Organization data identifies Foremake as the parent. Current machine-readable documentation is available at `/llms.txt` and `/llms-full.txt`; archived implementation references remain excluded from search.

Industry landscape pages describe public technology. They do not imply customer, partner or integration relationships. Product examples use fictional records. Public product and workspace access remain closed.

Foremake's company directory, organization descriptions, machine-readable index and social metadata use the current Vraelis framing. Its homepage company blocks remain removed, and Overlym is unchanged.

## Verification

- Optimized Next.js build and ESLint passed.
- All 49 public routes returned canonical, indexable pages with unique titles and consistent search/Open Graph/Twitter descriptions. Archived docs, pricing and unknown guides remained excluded.
- Browser checks covered 48 page/viewport combinations at 1366, 901, 390 and 320 pixels: one visible page heading, shared navigation, no horizontal overflow or page errors.
- Menus and Escape, Contour scenario changes and keyboard tabs, documentation filtering and reduced motion passed. Contact intake and privacy requirements were checked without sending inquiries.
- Host routing, abuse limits, contact intake and synthetic policy checks passed. These website checks do not validate a production AI-security product.
- Foremake passed 18 page/viewport combinations with matching social metadata and the removed homepage blocks absent.

## Private work

Private strategy decisions, customer-discovery drafts and model-release experiments remain in the private working repository, as their release instructions require. The public README describes the current direction; earlier browser-verification implementation notes are archived separately.
