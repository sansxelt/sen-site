"use server";

import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { isAdminEmail } from "../../../lib/admin";
import {
  applyToContribute,
  approveContributor,
  rejectContributor,
} from "../../../lib/contributors";

async function assertAdmin(): Promise<string> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email || !isAdminEmail(email)) {
    throw new Error("Forbidden");
  }
  return email;
}

function bust() {
  revalidatePath("/account/contributors");
}

export async function approveAction(formData: FormData) {
  const decidedBy = await assertAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!email || !displayName) return;
  await approveContributor({ email, displayName, decidedBy });
  bust();
}

export async function rejectAction(formData: FormData) {
  const decidedBy = await assertAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!email) return;
  await rejectContributor({ email, decidedBy, notes: notes || undefined });
  bust();
}

/** Manual entry: admin pastes an email + name to seed an approved
 * contributor without going through the public application form.
 * Useful before /contribute exists, or for migrating known
 * contributors in bulk. */
export async function seedApprovedAction(formData: FormData) {
  const decidedBy = await assertAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!email || !displayName) return;
  await applyToContribute({ email, appliedName: displayName });
  await approveContributor({ email, displayName, decidedBy });
  bust();
}
