"use client";

import { useEffect, useState, type FormEvent } from "react";

type StatusTone = "error" | "success";
type Status = { message: string; tone: StatusTone };

function statusClasses(tone: StatusTone) {
  return tone === "success"
    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
    : "border-rose-400/20 bg-rose-400/10 text-rose-100";
}

export function ContactForm({
  initialMessage = "",
  initialSubject = "",
}: {
  initialMessage?: string;
  initialSubject?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState(initialMessage);
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setSubject(initialSubject);
  }, [initialSubject]);

  useEffect(() => {
    setMessage(initialMessage);
  }, [initialMessage]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message, website }),
      });

      const payload = (await response.json()) as {
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "We couldn't send your message.");
      }

      setSent(true);
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't send your message. Please try again or email us directly.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-200">
          Message sent
        </div>
        <h2 className="mt-3 text-xl font-semibold text-white">
          We received your message.
        </h2>
        <p className="mt-3 text-sm leading-6 text-neutral-200">
          We will reply to <span className="text-white">{email}</span> as soon as
          possible.
        </p>
      </div>
    );
  }

  return (
    <div
      id="contact-form"
      className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8"
    >
      <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-200">
        Send a message
      </div>
      <h2 className="mt-3 text-xl font-semibold text-white">
        Get in touch directly.
      </h2>
      <p className="mt-2 text-sm leading-6 text-neutral-200">
        We will reply to your email address. For account issues, include the
        email tied to your sansxel account.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "-9999px",
            width: "1px",
            height: "1px",
            opacity: 0,
          }}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-white">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              placeholder="Your name"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white">
              Email <span className="text-rose-400">*</span>
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
        </div>

        <div>
          <label className="block text-sm font-medium text-white">
            Subject <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            disabled={loading}
            placeholder="Account issue, early access, billing..."
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white">
            Message <span className="text-rose-400">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={5}
            disabled={loading}
            placeholder="Describe your issue or question..."
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {status && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${statusClasses(
              status.tone,
            )}`}
          >
            {status.message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed"
        >
          {loading ? "Sending..." : "Send message"}
        </button>
      </form>
    </div>
  );
}
