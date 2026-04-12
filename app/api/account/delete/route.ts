import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
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
