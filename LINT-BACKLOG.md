# Lint backlog

**Lint is not green, and nothing in this repository claims otherwise.**

The security remediation introduced **zero** ESLint errors. Every error below predates it. This file exists
so that "not green" is a precise, actionable number rather than a shrug.

| Measurement | Errors | Warnings | Files |
|---|---:|---:|---:|
| `main@f09d1bc7` (baseline) | **186** | 86 | 96 |
| `security-remediation-2026-08-24` (current) | **186** | 81 | 94 |
| **Delta introduced by the remediation** | **+0** | **−5** | −2 |

Problems in files the remediation touched: **0 errors, 0 warnings**, across all 114 touched files.

Baseline data: [`scripts/lint-baseline.json`](scripts/lint-baseline.json) — per-file counts, measured on
`main`. Enforced by [`scripts/gates.ts`](scripts/gates.ts), which fails on any *regression* against it and
prints the inherited count as still-open on every run.

## Exact commands

```bash
# Reproduce the totals (JSON is authoritative — a text grep for " error " miscounts)
npx eslint . -f json > lint.json

# The gate: fails on regression, never claims global green
npx tsx scripts/gates.ts            # everything
npx tsx scripts/gates.ts --quick    # skip build + Docker suites

# Re-measure the baseline. A deliberate act — never do this to turn a red gate green.
npx tsx scripts/gates.ts --write-baseline
```

## Categorization — 186 errors, all accounted for

Counts are computed from the JSON report, not tallied by hand. `121 + 21 + 44 = 186`, nothing unclassified.

### 1. Out of scope — 121 errors, 18 files

Not compiled into the shipped app. Fixing them changes nothing that ships.

| Rule | Count |
|---|---:|
| `react/jsx-no-undef` | 86 |
| `react/no-unescaped-entities` | 27 |
| `react-hooks/set-state-in-effect` | 6 |
| `react-hooks/preserve-manual-memoization` | 1 |
| `@typescript-eslint/no-require-imports` | 1 |

Where they live, and why they are not shipped:

- **`App.jsx`, `Lower.jsx`, `Sections.jsx`, `Hero.jsx`** (repo root) — design mockups. Tracked, but
  **nothing imports them**: the only `import App from "./App"` in the repo is `desktop/src/main.tsx:3`,
  which resolves to `desktop/src/App.tsx`. Next compiles only under `app/`, and `next.config.ts` sets no
  `pageExtensions`. `tsconfig.json` includes only `.ts`/`.tsx`, so they are never typechecked either.
- **`Vraelis Design System/` and `Vraelis Design System (1)/`** — a duplicated design-system folder (100
  tracked files). Its `.jsx` files are loaded only by its own `index.html` through in-browser Babel
  `<script type="text/babel">`. That is *why* `jsx-no-undef` fires: they reference globals (`Reveal`,
  `React`, `FeatureRow`) supplied by sibling script tags, which ESLint's module scope cannot see.
- **`app/dev-preview/**`** — internal prototypes.
- **`sdk/typescript/dist/index.cjs`** — generated output. It is gitignored *and* untracked, and
  `tsconfig.json` excludes `sdk`. It is linted only because ESLint flat config does **not** read
  `.gitignore`, and `eslint.config.mjs:9-15` narrows the default ignores to
  `.next/ out/ build/ next-env.d.ts`.

**Recommended fix — config, not code.** Add to `globalIgnores` in `eslint.config.mjs`:

```js
"*.jsx",                    // root-level design mockups
"Vraelis Design System*/**",
"app/dev-preview/**",
"**/dist/**",
```

That removes **121 of 186 errors (65%)** without editing a line of shipped code. It is left undone here
because deciding what gets linted is a repository-policy call for the owner, not something a security
remediation should quietly change. The duplicated `Vraelis Design System (1)/` folder is probably worth
deleting outright.

### 2. Mechanical — 21 errors, 11 files

Local fixes that cannot change behaviour.

| Rule | Count | Where | Fix |
|---|---:|---|---|
| `@typescript-eslint/no-require-imports` | 9 | `scripts/key-usage-verify.ts` (5), `preflight-deployment-reach-verify.ts`, `preflight-oauth-state-verify.ts`, `preflight-routes-verify.ts`, `preflight-teams-verify.ts` | Hoist one `import { readFileSync } from "node:fs"` to the top of each file. Same module, same timing. |
| `react/no-unescaped-entities` | 5 | `components/landing/copilot-section.tsx` (2), `components/landing/workspace-section.tsx`, `desktop/src/update-ui.tsx` (2) | Replace `'` with `&apos;`, `"` with `&quot;`. |
| `@typescript-eslint/no-explicit-any` | 4 | `scripts/preflight-api-key-lifecycle.ts` | Declare the real response shape. |
| `prefer-const` | 2 | `lib/preflight/reviewed-plan-db.ts`, `lib/v-applications.ts` | Bindings never reassigned. |
| `react/jsx-no-comment-textnodes` | 1 | — | A comment being rendered as text. |

**`eslint --fix` does not fix any of these.** Verified against the JSON report: every
`no-unescaped-entities` message has `fix: null` and carries only `suggestions`, which plain `--fix`
ignores. Budget them as hand edits, not as a one-line command.

```bash
npx eslint scripts/key-usage-verify.ts scripts/preflight-deployment-reach-verify.ts \
  scripts/preflight-oauth-state-verify.ts scripts/preflight-routes-verify.ts \
  scripts/preflight-teams-verify.ts scripts/preflight-api-key-lifecycle.ts \
  lib/preflight/reviewed-plan-db.ts lib/v-applications.ts \
  components/landing/copilot-section.tsx components/landing/workspace-section.tsx \
  desktop/src/update-ui.tsx
```

### 3. Behavioral — 44 errors, 22 files

Each needs a judgement call; fixing them can change what renders, or when.

| Rule | Count | Why it is not mechanical |
|---|---:|---|
| `react-hooks/set-state-in-effect` | 23 | Worst: `app/rank/_components/rank-ui.tsx` (5), `app/rank/app/admin/page.tsx` (3). Representative site is `useEffect(() => { setOpen(false); }, [pathname])`. The honest fix is to derive during render or key off `pathname` — that changes render ordering and can change the first paint. |
| `react-hooks/static-components` | 9 | `rank-ui.tsx` (4), `components/landing/how-it-connects.tsx` (4), `components/account-dropdown.tsx`. Components declared inside a parent's render body, closing over locals. Hoisting is a real refactor, not a move. |
| `react-hooks/immutability` | 4 | Includes `rank-ui.tsx:520`, which assigns `document.cookie` and `window.location.href` inside a function declared during render (the workspace switcher). |
| `react-hooks/purity` | 4 | `Math.random()` during render in `components/3d/studio-rig.tsx` and `camera-drift.tsx`. **The randomness is the visual effect.** A seeded RNG changes the rendered scene. More likely a scoped `eslint-disable` with a comment than a code change. |
| `@next/next/no-html-link-for-pages` | 2 | `app/signin/signin-header.tsx` — a raw `<a>` to an internal route. Switching to `<Link>` changes navigation from a full reload to client-side, which on the sign-in header may be deliberate. |
| `react-hooks/rules-of-hooks` | 2 | `components/code-block.tsx`, `desktop/src/update-ui.tsx`. Real correctness issues; worth fixing, individually. |

None are auto-fixable (0 fixes, 0 suggestions).

## Suggested order

1. **Config ignores** — 121 errors, no code change, one file. Needs an owner decision on what gets linted.
2. **Mechanical** — 21 errors, ~11 small hand edits, no behaviour change.
3. **`rules-of-hooks`** (2) — genuine correctness, small.
4. **The remaining `react-hooks/*`** (42) — one at a time, with a UI check each. Consider whether the
   React Compiler rules should be `warn` rather than `error` in this codebase until they are worked through.

Doing 1 and 2 leaves **44 errors**, all behavioral, all in shipped code — a defensible steady state to
enforce as a hard gate.
