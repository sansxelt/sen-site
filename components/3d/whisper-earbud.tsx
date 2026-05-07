"use client";

import { useFrame } from "@react-three/fiber";
import { Float, MeshTransmissionMaterial } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { StudioRig } from "./studio-rig";

// Whisper earbud. Engineered silhouette: aluminum stem with glass
// driver dome, mesh speaker grille, mic ring at the base. The
// surrounding "waveform" is now three precise concentric rings (like
// equipotential lines on a CAD diagram), not particle smoke.

function Earbud() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.16;
  });

  return (
    <group ref={groupRef}>
      <Float speed={0.9} floatIntensity={0.18} rotationIntensity={0.06}>
        {/* Stem: precision aluminum */}
        <mesh position={[0, -0.1, 0]}>
          <capsuleGeometry args={[0.30, 0.62, 14, 28]} />
          <meshPhysicalMaterial
            color="#15171f"
            roughness={0.32}
            metalness={0.95}
            clearcoat={0.85}
            clearcoatRoughness={0.20}
          />
        </mesh>

        {/* Brushed metal seam at the join */}
        <mesh position={[0, 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.305, 0.0035, 8, 64]} />
          <meshStandardMaterial color="#3a3d49" metalness={1} roughness={0.55} />
        </mesh>

        {/* Glass driver dome */}
        <mesh position={[0, 0.55, 0]}>
          <sphereGeometry args={[0.36, 64, 64]} />
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.4}
            roughness={0.04}
            ior={1.45}
            chromaticAberration={0.015}
            color="#cfdfff"
            transparent
          />
        </mesh>

        {/* Speaker mesh: precise hex/torus pattern */}
        <mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.21, 0.008, 12, 48]} />
          <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.85} />
        </mesh>
        <mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.13, 0.005, 8, 32]} />
          <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.55} />
        </mesh>

        {/* Mic ring at base */}
        <mesh position={[0, -0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.20, 0.006, 8, 48]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.7} />
        </mesh>
        {/* Mic single dot */}
        <mesh position={[0, -0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.04, 24]} />
          <meshStandardMaterial color="#06121f" />
        </mesh>
      </Float>
    </group>
  );
}

function FieldRing({ radius, color, opacity = 0.45 }: { radius: number; color: string; opacity?: number }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.004, 8, 192]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

export function WhisperEarbud() {
  return (
    <>
      <StudioRig contactShadowY={-1.0} contactShadowOpacity={0.55} />

      <Earbud />

      {/* Concentric field rings (no particles, no random motion) */}
      <FieldRing radius={1.30} color="#60a5fa" opacity={0.55} />
      <FieldRing radius={1.75} color="#a8c4ff" opacity={0.32} />
      <FieldRing radius={2.20} color="#7ab5ff" opacity={0.20} />
    </>
  );
}
