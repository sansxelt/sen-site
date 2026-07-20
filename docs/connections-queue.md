# Connections queue

Not a roadmap. A holding pen, so ideas stop getting re-litigated and stop getting built on impulse.

**The rule: nothing here gets built until either the benchmark is done, or a real person asks for it
unprompted.** Every connection is cheap to add and expensive to be wrong about, because each one is a token
that something has to actually read. We already learned this the slow way with Supabase: the OAuth took a
day, and the reader was the part that mattered.

---

## Queued

### Sentry
**State: code exists, not live.** The provider is registered and the OAuth flow works; it renders no Connect
button because `SENTRY_OAUTH_CLIENT_ID` / `SENTRY_OAUTH_CLIENT_SECRET` are unset.

What it would do: pull runtime errors from the deployment under test and attach them to a run, so a failed
flow can point at the exception behind it instead of only the symptom the browser saw.

Why it is not on: the token has no consumer. Turning it on today adds a card that collects a credential and
reads it never, which is the thing the truth pass removed everywhere else.

Build the reader first, then the credentials. Not the other way round.

### Lovable
**State: not started.**

What it would do: the same job Vercel does, a deployment-URL source, so someone who built on Lovable can
point Vraelis at their live app without copying a URL.

Worth being precise about what this is and is not. It is convenience, not capability. Vraelis already checks
a Lovable app today, because it works from outside and needs nothing but a URL. That independence is the
pitch, so an integration must never become a prerequisite.

Why it is not on: nobody has asked. It becomes obviously worth building the moment a Lovable user says
pasting the URL is the annoying part.

---

## Already built, so nobody re-adds them

GitHub, Vercel, Stripe, Supabase (gated behind `SUPABASE_OAUTH_ENABLED`), Slack, webhooks, custom deploy,
custom auth, OpenAPI, sealed test accounts.

## Considered and deliberately not queued

Linear, GitLab, Cloudflare, Jira, Netlify, PostHog, Datadog, Railway, Render.

All reasonable. All the same failure: each is a credential rather than a feature, and the value in every case
lives in a consumer that does not exist. A directory of integrations is what a product builds when it is
avoiding the question of whether anyone wants the core thing.

---

## What actually unblocks this list

The benchmark (`benchmark-outcome-chain-v2.md`) measures which failures are invisible from the browser alone.
That number says which readers are worth building, and therefore which connections are worth having. Until it
runs, anything here is a guess with a login screen attached.
