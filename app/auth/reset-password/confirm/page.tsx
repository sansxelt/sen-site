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
    <section style={{ maxWidth: 480, margin: "0 auto", padding: "clamp(24px, 4vw, 40px) clamp(16px, 4vw, 24px) 80px" }}>
      <p style={{ fontFamily: "var(--font-code)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--fg-4)", margin: 0 }}>
        Account access
      </p>
      <h1 style={{ marginTop: 10, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--fg-1)", lineHeight: 1.15 }}>
        Choose a new password.
      </h1>
      <p style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-3)" }}>
        Enter a new password for your Vraelis account. After saving, sign in with your new credentials.
      </p>
      <div style={{ marginTop: 26 }}>
        <ResetPasswordConfirmForm token={token} />
      </div>
    </section>
  );
}
