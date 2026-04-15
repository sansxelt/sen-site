import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getSignInPath } from "@/lib/auth-ui";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Automatic context, timeline search, and privacy-first design — everything sansxel tracks so you don't have to.",
};

const features = [
  {
    title: "Automatic context",
    description:
      "sansxel quietly understands what you were doing across desktop sessions so resuming work feels instant instead of reconstructive.",
  },
  {
    title: "Ask your timeline",
    description:
      "Search, summarize, and recover momentum from your own activity history without digging through tabs and chat threads.",
  },
  {
    title: "Built for privacy",
    description:
      "Clear controls, visible tracking, and product language that treats sensitive context like a responsibility.",
  },
  {
    title: "Session continuity",
    description:
      "Pick up exactly where you left off — sansxel holds the thread between sessions so context doesn't leak between task switches.",
  },
  {
    title: "Workspace memory",
    description:
      "Your tools, your patterns, and your active state are all tracked so your environment reflects where you actually are in the work.",
  },
  {
    title: "Deep AI integration",
    description:
      "Query your own history with natural language. sansxel turns your activity log into something you can actually reason with.",
  },
];

export default async function FeaturesPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Features
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Context first. Friction low.
          </h1>
          <p className="mt-5 text-base leading-7 text-neutral-200">
            sansxel is designed to stay out of the way until you need memory,
            continuity, and fast re-entry into real work.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
            >
              <div className="text-lg font-medium text-white">{feature.title}</div>
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/pricing"
            className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
          >
            See pricing
          </Link>
          <Link
            href={signedIn ? "/account" : getSignInPath("/account")}
            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
          >
            {signedIn ? "Open workspace" : "Get started"}
          </Link>
        </div>
    </section>
  );
}
