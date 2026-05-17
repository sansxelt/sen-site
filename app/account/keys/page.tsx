import type { Metadata } from "next";
import { auth } from "../../../auth";
import { listApiKeys } from "../../../lib/api-keys";
import { KeysPanel } from "./keys-panel";

export const metadata: Metadata = {
  title: "API Keys",
  description: "Manage your Vraelis API keys.",
};

export default async function KeysPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const keys = await listApiKeys(email);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-white">API Keys</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Keys authenticate your desktop client and other integrations. Each key
        is shown once, store it somewhere safe.
      </p>

      <div className="mt-8">
        <KeysPanel initialKeys={keys} />
      </div>
    </div>
  );
}
