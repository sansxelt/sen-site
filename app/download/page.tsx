import Link from "next/link";
import type { Metadata } from "next";
import { EarlyAccessForm } from "../../components/early-access-form";
import { SiteShell } from "../../components/site-shell";

export const metadata: Metadata = {
  title: "Access",
  description:
    "Request sansxel early access, review launch status, and see what is needed before broader desktop access opens.",
};

export default function DownloadPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              Windows early access
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Access should feel clear, stable, and earned.
            </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-200">
            sansxel is positioned as a premium Windows-first early-access
            release. People should understand what is available now, what is
            still being prepared, and where support lives before they install
            anything.
          </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/account"
                className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                Open workspace
              </Link>
              <Link
                href="#early-access"
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Request invite
              </Link>
              <Link
                href="/contact"
                className="rounded-2xl border border-white/10 bg-black/20 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/5"
              >
                Contact support
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                ["Status", "Private preview with invite-based onboarding."],
                ["Platform", "Windows first. Other platforms later."],
                ["Access", "Account creation plus manual invite review."],
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

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Launch checklist
            </div>
            <div className="mt-6 space-y-3">
              {[
                "Signed Windows installer",
                "Versioned release notes",
                "Privacy policy and Terms of Service",
                "Functional auth and account flow",
                "Support email and issue triage path",
                "Pause, export, and deletion controls",
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
          className="mt-12 grid gap-8 lg:grid-cols-[1fr_.95fr]"
        >
          <EarlyAccessForm />

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              What happens next
            </div>
            <div className="mt-6 space-y-4 text-sm leading-6 text-neutral-300">
              <p>
                Submit your request to reserve a place in the launch queue and
                keep your access path connected to your sansxel account.
              </p>
              <p>
                Once invites are approved, signed-in members can return here
                for installer access, release notes, and support guidance.
              </p>
              <p>
                If you need a team rollout or want to validate pricing before
                joining, use the linked routes below.
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
    </SiteShell>
  );
}
