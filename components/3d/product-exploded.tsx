"use client";

import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial, Float } from "@react-three/drei";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { Lazy3DScene } from "./lazy-scene";
import { StudioRig } from "./studio-rig";

// ProductExploded: scroll-driven exploded view of a product, used to
// show what's inside the hardware. Each layer is a labeled component
// (acrylic body, electronics ring, iris reticle, traces). As the user
// scrolls into the section, layers separate vertically and a column
// of captions to the side highlights the active layer.
//
// Reduced-motion: layers stay separated at a fixed offset, no scroll
// driving, no Float animation.

type Layer = {
  id: string;
  title: string;
  body: string;
};

const LENS_LAYERS: Layer[] = [
  { id: "shell",  title: "Acrylic shell",      body: "Hydrogel-equivalent transmission acrylic. Anti-reflective coating tuned for indoor lighting." },
  { id: "ring",   title: "Electronics ring",   body: "Anodized carrier holding 24 sub-millimetre LEDs and 6 gold contact pads. The mainboard." },
  { id: "traces", title: "Display layer",      body: "Concentric copper-blue traces routing the render signal across the lens area." },
  { id: "iris",   title: "Iris reticle",       body: "Hairline ring sitting over the pupil. Optical axis reference; not an indicator light." },
];

function LensExplodedSubject({ separation }: { separation: number }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.18;
  });

  const lensProfile = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const r = t * 1.0;
      const y = -Math.pow(r, 2.4) * 0.14;
      pts.push(new THREE.Vector2(r, y));
    }
    return pts;
  }, []);

  const sep = separation;

  return (
    <group ref={groupRef} rotation={[Math.PI * 0.18, 0, 0]}>
      {/* Layer 1: shell */}
      <mesh position={[0, 0.6 * sep, 0]}>
        <latheGeometry args={[lensProfile, 128]} />
        <MeshTransmissionMaterial
          transmission={1}
          thickness={0.16}
          roughness={0.02}
          ior={1.43}
          chromaticAberration={0.008}
          color="#e6ecfa"
          transparent
          attenuationColor="#a8c4ff"
          attenuationDistance={6}
        />
      </mesh>

      {/* Layer 2: electronics ring */}
      <group position={[0, 0.2 * sep, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.95, 0.011, 24, 256]} />
          <meshPhysicalMaterial color="#13151c" roughness={0.34} metalness={1} clearcoat={0.6} />
        </mesh>
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          const isPrimary = i % 8 === 0;
          return (
            <mesh
              key={`led-${i}`}
              position={[Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95]}
            >
              <sphereGeometry args={[0.0085, 12, 12]} />
              <meshStandardMaterial
                color={isPrimary ? "#a8c4ff" : "#7ab5ff"}
                emissive={isPrimary ? "#a8c4ff" : "#7ab5ff"}
                emissiveIntensity={isPrimary ? 0.85 : 0.4}
              />
            </mesh>
          );
        })}
      </group>

      {/* Layer 3: traces */}
      <group position={[0, -0.1 * sep, 0]}>
        {[0.55, 0.72, 0.83].map((r, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[r, r + 0.003, 128]} />
            <meshBasicMaterial color="#7ab5ff" transparent opacity={0.16 - i * 0.03} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>

      {/* Layer 4: iris reticle */}
      <mesh position={[0, -0.4 * sep, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.184, 128]} />
        <meshStandardMaterial color="#a8c4ff" emissive="#a8c4ff" emissiveIntensity={0.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function ScrollDrivenScene({ targetRef }: { targetRef: React.RefObject<HTMLElement | null> }) {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start end", "end start"],
  });
  const [sep, setSep] = useState(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      setSep(1);
      return;
    }
    const unsub = scrollYProgress.on("change", (v) => {
      // Bell-curve so layers reach max separation at section centre
      const eased = 4 * v * (1 - v);
      setSep(Math.min(1, eased * 1.4));
    });
    return () => unsub();
  }, [scrollYProgress, reduce]);

  return (
    <Float speed={0.4} floatIntensity={0.06} rotationIntensity={0.04}>
      <LensExplodedSubject separation={sep} />
    </Float>
  );
}

const EASE = [0.16, 1, 0.3, 1] as const;

type Props = {
  product: "lens";
};

export function ProductExploded({ product }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const layers = product === "lens" ? LENS_LAYERS : [];
  const accent = "#c084fc";

  return (
    <section
      ref={sectionRef}
      style={{
        position: "relative",
        padding: "clamp(80px, 12vh, 140px) clamp(20px, 5vw, 80px)",
        overflow: "hidden",
        background: "#040406",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(192,132,252,0.10) 0%, transparent 55%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div style={{ maxWidth: 640, marginBottom: 56 }}>
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: `${accent}b3`,
              marginBottom: 12,
            }}
          >
            anatomy · exploded
          </div>
          <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 14 }}>
            What goes inside.
          </h2>
          <p className="landing-body" style={{ maxWidth: 560 }}>
            Four layers, stacked under fifty microns of acrylic. Scroll
            to separate. The display routing, the electronics ring, the
            iris reticle. No extra parts.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 40,
            alignItems: "center",
          }}
          className="exploded-row"
        >
          <div
            style={{
              position: "relative",
              aspectRatio: "1 / 1.2",
              maxWidth: 520,
              justifySelf: "center",
              width: "100%",
            }}
          >
            <Lazy3DScene
              poster="/landing/lens-poster.svg"
              alt="Lens exploded layers"
              cameraPosition={[0, 0.4, 5.0]}
              cameraFov={38}
              style={{ width: "100%", height: "100%" }}
            >
              <StudioRig
                contactShadowY={-1.2}
                contactShadowOpacity={0.4}
                fogNear={5}
                fogFar={12}
              />
              <ScrollDrivenScene targetRef={sectionRef} />
            </Lazy3DScene>
          </div>

          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {layers.map((l, i) => (
              <motion.li
                key={l.id}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6, ease: EASE, delay: i * 0.08 }}
                style={{
                  padding: "16px 18px",
                  borderRadius: 14,
                  border: `1px solid ${accent}26`,
                  background: `linear-gradient(180deg, ${accent}07, transparent 80%)`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                      color: accent,
                      letterSpacing: "0.14em",
                      opacity: 0.8,
                    }}
                  >
                    L{String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      color: "#f5f5f7",
                      fontWeight: 500,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {l.title}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.55 }}>
                  {l.body}
                </p>
              </motion.li>
            ))}
          </ol>
        </div>

        <style>{`
          @media (min-width: 900px) {
            .exploded-row {
              grid-template-columns: 1fr 1fr !important;
              gap: 64px !important;
            }
          }
        `}</style>
      </div>
    </section>
  );
}
