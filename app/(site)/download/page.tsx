import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { EarlyAccessForm } from "@/components/early-access-form";
import { readAccountContext } from "@/lib/account-session";
import { getSignInPath } from "@/lib/auth-ui";
import { getUserProfileByEmail } from "@/lib/user-profile";

export const metadata: Metadata = {
  title: "Access",
  description:
    "Request sansxel early access. See launch status, platform availability, and what to expect.",
};

export default async function DownloadPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);
  const profile = await getUserProfileByEmail(session?.user?.email);
  const initialAccountContext = readAccountContext(session, profile);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-200">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Early access open
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Get early access to sansxel.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-200">
            sansxel is currently in early access on Windows. Create an account,
            request an invite, and start materializing ideas into visual outputs
            as soon as your access is approved.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {signedIn ? (
              <Link
                href="/account"
                className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
              >
                Open workspace
              </Link>
            ) : (
              <Link
                href={getSignInPath("/account")}
                className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
              >
                Create account
              </Link>
            )}
            <Link
              href="#early-access"
              className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
            >
              Request invite
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Status", "Early access — invite-based onboarding."],
              ["Platform", "Windows first. macOS coming next."],
              ["What you get", "Full visual AI output system from day one."],
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
            What&apos;s included
          </div>
          <div className="mt-6 space-y-3">
            {[
              "Full visual output system (cards, grids, tables, flows)",
              "Desktop app with native integration",
              "Account and workspace management",
              "Export and sharing controls",
              "Privacy controls and data management",
              "Direct support channel",
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
              Submit your request to reserve a place in the launch queue.
              Your account stays connected to your invite status.
            </p>
            <p>
              Once approved, you get full access to sansxel — the desktop app,
              the visual output system, and your workspace.
            </p>
            <p>
              Start on the free tier and upgrade whenever your output needs
              grow.
            </p>
          </div>

          <div className="mt-6 grid gap-3">
            {[
              ["/account", "Open your workspace"],
              ["/pricing", "Review pricing"],
              ["/privacy", "Read the privacy policy"],
              ["/terms", "Read the terms"],
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
