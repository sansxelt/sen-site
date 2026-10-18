/* WHO OPERATES VRAELIS (founder, 2026-10-11).
 *
 * Foremake, Inc and Vraelis are unincorporated brands. "Foremake, Inc" is the brand name exactly as written;
 * the policies must not call it a registered corporation, and no legal entity may be invented for them. The person or
 * body that actually operates the site goes in OPERATOR below, with the notice address and the governing law, as the
 * founder states them. Nothing here is filled in by default, and neither a parent or guardian nor counsel is
 * substituted as the operator.
 *
 * Until all three are set, the section shows "to be confirmed", which is right on the review deployment and wrong on
 * vraelis.com. So a production build with v8 public refuses to render these pages with any of them missing (the build
 * fails rather than publishing a placeholder). A review build (VRAELIS_REVIEW_LABEL) is exempt. */
// Founder, 2026-10-11: the operator is Foremake, Inc (no individuals named, as on x.ai); no postal address, notices go
// by email; governed by California, USA law, with EU residents keeping their mandatory local consumer protections and
// the global terms applying everywhere else.
export const OPERATOR: { name: string | null; noticeAddress: string | null; noticesByEmail: boolean; governingLaw: string | null } = {
  name: "Foremake, Inc",
  noticeAddress: null,
  noticesByEmail: true,
  governingLaw: "the State of California, USA",
};

export function operatorMissing(): string[] {
  const missing: string[] = [];
  if (!OPERATOR.name?.trim()) missing.push("name");
  if (!OPERATOR.noticeAddress?.trim() && !OPERATOR.noticesByEmail) missing.push("noticeAddress");
  if (!OPERATOR.governingLaw?.trim()) missing.push("governingLaw");
  return missing;
}

export function assertOperatorPublishable() {
  const live = process.env.VERCEL_ENV === "production" && process.env.NEXT_PUBLIC_VRAELIS_V8_PUBLIC === "1" && !process.env.VRAELIS_REVIEW_LABEL;
  const missing = operatorMissing();
  if (live && missing.length) throw new Error(`v8 policies: operator details missing (${missing.join(", ")}); set them in app/dev-preview/v8/_legal/operator.ts before publishing`);
}
