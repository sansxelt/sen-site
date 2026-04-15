import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getSignInPath } from "@/lib/auth-ui";

export const metadata: Metadata = {
  title: "Function",
  description:
    "How sansxel works - from account creation to workspace setup and picking the right tier.",
};

const steps = [
  {
    number: "01",
    title: "Create your account",
    description:
      "Start on sansxel and continue with email, Google, or GitHub through the branded app-hosted flow. No third-party auth hostnames - everything stays inside the sansxel surface.",
  },
  {
    number: "02",
    title: "Set up your workspace",
    description:
      "Save how you work, what you want sansxel to remember, and which release track fits you best. Your preferences are stored against your account from day one.",
  },
  {
    number: "03",
    title: "Install the desktop app",
    description:
      "The sansxel desktop client runs quietly in the background and tracks session activity, app state, and context signals - all stored locally first.",
  },
  {
    number: "04",
    title: "Pick your tier when ready",
    description:
      "Move from the limited free tier into stronger personal or team plans without rebuilding your account path. Billing upgrades are non-destructive.",
  },
];

export default async function FunctionPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <div className="max-w-3xl">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
          Function
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          A simpler way to recover your work context.
        </h1>
        <p className="mt-5 text-base leading-7 text-neutral-200">
          sansxel doesn&apos;t interrupt the way you work. It runs alongside it
          while tracking what matters and surfacing it when you need it.
        </p>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        {steps.map((step) => (
          <div
            key={step.number}
            className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 sm:flex-row sm:p-7"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-sm font-semibold text-white">
              {step.number}
            </div>
            <div>
              <div className="text-lg font-medium text-white">{step.title}</div>
              <p className="mt-2 text-sm leading-6 text-neutral-200">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 flex flex-col gap-3 sm:flex-row">
        <Link
          href={signedIn ? "/account" : getSignInPath("/account")}
          className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
        >
          {signedIn ? "Open workspace" : "Get started"}
        </Link>
        <Link
          href="/features"
          className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
        >
          See all features
        </Link>
      </div>
    </section>
  );
}
