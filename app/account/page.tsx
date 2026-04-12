import type { Metadata } from "next";
import { auth } from "../../auth";
import { AccountPanel } from "../../components/account-panel";
import { readSessionState } from "../../lib/account-session";
import { SiteShell } from "../../components/site-shell";
import { getUserProfileByEmail } from "../../lib/user-profile";

export const metadata: Metadata = {
  title: "Account",
  description:
    "Manage your sansxel account, review rollout status, and keep setup moving before desktop access opens more broadly.",
};

export default async function AccountPage() {
  const session = await auth();
  const profile = await getUserProfileByEmail(session?.user?.email);
  const initialSessionState = readSessionState(session, profile);

  return (
    <SiteShell>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Account Workspace
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Keep going after sign-in.
          </h1>
          <p className="mt-5 text-base leading-7 text-neutral-200">
            Desktop access is still invite-based, but your account should
            already give you a meaningful place to manage identity, save setup
            preferences, and stay oriented.
          </p>
        </div>

        <div className="mt-10 sm:mt-12">
          <AccountPanel initialSessionState={initialSessionState} />
        </div>
      </section>
    </SiteShell>
  );
}
