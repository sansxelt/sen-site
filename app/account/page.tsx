import type { Metadata } from "next";
import { AccountPanel } from "../../components/account-panel";
import { SiteShell } from "../../components/site-shell";

export const metadata: Metadata = {
  title: "Account",
  description:
    "Manage your sen account, review rollout status, and keep setup moving before desktop access opens more broadly.",
};

export default function AccountPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Account Workspace
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Keep going after sign-in.
          </h1>
          <p className="mt-5 text-base leading-7 text-neutral-200">
            Desktop access is still invite-based, but your account should
            already give you a meaningful place to manage identity, save setup
            preferences, and stay oriented.
          </p>
        </div>

        <div className="mt-12">
          <AccountPanel />
        </div>
      </section>
    </SiteShell>
  );
}
