// Design 05 — flagship public-site prototype fixtures.
//
// Deterministic, anonymized data based on the real Vraelis production story (a Pro-purchase-persistence
// verification that Failed, Failed after an incomplete repair, then Verified). NOTHING here is a live customer
// record: the deployment, account, and identifiers are invented fixtures. The prototype must never claim it is
// executing a real customer deployment. Timestamps are fixed literals (no Date.now) so the render is stable.

export type StepState = "pass" | "fail" | "pending" | "skipped";
export type Conclusion = "verified" | "failed" | "running";

// One proof obligation the claim compiles into. The same seven obligations are checked for every record; only
// the per-record outcome differs, so the visitor watches the SAME plan resolve differently across attempts.
export type Obligation = {
  id: string;
  short: string; // the compiled obligation, one line
  tag: string; // a 1-2 word marker for the trace
  action: string; // what Vraelis actually does in the live product
};

export const CLAIM =
  "A customer can purchase Pro, receive access, sign out, sign back in, and keep Pro.";

export const OBLIGATIONS: Obligation[] = [
  { id: "ob-1", short: "The customer begins without Pro", tag: "starts Free", action: "Open the app as a fresh account and confirm the plan is Free" },
  { id: "ob-2", short: "Payment completes", tag: "payment", action: "Run the upgrade checkout with a sandbox card and confirm the charge succeeds" },
  { id: "ob-3", short: "The entitlement belongs to the same account", tag: "same account", action: "Confirm the Pro entitlement is written to the account that paid" },
  { id: "ob-4", short: "Pro access appears after payment", tag: "Pro appears", action: "Confirm the account reflects Pro and a Pro-only capability is reachable" },
  { id: "ob-5", short: "The session is destroyed", tag: "sign out", action: "Fully sign the customer out and discard the session" },
  { id: "ob-6", short: "The customer signs in again", tag: "sign in", action: "Sign back in as the same account in a fresh session" },
  { id: "ob-7", short: "Pro access remains", tag: "Pro persists", action: "Confirm Pro is still present and usable after re-authentication" },
];

export type EvidenceFrame = "plan-free" | "plan-pro" | "checkout-paid";

export type Evidence = {
  atObligation: string; // which obligation this evidence belongs to
  label: string;
  expected: string;
  observed: string;
  frame: EvidenceFrame; // a stylized depiction of the app state, NOT a real screenshot
  caption: string;
};

export type Step = {
  obligationId: string;
  state: StepState;
  observed: string; // owner-safe, human sentence
  ms: number;
};

export type VerificationRecord = {
  id: string;
  index: number;
  label: string; // human label for the lineage
  createdAt: string; // fixed ISO
  deployment: string; // anonymized pinned deployment
  commit: string;
  conclusion: Conclusion;
  outcome: string; // one-line human observed outcome
  failsAt: string | null; // obligation id where the path breaks, null when verified
  steps: Step[];
  evidence: Evidence;
};

// Shared deployment identity per attempt (anonymized). Each record pins its OWN deployment; a later record is a
// separate deployment and a separate preserved historical record.
const DEP = "app.northwind-store.example";

function steps(states: Record<string, [StepState, string, number]>): Step[] {
  return OBLIGATIONS.map((o) => {
    const s = states[o.id] ?? ["skipped", "Not reached on this run.", 0];
    return { obligationId: o.id, state: s[0], observed: s[1], ms: s[2] };
  });
}

export const RECORDS: VerificationRecord[] = [
  {
    id: "vrf-3c9e26ef",
    index: 1,
    label: "First verification",
    createdAt: "2026-07-14T09:12:00Z",
    deployment: DEP,
    commit: "a41d0c2",
    conclusion: "failed",
    outcome: "Payment succeeded, but the account never received Pro.",
    failsAt: "ob-4",
    steps: steps({
      "ob-1": ["pass", "The account started on the Free plan.", 1840],
      "ob-2": ["pass", "The sandbox charge completed and the receipt was recorded.", 5210],
      "ob-3": ["pass", "The charge was attributed to the account under test.", 1120],
      "ob-4": ["fail", "After payment the account still showed Free. No Pro-only capability was reachable.", 3400],
      "ob-5": ["skipped", "Not reached: Pro was never granted.", 0],
      "ob-6": ["skipped", "Not reached.", 0],
      "ob-7": ["skipped", "Not reached.", 0],
    }),
    evidence: {
      atObligation: "ob-4",
      label: "Account plan after a completed payment",
      expected: "The account reflects Pro, and a Pro-only capability is reachable.",
      observed: "The account still shows Free. The upgrade was charged but never applied.",
      frame: "plan-free",
      caption: "Captured on the pinned deployment, immediately after the charge cleared.",
    },
  },
  {
    id: "vrf-7a5dfe0f",
    index: 2,
    label: "After the first repair",
    createdAt: "2026-07-16T15:40:00Z",
    deployment: DEP,
    commit: "b7e9f14",
    conclusion: "failed",
    outcome: "Pro appeared after payment, then vanished after signing back in.",
    failsAt: "ob-7",
    steps: steps({
      "ob-1": ["pass", "The account started on the Free plan.", 1790],
      "ob-2": ["pass", "The sandbox charge completed.", 4980],
      "ob-3": ["pass", "The entitlement was written to the paying account.", 1040],
      "ob-4": ["pass", "The account showed Pro and a Pro-only capability was reachable.", 2600],
      "ob-5": ["pass", "The session was fully signed out and discarded.", 900],
      "ob-6": ["pass", "The same account signed back in on a new session.", 2210],
      "ob-7": ["fail", "After re-authentication the account had reverted to Free. Pro did not persist.", 3120],
    }),
    evidence: {
      atObligation: "ob-7",
      label: "Account plan after signing back in",
      expected: "Pro is still present and usable after re-authentication.",
      observed: "The account returned to Free. The entitlement did not survive a new session.",
      frame: "plan-free",
      caption: "The repair fixed the first failure but not the persistence requirement.",
    },
  },
  {
    id: "vrf-ff9d6c0d",
    index: 3,
    label: "After the full repair",
    createdAt: "2026-07-19T11:05:00Z",
    deployment: DEP,
    commit: "d2c81a0",
    conclusion: "verified",
    outcome: "Payment, entitlement, and access all held, and Pro survived a fresh sign-in.",
    failsAt: null,
    steps: steps({
      "ob-1": ["pass", "The account started on the Free plan.", 1810],
      "ob-2": ["pass", "The sandbox charge completed.", 5050],
      "ob-3": ["pass", "The entitlement was written to the paying account.", 1090],
      "ob-4": ["pass", "The account showed Pro and a Pro-only capability was reachable.", 2480],
      "ob-5": ["pass", "The session was fully signed out and discarded.", 880],
      "ob-6": ["pass", "The same account signed back in on a new session.", 2170],
      "ob-7": ["pass", "Pro was still present and usable after re-authentication.", 2320],
    }),
    evidence: {
      atObligation: "ob-7",
      label: "Account plan after signing back in",
      expected: "Pro is still present and usable after re-authentication.",
      observed: "The account still shows Pro. The entitlement survived a fresh session.",
      frame: "plan-pro",
      caption: "Every obligation held on the pinned deployment.",
    },
  },
];

// Public-decision vocabulary shared with the app (Design 02 conclusion language). Warm-neutral verdict tones.
export const CONCLUSION_META: Record<Conclusion, { label: string; ink: string; bg: string; line: string }> = {
  verified: { label: "Verified", ink: "#0A7B54", bg: "#E7F3EC", line: "rgba(14,158,108,0.30)" },
  failed: { label: "Failed", ink: "#A8452A", bg: "#F6ECE7", line: "#E7CFC5" },
  running: { label: "Verifying", ink: "#7E6F43", bg: "#F2ECDD", line: "#E4D9BE" },
};

// What the coding agent reported vs what Vraelis observed — the trust gap, in the product's own words.
export const AGENT_CLAIM = "Subscription checkout and Pro access are complete and working.";
export const VRAELIS_OBSERVED = "Payment succeeded, but Pro access did not persist. The claim did not hold.";
