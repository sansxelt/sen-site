import type { Metadata } from "next";
import { auth } from "../../../auth";
import {
  getReferralStats,
  REFERRAL_REWARD_CREDITS,
  REFERRAL_SIGNUP_CREDITS,
} from "../../../lib/referral";
import { CREDITS_PER_DOLLAR } from "../../../lib/credits";
import { CopyReferralLink } from "../../../components/copy-referral-link";

export const metadata: Metadata = {
  title: "Referral & Rewards",
  description: "Share VRAELIS with friends and earn credits when they upgrade.",
};

const BASE_URL = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://VRAELIS.ai";

export default async function AccountReferralPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";

  const stats = email
    ? await getReferralStats(email)
    : { code: "", totalReferrals: 0, conversions: 0, creditsEarned: 0 };

  const referralLink = stats.code
    ? `${BASE_URL}/signup?ref=${stats.code}`
    : "";

  const rewardDollars = (REFERRAL_REWARD_CREDITS / CREDITS_PER_DOLLAR).toFixed(2);
  const signupDollars = (REFERRAL_SIGNUP_CREDITS / CREDITS_PER_DOLLAR).toFixed(2);
  const earnedDollars = (stats.creditsEarned / CREDITS_PER_DOLLAR).toFixed(2);

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-300/85">
          Referral &amp; Rewards
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Invite friends, earn credits
        </h1>
        <p className="max-w-xl text-sm leading-6 text-neutral-400">
          Share your link. When a friend upgrades to any paid plan, you get{" "}
          {REFERRAL_REWARD_CREDITS} credits (${rewardDollars}) and they get{" "}
          {REFERRAL_SIGNUP_CREDITS} credits (${signupDollars}) just for signing up.
        </p>
      </header>

      {!email && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-200">
          Sign in to access your referral link.
        </div>
      )}

      {email && (
        <>
          {/* Referral link card */}
          <div className="rounded-xl border border-white/10 bg-neutral-900 p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Your referral link
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <code className="flex-1 min-w-0 truncate rounded-lg border border-white/10 bg-neutral-950 px-4 py-2 text-sm text-neutral-200 font-mono">
                {referralLink}
              </code>
              <CopyReferralLink link={referralLink} />
            </div>
          </div>

          {/* Stats card */}
          <div className="rounded-xl border border-white/10 bg-neutral-900 p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Your stats
            </p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <p className="text-2xl font-semibold text-white">
                  {stats.totalReferrals}
                </p>
                <p className="text-xs text-neutral-400">Friends referred</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-semibold text-white">
                  {stats.conversions}
                </p>
                <p className="text-xs text-neutral-400">Upgraded to paid</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-semibold text-white">
                  {stats.creditsEarned}
                </p>
                <p className="text-xs text-neutral-400">
                  Credits earned (${earnedDollars})
                </p>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="rounded-xl border border-white/10 bg-neutral-900 p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              How it works
            </p>
            <ol className="space-y-3">
              {[
                {
                  step: "1",
                  title: "Share your link",
                  body: "Copy your unique referral link above and share it anywhere — social, email, DM.",
                },
                {
                  step: "2",
                  title: "Friend signs up and upgrades",
                  body: "When they sign up via your link and upgrade to any paid plan, the reward triggers automatically.",
                },
                {
                  step: "3",
                  title: "Both of you get credits",
                  body: `You get ${REFERRAL_REWARD_CREDITS} credits ($${rewardDollars}). They get ${REFERRAL_SIGNUP_CREDITS} credits ($${signupDollars}) on signup.`,
                },
              ].map(({ step, title, body }) => (
                <li key={step} className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-purple-500/40 bg-purple-500/10 text-xs font-semibold text-purple-300">
                    {step}
                  </span>
                  <div className="space-y-0.5 pt-0.5">
                    <p className="text-sm font-medium text-neutral-200">{title}</p>
                    <p className="text-sm text-neutral-400">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}

      {/* Dev-mode banner: DB migration notice */}
      {process.env.NODE_ENV !== "production" && (
        <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] px-4 py-3 text-xs text-sky-300 space-y-1">
          <p className="font-semibold">Dev notice: DB migration required</p>
          <p className="text-sky-300/70">
            The referral system needs two Supabase tables:{" "}
            <code className="font-mono">referral_codes</code> and{" "}
            <code className="font-mono">referral_events</code>. See{" "}
            <code className="font-mono">lib/referral.ts</code> for the SQL. Until
            the migration runs, the page fails open with derived codes and zero stats.
          </p>
        </div>
      )}
    </div>
  );
}
