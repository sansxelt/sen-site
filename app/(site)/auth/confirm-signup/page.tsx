import Link from "next/link";
import type { Metadata } from "next";
import { verifyOAuthSignupToken } from "../../../../lib/oauth-signup-token";
import { ConfirmSignupForm } from "./confirm-form";

export const metadata: Metadata = {
  title: "Confirm signup",
  description: "Create your sansxel account.",
  robots: { index: false, follow: false },
};

type SearchParams = {
  email?:    string;
  provider?: string;
  name?:     string;
  token?:    string;
};

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  github: "GitHub",
};

export default async function ConfirmSignupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params   = await searchParams;
  const email    = (params.email ?? "").trim().toLowerCase();
  const provider = (params.provider ?? "").trim();
  const name     = (params.name ?? "").trim();
  const token    = params.token ?? "";

  const valid = Boolean(email && provider && token)
    && verifyOAuthSignupToken(token, { email, provider });

  if (!valid) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/[0.08] px-3 py-1 text-xs font-medium text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
            Link expired or invalid
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            This signup link is no longer valid.
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-300">
            Links from the sign-in bounce are short-lived for security.
            Head back to sign in and try again — it takes about ten seconds.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signin"
              className="sansxel-white-button flex-1 rounded-2xl bg-white px-5 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
            >
              Back to sign in
            </Link>
            <Link
              href="/"
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const providerLabel = PROVIDER_LABEL[provider] ?? provider;

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-300">
          New account
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Create a sansxel account?
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-300">
          You just signed in with <span className="font-medium text-white">{providerLabel}</span> as{" "}
          <span className="font-medium text-white">{email}</span>, and no sansxel
          account exists for that address yet. Creating one is a one-time step.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-neutral-400">
          If you previously deleted this account, creating it again will start
          fresh — your old data isn&apos;t restored.
        </div>

        <ConfirmSignupForm
          email={email}
          provider={provider}
          name={name}
          token={token}
        />

        <p className="mt-6 border-t border-white/10 pt-6 text-xs leading-5 text-neutral-500">
          Didn&apos;t mean to do this? Pick Cancel below — no account is created
          until you confirm.
        </p>
      </div>
    </div>
  );
}
