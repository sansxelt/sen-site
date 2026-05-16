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

export function ResetPasswordConfirmForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
        <p className="text-sm leading-6 text-neutral-200">
          This reset link is invalid or missing. Request a new one below.
        </p>
        <Link
          href="/auth/reset-password"
          className="mt-5 inline-block text-sm text-neutral-200 transition hover:text-white"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-200">
          All done
        </div>
        <h2 className="mt-3 text-xl font-semibold text-white">
          Password updated.
        </h2>
        <p className="mt-3 text-sm leading-6 text-neutral-200">
          Your password has been changed. Sign in with your new credentials.
        </p>
        <Link
          href="/signin"
          className="VRAELIS-white-button mt-6 inline-block rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const payload = (await response.json()) as { error?: string; ok?: boolean };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "We couldn't reset your password.");
      }

      setDone(true);
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't reset your password. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white">
            New password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={loading}
            placeholder="At least 8 characters"
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
          {loading ? "Saving..." : "Set new password"}
        </button>
      </form>

      <Link
        href="/auth/reset-password"
        className="mt-5 inline-block text-sm text-neutral-200 transition hover:text-white"
      >
        ← Request a new link
      </Link>
    </div>
  );
}
