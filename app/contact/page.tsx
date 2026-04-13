import Link from "next/link";
import type { Metadata } from "next";
import { SiteShell } from "../../components/site-shell";
import { ContactForm } from "./contact-form";
import { ContactChannels } from "./contact-channels";

export const metadata: Metadata = {
  title: "Contact / Support",
  description:
    "Contact sansxel for support, privacy questions, or early-access and team rollout conversations.",
};

export default function ContactPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="max-w-3xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Contact / Support
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Support should be easy to reach before and after access opens.
          </h1>
          <p className="mt-5 text-base leading-7 text-neutral-200">
            Click the right channel below — your email client stays out of it.
            Each address goes to someone who can actually help.
          </p>
        </div>

        {/* ── Primary: email channels ──────────────────────────────────── */}
        <ContactChannels />

        {/* ── Divider + secondary label ────────────────────────────────── */}
        <div className="mt-14 flex items-center gap-4">
          <div className="h-px flex-1 bg-white/[0.06]" />
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-600">
            Not covered above?
          </span>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>

        {/* ── Secondary: overflow form ─────────────────────────────────── */}
        <div className="mt-8">
          <ContactForm />
        </div>

        {/* ── Abuse notice ─────────────────────────────────────────────── */}
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
          <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-600" />
          <p className="text-xs leading-relaxed text-neutral-600">
            This form is for genuine enquiries only. Spam, abuse, or bad-faith
            submissions will result in immediate account termination and may be
            subject to IP-level access restrictions.
          </p>
        </div>

        {/* ── Support tips + related routes ────────────────────────────── */}
        <div className="mt-10 rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <div className="text-lg font-medium text-white">
                Tips for faster support
              </div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-200">
                <p>1. Include the email address tied to your sansxel account.</p>
                <p>
                  2. Mention whether the issue is auth, early access, billing,
                  or privacy-related.
                </p>
                <p>3. Attach screenshots or the exact error message when available.</p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <div className="text-lg font-medium text-white">
                Related
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
