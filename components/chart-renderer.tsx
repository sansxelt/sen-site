"use client";

import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ChartRenderer. Consumes a JSON spec the model emits inside a
// ```chart fenced block. Renders via Recharts so the visual is
// guaranteed to match the data — the model can't lie about the
// numbers because Recharts plots whatever's in the spec.
//
// Spec shape:
// {
//   "type": "line" | "bar" | "area" | "pie" | "scatter",
//   "title"?: string,
//   "data": Array<Record<string, number | string>>,
//   "x": string,                 // key in each data row for the X axis
//   "y": string | string[],      // one or many keys for series
//   "stacked"?: boolean,         // for bar/area
//   "colors"?: string[]          // accent colors per series, optional
// }
//
// On parse error or unsupported type, falls back to a plain code
// block so the user still sees what the model emitted.

type Spec = {
  type?: "line" | "bar" | "area" | "pie" | "scatter";
  title?: string;
  data?: Array<Record<string, number | string>>;
  x?: string;
  y?: string | string[];
  stacked?: boolean;
  colors?: string[];
  // Y-axis scale. Use "log" when the ratio between the largest and
  // smallest series is > 10x — without it, smaller series flatten
  // to the baseline. Linear is the default.
  yScale?: "linear" | "log";
};

const DEFAULT_COLORS = ["#a8c4ff", "#c084fc", "#22d3ee", "#60a5fa", "#fbbf24", "#22c55e", "#f87171", "#7ab5ff"];

const AXIS = { stroke: "rgba(255,255,255,0.45)", fontSize: 11 } as const;
const GRID = { stroke: "rgba(255,255,255,0.06)" } as const;
const TOOLTIP_STYLE = {
  background: "rgba(10,12,20,0.95)",
  border: "1px solid rgba(168,196,255,0.20)",
  borderRadius: 10,
  fontSize: 12,
  color: "#f5f5f7",
} as const;

function ChartFrame({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        margin: "12px 0 18px",
        padding: "16px 18px 14px",
        borderRadius: 14,
        border: "1px solid rgba(168,196,255,0.16)",
        background: "linear-gradient(180deg, rgba(168,196,255,0.04), rgba(0,0,0,0.20))",
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 12,
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(168,196,255,0.75)",
            marginBottom: 10,
          }}
        >
          {title}
        </div>
      )}
      <div style={{ width: "100%", height: 280 }}>{children}</div>
    </div>
  );
}

export function ChartRenderer({ source }: { source: string }) {
  let spec: Spec | null = null;
  try {
    spec = JSON.parse(source) as Spec;
  } catch {
    // Bad JSON, fall through to error frame
  }

  if (!spec || !spec.type || !Array.isArray(spec.data) || spec.data.length === 0) {
    return (
      <ChartFrame title="chart spec invalid">
        <pre
          style={{
            margin: 0,
            fontSize: 11,
            color: "rgba(255,255,255,0.55)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {source}
        </pre>
      </ChartFrame>
    );
  }

  const data = spec.data;
  const xKey = spec.x ?? Object.keys(data[0])[0];
  const yKeys = Array.isArray(spec.y)
    ? spec.y
    : spec.y
      ? [spec.y]
      : Object.keys(data[0]).filter((k) => k !== xKey);
  const colors = spec.colors ?? DEFAULT_COLORS;

  // Log-scale support. Recharts needs scale="log" + an explicit
  // numeric domain; "auto" breaks because log(0) is -Infinity. Find
  // the smallest positive value across all series for the lower
  // bound (or fall back to 1 if everything is 0).
  const isLog = spec.yScale === "log";
  const yAxisProps = isLog
    ? (() => {
        let minPositive = Infinity;
        let maxValue = 0;
        for (const row of data) {
          for (const k of yKeys) {
            const v = Number(row[k]);
            if (!Number.isFinite(v)) continue;
            if (v > 0 && v < minPositive) minPositive = v;
            if (v > maxValue) maxValue = v;
          }
        }
        if (!Number.isFinite(minPositive)) minPositive = 1;
        return {
          scale: "log" as const,
          domain: [minPositive, Math.max(maxValue, minPositive * 10)] as [number, number],
          allowDataOverflow: true,
        };
      })()
    : {};

  switch (spec.type) {
    case "line":
      return (
        <ChartFrame title={spec.title}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey={xKey} {...AXIS} />
              <YAxis {...AXIS} {...yAxisProps} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />}
              {yKeys.map((k, i) => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stroke={colors[i % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: colors[i % colors.length], strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartFrame>
      );
    case "bar":
      return (
        <ChartFrame title={spec.title}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey={xKey} {...AXIS} />
              <YAxis {...AXIS} {...yAxisProps} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(168,196,255,0.06)" }} />
              {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />}
              {yKeys.map((k, i) => (
                <Bar
                  key={k}
                  dataKey={k}
                  stackId={spec.stacked ? "stack" : undefined}
                  fill={colors[i % colors.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      );
    case "area":
      return (
        <ChartFrame title={spec.title}>
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey={xKey} {...AXIS} />
              <YAxis {...AXIS} {...yAxisProps} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />}
              {yKeys.map((k, i) => (
                <Area
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stackId={spec.stacked ? "stack" : undefined}
                  stroke={colors[i % colors.length]}
                  fill={colors[i % colors.length]}
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>
      );
    case "pie":
      return (
        <ChartFrame title={spec.title}>
          <ResponsiveContainer>
            <PieChart>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
              <Pie
                data={data}
                dataKey={(yKeys[0] ?? "value") as string}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={45}
                stroke="none"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartFrame>
      );
    case "scatter":
      return (
        <ChartFrame title={spec.title}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey={xKey} type="number" {...AXIS} />
              <YAxis dataKey={yKeys[0]} type="number" {...AXIS} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "rgba(168,196,255,0.20)" }} />
              <Scatter data={data} fill={colors[0]} />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartFrame>
      );
    default:
      return (
        <ChartFrame title={`unsupported type: ${spec.type}`}>
          <pre style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{source}</pre>
        </ChartFrame>
      );
  }
}
