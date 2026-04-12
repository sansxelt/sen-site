import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Usage",
  description: "API usage for your sansxel account.",
};

const MONTHLY_LIMIT = 10_000;

export default function UsagePage() {
  const used = 0;
  const pct = Math.min((used / MONTHLY_LIMIT) * 100, 100);

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  function fmt(d: Date) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-white">Usage</h1>
      <p className="mt-1 text-sm text-neutral-400">
        {fmt(periodStart)} – {fmt(periodEnd)}
      </p>

      {/* Gauge card */}
      <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-3xl font-semibold text-white">
              {used.toLocaleString()}
            </div>
            <div className="mt-0.5 text-sm text-neutral-400">
              of {MONTHLY_LIMIT.toLocaleString()} requests
            </div>
          </div>
          <div className="text-right text-xs text-neutral-500">
            Free plan
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-white/70 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 text-right text-xs text-neutral-500">
          {pct.toFixed(1)}% used
        </div>
      </div>

      {/* Breakdown placeholder */}
      <div className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          Daily breakdown
        </h2>
        <div className="mt-3 flex h-32 items-end gap-1">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-white/5"
              style={{ height: "100%" }}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-neutral-600">No requests recorded yet.</p>
      </div>

      {/* Info */}
      <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-neutral-400">
        Usage resets on the 1st of each month. Need higher limits?{" "}
        <a href="mailto:hello@sansxel.app" className="text-neutral-300 underline underline-offset-2 hover:text-white transition">
          Contact us.
        </a>
      </div>
    </div>
  );
}
