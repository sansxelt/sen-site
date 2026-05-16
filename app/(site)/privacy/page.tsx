import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read how VRAELIS handles account access, usage context, support requests, and privacy controls.",
};

const sections = [
  {
    title: "What VRAELIS collects",
    body: "VRAELIS may collect the account details you provide, sign-in activity, product usage context, support messages, and early-access requests you explicitly submit.",
  },
  {
    title: "Why it is collected",
    body: "We use that information to create and protect accounts, keep access stable, help people recover context, improve reliability, and respond to support or privacy requests.",
  },
  {
    title: "How control stays visible",
    body: "VRAELIS is designed around clear account access, visible policies, and product controls that make it easier to understand how information is handled over time.",
  },
  {
    title: "Security and trusted infrastructure",
    body: "We use trusted infrastructure partners to support secure account access and data handling, while keeping the experience branded and managed as VRAELIS.",
  },
  {
    title: "Privacy questions",
    body: "For privacy questions, export requests, or account deletion inquiries, contact help@VRAELIS.ai from the email address tied to your VRAELIS account.",
  },
];

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16 lg:px-8 lg:pt-10 lg:pb-24">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
          Privacy Policy
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          Privacy should be explicit, understandable, and easy to find.
        </h1>
        <p className="mt-5 text-base leading-7 text-neutral-200">
          This policy outlines the baseline expectations for
          VRAELIS&apos;s website, account system, and early-access
          experience.
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
