import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { sendAccountDeletedEmail } from "../../../../lib/email";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";

export async function DELETE() {
  const session = await auth();
  const email = session?.user?.email ?? null;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdminClient();

    const { error: credError } = await supabase
      .from("user_credentials" as never)
      .delete()
      .eq("email", email);

    if (credError) {
      console.error("Failed to delete credentials:", credError);
    }

    const { error: profileError } = await supabase
      .from("user_profiles" as never)
      .delete()
      .eq("email", email);

    if (profileError) {
      throw profileError;
    }

    // Confirmation email — fire-and-forget so a mail hiccup can't undo
    // the deletion that already succeeded above.
    sendAccountDeletedEmail(email, session?.user?.name ?? "").catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Account deletion failed:", error);

    return NextResponse.json(
      {
        error:
          "We couldn't delete your account right now. Please contact support.",
      },
      { status: 400 },
    );
  }
}
