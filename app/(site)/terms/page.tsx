import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Review the baseline terms for VRAELIS account access, early-access usage, and support expectations.",
};

const sections = [
  {
    title: "Service scope",
    body: "VRAELIS currently offers a website experience, account creation, and invite-based early access for a Windows-first desktop product. Features may evolve as the product matures.",
  },
  {
    title: "Account responsibilities",
    body: "You are responsible for providing accurate account information, protecting your credentials, and using the service in a lawful, non-abusive manner.",
  },
  {
    title: "Early-access availability",
    body: "Desktop access may be limited, delayed, or adjusted while VRAELIS remains in a pre-release state. Features, timing, and pricing may change before general availability.",
  },
  {
    title: "Acceptable use",
    body: "Do not attempt to disrupt the service, bypass access controls, misuse other people's accounts, or use VRAELIS in a way that harms others or violates applicable law.",
  },
  {
    title: "Contact",
    body: "Questions about these terms can be sent to help@VRAELIS.ai.",
  },
];

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16 lg:px-8 lg:pt-10 lg:pb-24">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
          Terms of Service
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          Clear terms help early access feel reliable.
        </h1>
        <p className="mt-5 text-base leading-7 text-neutral-200">
          These terms set expectations for website use, account access, and the
          pre-release desktop experience.
        </p>

        <div className="mt-10 space-y-4 sm:space-y-5">
          {sections.map((section) => (
            <div
              key={section.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
            >
              <h2 className="text-lg font-medium text-white">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-neutral-200">
                {section.body}
              </p>
            </div>
          ))}
        </div>
    </section>
  );
}
