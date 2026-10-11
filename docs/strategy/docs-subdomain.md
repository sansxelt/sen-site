# docs.vraelis.com: what the owner has to do

The code is ready (2026-10-10): `proxy.ts` serves the v8 docs at the root of `docs.vraelis.com`
(`/` the docs home, `/<slug>` a page, `/md/<slug>.md` the Markdown twins, `/search-index`, `/ask`).
The existing `/dev-preview/v8/docs/...` addresses keep working. Nothing below has been done; it needs
the owner's DNS and Vercel access.

## 1. DNS (Cloudflare holds vraelis.com's DNS)

Add one record:

| Type  | Name | Target                 | Proxy status |
|-------|------|------------------------|--------------|
| CNAME | docs | cname.vercel-dns.com   | DNS only     |

Use "DNS only" (grey cloud), as for the other Vercel-hosted names. Vercel issues the certificate itself.

## 2. Vercel

Project `sen-site`, Settings, Domains, Add: `docs.vraelis.com`. Attach it to the production branch,
with no redirect (it must serve, not redirect to vraelis.com). Vercel will show the record from step 1
as the one it expects. Or with the CLI: `vercel domains add docs.vraelis.com`.

## 3. The docs assistant (Ask AI)

Nothing is needed for it to work. By default it is free: no model, no key, no API cost. It answers by
quoting the best-matching passages of the docs, verbatim, under "From the documentation", each linked to
its section.

Generated answers (Claude, from the same retrieved sections, with citations) are opt-in, and need both:

- `ANTHROPIC_API_KEY` (Vercel, Settings, Environment Variables; it is already in `.env.local`), and
- `DOCS_ASSISTANT_LLM=1` (the switch; without it the key is ignored and there is no API cost).

Optional: `DOCS_ASSISTANT_MODEL` (default `claude-sonnet-5-5`, an Anthropic model id). If a generated answer
fails, the endpoint falls back to quoting. Consider a monthly spend limit on the Anthropic key before turning
it on. The endpoint limits each IP to 8 questions a minute and 60 an hour (per server instance).

## 4. Checks after it is live

- `https://docs.vraelis.com/` shows the docs home with the docs header (link back to vraelis.com).
- `https://docs.vraelis.com/overview` renders; `https://docs.vraelis.com/dev-preview/v8/docs/overview`
  308s to `/overview`.
- While v8 is a preview, every docs-host response carries `X-Robots-Tag: noindex, nofollow`.
- Ask AI answers with numbered sources (quoted passages by default).

## Later, when v8 is promoted

Canonical links and the Markdown twins already name `https://docs.vraelis.com/<slug>`. Once the
subdomain is live, `vraelis.com/docs/*` can 308 to it, so the docs have one address.

Local testing: `http://docs.localhost:3100/` (browsers and curl resolve `*.localhost`). A preview domain
can be mapped with `VRAELIS_DOCS_HOSTS="docs-preview.example.com=https://preview.example.com"`.
