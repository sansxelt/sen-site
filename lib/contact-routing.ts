/** Enable only after general@ inbound delivery/replies are verified. Public build-time config, never a secret. */
export const GENERAL_INBOX_READY = process.env.NEXT_PUBLIC_VRAELIS_GENERAL_INBOX_READY === "1";
export const GENERAL_INBOX = GENERAL_INBOX_READY ? "general@vraelis.com" : "help@vraelis.com";
export const SUPPORT_INBOXES = ["help@vraelis.com", "sales@vraelis.com", "privacy@vraelis.com", ...(GENERAL_INBOX_READY ? ["general@vraelis.com" as const] : [])] as const;
export type SupportInbox = (typeof SUPPORT_INBOXES)[number];
/** Never permit a caller-supplied address outside the fixed, enabled inboxes. */
export function resolveSupportInbox(candidate: string | null | undefined): SupportInbox {
  const value = (candidate ?? "").trim().toLowerCase();
  return SUPPORT_INBOXES.find((address) => address === value) ?? "help@vraelis.com";
}
