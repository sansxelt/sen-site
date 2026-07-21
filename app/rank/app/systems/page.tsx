// /systems — the canonical URL for what the codebase still calls applications.
//
// "Application" was accurate when Vraelis only checked deployed web apps. It is too narrow for where the
// product is going: a System is whatever a claim can be made about, which will later include an API, a
// connected service, or an agent environment. Renaming the concept in the interface first, and the tables
// later or never, is deliberate. The database name is an implementation detail; the word the user reads is
// the product.
//
// This re-exports the existing page rather than reimplementing it, so the two URLs cannot drift apart while
// the transition is in progress. /applications keeps working; nothing was moved or deleted.
import type { Metadata } from "next";
import ApplicationsPage from "../applications/page";

export const metadata: Metadata = { title: "Systems" };

export default ApplicationsPage;
