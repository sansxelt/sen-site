# Vraelis

Vraelis is developing cybersecurity software for AI systems used in defense, critical infrastructure and robotics. Our research covers model integrity, adversarial threats, machine trust and security evidence.

**Vraelis Contour** is our first product direction: model release security for robotics suppliers and system integrators. The intended workflow connects the exact release and destination approval to what a managed service reports loading, preserving disagreements and missing evidence. It is in private development. Public workspace access is closed; a signed model or consistent report does not establish safe behavior or a trustworthy host.

## Public information

- [Company](https://vraelis.com/company) — who we are and our scope.
- [Vraelis Contour](https://vraelis.com/contour) — the first product direction.
- [Research](https://vraelis.com/research) and [documentation](https://vraelis.com/docs) — security concepts, current foundations and their limits.
- [Development status](https://vraelis.com/beta) and [security](https://vraelis.com/security).
- [Foremake](https://foremake.com/) — the parent company.

Industry landscape stories are editorial references to public technology. They do not identify customers, partners or supported integrations.

## Website development

This repository contains the Next.js website and earlier implementation references. The public layout has been restored to `app/dev-preview/v6`, served at canonical URLs by `proxy.ts`. The sitemap derives from those routes. The newer layout remains available under `/dev-preview/v7` for review, excluded from search.

```sh
npm ci
npm run dev
npm run build
```

The public layout uses `NEXT_PUBLIC_VRAELIS_V6_PUBLIC=1`. Preserve its navigation, scrolling and reduced-motion behavior. Illustrative product examples do not connect to a live runtime.

Metadata uses a shared social card, page-specific descriptions, canonical URLs, organization and breadcrumb structured data. Private workspace and retired implementation routes remain excluded from search. Current Markdown documentation is available at `/llms.txt` and `/llms-full.txt`.

## Implementation history

Earlier browser-verification, CLI, API and console code remains as implementation history, not an available product offer. See the [archived implementation README](docs/archive/browser-verification-readme.md) and [AI security foundation](docs/ai-security-foundation.md). Private strategy documents and model experiments remain outside this public release.

Deployment is through the existing `sen-site` Vercel project; pushes to `main` build production. Preserve auth, CSRF and private product access gates when changing public routes.
