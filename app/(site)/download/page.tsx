import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EarlyAccessForm } from "@/components/early-access-form";
import { readAccountContext } from "@/lib/account-session";
import { getUserProfileByEmail } from "@/lib/user-profile";

export const metadata: Metadata = {
  title: "Access",
  description:
    "Request early access to Sansxel and try the layered AI response engine first.",
};

export default async function DownloadPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  // v0.1.16 — Download (and the early-access invite request inside)
  // require an account so we have an email to attach the invite to.
  // Anonymous visitors hit /signin first and bounce back here.
  if (!signedIn) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/download")}`);
  }

  const profile = await getUserProfileByEmail(session?.user?.email);
  const initialAccountContext = readAccountContext(session, profile);

  return (
    <section className="mx-auto max-w-[1600px] px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16 lg:px-8 lg:pt-10 lg:pb-24">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-200">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Early access open
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Get early access to Sansxel.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-200">
            Start with one chat surface and get the real product from day one:
            responses that can expand from quick clarity into structure,
            visuals, systems, and next actions.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <span
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3 text-center text-sm font-medium text-neutral-400"
              aria-disabled="true"
            >
              Downloads paused
            </span>
            <Link
              href="#early-access"
              className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
            >
              Request invite when reopened
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Status", "Early access with invite-based onboarding."],
              ["Platform", "Windows first today, with broader surfaces coming later."],
              ["What you get", "The full Sansxel layered response experience from your first session."],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="text-sm font-medium text-white">{title}</div>
                <div className="mt-2 text-sm leading-6 text-neutral-200">
                  {description}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            What is included
          </div>
          <div className="mt-6 space-y-3">
            {[
              "Universal input for questions, notes, links, screenshots, and files",
              "Layered responses that scale with the size of the request",
              "Saved history you can refine forward from",
              "Account and workspace management",
              "Export and sharing controls",
              "Direct support channel during rollout",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-neutral-200"
              >
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-white" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        id="early-access"
        className="mt-10 grid gap-6 lg:grid-cols-[1fr_.95fr] sm:mt-12"
      >
        <EarlyAccessForm initialAccountContext={initialAccountContext} />

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            What happens next
          </div>
          <div className="mt-6 space-y-4 text-sm leading-6 text-neutral-300">
            <p>
              Submit your request to hold a place in the queue. Your account
              stays connected to your invite status and future access.
            </p>
            <p>
              Once approved, you get the full Sansxel experience - not just an
              assistant, but a response engine that turns rough input into
              clearer, more usable output.
            </p>
            <p>
              Start on the free tier and expand into stronger personal or team
              workflows when Sansxel becomes part of your day-to-day work.
            </p>
          </div>

          <div className="mt-6 grid gap-3">
            {[
              ["/features", "See features"],
              ["/function", "See how it works"],
              ["/pricing", "Review pricing"],
              ["/contact", "Talk to support"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white transition hover:bg-white/5"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
