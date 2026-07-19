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
      <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={handleCreate} disabled={busy} className="btn" style={{ flex: 1, minWidth: 140, opacity: busy ? 0.6 : 1 }}>
          {busy ? "Creating…" : "Create account"}
        </button>
        <button type="button" onClick={handleCancel} disabled={busy} className="btn btn--ghost" style={{ flex: 1, minWidth: 120, opacity: busy ? 0.6 : 1 }}>
          Cancel
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 16, borderRadius: "var(--r-sm)", border: "1px solid rgba(178,58,58,0.25)", background: "rgba(178,58,58,0.08)", color: "#9F2D2D", padding: "10px 14px", fontSize: 12.5, lineHeight: 1.5 }}>
          {error}
        </div>
      )}
    </>
  );
}
