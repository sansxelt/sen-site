"use client";

// Atmospheric scrim. Sits over a full-bleed 3D scene to:
//   - fade the top into the page (so the previous act dissolves into
//     this one without a hard seam),
//   - fade the bottom into darkness (so typography below sits on a
//     calm field, not a busy 3D scene),
//   - add an optional vignette around the edges that contains the
//     eye on the central subject.
//
// Pointer-events: none so the underlying scene can still receive
// hover/orbit if we ever wire that up.

type Props = {
  topFadePx?: number;
  bottomFadePx?: number;
  vignette?: boolean;
  bg?: string;
};

export function Scrim({
  topFadePx = 180,
  bottomFadePx = 220,
  vignette = true,
  bg = "#050507",
}: Props) {
  return (
    <>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `linear-gradient(180deg, ${bg} 0%, transparent ${topFadePx}px, transparent calc(100% - ${bottomFadePx}px), ${bg} 100%)`,
        }}
      />
      {vignette && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 100% 75% at 50% 50%, transparent 55%, rgba(0,0,0,0.45) 100%)",
          }}
        />
      )}
    </>
  );
}
