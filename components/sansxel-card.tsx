"use client";

// v0.2.0 phase F: custom UI inference cards.
//
// The model emits structured output as a fenced block:
//   ```sansxel-card
//   { "type": "stat-grid", ... }
//   ```
// CodeBlock detects the language tag, parses the JSON, and
// hands off to <SansxelCard /> below which dispatches by type.
// Unknown types or malformed JSON fall back to a plain code
// preview so a bad render never breaks the whole answer.

type StatRow = {
  label: string;
  value: string;
  change?: string;
  tone?: "up" | "down" | "neutral";
  hint?: string;
};

type ComparisonColumn = {
  heading: string;
  tone?: "us" | "them" | "neutral";
  points: string[];
};

type PlanStep = {
  title: string;
  body?: string;
  sub?: string[];
};

type KeyValueItem = {
  label: string;
  value: string;
};

type TimelineEvent = {
  when: string;
  title: string;
  body?: string;
};

type CardJSON =
  | {
      type: "stat-grid";
      title?: string;
      subtitle?: string;
      rows: StatRow[];
      footer?: string;
    }
  | {
      type: "comparison";
      title?: string;
      subtitle?: string;
      columns: ComparisonColumn[];
      footer?: string;
    }
  | {
      type: "plan-steps";
      title?: string;
      subtitle?: string;
      steps: PlanStep[];
      footer?: string;
    }
  | {
      type: "key-value";
      title?: string;
      subtitle?: string;
      items: KeyValueItem[];
      footer?: string;
    }
  | {
      type: "quote";
      text: string;
      attribution?: string;
      source?: string;
    }
  | {
      type: "timeline";
      title?: string;
      events: TimelineEvent[];
      footer?: string;
    };

// Tries to parse a sansxel-card JSON payload. Strict on type
// presence; lenient on extra fields. Returns null on malformed
// input so the caller can fall back to a code-block render.
export function parseSansxelCard(raw: string): CardJSON | null {
  try {
    const obj = JSON.parse(raw) as { type?: string };
    if (!obj || typeof obj !== "object") return null;
    if (typeof obj.type !== "string") return null;
    return obj as CardJSON;
  } catch {
    return null;
  }
}

// Renders while a sansxel-card is still being streamed by the
// model so the user doesn't see partial JSON typing in. Three
// shimmer rows + a subtle status line ("Building card…"); the
// real card swaps in over the top with its own entry animation
// once the JSON parses. Sized to roughly match a stat-grid so
// the layout shift is small.
export function SansxelCardSkeleton() {
  return (
    <div className="sx-card sx-card--skeleton" aria-hidden>
      <div className="sx-skeleton-status">
        <span className="sx-skeleton-pulse" />
        Building card…
      </div>
      <div className="sx-skeleton-rows">
        <div className="sx-skeleton-row" />
        <div className="sx-skeleton-row" />
        <div className="sx-skeleton-row" />
      </div>
    </div>
  );
}

export function SansxelCard({ data }: { data: CardJSON }) {
  switch (data.type) {
    case "stat-grid":
      return <StatGrid data={data} />;
    case "comparison":
      return <Comparison data={data} />;
    case "plan-steps":
      return <PlanSteps data={data} />;
    case "key-value":
      return <KeyValue data={data} />;
    case "quote":
      return <QuoteCard data={data} />;
    case "timeline":
      return <Timeline data={data} />;
    default:
      // Unknown card type, render the raw JSON in a fallback
      // box so the user sees something but knows it's not what
      // the model intended.
      return (
        <div className="sx-card sx-card--unknown">
          <div className="sx-card-warn">
            Unknown card type: {(data as { type: string }).type}
          </div>
        </div>
      );
  }
}

// ── stat-grid ─────────────────────────────────────────────────
function StatGrid({
  data,
}: {
  data: Extract<CardJSON, { type: "stat-grid" }>;
}) {
  return (
    <div className="sx-card sx-stat-grid">
      <CardHeader title={data.title} subtitle={data.subtitle} />
      <div className="sx-stat-grid-rows">
        {data.rows.map((row, i) => (
          <div key={i} className="sx-stat-row">
            <div className="sx-stat-row-main">
              <span className="sx-stat-label">{row.label}</span>
              {row.hint && (
                <span className="sx-stat-hint">{row.hint}</span>
              )}
            </div>
            <div className="sx-stat-row-value">
              <span className="sx-stat-value">{row.value}</span>
              {row.change && (
                <span className={`sx-stat-change sx-tone-${row.tone ?? "neutral"}`}>
                  {row.change}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <CardFooter footer={data.footer} />
    </div>
  );
}

// ── comparison ────────────────────────────────────────────────
function Comparison({
  data,
}: {
  data: Extract<CardJSON, { type: "comparison" }>;
}) {
  return (
    <div className="sx-card sx-comparison">
      <CardHeader title={data.title} subtitle={data.subtitle} />
      <div className="sx-comparison-cols">
        {data.columns.map((col, i) => (
          <div
            key={i}
            className={`sx-comparison-col sx-tone-${col.tone ?? "neutral"}`}
          >
            <div className="sx-comparison-eyebrow">
              {col.tone === "us"
                ? "Us"
                : col.tone === "them"
                  ? "Them"
                  : null}
            </div>
            <div className="sx-comparison-heading">{col.heading}</div>
            <ul className="sx-comparison-points">
              {col.points.map((p, j) => (
                <li key={j}>{p}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <CardFooter footer={data.footer} />
    </div>
  );
}

// ── plan-steps ────────────────────────────────────────────────
function PlanSteps({
  data,
}: {
  data: Extract<CardJSON, { type: "plan-steps" }>;
}) {
  return (
    <div className="sx-card sx-plan-steps">
      <CardHeader title={data.title} subtitle={data.subtitle} />
      <ol className="sx-plan-list">
        {data.steps.map((step, i) => (
          <li key={i} className="sx-plan-step">
            <div className="sx-plan-step-num">{String(i + 1).padStart(2, "0")}</div>
            <div className="sx-plan-step-body">
              <div className="sx-plan-step-title">{step.title}</div>
              {step.body && (
                <p className="sx-plan-step-text">{step.body}</p>
              )}
              {step.sub && step.sub.length > 0 && (
                <ul className="sx-plan-step-sub">
                  {step.sub.map((s, j) => (
                    <li key={j}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
      <CardFooter footer={data.footer} />
    </div>
  );
}

// ── key-value ─────────────────────────────────────────────────
function KeyValue({
  data,
}: {
  data: Extract<CardJSON, { type: "key-value" }>;
}) {
  return (
    <div className="sx-card sx-key-value">
      <CardHeader title={data.title} subtitle={data.subtitle} />
      <dl className="sx-kv-list">
        {data.items.map((item, i) => (
          <div key={i} className="sx-kv-row">
            <dt className="sx-kv-label">{item.label}</dt>
            <dd className="sx-kv-value">{item.value}</dd>
          </div>
        ))}
      </dl>
      <CardFooter footer={data.footer} />
    </div>
  );
}

// ── quote ─────────────────────────────────────────────────────
function QuoteCard({
  data,
}: {
  data: Extract<CardJSON, { type: "quote" }>;
}) {
  return (
    <div className="sx-card sx-quote">
      <div className="sx-quote-mark" aria-hidden>
        &ldquo;
      </div>
      <blockquote className="sx-quote-text">{data.text}</blockquote>
      {(data.attribution || data.source) && (
        <div className="sx-quote-meta">
          {data.attribution && (
            <span className="sx-quote-author">{data.attribution}</span>
          )}
          {data.source && (
            <a
              href={data.source}
              target="_blank"
              rel="noreferrer"
              className="sx-quote-source"
            >
              source
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── timeline ──────────────────────────────────────────────────
function Timeline({
  data,
}: {
  data: Extract<CardJSON, { type: "timeline" }>;
}) {
  return (
    <div className="sx-card sx-timeline">
      <CardHeader title={data.title} />
      <ol className="sx-timeline-list">
        {data.events.map((evt, i) => (
          <li key={i} className="sx-timeline-event">
            <div className="sx-timeline-dot" aria-hidden />
            <div className="sx-timeline-when">{evt.when}</div>
            <div className="sx-timeline-body">
              <div className="sx-timeline-title">{evt.title}</div>
              {evt.body && (
                <p className="sx-timeline-text">{evt.body}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <CardFooter footer={data.footer} />
    </div>
  );
}

// ── shared bits ───────────────────────────────────────────────
function CardHeader({
  title,
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  if (!title && !subtitle) return null;
  return (
    <div className="sx-card-head">
      {title && <div className="sx-card-title">{title}</div>}
      {subtitle && <div className="sx-card-subtitle">{subtitle}</div>}
    </div>
  );
}

function CardFooter({ footer }: { footer?: string }) {
  if (!footer) return null;
  return <div className="sx-card-footer">{footer}</div>;
}
