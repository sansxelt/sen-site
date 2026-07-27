// /records — the canonical URL for the permanent record of what happened.
//
// The founder's model ends at "permanent records", and the console already kept them: /activity is an
// append-only audit trail (lib/v-audit) covering workspace and organization events, with an export. It was
// named after the mechanism, so nothing in the navigation said that Vraelis REMEMBERS, which is most of why
// anyone would trust a verification months after it ran.
//
// Re-exported rather than reimplemented, the same way /systems and /verifications were renamed, so the two
// URLs cannot drift while the vocabulary settles. /activity keeps working.
import type { Metadata } from "next";
import ActivityPage from "../activity/page";

export const metadata: Metadata = { title: "Records" };

export default ActivityPage;
