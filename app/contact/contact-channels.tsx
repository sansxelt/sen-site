"use client";

import { useState } from "react";

const channels = [
  {
    title: "General support",
    email: "help@sansxel.ai",
    description: "Questions about accounts, auth, access, and onboarding.",
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

export function ContactChannels() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(email: string) {
    navigator.clipboard.writeText(email).then(() => {
      setCopied(email);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {channels.map(({ title, email, description }) => (
        <button
          key={email}
          type="button"
          onClick={() => copy(email)}
          className="rounded-3xl border border-white/10 bg-white/5 p-5 text-left transition hover:bg-white/10 sm:p-6"
        >
          <div className="text-lg font-medium text-white">{title}</div>
          <div className="mt-3 flex items-center gap-2 text-sm font-medium text-neutral-200">
            <span>{email}</span>
            {copied === email ? (
              <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                Copied
              </span>
            ) : (
              <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-500">
                Copy
              </span>
            )}
          </div>
          <p className="mt-3 text-sm leading-6 text-neutral-300">{description}</p>
        </button>
      ))}
    </div>
  );
}
