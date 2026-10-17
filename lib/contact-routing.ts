/** Existing monitored address for general inquiries and feedback. */
export const GENERAL_INBOX = "help@vraelis.com";
export const SUPPORT_INBOXES = [GENERAL_INBOX, "sales@vraelis.com", "privacy@vraelis.com"] as const;
export type SupportInbox = (typeof SUPPORT_INBOXES)[number];
/** Never permit a caller-supplied address outside the fixed, enabled inboxes. */
export function resolveSupportInbox(candidate: string | null | undefined): SupportInbox {
  const value = (candidate ?? "").trim().toLowerCase();
  return SUPPORT_INBOXES.find((address) => address === value) ?? "help@vraelis.com";
}
