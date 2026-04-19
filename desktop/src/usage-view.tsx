import { useEffect, useMemo, useState } from "react";
import { getWeeklyUsage, type WeeklyUsageSummary } from "./api";
import { getDesktopBillingState, type DesktopBillingState } from "./billing-api";
import type { DesktopSession } from "./auth";

export function DesktopUsageView({
  session,
  onOpenPlan,
}: {
  session: DesktopSession;
  onOpenPlan: () => void;
}) {
  const [usage, setUsage] = useState<WeeklyUsageSummary | null>(null);
  const [billing, setBilling] = useState<DesktopBillingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [usageData, billingData] = await Promise.all([
          getWeeklyUsage(session.token),
          getDesktopBillingState(session.token),
        ]);
        if (cancelled) return;
        setUsage(usageData);
        setBilling(billingData);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load usage.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  const insights = useMemo(() => {
    if (!usage) return null;
    const totalWeek = usage.daily_requests.reduce((sum, count) => sum + count, 0);
    const topDay = usage.daily_requests.reduce(
      (best, count, index) => (count > best.count ? { count, index } : best),
      { count: 0, index: 0 },
    );
    const topActivity = usage.recent.reduce<Record<string, number>>((acc, item) => {
      acc[item.kind] = (acc[item.kind] ?? 0) + 1;
      return acc;
    }, {});
    const topKind =
      Object.entries(topActivity).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "chat";

    return {
      totalWeek,
      averagePerDay: Math.round(totalWeek / 7),
      topDay,
      topKind,
    };
  }, [usage]);

  if (loading) {
    return (
      <div className="view">
        <div className="view-head">
          <h1>Usage</h1>
          <p>Plan limits, weekly activity, and what your desktop is actually doing.</p>
        </div>
        <div className="view-body">
          <div className="view-loading">Loading...</div>
        </div>
      </div>
    );
  }

  const reset = usage ? new Date(usage.week_reset) : null;
  const resetIn = reset ? Math.max(0, reset.getTime() - Date.now()) : 0;
  const resetDays = Math.floor(resetIn / (1000 * 60 * 60 * 24));
  const resetHours = Math.floor((resetIn / (1000 * 60 * 60)) % 24);
  const chatPct =
    usage && usage.weekly_chat_limit && usage.weekly_chat_limit > 0
      ? Math.min((usage.chat_requests / usage.weekly_chat_limit) * 100, 100)
      : 0;
  const voicePct =
    usage &&
    usage.weekly_voice_seconds_limit &&
    usage.weekly_voice_seconds_limit > 0
      ? Math.min((usage.voice_seconds / usage.weekly_voice_seconds_limit) * 100, 100)
      : 0;
  const isUpgradePlan =
    billing &&
    (billing.currentPlanKey === "free" ||
      billing.currentPlanKey === "apprentice" ||
      billing.currentPlanKey === "studio");

  return (
    <div className="view">
      <div className="view-head">
        <h1>Usage</h1>
        <p>
          {reset
            ? `Resets ${reset.toUTCString().slice(0, 22)} (${resetDays}d ${resetHours}h)`
            : "Plan limits, weekly activity, and what your desktop is actually doing."}
        </p>
      </div>

      <div className="view-body usage-view-body">
        {error && <div className="view-error">{error}</div>}
        {usage && billing && insights && (
          <>
            <div className="usage-hero-grid">
              <div className="usage-panel usage-panel--accent">
                <div className="usage-card-tag">Current plan</div>
                <div className="usage-panel-title">{billing.currentPlanName}</div>
                <p className="usage-panel-copy">{billing.currentPlanDescription}</p>
                <div className="usage-mini-grid">
                  <div className="usage-mini-stat">
                    <span className="usage-mini-label">Memory</span>
                    <strong>{billing.currentPlanMemoryWindow}</strong>
                  </div>
                  <div className="usage-mini-stat">
                    <span className="usage-mini-label">Usage</span>
                    <strong>{billing.currentPlanMonthlyCredits}</strong>
                  </div>
                </div>
                {isUpgradePlan && (
                  <button
                    type="button"
                    className="upgrade-cta-btn"
                    onClick={onOpenPlan}
                  >
                    Upgrade in app
                  </button>
                )}
              </div>

              <div className="usage-panel">
                <div className="usage-card-tag">This week</div>
                <div className="usage-panel-title">
                  {usage.chat_requests.toLocaleString()}
                  <span className="usage-card-of">
                    {" / "}
                    {usage.weekly_chat_limit === null
                      ? "unlimited"
                      : usage.weekly_chat_limit.toLocaleString()}
                  </span>
                </div>
                <p className="usage-panel-copy">
                  Average {insights.averagePerDay.toLocaleString()} requests a day.
                  Most active surface: {formatKind(insights.topKind)}.
                </p>
                {usage.weekly_chat_limit !== null && (
                  <div className="usage-bar">
                    <div className="usage-bar-fill" style={{ width: `${chatPct}%` }} />
                  </div>
                )}
              </div>

              <div className="usage-panel">
                <div className="usage-card-tag">Voice</div>
                <div className="usage-panel-title">
                  {formatVoiceSeconds(Math.round(usage.voice_seconds))}
                  {usage.weekly_voice_seconds_limit ? (
                    <span className="usage-card-of">
                      {" / "}
                      {formatVoiceSeconds(usage.weekly_voice_seconds_limit)}
                    </span>
                  ) : null}
                </div>
                <p className="usage-panel-copy">
                  Voice turns restart faster now, with a short cue if speech generation pauses.
                </p>
                {usage.weekly_voice_seconds_limit ? (
                  <div className="usage-bar">
                    <div className="usage-bar-fill" style={{ width: `${voicePct}%` }} />
                  </div>
                ) : (
                  <div className="billing-note">Voice is still locked on your current plan.</div>
                )}
              </div>
            </div>

            {usage.pro_throttle?.current_tier && (
              <div className="usage-throttle">
                <span className="usage-throttle-tag">Pro throttle</span>
                Currently serving on
                <span className="usage-throttle-tier">
                  {" "}
                  sansxel-1 {usage.pro_throttle.current_tier === "smart" ? "deep" : usage.pro_throttle.current_tier}
                </span>
                .
                {" "}
                {usage.pro_throttle.next_downshift_in && usage.pro_throttle.next_downshift_in > 0
                  ? `${usage.pro_throttle.next_downshift_in.toLocaleString()} more requests until the next downshift.`
                  : "Already on the lowest tier this week."}
              </div>
            )}

            <div className="usage-insight-grid">
              <div className="usage-panel">
                <div className="usage-card-tag">Pace</div>
                <div className="usage-panel-title">{insights.totalWeek.toLocaleString()}</div>
                <p className="usage-panel-copy">Total requests over the last 7 days.</p>
              </div>
              <div className="usage-panel">
                <div className="usage-card-tag">Most active day</div>
                <div className="usage-panel-title">
                  {weekdayLabelFromIndex(insights.topDay.index)}
                </div>
                <p className="usage-panel-copy">
                  {insights.topDay.count.toLocaleString()} requests that day.
                </p>
              </div>
              <div className="usage-panel">
                <div className="usage-card-tag">Desktop unlocks</div>
                <div className="usage-mini-grid usage-mini-grid--stack">
                  <div className="usage-mini-stat">
                    <span className="usage-mini-label">Plan</span>
                    <strong>{billing.currentPlanName}</strong>
                  </div>
                  <div className="usage-mini-stat">
                    <span className="usage-mini-label">API headroom</span>
                    <strong>
                      {billing.currentPlanApiRequestLimit === null
                        ? "Unlimited"
                        : `${billing.currentPlanApiRequestLimit.toLocaleString()} req`}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="view-section-title">Last 7 days</div>
            <div className="usage-chart">
              {usage.daily_requests.map((count, index) => {
                const max = Math.max(1, ...usage.daily_requests);
                const pct = (count / max) * 100;
                return (
                  <div key={index} className="usage-chart-bar-wrap">
                    <div className="usage-chart-count">{count}</div>
                    <div className="usage-chart-bar">
                      <div
                        className="usage-chart-bar-fill"
                        style={{ height: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                    <div className="usage-chart-label">
                      {weekdayLabelFromIndex(index)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="view-section-title">Recent activity</div>
            {usage.recent.length === 0 ? (
              <div className="usage-empty">No requests recorded yet.</div>
            ) : (
              <div className="usage-list">
                {usage.recent.map((item) => (
                  <div key={item.id} className="usage-row">
                    <span className="usage-row-kind">{formatKind(item.kind)}</span>
                    <span className="usage-row-meta">
                      {item.model ?? "—"}
                      {item.surface ? ` · ${item.surface}` : ""}
                    </span>
                    <span className="usage-row-tokens">
                      {item.total_tokens > 0
                        ? `${item.total_tokens.toLocaleString()}t`
                        : item.audio_seconds
                          ? formatVoiceSeconds(item.audio_seconds)
                          : "—"}
                    </span>
                    <span className="usage-row-time">
                      {new Date(item.created_at).toLocaleString("en-US", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatKind(kind: string) {
  switch (kind) {
    case "voice_transcribe":
      return "Voice in";
    case "voice_speak":
      return "Voice out";
    case "copilot":
      return "Copilot";
    case "chat":
      return "Chat";
    default:
      return kind;
  }
}

function weekdayLabelFromIndex(index: number) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][index] ?? "Day";
}

function formatVoiceSeconds(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}
