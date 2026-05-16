import Link from "next/link";
import type { Metadata } from "next";
import { AuroraBackground } from "@/components/aurora-background";
import { Reveal } from "@/components/landing/reveal";
import { ContactForm } from "./contact-form";
import { ContactChannels } from "./contact-channels";

export const metadata: Metadata = {
  title: "Contact / Support",
  description:
    "Contact vraelis for support, privacy questions, or early-access and team rollout conversations.",
};

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialSubject = readParam(params, "subject");
  const initialMessage = readParam(params, "message");

  return (
    <>
      <AuroraBackground />
      <section className="mx-auto max-w-5xl px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16 lg:px-8 lg:pt-10 lg:pb-24">
      <Reveal as="div" className="max-w-3xl">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
          Contact / Support
        </div>
        <h1 className="hx-gradient-text mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
          Support should be easy to reach before and after access opens.
        </h1>
        <p className="mt-5 text-base leading-7 text-neutral-200">
          Use the right channel below without leaving the site. Every path here
          leads somewhere real.
        </p>
      </Reveal>

      <Reveal delay={0.1}>
        <ContactChannels />
      </Reveal>

      <Reveal as="div" delay={0.05} className="mt-14 flex items-center gap-4">
        <div className="h-px flex-1 bg-white/[0.06]" />
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-600">
          Not covered above?
        </span>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </Reveal>

      <Reveal as="div" className="mt-8">
        <ContactForm
          initialMessage={initialMessage}
          initialSubject={initialSubject}
        />
      </Reveal>

      <Reveal as="div" className="mt-5 flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
        <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-600" />
        <p className="text-xs leading-relaxed text-neutral-600">
          This form is for genuine enquiries only. Spam, abuse, or bad-faith
          submissions will result in immediate account termination and may be
          subject to IP-level access restrictions.
        </p>
      </Reveal>

      <Reveal as="div" className="mt-10 rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <div className="text-lg font-medium text-white">
              Tips for faster support
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-200">
              <p>1. Include the email address tied to your vraelis account.</p>
              <p>
                2. Mention whether the issue is auth, early access, billing, or
                privacy-related.
              </p>
              <p>
                3. Attach screenshots or the exact error message when available.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
            <div className="text-lg font-medium text-white">Related</div>
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
      </Reveal>

      <Reveal as="div" className="mt-6">
        <a
          href="https://discord.gg/5sxuuewf3u"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between rounded-3xl border border-[rgba(88,101,242,0.22)] bg-[rgba(88,101,242,0.06)] p-5 transition hover:border-[rgba(88,101,242,0.40)] hover:bg-[rgba(88,101,242,0.10)] sm:p-6"
        >
          <div>
            <div className="text-base font-medium text-white">Discord community</div>
            <p className="mt-1 text-sm text-neutral-400">
              Fastest path to a real answer. The team monitors it daily — also where early users, feedback loops, and product updates live.
            </p>
          </div>
          <div className="ml-6 shrink-0 text-sm font-medium transition" style={{ color: "rgba(148,163,255,0.80)" }}>
            discord.gg/5sxuuewf3u →
          </div>
        </a>
      </Reveal>
      </section>
    </>
  );
}
