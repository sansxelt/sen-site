import type { Metadata } from "next";
import { ResetPasswordConfirmForm } from "./reset-password-confirm-form";

export const metadata: Metadata = {
  title: "Set New Password",
  description: "Choose a new password for your Vraelis account.",
};

export default async function ResetPasswordConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token =
    typeof params.token === "string" ? params.token : "";

  return (
    <section className="auth-recovery">
      <ResetPasswordConfirmForm token={token} />
    </section>
  );
}
