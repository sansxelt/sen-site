"use client";

import { useState, type FormEvent } from "react";

export function ResendVerification({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [email,   setEmail]   = useState(defaultEmail);
  const [status,  setStatus]  = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage(null);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Could not send verification email.");
        return;
      }

      setStatus("sent");
      setMessage("If that email has a pending signup, a fresh verification link is on the way. Check your inbox (and spam folder).");
    } catch {
      setStatus("error");
      setMessage("Network error. Try again in a minute.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-3">
      <label className="block text-xs font-medium uppercase tracking-[0.15em] text-neutral-400">
        Your email
      </label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-white/25"
      />

      {message && (
        <div
          className={`rounded-xl border p-3 text-xs leading-relaxed ${
            status === "error"
              ? "border-rose-400/20 bg-rose-400/5 text-rose-200"
              : "border-emerald-400/20 bg-emerald-400/5 text-emerald-200"
          }`}
        >
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={status === "loading" || status === "sent"}
        className="sansxel-white-button w-full rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading" ? "Sending…"
        : status === "sent"    ? "Sent, check your inbox"
                               : "Send a new link"}
      </button>
    </form>
  );
}
