import Link from "next/link";
import { ResendVerification } from "../../../../components/resend-verification";
import { SignupWaitingPoller } from "../../../../components/signup-waiting-poller";

export const metadata = {
  title: "Check your email",
  description: "Confirm your sansxel account by clicking the link we just sent.",
};

type SearchParams = {
  email?:  string;
  status?: "expired" | "invalid" | "error";
};

/**
 * Landing page after signup — and the bounce page when a verify link
 * expires or is invalid.  The status query param tells us which variant
 * to render.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const email  = params.email ?? "";
  const status = params.status ?? "pending";

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10">
        {status === "pending" && <PendingState email={email} />}
        {status === "expired" && <ExpiredState email={email} />}
        {status === "invalid" && <InvalidState />}
        {status === "error"   && <ErrorState email={email} />}

        <div className="mt-8 border-t border-white/10 pt-6 text-center text-sm text-neutral-400">
          Already verified?{" "}
          <Link href="/signin" className="text-white underline decoration-neutral-600 underline-offset-4 hover:decoration-white">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── State: freshly signed up, waiting on verify click ────────────────────
function PendingState({ email }: { email: string }) {
  return (
    <>
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Check your email
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Confirm your email to finish.
      </h1>
      <p className="mt-3 text-sm leading-6 text-neutral-300">
        We just sent a confirmation link to{" "}
        {email
          ? <span className="text-white">{email}</span>
          : <span className="text-neutral-400">your email address</span>}
        . Click the link in that email and your account goes live — takes five seconds.
      </p>

      <SignupWaitingPoller />

      <ul className="mt-5 space-y-2 text-xs text-neutral-400">
        <li className="flex items-start gap-2">
          <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-neutral-500" />
          <span className="min-w-0 leading-5">
            The link expires in 24 hours. If that happens, come back here to resend.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-neutral-500" />
          <span className="min-w-0 leading-5">
            Not in your inbox? Check your spam folder — the sender is{" "}
            <span className="text-neutral-300">hello@sansxel.ai</span>.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-neutral-500" />
          <span className="min-w-0 leading-5">
            Nothing gets charged and no account is created until you click the link.
          </span>
        </li>
      </ul>

      <details className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
        <summary className="cursor-pointer text-sm font-medium text-neutral-200">
          Didn&apos;t get the email?
        </summary>
        <ResendVerification defaultEmail={email} />
      </details>
    </>
  );
}

// ── State: link expired ───────────────────────────────────────────────────
function ExpiredState({ email }: { email: string }) {
  return (
    <>
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Link expired
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        That verification link expired.
      </h1>
      <p className="mt-3 text-sm leading-6 text-neutral-300">
        Confirmation links last 24 hours. No problem — we&apos;ll send a fresh one to{" "}
        {email ? <span className="text-white">{email}</span> : <span className="text-neutral-400">your email</span>}.
      </p>
      <ResendVerification defaultEmail={email} />
    </>
  );
}

// ── State: link invalid / unknown token ───────────────────────────────────
function InvalidState() {
  return (
    <>
      <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-300">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        Link invalid
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        We couldn&apos;t verify that link.
      </h1>
      <p className="mt-3 text-sm leading-6 text-neutral-300">
        Maybe it was already used (your account might already be active), or it was edited somewhere along the way. Sign in below — if that doesn&apos;t work, enter your email and we&apos;ll send a fresh confirmation link.
      </p>
      <Link
        href="/signin"
        className="sansxel-white-button mt-5 inline-block rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
      >
        Try signing in
      </Link>
      <div className="mt-6">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-neutral-400">Or resend</p>
        <ResendVerification />
      </div>
    </>
  );
}

// ── State: server-side error during verify ────────────────────────────────
function ErrorState({ email }: { email: string }) {
  return (
    <>
      <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-300">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        Something went wrong
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        We hit a snag verifying your email.
      </h1>
      <p className="mt-3 text-sm leading-6 text-neutral-300">
        Try the link again in a minute — if it keeps failing, resend a fresh link below or email <a href="mailto:help@sansxel.ai" className="text-white underline decoration-neutral-600 underline-offset-4">help@sansxel.ai</a> and we&apos;ll sort it out.
      </p>
      <ResendVerification defaultEmail={email} />
    </>
  );
}
