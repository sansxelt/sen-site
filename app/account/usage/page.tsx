import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "../../../auth";
import {
  getSubscriptionByEmail,
  readPricingSnapshot,
} from "../../../lib/subscriptions";
import {
  getUsageSummary,
  listRecentUsage,
  type UsageRow,
} from "../../../lib/usage";

export const metadata: Metadata = {
  title: "Usage",
  description: "API usage for your sansxel account.",
};

const usageSupportHref =
  "/contact?subject=Higher%20usage%20limits&message=I%20need%20more%20usage%20for%3A%20#contact-form";

export default async function UsagePage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const subscription = readPricingSnapshot(
    await getSubscriptionByEmail(email),
  );
  const monthlyLimit = subscription.plan.apiRequestLimit;

  // Period = current calendar month
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [summary, recent] = await Promise.all([
    email ? getUsageSummary(email, periodStart) : null,
    email ? listRecentUsage(email, 25) : null,
  ]);

  const used = summary?.total_requests ?? 0;
  const pct =
    monthlyLimit && monthlyLimit > 0
      ? Math.min((used / monthlyLimit) * 100, 100)
      : 0;

  function fmt(date: Date) {
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-white">Usage</h1>
      <p className="mt-1 text-sm text-neutral-400">
        {fmt(periodStart)} – {fmt(periodEnd)}
      </p>

      <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-3xl font-semibold text-white">
              {used.toLocaleString()}
            </div>
            <div className="mt-0.5 text-sm text-neutral-400">
              of{" "}
              {monthlyLimit === null
                ? "Unlimited API"
                : `${monthlyLimit.toLocaleString()} requests`}
            </div>
          </div>
          <div className="text-right text-xs text-neutral-500">
            {subscription.plan.name} plan
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-purple-400/80 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 text-right text-xs text-neutral-500">
          {pct.toFixed(1)}% used
        </div>
      </div>

      {summary && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Chat" value={summary.chat_requests} />
          <Stat label="Copilot" value={summary.copilot_requests} />
          <Stat label="Voice in" value={summary.voice_transcribe_requests} />
          <Stat label="Voice out" value={summary.voice_speak_requests} />
        </div>
      )}

      {summary && (summary.total_input_tokens > 0 || summary.total_output_tokens > 0) && (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Tokens this month
          </div>
          <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
            <TokenRow
              label="Input"
              value={summary.total_input_tokens}
            />
            <TokenRow
              label="Output"
              value={summary.total_output_tokens}
            />
            <TokenRow
              label="Total"
              value={summary.total_tokens}
              accent
            />
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Recent activity
        </h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
          {!recent || recent.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-neutral-500">
              No requests recorded yet. Talk to sansxel-1 and refresh.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {recent.map((row) => (
                <UsageEventRow key={row.id} row={row} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-neutral-400">
        Usage resets on the 1st of each month. Need higher limits?{" "}
        <Link href={usageSupportHref} className="sansxel-subtle-link">
          Contact us.
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-xl font-semibold text-white">
        {value.toLocaleString()}
      </div>
      <div className="mt-0.5 text-xs uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </div>
    </div>
  );
}

function TokenRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </div>
      <div
        className={
          accent
            ? "mt-1 text-lg font-semibold text-purple-200"
            : "mt-1 text-lg font-semibold text-white"
        }
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function UsageEventRow({ row }: { row: UsageRow }) {
  const kindLabel = ((): string => {
    switch (row.kind) {
      case "chat":
        return "Chat";
      case "copilot":
        return "Copilot";
      case "voice_transcribe":
        return "Voice in";
      case "voice_speak":
        return "Voice out";
      default:
        return row.kind;
    }
  })();
  const ts = new Date(row.created_at);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
      <span className="w-20 shrink-0 text-xs font-medium text-neutral-300">
        {kindLabel}
      </span>
      <span className="hidden flex-1 truncate text-xs text-neutral-500 sm:inline">
        {row.model ?? "—"}
        {row.surface ? ` · ${row.surface}` : ""}
      </span>
      <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-neutral-400">
        {row.total_tokens > 0 ? `${row.total_tokens.toLocaleString()}t` : "—"}
      </span>
      <span className="ml-3 shrink-0 text-xs text-neutral-600">
        {ts.toLocaleString("en-US", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}
