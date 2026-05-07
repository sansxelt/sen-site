"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// Cinematic studio rig used by every product scene. Aim is the look
// of a controlled product photoshoot: a darker base, two large soft
// boxes, a cool rim, a tight hot-spot key, gentle volumetric depth.
//
// Lights:
//   keyBox    large white softbox upper-right, rectangular area light
//             feel via emissive plane that the HDRI Environment already
//             integrates (we still use directional for the actual cast)
//   fillBox   wide cool fill from camera-left, low intensity
//   rimLight  tight back-rim for silhouette separation on dark bodies
//   hotSpot   spot light for tabletop hot-spot reflection
//
// Atmospherics:
//   depth fog — exponential fog in the scene background
//   reflector ground (optional) — disabled by default to keep
//     compositing clean against the page; ContactShadows handles ground
//   floating dust — opt-in via `dust` prop, 60-particle drift
//
// Performance:
//   Respects (prefers-reduced-motion) to skip dust + light animation.

type Props = {
  contactShadowOpacity?: number;
  contactShadowY?: number;
  contactShadowBlur?: number;
  fog?: boolean;
  fogColor?: string;
  fogNear?: number;
  fogFar?: number;
  dust?: boolean;
  intensity?: number;
};

function Dust({ count = 60, radius = 6 }: { count?: number; radius?: number }) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * radius * 2;
      arr[i * 3 + 1] = (Math.random() - 0.5) * radius * 1.4;
      arr[i * 3 + 2] = (Math.random() - 0.5) * radius * 1.2;
    }
    return arr;
  }, [count, radius]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const geo = ref.current.geometry as THREE.BufferGeometry;
    const attr = geo.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += delta * 0.04 * (1 + (i % 5) * 0.05);
      if (arr[i * 3 + 1] > radius) arr[i * 3 + 1] = -radius;
      arr[i * 3 + 0] += Math.sin((arr[i * 3 + 1] + i) * 0.3) * delta * 0.01;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.012}
        color="#ffffff"
        transparent
        opacity={0.22}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export function StudioRig({
  contactShadowOpacity = 0.55,
  contactShadowY = -1.2,
  contactShadowBlur = 2.6,
  fog = true,
  fogColor = "#040508",
  fogNear = 6,
  fogFar = 16,
  dust = false,
  intensity = 1,
}: Props) {
  const { scene } = useThree();
  const reducedMotion = typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!fog) {
      scene.fog = null;
      return;
    }
    scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
    return () => { scene.fog = null; };
  }, [scene, fog, fogColor, fogNear, fogFar]);

  return (
    <>
      {/* Ambient fill — kept low so darker bodies stay rich */}
      <ambientLight intensity={0.10 * intensity} color="#aab8d8" />

      {/* Key softbox: warm-white, upper-right, the dominant source */}
      <directionalLight
        position={[5.5, 7, 4]}
        intensity={1.45 * intensity}
        color="#fff5e8"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Fill: cool wash from camera-left, half the intensity */}
      <directionalLight
        position={[-6, 2.5, 3]}
        intensity={0.40 * intensity}
        color="#9eb6e8"
      />

      {/* Rim: tight back light for silhouette separation */}
      <directionalLight
        position={[0, 1.6, -6]}
        intensity={0.85 * intensity}
        color="#dde6ff"
      />

      {/* Hot-spot — small spot to seed glossy highlights on metal */}
      <spotLight
        position={[2.5, 5, 2]}
        intensity={0.7 * intensity}
        angle={0.55}
        penumbra={0.85}
        decay={2}
        color="#ffffff"
      />

      {/* HDRI for reflections; lower intensity than before so we see
          the directional rig instead of a uniform wash */}
      <Environment preset="studio" environmentIntensity={0.32 * intensity} />

      {/* Grounded shadow — stronger contact, slightly tighter blur */}
      <ContactShadows
        position={[0, contactShadowY, 0]}
        opacity={contactShadowOpacity}
        scale={12}
        blur={contactShadowBlur}
        far={5}
        resolution={1024}
        color="#000000"
      />

      {dust && !reducedMotion && <Dust />}
    </>
  );
}
