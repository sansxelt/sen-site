import type { Metadata } from "next";
import { auth } from "../../../auth";
import { readSessionState } from "../../../lib/account-session";
import { getUserProfileByEmail } from "../../../lib/user-profile";
import { SettingsPanel } from "./settings-panel";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your VRAELIS account settings.",
};

export default async function SettingsPage() {
  const session = await auth();
  const profile = await getUserProfileByEmail(session?.user?.email);
  const initialSessionState = readSessionState(session, profile);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-white">Settings</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Profile, preferences, and account security.
      </p>

      <div className="mt-8 space-y-6">
        <SettingsPanel initialSessionState={initialSessionState} />
      </div>
    </div>
  );
}
