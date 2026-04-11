import Link from "next/link";
import type { Metadata } from "next";
import { SiteShell } from "../../components/site-shell";

export const metadata: Metadata = {
  title: "Contact / Support",
  description:
    "Contact sansxel for support, privacy questions, or early-access and team rollout conversations.",
};

export default function ContactPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-6 py-16 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Contact / Support
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Support should be easy to reach before and after access opens.
          </h1>
          <p className="mt-5 text-base leading-7 text-neutral-200">
            Use the direct channels below for product questions, privacy
            requests, early-access issues, or team rollout conversations.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            [
              "General support",
              "hello@sansxel.app",
              "Questions about accounts, auth, access, and onboarding.",
            ],
            [
              "Privacy requests",
              "privacy@sansxel.app",
              "Requests related to account data, deletion, export, or policy questions.",
            ],
            [
              "Teams / sales",
              "sales@sansxel.app",
              "Workspace rollout, pricing conversations, and private onboarding.",
            ],
          ].map(([title, email, description]) => (
            <a
              key={email}
              href={`mailto:${email}`}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10"
            >
              <div className="text-lg font-medium text-white">{title}</div>
              <div className="mt-3 text-sm font-medium text-neutral-200">
                {email}
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-300">
                {description}
              </p>
            </a>
          ))}
        </div>

        <div className="mt-10 rounded-[32px] border border-white/10 bg-white/5 p-8">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <div className="text-lg font-medium text-white">
                Suggested support flow
              </div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-200">
                <p>1. Include the email address tied to your sansxel account.</p>
                <p>2. Mention whether the issue is auth, early access, billing, or privacy-related.</p>
                <p>3. Add screenshots or the exact error message when available.</p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <div className="text-lg font-medium text-white">
                Related routes
              </div>
              <div className="mt-4 grid gap-3">
                {[
                  ["/download", "Launch status"],
                  ["/pricing", "Pricing"],
                  ["/privacy", "Privacy Policy"],
                  ["/terms", "Terms of Service"],
                ].map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
