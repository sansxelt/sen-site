"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// Spline scene wrapper. Pulls a hosted Spline scene from spline.design
// and embeds it. Same lazy-load + reduced-motion + small-viewport
// gating as Lazy3DScene so we never ship the Spline runtime to
// users who do not benefit from it.
//
// Usage:
//   <SplineScene
//     url="https://prod.spline.design/<scene-id>/scene.splinecode"
//     poster="/landing/lens-poster.svg"
//     alt="Sansxel Lens"
//   />
//
// Authoring workflow:
//   1. Go to spline.design, create a scene (use their AI generate
//      feature for starting points, polish manually).
//   2. File -> Export -> Code Export -> React.
//   3. Copy the scene URL (ends in .splinecode).
//   4. Paste into your CinematicAct's splineUrl prop.

const Spline = dynamic(
  () => import("@splinetool/react-spline").then((m) => m.default),
  { ssr: false },
);

type Props = {
  url: string;
  poster?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  rootMargin?: string;
};

export function SplineScene({
  url,
  poster,
  alt = "",
  className,
  style,
  rootMargin = "200px 0px",
}: Props) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small  = window.matchMedia("(max-width: 720px)").matches;
    if (reduce || small) {
      setVisible(false);
      return;
    }

    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className} style={{ position: "relative", ...style }}>
      {!visible && poster && (
        <img
          src={poster}
          alt={alt}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: 0.95,
          }}
        />
      )}
      {visible && (
        <Spline
          scene={url}
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </div>
  );
}
