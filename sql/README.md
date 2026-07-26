# Migrations

Numbered files in this directory are SCHEMA. They are additive, safe to re-run, and applied by hand in the
Supabase SQL editor. Historical DATA corrections are not migrations and do not live here; see `ops/`.

## There are two migration 19s

```
vraelis-preflight-19-guarantees.sql              Guarantees increment 1
vraelis-preflight-19-requirement-provenance.sql  requirement provenance
```

Both are applied to production. Neither is wrong, and there is no data problem: they touch different tables,
both are `if not exists` throughout, and re-running either is a no-op.

They collided because the two lines of work were developed on branches that could not see each other. The
provenance work was cut from `main`, which did not yet have the Guarantees increments; the Guarantees work
shipped to production without ever landing on `main`. Each picked the next free number in the tree it could
see, and both saw 19.

**Do not renumber them.** The names are recorded in `ops/ROLLOUT.md`, in the correction scripts, and in the
verification queries used during the provenance incident. A file that has been applied under one name and
then renamed makes those records wrong, which is a worse problem than an ambiguous ordinal.

## The real applied order

Numbers are not the order. This is:

| Applied | File | What |
|---|---|---|
| earlier | `19-guarantees.sql` | Guarantees durable object, status derivation, release rollup |
| 2026-07-25 | `19-requirement-provenance.sql` | provenance columns, additive and inert |
| 2026-07-25 | `20-provenance-defaults.sql` | honest defaults, 7 constraints, all NOT VALID |
| 2026-07-26 | `22-approved-review-state-consistency.sql` | approved matches review_state, NOT VALID |

There is no 21. It was the historical correction, which was moved out of the numbered path to
`ops/provenance-correction-MANUAL.sql` precisely so no runner could pick it up, and the number was retired
rather than reused. `scripts/preflight-provenance-integrity-verify.ts` fails the build if a 21 reappears.

## Next number

**Use 23.** Check this file and `ls sql/` first, and if you are working on a branch that does not contain
everything production runs, check the deployed tree too. That is the mistake that produced two 19s.

## Verifying what is actually applied

Numbers in filenames are intent. `ops/verify-schema.sql` reads what the database actually holds: column
defaults and constraint state, neither of which is visible over PostgREST.
