"use client";

// CanvasRenderer. Consumes a JSON layout spec the model emits inside
// a ```canvas fenced block. Renders as positioned DOM nodes so the
// model can compose simple designs / mockups / diagrams without
// hand-rolling SVG (which it does inaccurately).
//
// Spec shape:
// {
//   "width"?: number,            // logical canvas width (default 800)
//   "height"?: number,           // logical canvas height (default 480)
//   "background"?: string,       // optional bg color, default transparent
//   "nodes": Array<Node>
// }
//
// Node = one of:
// { "type": "rect",  x, y, w, h, fill?, stroke?, radius? }
// { "type": "text",  x, y, content, size?, color?, weight?, align? }
// { "type": "line",  x1, y1, x2, y2, color?, width? }
// { "type": "image", x, y, w, h, url, alt? }
// { "type": "circle", x, y, r, fill?, stroke? }
//
// Coordinates are in the spec's logical units; the canvas scales
// responsively to fit the chat width via aspect-ratio.

type RectNode = { type: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; radius?: number };
type TextNode = { type: "text"; x: number; y: number; content: string; size?: number; color?: string; weight?: number | string; align?: "left" | "center" | "right" };
type LineNode = { type: "line"; x1: number; y1: number; x2: number; y2: number; color?: string; width?: number };
type ImageNode = { type: "image"; x: number; y: number; w: number; h: number; url: string; alt?: string };
type CircleNode = { type: "circle"; x: number; y: number; r: number; fill?: string; stroke?: string };
type Node = RectNode | TextNode | LineNode | ImageNode | CircleNode;

type Spec = {
  width?: number;
  height?: number;
  background?: string;
  nodes?: Node[];
};

function CanvasFrame({ children, aspectRatio }: { children: React.ReactNode; aspectRatio: string }) {
  return (
    <div
      style={{
        margin: "12px 0 18px",
        padding: "16px 18px",
        borderRadius: 14,
        border: "1px solid rgba(168,196,255,0.16)",
        background: "linear-gradient(180deg, rgba(168,196,255,0.04), rgba(0,0,0,0.20))",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(168,196,255,0.65)",
          marginBottom: 10,
        }}
      >
        canvas
      </div>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio,
          overflow: "hidden",
          borderRadius: 10,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function CanvasRenderer({ source }: { source: string }) {
  let spec: Spec | null = null;
  try {
    spec = JSON.parse(source) as Spec;
  } catch {
    // Bad JSON
  }

  if (!spec || !Array.isArray(spec.nodes)) {
    return (
      <CanvasFrame aspectRatio="16/9">
        <pre style={{ margin: 0, padding: 14, fontSize: 11, color: "rgba(255,255,255,0.55)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {source}
        </pre>
      </CanvasFrame>
    );
  }

  const W = spec.width ?? 800;
  const H = spec.height ?? 480;

  return (
    <CanvasFrame aspectRatio={`${W}/${H}`}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: spec.background ?? "transparent",
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          {spec.nodes.map((n, i) => {
            switch (n.type) {
              case "rect":
                return (
                  <rect
                    key={i}
                    x={n.x}
                    y={n.y}
                    width={n.w}
                    height={n.h}
                    rx={n.radius ?? 0}
                    fill={n.fill ?? "rgba(168,196,255,0.10)"}
                    stroke={n.stroke ?? "none"}
                    strokeWidth={n.stroke ? 1.5 : 0}
                  />
                );
              case "text":
                return (
                  <text
                    key={i}
                    x={n.x}
                    y={n.y}
                    fontSize={n.size ?? 14}
                    fill={n.color ?? "#f5f5f7"}
                    fontWeight={n.weight ?? 400}
                    textAnchor={n.align === "center" ? "middle" : n.align === "right" ? "end" : "start"}
                    fontFamily="var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
                  >
                    {n.content}
                  </text>
                );
              case "line":
                return (
                  <line
                    key={i}
                    x1={n.x1}
                    y1={n.y1}
                    x2={n.x2}
                    y2={n.y2}
                    stroke={n.color ?? "rgba(168,196,255,0.35)"}
                    strokeWidth={n.width ?? 1.5}
                    strokeLinecap="round"
                  />
                );
              case "image":
                return (
                  <image
                    key={i}
                    href={n.url}
                    x={n.x}
                    y={n.y}
                    width={n.w}
                    height={n.h}
                    preserveAspectRatio="xMidYMid slice"
                  />
                );
              case "circle":
                return (
                  <circle
                    key={i}
                    cx={n.x}
                    cy={n.y}
                    r={n.r}
                    fill={n.fill ?? "rgba(168,196,255,0.18)"}
                    stroke={n.stroke ?? "none"}
                    strokeWidth={n.stroke ? 1.5 : 0}
                  />
                );
              default:
                return null;
            }
          })}
        </svg>
      </div>
    </CanvasFrame>
  );
}
