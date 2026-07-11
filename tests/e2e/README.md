# Upload flow E2E (Playwright)

Browser tests for the **flag-on** AI-Output-Check upload flow. They run against a preview (or a local
dev server) where `NEXT_PUBLIC_VRAELIS_UPLOADS=1` — **never** production, where the flag stays OFF.

These are **authored but not yet executed** — Playwright is not installed in this repo and there is no
flag-on preview yet. Nothing here has been browser-verified. Do not claim otherwise until `test:e2e`
runs green against a real preview.

## One-time install

```bash
npm i -D @playwright/test
npm run test:e2e:install     # downloads chromium + webkit
```

## Auth (do not weaken auth to make tests pass)

Auth is a saved `storageState`, produced once by signing in as a **funded test account** on the preview:

```bash
# In a headed browser, sign in, then save state:
npx playwright open --save-storage=.auth/state.json <preview-url>/signin
# Second account for the cross-owner security case (33):
npx playwright open --save-storage=.auth/state-b.json <preview-url>/signin
```

`.auth/` is gitignored (see below). Never commit storageState or credentials.

## Run

```bash
# Against a preview:
PLAYWRIGHT_BASE_URL="https://<preview>.vercel.app" \
VRAELIS_E2E_STORAGE_STATE=.auth/state.json \
VRAELIS_E2E_STORAGE_STATE_B=.auth/state-b.json \
npm run test:e2e

# Against a local flag-on dev server (starts it for you):
PLAYWRIGHT_LOCAL=1 VRAELIS_E2E_STORAGE_STATE=.auth/state.json npm run test:e2e
```

Without `VRAELIS_E2E_STORAGE_STATE`, authed specs **skip** (they don't fail); the few unauthenticated
assertions still run.

## Coverage (34 cases)

- `01-form-and-uploads.spec.ts` — cases 1–18: form loads, text-only stays functional, drag/multiselect/
  keyboard reorder, refresh persistence, PDF/TXT/MD readiness, DOCX "not supported yet", oversized +
  encrypted errors, remove/retry/replace, context separation, dynamic summary counts, CTA gating.
- `02-checks-and-evidence.spec.ts` — cases 19–30: real screenshot/PDF/mixed checks, comparison winner,
  evidence chips (dormant until model-produced evidence is wired — asserted when present), capability
  labels, no-charge failure UI, duplicate-submit dedupe, completed replay.
- `03-responsive-a11y-security.spec.ts` — cases 31–34: mobile layout (no h-scroll), keyboard-only
  reorder, focus-trapped preview dialog, cross-owner preview denial (API boundary, needs 2 accounts),
  delete-check access removal (pending the delete-check route in the preview).

## Notes

- Evidence-chip cases are **conditional**: model-produced structured evidence is deferred, so chips are
  dormant in the current build. The specs assert the chip path **when evidence is present** and annotate
  a note otherwise — they never fake a pass.
- Case 34 needs a delete-check route in the preview; the underlying byte-purge is unit-covered by
  `scripts/cleanup-verify.ts`.
