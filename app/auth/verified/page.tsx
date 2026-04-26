import Link from "next/link";
import { getSignInPath } from "../../../lib/auth-ui";

export const metadata = {
  title: "Account verified",
  description: "Your sansxel account is live.",
};

type SearchParams = { email?: string };

export default async function VerifiedPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const email  = params.email ?? "";
  const signInHref = getSignInPath(email ? `/account?email=${encodeURIComponent(email)}` : "/account");

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16 lg:px-8 lg:pt-10 lg:pb-24">
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Email verified
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          You&apos;re in.
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-300">
          Your sansxel account{email && <> ({<span className="text-white">{email}</span>})</>} is active. Sign in with the password you chose during signup and you&apos;re ready to go.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={signInHref}
            className="sansxel-white-button flex-1 rounded-2xl bg-white px-5 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
          >
            Sign in
          </Link>
          <Link
            href="/pricing"
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
          >
            See pricing
          </Link>
        </div>

        <p className="mt-6 border-t border-white/10 pt-6 text-xs text-neutral-500">
          You&apos;ll also get a welcome email from hello@sansxel.ai with getting-started tips.
        </p>
      </div>
    </div>
  );
}
