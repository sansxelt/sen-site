"use client";

import { useState, useEffect, type FormEvent } from "react";
import { createPortal } from "react-dom";

interface Props {
  to: string;
  toLabel: string;
  onClose: () => void;
}

export function EmailComposer({ to, toLabel, onClose }: Props) {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [sent, setSent]       = useState(false);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          subject,          // raw, no prefix — server handles channel tagging
          message,
          to,               // routes server-side to help@/sales@/privacy@
          channel: toLabel, // shown inside the support email body
          website,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to send.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Composer card */}
      <div
        className="w-full max-w-lg rounded-[28px] border border-white/[0.18] bg-[#0c0c0c] shadow-2xl"
        style={{ animation: "composerIn 180ms ease forwards" }}
      >
        <style>{`
          @keyframes composerIn {
            from { opacity: 0; transform: scale(0.96) translateY(8px); }
            to   { opacity: 1; transform: scale(1)    translateY(0); }
          }
        `}</style>

        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-white/[0.12] px-5 py-4">
          <span className="text-sm font-medium text-white">New message</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {sent ? (
          /* Success state */
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10l4.5 4.5L16 6" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="text-base font-medium text-white">Message sent</div>
            <p className="text-sm text-neutral-500">
              We&apos;ll reply to <span className="text-neutral-300">{email}</span> as soon as possible.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2 text-sm text-neutral-300 transition hover:bg-white/10 hover:text-white"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Honeypot */}
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", opacity: 0 }}
            />
            {/* To row */}
            <div className="flex items-center gap-3 border-b border-white/[0.12] px-5 py-3">
              <span className="shrink-0 text-xs text-neutral-600">To</span>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-neutral-200">
                  {to}
                </span>
                <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] text-neutral-600">
                  {toLabel}
                </span>
              </div>
            </div>

            <div className="space-y-0 divide-y divide-white/[0.12]">
              {/* Name + Email row */}
              <div className="grid grid-cols-2">
                <div className="border-r border-white/[0.12]">
                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    className="w-full bg-transparent px-5 py-3.5 text-sm text-white outline-none placeholder:text-neutral-600 disabled:opacity-50"
                  />
                </div>
                <div>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full bg-transparent px-5 py-3.5 text-sm text-white outline-none placeholder:text-neutral-600 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Subject */}
              <input
                type="text"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-transparent px-5 py-3.5 text-sm text-white outline-none placeholder:text-neutral-600 disabled:opacity-50"
              />

              {/* Message */}
              <textarea
                placeholder="Write your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={6}
                disabled={loading}
                className="w-full resize-none bg-transparent px-5 py-4 text-sm text-white outline-none placeholder:text-neutral-600 disabled:opacity-50"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/[0.12] px-5 py-4">
              {error ? (
                <p className="text-xs text-rose-400">{error}</p>
              ) : (
                <p className="text-xs text-neutral-600">
                  Reply goes to your email address.
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="sansxel-white-button rounded-xl bg-white px-5 py-2 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
