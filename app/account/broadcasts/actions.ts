"use server";

import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { isAdminEmail } from "../../../lib/admin";
import {
  broadcastBodyToHtml,
  sendBroadcast,
  type BroadcastAudience,
} from "../../../lib/broadcasts";

async function assertAdmin(): Promise<string> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email || !isAdminEmail(email)) {
    throw new Error("Forbidden");
  }
  return email;
}

export async function sendBroadcastAction(
  formData: FormData,
): Promise<
  | { ok: true; delivered: number; failed: number; recipientCount: number }
  | { ok: false; error: string }
> {
  const email = await assertAdmin();
  const subject = String(formData.get("subject") ?? "").trim();
  const bodyMd = String(formData.get("body_md") ?? "").trim();
  const audienceRaw = String(formData.get("audience") ?? "all");
  const audience: BroadcastAudience =
    audienceRaw === "free" || audienceRaw === "paid" ? audienceRaw : "all";
  const dryRun = String(formData.get("dry_run") ?? "") === "yes";

  if (!subject) return { ok: false, error: "Subject required." };
  if (!bodyMd) return { ok: false, error: "Body required." };
  if (subject.length > 200) {
    return { ok: false, error: "Subject too long (200 char max)." };
  }
  if (bodyMd.length > 20_000) {
    return { ok: false, error: "Body too long (20k char max)." };
  }

  if (dryRun) {
    return {
      ok: false,
      error:
        "Dry run not implemented yet. Uncheck the box to send for real.",
    };
  }

  const result = await sendBroadcast({
    subject,
    bodyMd,
    bodyHtml: broadcastBodyToHtml(bodyMd),
    audience,
    sentBy: email,
  });

  revalidatePath("/account/broadcasts");

  if (!result.ok) {
    return {
      ok: false,
      error: result.reason ?? "Send failed (no recipients delivered).",
    };
  }
  return {
    ok: true,
    delivered: result.delivered,
    failed: result.failed,
    recipientCount: result.recipientCount,
  };
}
