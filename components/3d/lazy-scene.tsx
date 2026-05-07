"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// Lazy R3F Canvas. Three.js + drei are ~600KB gzipped so we never
// want them in the initial JS bundle. next/dynamic with ssr:false
// pulls them on first scroll-into-view, and a poster image stands in
// for users on mobile, reduced-motion, or before the chunk arrives.

const Canvas = dynamic(
  () => import("@react-three/fiber").then((m) => m.Canvas),
  { ssr: false },
);

type Props = {
  children: ReactNode;
  poster?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  cameraPosition?: [number, number, number];
  cameraFov?: number;
  rootMargin?: string;
  forceFallback?: boolean;
  dpr?: [number, number];
};

function useShouldRender(rootMargin: string, force?: boolean) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (force) {
      setVisible(false);
      return;
    }
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
  }, [rootMargin, force]);

  return [ref, visible] as const;
}

export function Lazy3DScene({
  children,
  poster,
  alt = "",
  className,
  style,
  cameraPosition = [0, 0, 6],
  cameraFov = 45,
  rootMargin = "200px 0px",
  forceFallback,
  dpr = [1, 2],
}: Props) {
  const [ref, visible] = useShouldRender(rootMargin, forceFallback);

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
        <Canvas
          dpr={dpr}
          camera={{ position: cameraPosition, fov: cameraFov }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          style={{ width: "100%", height: "100%" }}
        >
          {children}
        </Canvas>
      )}
    </div>
  );
}
