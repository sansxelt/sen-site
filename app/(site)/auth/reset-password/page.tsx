import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Request a password reset link for your sansxel account.",
};

export default function ResetPasswordPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-md">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Account Access
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Reset your password.
          </h1>
          <p className="mt-4 text-sm leading-7 text-neutral-200">
            Enter your account email and we will send you a reset link if an
            email-based account exists.
          </p>
          <div className="mt-8">
            <ResetPasswordForm />
          </div>
        </div>
    </section>
  );
}
