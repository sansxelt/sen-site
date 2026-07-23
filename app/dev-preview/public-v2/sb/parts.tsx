import type { ReactNode, CSSProperties } from "react";

// The Proof Arena object system. Reusable across the 10 storyboard frames.

export function Wordmark({ muted = false }: { muted?: boolean }) {
  const R = 7, C = 2 * Math.PI * R;
  return (
    <span className="sb-brand" style={muted ? { color: "var(--ink-lo)" } : undefined}>
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r={R} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeDasharray={`${C * 0.78} ${C}`} transform="rotate(-108 12 12)" />
        <circle cx="12" cy="12" r="2.1" fill="var(--vr)" />
      </svg>
      Vraelis
    </span>
  );
}

// the business invariant — fixed, luminous, outside the code
export function InvariantLaw({ children, k = "Business invariant · held on file" }: { children: ReactNode; k?: string }) {
  return (
    <div className="sb-invariant">
      <span className="k">{k}</span>
      <span className="t">{children}</span>
    </div>
  );
}

// the AI change packet — a tangible release object
export function ChangePacket({ claim, ref_, repair = false, style }: { claim: string; ref_: string; repair?: boolean; style?: CSSProperties }) {
  return (
    <div className={`sb-packet${repair ? " sb-packet--repair" : ""}`} style={style}>
      <div className="h"><span className="agent">{repair ? "coding agent · repair" : "coding agent"}</span><span style={{ marginLeft: "auto" }}>{ref_}</span></div>
      <div className="claim">&ldquo;{claim}&rdquo;</div>
    </div>
  );
}

export function IdentityToken({ initials, name, org, color }: { initials: string; name: string; org: string; color: string }) {
  return (
    <span className="sb-id">
      <span className="av" style={{ background: color }}>{initials}</span>
      <span className="nm">{name}</span>
      <span className="og">{org}</span>
    </span>
  );
}

export type WorldRow = { name: string; owner: string; foreign?: boolean };

// a real product surface — one organization's live data view, seen as one of its users
export function OrgWorld({ org, orgName, color, userInitials, userName, rows, foot, dim = false, style }: {
  org: string; orgName: string; color: string; userInitials: string; userName: string; rows: WorldRow[]; foot?: string; dim?: boolean; style?: CSSProperties;
}) {
  return (
    <div className="sb-world" style={{ opacity: dim ? 0.55 : 1, ...style }}>
      <div className="sb-world-bar">
        <span className="sb-world-badge" style={{ background: color }}>{org}</span>
        <span className="sb-world-name">{orgName}</span>
        <span className="sb-world-user"><span className="av" style={{ background: color }}>{userInitials}</span>{userName}</span>
      </div>
      <div className="sb-world-body">
        {rows.map((r, i) => (
          <div key={i} className={`sb-row${r.foreign ? " sb-row--foreign" : ""}`}>
            <span className="ic" style={{ background: r.foreign ? "var(--breach)" : color, opacity: r.foreign ? 1 : 0.5 }} />
            <span className="nm">{r.name}</span>
            <span className="own">{r.owner}</span>
          </div>
        ))}
      </div>
      {foot ? <div className="sb-world-foot">{foot}</div> : null}
    </div>
  );
}

export function ProofRecord({ verdict, n, label, style }: { verdict: "rejected" | "verified"; n: string; label: string; style?: CSSProperties }) {
  return (
    <div className="sb-record" data-v={verdict} style={style}>
      <span className="rn">{n}</span>
      <span className="rl">{label}</span>
      <span className="rv">{verdict === "rejected" ? "release rejected" : "verified"}</span>
    </div>
  );
}

export function StudyTag({ children }: { children: ReactNode }) {
  return <span className="sb-tag">{children}</span>;
}

// an evidence thread converging on a point — drawn as a glowing SVG filament
export function EvidenceField({ children }: { children: ReactNode }) {
  return <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }}>{children}</svg>;
}
