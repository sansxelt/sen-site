"use server";

import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { applyToContribute } from "../../../lib/contributors";

// Public-facing apply action. Unlike the admin actions, this one
// only writes to the applicant's own row (keyed on session email)
// so a signed-in user can submit/update their own application but
// can't approve themselves or touch anyone else.

export async function applyAction(formData: FormData): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) return { ok: false, error: "Sign in first." };

  const appliedName = String(formData.get("applied_name") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!appliedName) return { ok: false, error: "Name is required." };
  if (appliedName.length > 80) {
    return { ok: false, error: "Name is too long (80 chars max)." };
  }
  if (reason.length > 1500) {
    return { ok: false, error: "Pitch is too long (1500 chars max)." };
  }

  const result = await applyToContribute({
    email,
    appliedName,
    reason: reason || undefined,
  });

  if (!result) {
    return {
      ok: false,
      error:
        "Couldn't save your application. The contributor system may not be wired up yet, try help@vraelis.com for now.",
    };
  }

  revalidatePath("/contribute");
  revalidatePath("/account/contributors");
  return { ok: true };
}
