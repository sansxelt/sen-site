import type { Metadata } from "next";
import { ResetPasswordConfirmForm } from "./reset-password-confirm-form";

export const metadata: Metadata = {
  title: "Set New Password",
  description: "Choose a new password for your VRAELIS account.",
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
    <section className="mx-auto max-w-5xl px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16 lg:px-8 lg:pt-10 lg:pb-24">
        <div className="mx-auto max-w-md">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Account Access
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Choose a new password.
          </h1>
          <p className="mt-4 text-sm leading-7 text-neutral-200">
            Enter a new password for your VRAELIS account. After saving, sign
            in with your new credentials.
          </p>
          <div className="mt-8">
            <ResetPasswordConfirmForm token={token} />
          </div>
        </div>
    </section>
  );
}
