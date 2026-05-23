// CinematicAct.jsx
// Full-bleed scene block. The signature Vraelis layout: one act per
// concept, photograph (or styled placeholder) edge-to-edge, scrim
// darkens one corner, type slab sits in the dark corner, optional
// CTA pill. Mirrors the structure of components/landing/cinematic-act.tsx
// in the source repo but renders a static placeholder where the
// codebase uses a real PNG.

const { useRef } = React;

function CinematicAct({
  eyebrow,
  headline,
  body,
  cta,
  accent = "#a8c4ff",
  anchor = "bottom-left",   // "bottom-left" | "bottom-right" | "bottom-center"
  imageUrl,                  // real stock photograph (preferred)
  imageObjectPosition = "center",
  placeholderTint,           // fallback radial tint if no image / image fails
  minHeight = "100svh",
  scrim = "full",            // "full" | "left" | "right" | "none"
  showProductChips = false,
  children,                  // optional inline overlay (HUD wireframe, etc.)
}) {
  const [imgFailed, setImgFailed] = React.useState(false);
  const showPhoto = imageUrl && !imgFailed;
  const ref = useRef(null);

  const anchorStyle = (() => {
    switch (anchor) {
      case "bottom-right":
        return { right: "clamp(20px, 5vw, 80px)", width: "min(720px, calc(100vw - 32px))", bottom: "clamp(48px, 12vh, 140px)", textAlign: "right", alignItems: "flex-end" };
      case "bottom-center":
        return { left: 0, right: 0, marginInline: "auto", paddingInline: "clamp(20px, 5vw, 80px)", bottom: "clamp(48px, 10vh, 120px)", textAlign: "center", alignItems: "center" };
      case "bottom-left":
      default:
        return { left: "clamp(20px, 5vw, 80px)", right: "clamp(20px, 5vw, 80px)", bottom: "clamp(48px, 12vh, 140px)", textAlign: "left", alignItems: "flex-start" };
    }
  })();

  return (
    <section
      ref={ref}
      style={{
        position: "relative",
        height: minHeight,
        minHeight: 560,
        overflow: "hidden",
        background: "var(--bg-0)",
      }}
    >
      {/* Real photograph layer — preferred. Fails over to the radial
          placeholder if the image errors out (offline preview, blocked
          hotlink, etc.). */}
      {showPhoto && (
        <img
          src={imageUrl}
          alt=""
          onError={() => setImgFailed(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: imageObjectPosition,
            display: "block",
          }}
          loading="eager"
          decoding="async"
        />
      )}

      {/* Radial fallback — warm subject + cool environment. Always
          rendered behind the photo so a transparent-edged image still
          gets a backdrop. Stands alone if no image. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: showPhoto ? -1 : 0,
          background: placeholderTint
            ? `
              radial-gradient(ellipse at 30% 40%, ${placeholderTint} 0%, #1a1820 38%, #050507 75%),
              radial-gradient(ellipse at 75% 70%, ${accent}22 0%, transparent 55%)
            `
            : `radial-gradient(ellipse at 50% 50%, ${accent}10 0%, transparent 60%)`,
        }}
      />

      {/* Optional inline overlay (HUD wireframe, callouts, etc.) */}
      {children && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, pointerEvents: "none" }}>
          {children}
        </div>
      )}

      {/* Scrim — bottom-anchored ramp + optional corner darken */}
      {scrim !== "none" && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              scrim === "left"
                ? "linear-gradient(to right, rgba(5,5,7,0.88) 0%, rgba(5,5,7,0.55) 35%, rgba(5,5,7,0) 75%), linear-gradient(to top, rgba(5,5,7,0.88) 0%, rgba(5,5,7,0.55) 35%, rgba(5,5,7,0) 70%)"
                : scrim === "right"
                ? "linear-gradient(to left, rgba(5,5,7,0.88) 0%, rgba(5,5,7,0.55) 35%, rgba(5,5,7,0) 75%), linear-gradient(to top, rgba(5,5,7,0.88) 0%, rgba(5,5,7,0.55) 35%, rgba(5,5,7,0) 70%)"
                : "linear-gradient(180deg, transparent 0%, transparent 35%, rgba(5,5,7,0.55) 55%, rgba(5,5,7,0.88) 75%, #050507 92%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      )}

      {/* Top fade so the photo dissolves cleanly into the page above */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: 160,
          background: "linear-gradient(180deg, #050507 0%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Foreground type slab */}
      <div
        style={{
          position: "absolute",
          maxWidth: "min(900px, 92vw)",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          gap: 22,
          ...anchorStyle,
        }}
      >
        {eyebrow && (
          <div className="pill" style={{ color: accent, borderColor: `${accent}3a` }}>
            <span className="dot" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}></span>
            {eyebrow}
          </div>
        )}

        <h2 className="cinematic-display cinematic-display--gradient" style={{ margin: 0 }}>
          {headline}
        </h2>

        {body && (
          <p style={{
            margin: 0,
            fontSize: "clamp(1rem, 1.4vw, 1.25rem)",
            lineHeight: 1.55,
            color: "rgba(245,245,247,0.72)",
            maxWidth: 540,
            letterSpacing: "-0.005em",
          }}>
            {body}
          </p>
        )}

        {showProductChips && <ProductChips />}

        {cta && (
          <a className={`cta${accent === "#c084fc" ? " cta--vio" : ""}`} href={cta.href || "#"} onClick={(e) => { if (cta.onClick) { e.preventDefault(); cta.onClick(); } }}>
            {cta.label}
            <span aria-hidden style={{ fontSize: 13 }}>→</span>
          </a>
        )}
      </div>
    </section>
  );
}

Object.assign(window, { CinematicAct });
