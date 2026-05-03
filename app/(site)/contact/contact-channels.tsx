"use client";

import { useState } from "react";
import { EmailComposer } from "./email-composer";

const channels = [
  {
    title: "General support",
    email: "help@sansxel.ai",
    description: "Accounts, auth, access, onboarding. Also where you apply to write for Learn. Send your name, past work, and the topics you want to cover. Approved writers get a hardlocked byline.",
  },
  {
    title: "Privacy requests",
    email: "privacy@sansxel.ai",
    description: "Requests related to account data, deletion, export, or policy questions.",
  },
  {
    title: "Teams / sales",
    email: "sales@sansxel.ai",
    description: "Workspace rollout, pricing conversations, and private onboarding.",
  },
];

const DISCORD_HREF = "https://discord.gg/5sxuuewf3u";

export function ContactChannels() {
  const [copied, setCopied]     = useState<string | null>(null);
  const [composing, setComposing] = useState<{ email: string; title: string } | null>(null);

  function copy(e: React.MouseEvent, email: string) {
    e.stopPropagation();
    navigator.clipboard.writeText(email).then(() => {
      setCopied(email);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {channels.map(({ title, email, description }) => (
          <button
            key={title}
            type="button"
            onClick={() => setComposing({ email, title })}
            className="group cursor-pointer rounded-3xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-white/20 hover:bg-white/10 active:scale-[0.98] sm:p-6"
          >
            <div className="text-lg font-medium text-white">{title}</div>

            <div className="mt-3 flex items-center gap-2 text-sm font-medium text-neutral-200">
              <span>{email}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => copy(e, email)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") copy(e as unknown as React.MouseEvent, email); }}
                className={`inline-flex min-h-[24px] items-center rounded-md border px-2 py-1 text-[11px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 ${
                  copied === email
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                    : "border-white/10 bg-white/5 text-neutral-400 group-hover:border-white/20 group-hover:text-neutral-200"
                }`}
              >
                {copied === email ? "Copied ✓" : "Copy"}
              </span>
            </div>

            <p className="mt-3 text-sm leading-6 text-neutral-300">{description}</p>

            <div className="mt-4 flex items-center gap-1.5 text-[11px] text-neutral-600 transition group-hover:text-neutral-400">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0">
                <rect x="1" y="2" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
                <path d="M1 4.5l5 3 5-3" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
              </svg>
              Click to compose
            </div>
          </button>
        ))}
      </div>

      {/* Discord card — fastest path for real-time help */}
      <a
        href={DISCORD_HREF}
        target="_blank"
        rel="noopener noreferrer"
        className="group cursor-pointer rounded-3xl border border-[rgba(88,101,242,0.22)] bg-[rgba(88,101,242,0.06)] p-5 text-left transition hover:border-[rgba(88,101,242,0.40)] hover:bg-[rgba(88,101,242,0.10)] sm:p-6 sm:col-span-2 lg:col-span-1"
        style={{ display: "block", textDecoration: "none" }}
      >
        <div className="text-lg font-medium text-white">Discord community</div>
        <div className="mt-3 text-sm font-medium" style={{ color: "rgba(148,163,255,0.80)" }}>
          discord.gg/5sxuuewf3u
        </div>
        <p className="mt-3 text-sm leading-6 text-neutral-300">
          Fastest path to a real answer. Create a ticket in the server — the team monitors it daily.
          Also where early users, feedback loops, and product updates live.
        </p>
        <div className="mt-4 flex items-center gap-1.5 text-[11px] text-neutral-600 transition group-hover:text-[rgba(148,163,255,0.70)]">
          ◈ &nbsp;Open Discord →
        </div>
      </a>

      {composing && (
        <EmailComposer
          to={composing.email}
          toLabel={composing.title}
          onClose={() => setComposing(null)}
        />
      )}
    </>
  );
}
