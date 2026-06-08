// Email broadcast data layer (v0.2.0 phase D).
//
// Schema in docs/v0.2.0-broadcasts.sql. Admin pages compose +
// trigger sends; this module owns the recipient query, the
// dispatch loop, and the persisted record. Fails open when the
// table or related infra is missing so a partial outage never
// 500s the admin page.

import { Resend } from "resend";
import {
  getSupabaseAdminClient,
  isDatabaseConfigured,
} from "./supabase-admin";

const TABLE = "email_broadcasts";
const PROFILES = "user_profiles";
const SUBSCRIPTIONS = "account_subscriptions";

const FROM_BROADCAST = "Vraelis <hello@vraelis.com>";

export type BroadcastAudience = "all" | "free" | "paid";

export type Broadcast = {
  id: string;
  subject: string;
  body_md: string;
  audience: BroadcastAudience;
  sent_by: string;
  sent_at: string;
  recipient_count: number;
  delivered: number;
  failed: number;
};

let resendClient: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// --- Reads -----------------------------------------------------

export async function listRecentBroadcasts(limit = 30): Promise<Broadcast[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(TABLE as never)
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as unknown as Broadcast[];
  } catch {
    return [];
  }
}

/** Returns the email list for an audience filter. Fails open with
 * an empty list so a missing subscriptions table just means no
 * paid filter, not a crash. */
export async function listRecipientsForAudience(
  audience: BroadcastAudience,
): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const supabase = getSupabaseAdminClient();
    const profilesRes = await supabase
      .from(PROFILES as never)
      .select("email");
    const profiles = (profilesRes.data ?? []) as unknown as Array<{
      email?: string;
    }>;
    const emails = new Set<string>(
      profiles
        .map((p) => p.email?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e)),
    );
    if (audience === "all" || emails.size === 0) {
      return Array.from(emails);
    }

    const subsRes = await supabase
      .from(SUBSCRIPTIONS as never)
      .select("email, plan_key");
    const subs = (subsRes.data ?? []) as unknown as Array<{
      email?: string;
      plan_key?: string;
    }>;
    const paidSet = new Set<string>(
      subs
        .filter((s) => s.plan_key && s.plan_key !== "free")
        .map((s) => s.email?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e)),
    );

    if (audience === "paid") {
      return Array.from(emails).filter((e) => paidSet.has(e));
    }
    if (audience === "free") {
      return Array.from(emails).filter((e) => !paidSet.has(e));
    }
    return Array.from(emails);
  } catch {
    return [];
  }
}

// --- Writes ----------------------------------------------------

/** Sends the broadcast to every recipient sequentially (low rate
 * for now, so the route doesn't time out on big lists; switch to
 * Resend's batch API or a queue when the list grows). Returns
 * counts so the admin sees what actually went out. */
export async function sendBroadcast(input: {
  subject: string;
  bodyMd: string;
  bodyHtml: string;
  audience: BroadcastAudience;
  sentBy: string;
}): Promise<{
  ok: boolean;
  recipientCount: number;
  delivered: number;
  failed: number;
  broadcastId: string | null;
  reason?: string;
}> {
  const resend = getResend();
  if (!resend) {
    return {
      ok: false,
      recipientCount: 0,
      delivered: 0,
      failed: 0,
      broadcastId: null,
      reason: "Resend is not configured (RESEND_API_KEY missing).",
    };
  }
  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      recipientCount: 0,
      delivered: 0,
      failed: 0,
      broadcastId: null,
      reason: "Database is not configured.",
    };
  }

  const recipients = await listRecipientsForAudience(input.audience);
  if (recipients.length === 0) {
    return {
      ok: false,
      recipientCount: 0,
      delivered: 0,
      failed: 0,
      broadcastId: null,
      reason: "No recipients matched that audience.",
    };
  }

  let delivered = 0;
  let failed = 0;
  for (const to of recipients) {
    try {
      await resend.emails.send({
        from: FROM_BROADCAST,
        to,
        subject: input.subject,
        html: input.bodyHtml,
        text: input.bodyMd,
      });
      delivered += 1;
    } catch (err) {
      failed += 1;
      console.warn(`[broadcast] send to ${to} failed:`, err);
    }
  }

  // Persist the record. Failures here are non-fatal; the email
  // already shipped, the audit row just won't appear.
  let broadcastId: string | null = null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from(TABLE as never)
      .insert({
        subject: input.subject,
        body_md: input.bodyMd,
        audience: input.audience,
        sent_by: input.sentBy.toLowerCase(),
        recipient_count: recipients.length,
        delivered,
        failed,
      } as never)
      .select("id")
      .single();
    if (data && (data as unknown as { id?: string }).id) {
      broadcastId = (data as unknown as { id: string }).id;
    }
  } catch (err) {
    console.warn("[broadcast] persist failed:", err);
  }

  return {
    ok: delivered > 0,
    recipientCount: recipients.length,
    delivered,
    failed,
    broadcastId,
  };
}

// --- Markdown -> HTML rendering -------------------------------

/** Tiny safe markdown renderer for broadcast bodies. Supports
 * paragraphs, bold/italic, inline code, and links. Anything else
 * the admin pastes survives as plain text inside <p>. We don't
 * pull in remark / rehype here because the admin page is server-
 * rendered and the dependency surface should stay small. */
export function broadcastBodyToHtml(md: string): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const inline = (s: string) => {
    let out = escape(s);
    // links: [label](https://...)
    out = out.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      (_match, label: string, href: string) =>
        `<a href="${href}" style="color:#7c3aed;text-decoration:underline;">${label}</a>`,
    );
    // **bold**
    out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    // *italic*
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    // `inline code`
    out = out.replace(
      /`([^`\n]+)`/g,
      '<code style="background:#f4f4f5;padding:1px 5px;border-radius:4px;">$1</code>',
    );
    return out;
  };

  const paragraphs = md
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const blocks = paragraphs.map((p) => {
    const lines = p.split("\n").map(inline).join("<br/>");
    return `<p style="margin:0 0 14px;line-height:1.55;">${lines}</p>`;
  });

  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;color:#0a0a0a;max-width:580px;margin:0 auto;padding:24px;">
${blocks.join("\n")}
<p style="margin-top:32px;font-size:11px;color:#737373;">
Sent from Vraelis. <a href="https://vraelis.com" style="color:#737373;">vraelis.com</a>
</p>
</div>`;
}
