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
import { getPlanForEmail } from "../../../lib/account-billing";
import {
  getWeeklyUsage,
  nextWeekResetUtc,
  PLAN_LIMITS,
  startOfWeekUtc,
} from "../../../lib/plan-limits";

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

  // Period = current calendar month for the legacy monthly counter,
  // current UTC week for the new plan-limit gauge.
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const weekStart = startOfWeekUtc(now);
  const weekReset = nextWeekResetUtc(now);

  const [summary, recent, weeklyUsage, plan] = await Promise.all([
    email ? getUsageSummary(email, periodStart) : null,
    email ? listRecentUsage(email, 25) : null,
    email ? getWeeklyUsage(email) : null,
    email ? getPlanForEmail(email) : "free" as const,
  ]);

  const planLimit = PLAN_LIMITS[plan];
  const used = summary?.total_requests ?? 0;
  const pct =
    monthlyLimit && monthlyLimit > 0
      ? Math.min((used / monthlyLimit) * 100, 100)
      : 0;

  const weeklyChatLimit = planLimit.weekly_chat_requests;
  const weeklyChatUsed = weeklyUsage?.chat_requests ?? 0;
  const weeklyChatPct =
    weeklyChatLimit && weeklyChatLimit > 0
      ? Math.min((weeklyChatUsed / weeklyChatLimit) * 100, 100)
      : 0;
  const weeklyVoiceLimit = planLimit.weekly_voice_seconds;
  const weeklyVoiceUsed = Math.round(weeklyUsage?.voice_seconds ?? 0);

  const proThrottleNext = planLimit.pro_throttle
    ? weeklyChatUsed < planLimit.pro_throttle.smart_to_balanced
      ? planLimit.pro_throttle.smart_to_balanced - weeklyChatUsed
      : weeklyChatUsed < planLimit.pro_throttle.balanced_to_fast
        ? planLimit.pro_throttle.balanced_to_fast - weeklyChatUsed
        : 0
    : null;
  const currentProTier =
    !planLimit.pro_throttle
      ? null
      : weeklyChatUsed >= planLimit.pro_throttle.balanced_to_fast
        ? "fast"
        : weeklyChatUsed >= planLimit.pro_throttle.smart_to_balanced
          ? "balanced"
          : "smart";

  const resetIn = weekReset.getTime() - now.getTime();
  const resetDays = Math.floor(resetIn / (1000 * 60 * 60 * 24));
  const resetHours = Math.floor((resetIn / (1000 * 60 * 60)) % 24);

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
        Weekly resets {fmt(weekReset)} ({resetDays}d {resetHours}h)
      </p>

      {/* ── Weekly chat budget ────────────────────────────────────── */}
      <div className="mt-6 rounded-xl border border-purple-400/15 bg-purple-500/[0.04] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-300">
              This week
            </div>
            <div className="mt-1.5 text-2xl font-semibold text-white">
              {weeklyChatUsed.toLocaleString()}
              <span className="ml-1.5 text-sm font-normal text-neutral-400">
                of{" "}
                {weeklyChatLimit === null
                  ? "unlimited"
                  : `${weeklyChatLimit.toLocaleString()}`}{" "}
                chat requests
              </span>
            </div>
          </div>
          <div className="text-right text-xs text-neutral-500">
            {plan} plan
            <div className="mt-1 font-mono text-[10px] tracking-wider text-neutral-600">
              resets {weekReset.toUTCString().slice(0, 22)}
            </div>
          </div>
        </div>

        {weeklyChatLimit !== null && (
          <>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-purple-400 transition-all"
                style={{ width: `${weeklyChatPct}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-neutral-500">{weeklyChatPct.toFixed(1)}% used</span>
              <span className="text-neutral-500">
                {(weeklyChatLimit - weeklyChatUsed).toLocaleString()} remaining
              </span>
            </div>
          </>
        )}

        {planLimit.pro_throttle && currentProTier && (
          <div className="mt-4 rounded-lg border border-amber-400/15 bg-amber-400/[0.05] p-3 text-xs leading-5 text-amber-200/85">
            <span className="font-semibold uppercase tracking-[0.14em] text-amber-300">
              Pro throttle
            </span>
            <span className="ml-2">
              Currently serving on{" "}
              <span className="text-white">
                sansxel-1 {currentProTier === "smart" ? "deep" : currentProTier}
              </span>
              .{" "}
              {proThrottleNext && proThrottleNext > 0 ? (
                <>
                  {proThrottleNext.toLocaleString()} more requests until the
                  next downshift.
                </>
              ) : (
                <>You're on the lowest tier this week — resets {fmt(weekReset)}.</>
              )}
            </span>
          </div>
        )}

        {weeklyVoiceLimit !== null && weeklyVoiceLimit > 0 && (
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-neutral-500">Voice this week</span>
            <span className="font-mono tabular-nums text-neutral-300">
              {Math.floor(weeklyVoiceUsed / 60)}m {weeklyVoiceUsed % 60}s /{" "}
              {Math.floor(weeklyVoiceLimit / 60)}m
            </span>
          </div>
        )}
      </div>

      <h2 className="mt-10 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
        Month at a glance
      </h2>
      <p className="mt-1 text-xs text-neutral-600">
        {fmt(periodStart)} – {fmt(periodEnd)}
      </p>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-6">
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
