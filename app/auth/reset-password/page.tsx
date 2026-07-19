import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Request a password reset link for your Vraelis account.",
};

export default function ResetPasswordPage() {
  return (
    <section style={{ maxWidth: 480, margin: "0 auto", padding: "clamp(24px, 4vw, 40px) clamp(16px, 4vw, 24px) 80px" }}>
      <p style={{ fontFamily: "var(--font-code)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fg-4)", margin: 0 }}>
        Account access
      </p>
      <h1 style={{ marginTop: 10, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--fg-1)", lineHeight: 1.15 }}>
        Reset your password.
      </h1>
      <p style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-3)" }}>
        Enter your account email and we will send you a reset link if an email-based account exists.
      </p>
      <div style={{ marginTop: 26 }}>
        <ResetPasswordForm />
      </div>
    </section>
  );
}
