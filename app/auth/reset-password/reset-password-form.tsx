"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type StatusTone = "error" | "success";
type Status = { message: string; tone: StatusTone };

function statusClasses(tone: StatusTone) {
  return tone === "success"
    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
    : "border-rose-400/20 bg-rose-400/10 text-rose-100";
}

export function ResetPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json()) as { error?: string; ok?: boolean };

      if (!response.ok) {
        throw new Error(payload.error ?? "We couldn't send the reset link.");
      }

      setSent(true);
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't send the reset link. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-200">
          Check your inbox
        </div>
        <h2 className="mt-3 text-xl font-semibold text-white">
          Reset link sent.
        </h2>
        <p className="mt-3 text-sm leading-6 text-neutral-200">
          If an email-based account exists for{" "}
          <span className="text-white">{email}</span>, you will receive a reset
          link shortly. It expires in one hour.
        </p>
        <Link
          href="/signin"
          className="mt-6 inline-block text-sm text-neutral-200 transition hover:text-white"
        >
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            placeholder="you@example.com"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {status && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${statusClasses(status.tone)}`}
          >
            {status.message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="VRAELIS-white-button w-full rounded-2xl bg-white px-6 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <Link
        href="/signin"
        className="mt-5 inline-block text-sm text-neutral-200 transition hover:text-white"
      >
        ← Back to sign in
      </Link>
    </div>
  );
}
