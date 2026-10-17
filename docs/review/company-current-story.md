Company/current-story review — 2026-10-16

Prepared on a separate review branch; founder subsequently requested completing the live changes on October17. Deployment evidence is retained in the private handoff.

Changes: separate About from Partners; show Vraelis by Foremake, Inc near the homepage and About introductions; preserve retired-product archive and per-page historical context while excluding those context blocks from current machine-readable aggregates/search. Public products remain research, without adopting Ledger or another name. Homepage has direct Contour/docs entry points, without invented package commands.

General inquiries and feedback use the existing help@vraelis.com address, per the founder's October17 direction. The proposed general@ mailbox and enable flag were removed. Existing help/sales/privacy routes remain allowlisted; no mailbox provisioning is needed. No mail was sent in verification. Exact official X URL remains unverified; existing LinkedIn is retained. Logo work is paused.

Checks: TypeScript noEmit; targeted ESLint (homepage retains pre-existing image warnings); scripts/company-current-story-verify.ts tests existing recipient allowlists and archive/current aggregate separation. Chromium at 1440px and390px: home, About, Partners, Contact and introduction return200, without horizontal overflow. Initial reused-page development browser run emitted one Next router initialization error; repeat with fresh pages recorded separately. No production build was run because retained workspace storage is limited. No mailbox provisioning, legal/domain/billing change, outreach or new deployment claim.
