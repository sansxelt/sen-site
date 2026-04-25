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
import { getWeeklyUsage, nextWeekResetUtc, PLAN_LIMITS } from "../../../lib/plan-limits";
import {
  getPlanActionHref,
  getPricingPlan,
  type PricingPlan,
  type PricingPlanKey,
} from "../../../lib/pricing";

export const metadata: Metadata = {
  title: "Usage",
  description: "API usage for your sansxel account.",
};

const usageSupportHref =
  "/contact?subject=Higher%20usage%20limits&message=I%20need%20more%20usage%20for%3A%20#contact-form";

const personalUpgradeOrder: PricingPlanKey[] = [
  "free",
  "apprentice",
  "studio",
  "pro",
];

export default async function UsagePage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const subscription = readPricingSnapshot(
    await getSubscriptionByEmail(email),
  );
  const currentPlan = subscription.plan;
  const monthlyLimit = currentPlan.apiRequestLimit;

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const weekReset = nextWeekResetUtc(now);

  const [summary, recent, weeklyUsage, plan] = await Promise.all([
    email ? getUsageSummary(email, periodStart) : null,
    email ? listRecentUsage(email, 25) : null,
    email ? getWeeklyUsage(email) : null,
    email ? getPlanForEmail(email) : ("free" as const),
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
  const suggestedUpgrade = getSuggestedUpgrade(currentPlan.key);
  const suggestedUpgradeLimits = suggestedUpgrade
    ? PLAN_LIMITS[suggestedUpgrade.key]
    : null;

  function fmt(date: Date) {
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-white">Usage</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Weekly resets {fmt(weekReset)} ({resetDays}d {resetHours}h)
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]">
        <div className="rounded-xl border border-purple-400/15 bg-purple-500/[0.04] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-300">
                This week
              </div>
              <div className="mt-1.5 text-2xl font-semibold text-white">
                {weeklyChatUsed.toLocaleString()}
                <span className="ml-1.5 text-sm font-normal text-neutral-400">
                  /{" "}
                  {weeklyChatLimit === null
                    ? "unlimited"
                    : weeklyChatLimit.toLocaleString()}
                </span>
              </div>
              <div className="mt-1 text-sm text-neutral-400">
                Chat requests on the {currentPlan.name} plan
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-right text-xs text-neutral-400">
              <div className="font-medium text-white">{currentPlan.name}</div>
              <div className="mt-1 text-[11px] text-neutral-500">
                resets {weekReset.toUTCString().slice(0, 22)}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <UsageChip>{currentPlan.name} plan</UsageChip>
            <UsageChip>{currentPlan.memoryWindow}</UsageChip>
            <UsageChip>{formatVoiceBudget(weeklyVoiceLimit)}</UsageChip>
            <UsageChip>{formatMonthlyApiBudget(monthlyLimit)}</UsageChip>
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
                <span className="text-neutral-500">
                  {weeklyChatPct.toFixed(1)}% used
                </span>
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
                  <>You&apos;re on the lowest tier this week - resets {fmt(weekReset)}.</>
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

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Current plan
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xl font-semibold text-white">
                  {currentPlan.name}
                </span>
                {/* v0.1.13 \u2014 Plan status badge so users always know
                    whether their plan is Active, Comped, or Cancelling.
                    Was missing entirely before \u2014 the page just said
                    "Pro" with no answer to "is this still active?". */}
                {(() => {
                  if (currentPlan.key === "free") {
                    return (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                        Free
                      </span>
                    );
                  }
                  if (subscription.status === "active") {
                    return (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                        Active
                      </span>
                    );
                  }
                  if (subscription.status === "canceled") {
                    return (
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
                        Canceled
                      </span>
                    );
                  }
                  if (subscription.status === "selection_pending") {
                    return (
                      <span className="rounded-full border border-purple-400/30 bg-purple-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-purple-300">
                        Comped \u00b7 no card needed
                      </span>
                    );
                  }
                  if (subscription.status === "contact_required") {
                    return (
                      <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300">
                        Contact required
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="mt-1 text-sm text-neutral-400">
                {currentPlan.monthlyLabel}
              </div>
            </div>

            <Link
              href="/account#billing"
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/[0.07]"
            >
              Manage
            </Link>
          </div>

          <p className="mt-3 text-sm leading-6 text-neutral-400">
            {currentPlan.description}
          </p>

          <div className="mt-3 text-xs text-neutral-500">{currentPlan.note}</div>

          <div className="mt-4 grid gap-2">
            <PlanFact label="Memory" value={currentPlan.memoryWindow} />
            <PlanFact
              label="Monthly API"
              value={formatMonthlyApiBudget(monthlyLimit)}
            />
            <PlanFact
              label="Weekly chat"
              value={formatChatBudget(weeklyChatLimit)}
            />
            <PlanFact
              label="Weekly voice"
              value={formatVoiceBudget(weeklyVoiceLimit)}
            />
          </div>

          {suggestedUpgrade && suggestedUpgradeLimits ? (
            <div className="mt-4 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.05] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Upgrade path
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Upgrade to {suggestedUpgrade.name}
                  </div>
                  <div className="mt-1 text-xs text-emerald-100/75">
                    {suggestedUpgrade.monthlyLabel}
                  </div>
                </div>
                <Link
                  href={getPlanActionHref(suggestedUpgrade)}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:opacity-90"
                >
                  Upgrade to {suggestedUpgrade.name} →
                </Link>
              </div>

              <p className="mt-3 text-xs leading-5 text-emerald-100/75">
                {suggestedUpgrade.description}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <UsageChip tone="accent">
                  {formatChatBudget(suggestedUpgradeLimits.weekly_chat_requests)}
                </UsageChip>
                <UsageChip tone="accent">
                  {formatVoiceBudget(suggestedUpgradeLimits.weekly_voice_seconds)}
                </UsageChip>
                <UsageChip tone="accent">
                  {suggestedUpgrade.memoryWindow}
                </UsageChip>
              </div>

              <Link
                href="/pricing"
                className="mt-3 inline-flex text-xs text-emerald-200/80 transition hover:text-white"
              >
                Compare all plans →
              </Link>
            </div>
          ) : currentPlan.key === "pro" ? (
            <div className="mt-4 rounded-lg border border-sky-400/15 bg-sky-400/[0.05] p-4 text-xs leading-5 text-sky-100/80">
              You&apos;re on the highest personal plan. Need team seats, shared
              controls, or custom policy?{" "}
              <Link href="/contact" className="sansxel-subtle-link">
                Talk to us.
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <h2 className="mt-10 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
        Month at a glance
      </h2>
      <p className="mt-1 text-xs text-neutral-600">
        {fmt(periodStart)} - {fmt(periodEnd)}
      </p>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-end justify-between gap-3">
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
            {currentPlan.name} plan
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

      {summary &&
        (summary.total_input_tokens > 0 || summary.total_output_tokens > 0) && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Tokens this month
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
              <TokenRow label="Input" value={summary.total_input_tokens} />
              <TokenRow label="Output" value={summary.total_output_tokens} />
              <TokenRow label="Total" value={summary.total_tokens} accent />
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

function UsageChip({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "accent";
}) {
  return (
    <span
      className={
        tone === "accent"
          ? "rounded-full border border-emerald-300/15 bg-emerald-300/[0.08] px-2.5 py-1 text-[11px] text-emerald-100/80"
          : "rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-neutral-400"
      }
    >
      {children}
    </span>
  );
}

function PlanFact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
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
  const kindLabel = (() => {
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
        {row.model ?? "-"}
        {row.surface ? ` - ${row.surface}` : ""}
      </span>
      <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-neutral-400">
        {row.total_tokens > 0 ? `${row.total_tokens.toLocaleString()}t` : "-"}
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

function getSuggestedUpgrade(currentPlanKey: PricingPlanKey): PricingPlan | null {
  const currentIndex = personalUpgradeOrder.indexOf(currentPlanKey);
  if (currentIndex === -1 || currentIndex >= personalUpgradeOrder.length - 1) {
    return null;
  }

  return getPricingPlan(personalUpgradeOrder[currentIndex + 1]);
}

function formatChatBudget(limit: number | null) {
  return limit === null ? "Unlimited chat" : `${limit.toLocaleString()} chats / week`;
}

function formatVoiceBudget(limit: number | null) {
  if (limit === null) return "Unlimited voice";
  if (limit === 0) return "Voice on paid plans";
  return `${Math.floor(limit / 60)}m voice / week`;
}

function formatMonthlyApiBudget(limit: number | null) {
  return limit === null
    ? "Unlimited API"
    : `${limit.toLocaleString()} API requests / month`;
}
