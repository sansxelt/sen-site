"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

type Props = {
  email:    string;
  provider: string;
  name:     string;
  token:    string;
};

export function ConfirmSignupForm({ email, provider, name, token }: Props) {
  const router = useRouter();
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/confirm-signup", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ email, provider, name, token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }

      // Profile exists now. Kick OAuth back off, the provider is still
      // logged in upstream, so this round-trip is silent for the user.
      await signIn(provider, { callbackUrl: "/account" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setBusy(false);
    }
  }

  function handleCancel() {
    router.push("/");
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy}
          className="VRAELIS-white-button flex-1 rounded-2xl bg-white px-5 py-3 text-center text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create account"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={busy}
          className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/[0.08] px-4 py-3 text-xs leading-5 text-rose-200">
          {error}
        </div>
      )}
    </>
  );
}
