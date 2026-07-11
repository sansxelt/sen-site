# Vraelis Preflight worker

Long-running worker (deploy on **Railway** as its own service) that claims queued preflight runs from the
existing Postgres queue (`v_preflight_runs` + `v_preflight_claim()`), drives an **isolated Browserbase**
browser via Playwright over CDP, executes bounded approved flows, captures deterministic evidence, and
finalizes each run. Browserbase and Railway are **replaceable infrastructure**; Vraelis owns the run
model, evidence, contract, decisions, and reports.

## Architecture (all behind interfaces — both providers are swappable)

```
Vercel web app --enqueue--> Postgres queue --claim--> THIS worker --CDP--> Browserbase browser
                                   ^                        |
                                   +----- evidence/results--+ (private artifacts, signed URLs)
```

- `BrowserProvider` (`providers/browserbase.ts` real, `providers/fake.ts` deterministic) — the worker never
  imports vendor code outside a provider.
- `RunStore` (`run-store-postgres.ts` real, `run-store-fake.ts` in-memory) — the queue behind an interface.
- `execute-run.ts` — the bounded executor (semantic step allowlist, per-step ownership-checked heartbeat,
  explainable decision, always closes the session).

## Status
- Lifecycle proven end-to-end with the fakes: `npm run preflight:worker:test` (26/26 — claim, lease,
  session, flows, incremental persistence, decision, charge-on-completion, close, plus provider-fail,
  cancel, lease-loss, close-throws, requeue, recovery, max-attempts; no run ever left stuck).
- The Postgres store + Browserbase provider are IMPLEMENTED but NOT yet integration-tested (the additive
  migration is unapplied and there is no Browserbase session yet). `npm run preflight:verify-db` must pass
  and `BROWSERBASE_API_KEY` must be set before a real run.

## Env (server-only — see .env.preflight.example)
`BROWSER_PROVIDER=browserbase | fake`, `BROWSERBASE_API_KEY` (the project is inferred from the key),
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, plus the `PREFLIGHT_WORKER_*` / `PREFLIGHT_MAX_*`
bounds. A missing `BROWSERBASE_API_KEY` under `BROWSER_PROVIDER=browserbase` fails startup clearly.

## Commands
- `npm run preflight:worker`      start the worker (uses BROWSER_PROVIDER)
- `npm run preflight:worker:test` deterministic lifecycle test (fakes; no DB/browser/creds)
- `npm run preflight:verify-db`   read-only DB readiness check
