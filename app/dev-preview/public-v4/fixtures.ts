// Deterministic, anonymized fixtures for the public-v4 flagship. These are illustrative and labelled as such
// on the surface; they carry NO real customer, metric, or credential. The three Guarantees are exactly the
// founder's brief: paid access retention, workspace isolation, submitted-record persistence. Each is a durable
// business requirement, its derived proof obligations, its approved reviewed plan, and its preserved history.
//
// Vocabulary is the shipping product's: Verified / Failed / Blocked (public-decision.ts), plus Unproven for an
// approved-but-not-yet-verified Guarantee, and Plan review required for a drifted one. "Next" markers denote
// direction (reverify on deployment), never current capability.

export type Verdict = "verified" | "failed" | "blocked";
export type GStatus = Verdict | "unproven" | "plan_review_required";

export type HistoryRecord = { verdict: Verdict; deployment: string; when: string; note: string };

export type GuaranteeFixture = {
  id: string;
  short: string;        // rail label
  requirement: string;  // the business requirement, at major scale on the stage
  status: GStatus;
  obligations: string[]; // what Vraelis derives the claim into
  plan: string[];        // the reviewed proof plan, the exact checks a human approved
  approvedBy: string;
  approvedWhen: string;
  history: HistoryRecord[]; // preserved, immutable records (newest first); empty for a just-born Guarantee
  observed?: string;    // for a Failed guarantee: what happened instead
};

export const SYSTEM_NAME = "Northwind, production";

export const GUARANTEES: GuaranteeFixture[] = [
  {
    id: "grt_paid_access",
    short: "Paid customers retain access",
    requirement: "A customer who purchases Pro receives Pro access and keeps it after signing out and back in.",
    status: "unproven", // the one being born in the flagship sequence
    obligations: [
      "The upgrade to Pro is reachable and completes without an error",
      "The account reflects Pro immediately after payment",
      "A Pro-only capability is actually available",
      "Pro access survives a full sign-out and fresh sign-in",
    ],
    plan: [
      "Open the pricing page and start the upgrade to Pro",
      "Complete payment and confirm the account shows Pro",
      "Use a Pro-only capability",
      "Sign out, sign back in, confirm Pro persists",
    ],
    approvedBy: "avery@northwind.io",
    approvedWhen: "just now",
    history: [], // just approved: no verification yet
  },
  {
    id: "grt_workspace_isolation",
    short: "Users only reach their own workspace",
    requirement: "A signed-in user can only reach data that belongs to their own workspace, never another tenant's.",
    status: "verified",
    obligations: [
      "A second workspace's records are never listed for the first user",
      "A direct link to another workspace's record is refused",
      "The API scopes every read to the caller's workspace",
    ],
    plan: [
      "Sign in as workspace A, note a record id",
      "Sign in as workspace B, request A's record id directly",
      "Confirm the request is refused, not served",
    ],
    approvedBy: "avery@northwind.io",
    approvedWhen: "6 days ago",
    history: [
      { verdict: "verified", deployment: "8f21ad", when: "12 minutes ago", note: "Every isolation check held on the tested deployment." },
      { verdict: "verified", deployment: "72c98e", when: "2 days ago", note: "Held after the workspace switcher change." },
      { verdict: "blocked", deployment: "5b0e11", when: "5 days ago", note: "A test account was unavailable, so no verdict was reached." },
    ],
  },
  {
    id: "grt_record_persistence",
    short: "Submitted records stay saved",
    requirement: "A submitted record is still saved and visible after the user reloads the app and signs back in.",
    status: "failed",
    observed: "The record rendered right after creation, but the list was empty after a reload. No write reached the backing store.",
    obligations: [
      "A created record is written to the backing store, not only the screen",
      "The record is listed again after a hard reload",
      "The record survives a fresh sign-in",
    ],
    plan: [
      "Sign in and create a record",
      "Hard reload the workspace, confirm the record is still listed",
      "Sign out and back in, confirm it persists",
    ],
    approvedBy: "avery@northwind.io",
    approvedWhen: "6 days ago",
    history: [
      { verdict: "failed", deployment: "8f21ad", when: "18 minutes ago", note: "The record disappeared after reload. Repair returned to the coding agent." },
      { verdict: "verified", deployment: "1c77de", when: "3 days ago", note: "Persisted across reload and re-sign-in." },
    ],
  },
];
