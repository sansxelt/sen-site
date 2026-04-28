"use client";

import { useState, useTransition } from "react";
import { applyAction } from "./actions";

// Apply form for signed-in non-admin users. Pre-fills the name
// from any prior submission so a re-apply doesn't start blank.

export function ContributeForm({
  defaultName = "",
  defaultReason = "",
  isResubmit = false,
}: {
  defaultName?: string;
  defaultReason?: string;
  isResubmit?: boolean;
}) {
  const [name, setName] = useState(defaultName);
  const [reason, setReason] = useState(defaultReason);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await applyAction(fd);
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(res.error);
      }
    });
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-5 py-4 text-sm leading-6 text-emerald-100">
        Application received. We&apos;ll review and email you with a decision.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">
          Name
        </span>
        <input
          name="applied_name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="The name your byline should use"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-white/30"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">
          Pitch
        </span>
        <textarea
          name="reason"
          rows={6}
          maxLength={1500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Past work (links welcome), the topics you want to cover, why these readers."
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm leading-relaxed text-neutral-100 outline-none transition focus:border-white/30"
        />
      </label>

      {error && (
        <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-neutral-500">
          Approved writers get a hardlocked byline that ships with every piece.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full border border-white/15 bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-100 disabled:opacity-60"
        >
          {pending
            ? "Sending…"
            : isResubmit
              ? "Resubmit"
              : "Submit application"}
        </button>
      </div>
    </form>
  );
}
