// /verifications — the canonical URL for what the codebase still calls passes.
//
// A user should see one object, a Verification, not three internal ones (a pass, a run, a report). Those
// still exist underneath and a verification is composed of them, but they are lifecycle stages rather than
// destinations, and the navigation should not ask anyone to learn the difference.
//
// Re-exports the existing page so the old and new URLs cannot drift while the transition is in progress.
// /passes keeps working.
import type { Metadata } from "next";
import PassesPage from "../passes/page";

export const metadata: Metadata = { title: "Verifications" };

export default PassesPage;
