"use client";

import { useEffect, useState } from "react";
import { getThemeChoice, setThemeChoice } from "./theme-provider";

type Choice = "light" | "dark" | "system";

const OPTIONS: Array<{ value: Choice; label: string; sub: string }> = [
  { value: "light",  label: "Light",            sub: "Bright. Daytime work." },
  { value: "dark",   label: "Dark",             sub: "Default. Easier at night." },
  { value: "system", label: "Sync with Computer", sub: "Follows your OS theme." },
];

/**
 * Theme + cross-device sync settings card, mounted inside
 * /account/settings.
 */
export function ThemePicker() {
  const [choice, setChoice] = useState<Choice>("dark");

  useEffect(() => {
    setChoice(getThemeChoice());
  }, []);

  const apply = (next: Choice) => {
    setChoice(next);
    setThemeChoice(next);
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:rounded-3xl sm:p-6">
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 sm:text-xs">
        Appearance
      </div>
      <h2 className="mt-1.5 text-base font-semibold text-white sm:mt-2 sm:text-lg">
        Theme
      </h2>
      <p className="mt-1 text-xs text-neutral-400 sm:text-sm">
        Choose how the workshop looks. Sync with Computer follows your OS preference.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((opt) => {
          const active = choice === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => apply(opt.value)}
              className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                active
                  ? "border-violet-400/60 bg-violet-400/[0.10]"
                  : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]"
              }`}
              aria-pressed={active}
            >
              <span className={`text-sm font-semibold ${active ? "text-white" : "text-neutral-200"}`}>
                {opt.label}
              </span>
              <span className="text-xs leading-snug text-neutral-400">{opt.sub}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
