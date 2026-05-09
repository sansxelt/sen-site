"use client";

import { useFrame } from "@react-three/fiber";
import { Float, MeshTransmissionMaterial } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { StudioRig } from "./studio-rig";
import { ModelOrFallback } from "./use-gltf-or-fallback";
import { BrandMark } from "./brand-mark";
import { CinematicEffects } from "./cinematic-effects";
import { CameraDrift } from "./camera-drift";

// Whisper. Premium earbud silhouette, layered procedurally for
// concept-render realism:
//
//   stem            anodized aluminum capsule, 0.96 metalness
//   chamfer ring    secondary brushed band that fakes the milled bevel
//                   between stem body and cap
//   soft-touch tip  separate translucent rubber dome the wearer's ear
//                   contacts (different material from the metal stem)
//   accent ring     bright metallic band at the dome-stem junction
//   glass dome      AR-tinted transmission glass over the driver
//   hex grille      ~36 small dots in a hex pattern — actual speaker
//                   mesh, not a torus stand-in
//   mic holes       3 milled circular holes on the stem base (visible
//                   black perforations, not just slits)
//   capacitive band hairline brushed touch ring with 2 dot indicators
//   etched mark     Sansxel triangles on the stem side
//   serial          4 microscopic notches under the touch band

function ProceduralEarbud() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.12;
  });

  // Hex-pattern positions for the speaker grille. 3 rings of dots
  // around the dome face. Pre-computed once.
  const hexDots = useMemo(() => {
    const out: { pos: [number, number, number]; size: number }[] = [];
    const rings = [
      { r: 0.06, n: 1, size: 0.0065 },   // centre
      { r: 0.105, n: 6, size: 0.006 },
      { r: 0.155, n: 12, size: 0.0055 },
      { r: 0.195, n: 16, size: 0.005 },
    ];
    for (const ring of rings) {
      if (ring.n === 1) {
        out.push({ pos: [0, 0.55, 0], size: ring.size });
        continue;
      }
      for (let i = 0; i < ring.n; i++) {
        const a = (i / ring.n) * Math.PI * 2;
        out.push({
          pos: [Math.cos(a) * ring.r, 0.55, Math.sin(a) * ring.r],
          size: ring.size,
        });
      }
    }
    return out;
  }, []);

  return (
    <group ref={groupRef}>
      <Float speed={0.7} floatIntensity={0.12} rotationIntensity={0.05}>
        {/* STEM — anodized aluminum capsule */}
        <mesh position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.28, 0.62, 16, 32]} />
          <meshPhysicalMaterial
            color="#06080e"
            roughness={0.26}
            metalness={0.98}
            clearcoat={0.95}
            clearcoatRoughness={0.10}
          />
        </mesh>

        {/* CHAMFER BAND — slightly larger and brighter ring just
            above the bottom of the stem; a milled-bevel highlight */}
        <mesh position={[0, -0.40, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.282, 0.0035, 8, 96]} />
          <meshStandardMaterial color="#3a3d49" metalness={1} roughness={0.4} />
        </mesh>

        {/* SOFT-TOUCH RUBBER TIP — separate dome the ear contacts.
            Slightly translucent to read as soft silicone rubber, not
            the same metal as the stem. */}
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.30, 0.27, 0.06, 48]} />
          <meshPhysicalMaterial
            color="#1a1c20"
            roughness={0.92}
            metalness={0}
            transmission={0.08}
            thickness={0.05}
            ior={1.42}
          />
        </mesh>

        {/* TIP CHAMFER — thin brighter band around the tip top edge */}
        <mesh position={[0, 0.21, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.30, 0.0025, 8, 96]} />
          <meshStandardMaterial color="#3a3d49" metalness={1} roughness={0.5} />
        </mesh>

        {/* METALLIC ACCENT RING — bright stainless band at the
            dome-tip junction, the most "expensive product" detail */}
        <mesh position={[0, 0.245, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.305, 0.008, 12, 96]} />
          <meshPhysicalMaterial
            color="#9aa3b8"
            metalness={1}
            roughness={0.18}
            clearcoat={0.7}
            clearcoatRoughness={0.1}
          />
        </mesh>
        {/* Inner mirror of the accent — gives the band a CNC bevel */}
        <mesh position={[0, 0.245, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.298, 0.0028, 8, 96]} />
          <meshStandardMaterial color="#1a1c24" metalness={1} roughness={0.5} />
        </mesh>

        {/* GLASS DRIVER DOME — AR-tinted */}
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.34, 64, 64]} />
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.4}
            roughness={0.04}
            ior={1.48}
            chromaticAberration={0.018}
            color="#dde4f5"
            transparent
            anisotropy={0.3}
            distortion={0.05}
            distortionScale={0.3}
          />
        </mesh>

        {/* HEX GRILLE — actual mesh of small perforations, not a
            single torus. Reads as a real speaker driver. */}
        {hexDots.map((d, i) => (
          <mesh key={`hex-${i}`} position={d.pos} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[d.size, 12]} />
            <meshStandardMaterial color="#04060e" />
          </mesh>
        ))}

        {/* GRILLE OUTER RING — fine bezel around the hex pattern */}
        <mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.215, 0.0035, 12, 96]} />
          <meshStandardMaterial color="#a8c4ff" emissive="#a8c4ff" emissiveIntensity={0.4} />
        </mesh>

        {/* CAPACITIVE TOUCH RING */}
        <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.282, 0.0035, 8, 64]} />
          <meshStandardMaterial color="#5a6378" metalness={1} roughness={0.4} />
        </mesh>
        {[0, Math.PI].map((a, i) => (
          <mesh
            key={`tap-${i}`}
            position={[Math.cos(a) * 0.282, -0.05, Math.sin(a) * 0.282]}
          >
            <sphereGeometry args={[0.008, 12, 12]} />
            <meshStandardMaterial color="#a8c4ff" emissive="#a8c4ff" emissiveIntensity={0.5} />
          </mesh>
        ))}

        {/* MIC HOLES — 3 actual visible perforation circles at the
            base of the stem (not slits) */}
        {Array.from({ length: 3 }).map((_, i) => {
          const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
          return (
            <mesh
              key={`mic-${i}`}
              position={[Math.cos(a) * 0.281, -0.62, Math.sin(a) * 0.281]}
              rotation={[0, -a, 0]}
            >
              <circleGeometry args={[0.012, 16]} />
              <meshStandardMaterial color="#02030a" />
            </mesh>
          );
        })}

        {/* MIC RING + DOT at the base */}
        <mesh position={[0, -0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18, 0.0035, 8, 48]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, -0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.03, 24]} />
          <meshStandardMaterial color="#04060e" />
        </mesh>

        {/* ETCHED SANSXEL MARK — on the stem side */}
        <BrandMark
          size={0.045}
          position={[0.281, -0.18, 0]}
          rotation={[0, Math.PI / 2, 0]}
          color="#23262e"
          opacity={0.85}
        />

        {/* SERIAL NOTCHES — under the capacitive band */}
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh
            key={`serial-${i}`}
            position={[0.281, -0.085 + i * 0.012, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <planeGeometry args={[0.012, 0.0015]} />
            <meshBasicMaterial color="#3b4358" />
          </mesh>
        ))}
      </Float>
    </group>
  );
}

export function WhisperEarbud({ effects = true }: { effects?: boolean } = {}) {
  return (
    <>
      <StudioRig
        contactShadowY={-1.0}
        contactShadowOpacity={0.55}
        fogNear={5}
        fogFar={13}
        dust
        reflectiveFloor
      />
      <CameraDrift amplitudeX={0.16} amplitudeY={0.10} amplitudeZ={0.12} periodSeconds={9} />
      <ModelOrFallback url="/models/whisper-v1.glb" fallback={<ProceduralEarbud />} />
      {/* Equipotential field rings removed — they read as a
          schematic diagram. Atmospheric dust + fog from StudioRig
          carries the depth instead. */}
      {effects && <CinematicEffects intensity="product" />}
    </>
  );
}
