import type { ReactNode } from "react";

// Shared parts for the Phase 0C concept studies.

export function Wordmark({ ink = "#17140D", dot = "#0C6A46", est = true }: { ink?: string; dot?: string; est?: boolean }) {
  const R = 7, C = 2 * Math.PI * R;
  return (
    <span className="c0-brand" style={{ color: ink }}>
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r={R} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeDasharray={`${C * 0.78} ${C}`} transform="rotate(-108 12 12)" />
        <circle cx="12" cy="12" r="2.1" fill={dot} />
      </svg>
      Vraelis
      {est ? <span className="est" style={{ color: "inherit", opacity: 0.6 }}>Bureau of Proof</span> : null}
    </span>
  );
}

// The verdict as an official seal/stamp — the ownable brand device. A trust institution stamps things.
export function Seal({ verdict, size = 168, rotate = -7 }: { verdict: "rejected" | "verified"; size?: number; rotate?: number }) {
  const rejected = verdict === "rejected";
  const stroke = rejected ? "#B03122" : "#0C6A46";
  const foil = rejected ? "#B03122" : "#A9803A";
  const ring = rejected ? "RELEASE HELD · EVIDENCE ON FILE · " : "PROOF ON FILE · VERIFIED WORKFLOW · ";
  const pathId = `seal-${verdict}`;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden style={{ transform: `rotate(${rotate}deg)` }}>
      <defs>
        <path id={pathId} d="M100,100 m -74,0 a 74,74 0 1,1 148,0 a 74,74 0 1,1 -148,0" />
      </defs>
      <circle cx="100" cy="100" r="92" stroke={stroke} strokeWidth="1.5" opacity="0.5" />
      <circle cx="100" cy="100" r="83" stroke={stroke} strokeWidth="3" />
      <circle cx="100" cy="100" r="55" stroke={stroke} strokeWidth="1.2" opacity="0.5" />
      <text fill={foil} style={{ fontFamily: "var(--mono)", fontSize: 12.5, letterSpacing: "0.18em", fontWeight: 600 }}>
        <textPath href={`#${pathId}`} startOffset="0">{ring + ring}</textPath>
      </text>
      {rejected ? (
        <>
          <text x="100" y="92" textAnchor="middle" fill={stroke} style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, letterSpacing: "-0.02em" }}>RELEASE</text>
          <text x="100" y="124" textAnchor="middle" fill={stroke} style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, letterSpacing: "-0.02em" }}>HELD</text>
        </>
      ) : (
        <>
          <path d="M78 100 l14 14 l30 -34" stroke={stroke} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          <text x="100" y="150" textAnchor="middle" fill={stroke} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "0.02em" }}>VERIFIED</text>
        </>
      )}
    </svg>
  );
}

export function StudyTag({ children }: { children: ReactNode }) {
  return <span className="c0-tag">{children}</span>;
}

// small evidence-source node (for concept B)
export function SourceNode({ label, held = true }: { label: string; held?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 15px", border: "1px solid var(--line-2)", borderRadius: 4, background: "var(--paper-2)", boxShadow: "0 10px 26px -20px rgba(23,20,13,0.4)" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", background: held ? "var(--green)" : "var(--red)" }} />
      <span style={{ fontSize: 13.5, fontWeight: 550, color: "var(--ink)" }}>{label}</span>
      <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: held ? "var(--green)" : "var(--red)" }}>{held ? "checked" : "conflict"}</span>
    </div>
  );
}
