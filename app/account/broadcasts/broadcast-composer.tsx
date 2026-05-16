"use client";

import { useState, useTransition } from "react";
import { sendBroadcastAction } from "./actions";

// Owner broadcast composer. Subject + audience picker + markdown
// body. Submitting calls the server action which fans the email
// out through Resend and persists the audit row. State machine
// is intentionally tiny (idle / sending / sent / error) since
// broadcasts are infrequent and a hard refresh after each send
// is fine.

export function BroadcastComposer() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "free" | "paid">("all");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "ok"; delivered: number; failed: number; total: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      !confirm(
        `Send "${subject}" to ${
          audience === "all"
            ? "every signed-up user"
            : audience === "paid"
              ? "paid subscribers only"
              : "free users only"
        }?`,
      )
    ) {
      return;
    }
    setStatus({ kind: "idle" });
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await sendBroadcastAction(fd);
      if (res.ok) {
        setStatus({
          kind: "ok",
          delivered: res.delivered,
          failed: res.failed,
          total: res.recipientCount,
        });
        setSubject("");
        setBody("");
      } else {
        setStatus({ kind: "error", message: res.error });
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
    >
      <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-neutral-300">
        New broadcast
      </h2>

      <label className="block space-y-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
          Subject
        </span>
        <input
          name="subject"
          required
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject line readers see in their inbox"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-white/30"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
          Audience
        </span>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { value: "all", label: "Everyone", sub: "Every signed-up account" },
            { value: "free", label: "Free only", sub: "Excludes paid subs" },
            { value: "paid", label: "Paid only", sub: "Subscribers (any tier)" },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`cursor-pointer rounded-lg border p-3 transition ${
                audience === opt.value
                  ? "border-violet-400/40 bg-violet-400/[0.10]"
                  : "border-white/10 bg-black/20 hover:border-white/20"
              }`}
            >
              <input
                type="radio"
                name="audience"
                value={opt.value}
                checked={audience === opt.value}
                onChange={() =>
                  setAudience(opt.value as "all" | "free" | "paid")
                }
                className="sr-only"
              />
              <div className="text-sm font-medium text-white">{opt.label}</div>
              <div className="mt-0.5 text-[11px] text-neutral-500">
                {opt.sub}
              </div>
            </label>
          ))}
        </div>
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
          Body (markdown)
        </span>
        <textarea
          name="body_md"
          required
          maxLength={20000}
          rows={12}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What did you ship? Why does it matter? Link to docs / pricing / a video."
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-[13px] leading-relaxed text-neutral-100 outline-none transition focus:border-white/30"
        />
        <div className="mt-1 text-[11px] text-neutral-500">
          Supports paragraphs, **bold**, *italic*, `inline code`, and
          [links](https://). Plain enough to feel personal, polished
          enough to look intentional.
        </div>
      </label>

      {status.kind === "ok" && (
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-2 text-sm text-emerald-200">
          Sent. {status.delivered}/{status.total} delivered
          {status.failed > 0 && (
            <>, {status.failed} failed (check the log)</>
          )}
          .
        </div>
      )}
      {status.kind === "error" && (
        <div className="rounded-lg border border-rose-400/20 bg-rose-400/[0.08] px-3 py-2 text-sm text-rose-200">
          {status.message}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-neutral-500">
          Sends from <code className="text-neutral-300">hello@vraelis.ai</code>
          . Recipients see the rendered HTML.
        </p>
        <button
          type="submit"
          disabled={pending || !subject.trim() || !body.trim()}
          className="rounded-full border border-white/15 bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-100 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send broadcast"}
        </button>
      </div>
    </form>
  );
}
