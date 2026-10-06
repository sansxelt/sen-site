import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Request a password reset link for your Vraelis account.",
};

export default function ResetPasswordPage() {
  return (
    <section className="auth-recovery">
      <ResetPasswordForm />
    </section>
  );
}
