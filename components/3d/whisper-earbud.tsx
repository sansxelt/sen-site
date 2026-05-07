"use client";

import { useFrame } from "@react-three/fiber";
import { Float, MeshTransmissionMaterial } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { StudioRig } from "./studio-rig";
import { ModelOrFallback } from "./use-gltf-or-fallback";

// Whisper. Premium earbud silhouette: anodized aluminum stem, glass
// driver dome with soft-touch ear-tip ring, capacitive touch panel
// at the stem base, milled mic vents. Reads as something Bose or
// Apple would manufacture, not a glowing concept render.
//
// Material strategy:
//   stem:        anodized aluminum, 0.95 metalness, gentle clearcoat
//   tip:         soft-touch dark grey rubber, no clearcoat
//   dome:        anti-reflective transmission glass, low chromatic
//   grille:      precision torus + radial slits (mic+driver vents)
//   touch ring:  hairline brushed metal capacitive band
//   mic vents:   3 milled slits at the base
//
// Drop /models/whisper-v1.glb to override.

function ProceduralEarbud() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.12;
  });

  return (
    <group ref={groupRef}>
      <Float speed={0.7} floatIntensity={0.12} rotationIntensity={0.05}>
        {/* Stem — anodized aluminum capsule */}
        <mesh position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.28, 0.62, 16, 32]} />
          <meshPhysicalMaterial
            color="#10121a"
            roughness={0.30}
            metalness={0.96}
            clearcoat={0.8}
            clearcoatRoughness={0.16}
          />
        </mesh>

        {/* Soft-touch ear-tip — sits on top of the stem where the
            dome connects. Different material to read as 2 parts. */}
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.30, 0.27, 0.06, 48]} />
          <meshStandardMaterial color="#1a1c20" roughness={0.92} metalness={0} />
        </mesh>

        {/* Brushed metal seam at the join — hairline detail */}
        <mesh position={[0, 0.21, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.30, 0.0025, 8, 96]} />
          <meshStandardMaterial color="#3a3d49" metalness={1} roughness={0.5} />
        </mesh>

        {/* Glass driver dome — anti-reflective tint */}
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.34, 64, 64]} />
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.32}
            roughness={0.06}
            ior={1.45}
            chromaticAberration={0.008}
            color="#dde4f5"
            transparent
            anisotropy={0.2}
          />
        </mesh>

        {/* Driver grille — precision torus + radial perforation pattern.
            Smaller, more restrained than before. */}
        <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.20, 0.005, 12, 64]} />
          <meshStandardMaterial color="#a8c4ff" emissive="#a8c4ff" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.13, 0.0035, 8, 48]} />
          <meshStandardMaterial color="#a8c4ff" emissive="#a8c4ff" emissiveIntensity={0.28} />
        </mesh>

        {/* 12 perforation dots in the grille — mesh holes */}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <mesh
              key={`perf-${i}`}
              position={[Math.cos(a) * 0.165, 0.5, Math.sin(a) * 0.165]}
            >
              <sphereGeometry args={[0.006, 8, 8]} />
              <meshBasicMaterial color="#06080e" />
            </mesh>
          );
        })}

        {/* Capacitive touch ring — hairline brushed band on the
            stem, reads as the tap-to-skip surface */}
        <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.282, 0.0035, 8, 64]} />
          <meshStandardMaterial color="#5a6378" metalness={1} roughness={0.4} />
        </mesh>
        {/* Two faint dot indicators on the touch ring */}
        {[0, Math.PI].map((a, i) => (
          <mesh
            key={`tap-${i}`}
            position={[Math.cos(a) * 0.282, -0.05, Math.sin(a) * 0.282]}
          >
            <sphereGeometry args={[0.008, 12, 12]} />
            <meshStandardMaterial color="#a8c4ff" emissive="#a8c4ff" emissiveIntensity={0.5} />
          </mesh>
        ))}

        {/* Mic vents — 3 milled slits at the base */}
        {Array.from({ length: 3 }).map((_, i) => {
          const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
          return (
            <mesh
              key={`vent-${i}`}
              position={[Math.cos(a) * 0.281, -0.62, Math.sin(a) * 0.281]}
              rotation={[0, -a, 0]}
            >
              <planeGeometry args={[0.012, 0.04]} />
              <meshStandardMaterial color="#02030a" />
            </mesh>
          );
        })}

        {/* Mic ring + dot at the very tip */}
        <mesh position={[0, -0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18, 0.0035, 8, 48]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, -0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.03, 24]} />
          <meshStandardMaterial color="#04060e" />
        </mesh>

        {/* Laser-etched serial — 4 microscopic notches on the side */}
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh
            key={`serial-${i}`}
            position={[0.281, -0.32 + i * 0.04, 0]}
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

function FieldRing({ radius, color, opacity = 0.45 }: { radius: number; color: string; opacity?: number }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.0035, 8, 256]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

export function WhisperEarbud() {
  return (
    <>
      <StudioRig
        contactShadowY={-1.0}
        contactShadowOpacity={0.55}
        fogNear={5}
        fogFar={13}
      />

      <ModelOrFallback url="/models/whisper-v1.glb" fallback={<ProceduralEarbud />} />

      {/* Concentric field rings — restrained, like equipotentials on
          a CAD diagram. No particles. */}
      <FieldRing radius={1.30} color="#60a5fa" opacity={0.42} />
      <FieldRing radius={1.75} color="#a8c4ff" opacity={0.24} />
      <FieldRing radius={2.20} color="#7ab5ff" opacity={0.14} />
    </>
  );
}
