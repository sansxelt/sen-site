"use client";

import { useFrame } from "@react-three/fiber";
import { Float, MeshTransmissionMaterial } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";
import { StudioRig } from "./studio-rig";

// Sansxel Lens. Transparent contact lens (lathe-curved acrylic disc),
// inner electronics ring with 16 evenly-spaced LEDs (medical-device
// style), thin pupil reticle. The HUD overlay was dropped — too
// "concept-art", reads as fake. Just the engineered hardware.

function ContactLens() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.10;
  });

  // Lathe profile: curved disc with center depression (concave inner
  // face that sits on the eye)
  const lensProfile = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const segments = 48;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const r = t * 1.0;
      // Slightly bowed convex outer face
      const y = -Math.pow(r, 2.2) * 0.16;
      pts.push(new THREE.Vector2(r, y));
    }
    return pts;
  }, []);

  return (
    <Float speed={0.6} floatIntensity={0.10} rotationIntensity={0.06}>
      <group ref={groupRef} rotation={[Math.PI * 0.20, 0, 0]}>
        {/* The lens body: medical-grade acrylic */}
        <mesh>
          <latheGeometry args={[lensProfile, 96]} />
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.18}
            roughness={0}
            ior={1.42}
            chromaticAberration={0.018}
            color="#dde6fa"
            transparent
            attenuationColor="#a8c4ff"
            attenuationDistance={4}
          />
        </mesh>

        {/* Outer electronics ring: precision metal track */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
          <torusGeometry args={[0.95, 0.012, 16, 192]} />
          <meshPhysicalMaterial
            color="#1a1c24"
            roughness={0.42}
            metalness={1}
            clearcoat={0.6}
            clearcoatRoughness={0.25}
          />
        </mesh>

        {/* 16 evenly-spaced LEDs around the ring — emit just enough
            to read as "powered electronics" without the toy glow */}
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i / 16) * Math.PI * 2;
          const isPrimary = i % 4 === 0;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 0.95, -0.005, Math.sin(a) * 0.95]}
            >
              <sphereGeometry args={[0.014, 16, 16]} />
              <meshStandardMaterial
                color={isPrimary ? "#a8c4ff" : "#c084fc"}
                emissive={isPrimary ? "#a8c4ff" : "#c084fc"}
                emissiveIntensity={isPrimary ? 1.6 : 1.1}
              />
            </mesh>
          );
        })}

        {/* Iris reticle (the part that sits over the pupil) — fine
            ring only, no glowing center */}
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.18, 0.195, 96]} />
          <meshStandardMaterial color="#a8c4ff" emissive="#a8c4ff" emissiveIntensity={0.5} side={THREE.DoubleSide} />
        </mesh>

        {/* Subtle inner concentric tracks (electrical traces) */}
        <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.555, 96]} />
          <meshBasicMaterial color="#a8c4ff" transparent opacity={0.18} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.72, 0.724, 96]} />
          <meshBasicMaterial color="#a8c4ff" transparent opacity={0.14} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </Float>
  );
}

export function LensObject() {
  return (
    <>
      <StudioRig contactShadowY={-0.6} contactShadowOpacity={0.6} contactShadowBlur={3} />
      <ContactLens />
    </>
  );
}
