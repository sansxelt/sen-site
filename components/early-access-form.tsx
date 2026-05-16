"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { AccountContext } from "../lib/account-session";

type StatusTone = "error" | "success";
type Status = {
  message: string;
  tone: StatusTone;
};

function statusClasses(tone: StatusTone) {
  return tone === "success"
    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
    : "border-rose-400/20 bg-rose-400/10 text-rose-100";
}

function formatRequestedAt(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Request already saved for this account.";
  }

  return `Request already saved on ${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date)}.`;
}

export function EarlyAccessForm({
  initialAccountContext,
}: {
  initialAccountContext: AccountContext;
}) {
  const [name, setName] = useState(initialAccountContext?.name ?? "");
  const [email, setEmail] = useState(initialAccountContext?.email ?? "");
  const [focusArea, setFocusArea] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [accountContext, setAccountContext] =
    useState<AccountContext>(initialAccountContext);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          focusArea,
          name,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        requestedAt?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error ?? "We couldn't save your request right now.",
        );
      }

      if (
        accountContext?.email &&
        accountContext.email.toLowerCase() === email.trim().toLowerCase()
      ) {
        setAccountContext({
          email: accountContext.email,
          name: name.trim() || accountContext.name,
          requestedAt: payload.requestedAt ?? accountContext.requestedAt,
        });
      }

      setStatus({
        tone: "success",
        message:
          "Your invite request is on file. We'll reach out as access opens for your account.",
      });
      setName((current) => (accountContext?.email ? current : ""));
      setEmail((current) => (accountContext?.email ? current : ""));
      setFocusArea("");
    } catch (error) {
      console.error("Early access request failed:", error);
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't save your request right now.",
      });
    } finally {
      setLoading(false);
    }
  }

  const existingRequestMessage = formatRequestedAt(accountContext?.requestedAt ?? null);

  return (
    <div className="rounded-[32px] border border-white/12 bg-black/25 p-5 sm:p-8">
      <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-200">
        Early Access
      </div>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
        Request your invite.
      </h3>
      <p className="mt-4 text-sm leading-6 text-neutral-200">
        Reserve a place in the rollout with clear support, privacy language,
        and account-linked access from the start.
      </p>

      {accountContext && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <div className="text-sm font-medium text-white">
            Signed in as {accountContext.email}
          </div>
          <p className="mt-2 text-sm leading-6 text-neutral-200">
            We can keep this invite request tied to your existing account so
            the next step feels continuous instead of manual.
          </p>
          {existingRequestMessage && (
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-100">
              {existingRequestMessage}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25"
        />
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25"
          required
        />
        <textarea
          value={focusArea}
          onChange={(event) => setFocusArea(event.target.value)}
          placeholder="What do you want VRAELIS to help you recover or remember?"
          rows={4}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25"
        />
        <button
          type="submit"
          disabled={loading}
          className="VRAELIS-white-button w-full rounded-2xl bg-white px-6 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed"
        >
          {loading ? "Saving request..." : "Join early access"}
        </button>
      </form>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
        <div className="text-sm font-medium text-white">
          Built for trust from the start
        </div>
        <p className="mt-2 text-sm leading-6 text-neutral-200">
          We review access carefully, keep the path intentional, and link the
          policies you need before installer access opens up.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm text-neutral-100">
          <Link href="/privacy" className="VRAELIS-subtle-link">
            Privacy Policy
          </Link>
          <Link href="/terms" className="VRAELIS-subtle-link">
            Terms of Service
          </Link>
          <Link href="/contact" className="VRAELIS-subtle-link">
            Contact / Support
          </Link>
        </div>
      </div>

      {status && (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${statusClasses(
            status.tone,
          )}`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
