"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { Lazy3DScene } from "./lazy-scene";

// ProductMacro: a close-up scene with a tighter camera, no Float
// motion (the parent scene already auto-rotates), used for callout
// detail sections under the hero. Each macro has a short caption
// (manufacturing detail + spec) on the left.
//
// Layout:
//   [ caption ]   [ macro 3D scene ]
// reverses on alternating macros so a product page reads as a
// catalogue spread.

type Spec = { label: string; value: string };

type Props = {
  kicker: string;
  title: string;
  body: string;
  specs?: Spec[];
  poster: string;
  posterAlt: string;
  scene: ReactNode;
  cameraPosition?: [number, number, number];
  cameraFov?: number;
  accent?: string;
  reverse?: boolean;
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function ProductMacro({
  kicker,
  title,
  body,
  specs,
  poster,
  posterAlt,
  scene,
  cameraPosition = [0, 0, 3.4],
  cameraFov = 35,
  accent = "#a8c4ff",
  reverse = false,
}: Props) {
  const reduce = useReducedMotion();

  return (
    <section
      style={{
        position: "relative",
        padding: "clamp(60px, 9vh, 110px) clamp(20px, 5vw, 80px)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 50% 40% at ${reverse ? "20%" : "80%"} 50%, ${accent}10 0%, transparent 55%)`,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 40,
          alignItems: "center",
        }}
        className={reverse ? "macro-row reverse" : "macro-row"}
      >
        <motion.div
          initial={reduce ? false : { opacity: 0, x: reverse ? 20 : -20 }}
          whileInView={reduce ? undefined : { opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="macro-copy"
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: `${accent}b3`,
              marginBottom: 14,
            }}
          >
            {kicker}
          </div>
          <h3
            style={{
              fontSize: "clamp(1.5rem, 2.4vw, 2rem)",
              fontWeight: 600,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              marginBottom: 14,
              color: "#f5f5f7",
            }}
          >
            {title}
          </h3>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.6)",
              maxWidth: 460,
              marginBottom: specs ? 22 : 0,
            }}
          >
            {body}
          </p>

          {specs && (
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 10,
                margin: 0,
                padding: 0,
                maxWidth: 460,
              }}
            >
              {specs.map((s) => (
                <div
                  key={s.label}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.022)",
                  }}
                >
                  <dt
                    style={{
                      fontSize: 9,
                      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.4)",
                      marginBottom: 4,
                    }}
                  >
                    {s.label}
                  </dt>
                  <dd
                    style={{
                      fontSize: 13,
                      color: accent,
                      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                      margin: 0,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.94 }}
          whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.0, ease: EASE, delay: 0.1 }}
          style={{
            position: "relative",
            aspectRatio: "1 / 1",
            maxWidth: 480,
            justifySelf: "center",
            width: "100%",
          }}
          className="macro-stage"
        >
          <Lazy3DScene
            poster={poster}
            alt={posterAlt}
            cameraPosition={cameraPosition}
            cameraFov={cameraFov}
            style={{ width: "100%", height: "100%" }}
          >
            {scene}
          </Lazy3DScene>
        </motion.div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .macro-row {
            grid-template-columns: 1fr 1fr !important;
            gap: 60px !important;
          }
          .macro-row.reverse .macro-copy { order: 2; }
          .macro-row.reverse .macro-stage { order: 1; }
        }
      `}</style>
    </section>
  );
}
