"use client";

import { useState } from "react";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function SendButton({
  sampleKey,
  defaultTo,
}: {
  sampleKey: string;
  defaultTo: string;
}) {
  const [to, setTo] = useState(defaultTo);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSend() {
    if (!to.trim()) {
      setStatus({ kind: "error", message: "Enter a recipient email." });
      return;
    }
    setStatus({ kind: "sending" });

    try {
      const res = await fetch("/api/dev/email-send", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ key: sampleKey, to: to.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus({ kind: "error", message: data.error ?? `HTTP ${res.status}` });
        return;
      }
      setStatus({ kind: "ok" });
      setTimeout(() => setStatus({ kind: "idle" }), 3500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setStatus({ kind: "error", message });
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="you@example.com"
          className="w-64 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:border-white/30 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={status.kind === "sending"}
          className="rounded-lg border border-white/10 bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status.kind === "sending" ? "Sending…" : "Send"}
        </button>
      </div>
      {status.kind === "ok" && (
        <div className="text-[11px] text-emerald-400">Sent — check inbox.</div>
      )}
      {status.kind === "error" && (
        <div className="max-w-xs text-right text-[11px] text-rose-400">
          {status.message}
        </div>
      )}
    </div>
  );
}
