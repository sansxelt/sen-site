"use client";

import { useState } from "react";
import { AuthPanel, ModeSwitcher, OAuthSection, type AuthMode } from "./auth-panel";

export function AuthFlow({
  initialSessionEmail,
}: {
  initialSessionEmail: string | null;
}) {
  const [mode, setMode] = useState<AuthMode>("signup");

  return (
    <div>
      <div className="grid gap-6 xl:grid-cols-[1.08fr_.92fr] xl:items-start">
        {/* Left: header + session banner + email form */}
        <AuthPanel
          mode={mode}
          onModeChange={setMode}
          initialSessionEmail={initialSessionEmail}
        />

        {/* Right: toggle + OAuth */}
        <div className="flex flex-col gap-4">
          <ModeSwitcher mode={mode} onModeChange={setMode} />
          <OAuthSection />
        </div>
      </div>

      {/* Trust, full width, centered below */}
      <div className="mt-6 rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Trust
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Credibility has to be visible.
          </h3>
          <div className="mt-6 grid gap-3 text-sm text-neutral-200 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Email, Google, and GitHub all start from sansxel's own sign-in flow before handing off when needed.",
              "The callback returns to sansxel routes instead of a third-party auth hostname.",
              "New email accounts are created inside the same auth surface and land in the same workspace flow.",
              "Privacy, terms, pricing, and support all have real routes.",
              "Invite requests stay attached to the same account path.",
              "Secure account handling stays visible throughout the journey.",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left"
              >
                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-white" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
