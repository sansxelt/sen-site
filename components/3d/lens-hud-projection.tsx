"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

// The faint UI Lens projects forward. NOT a sci-fi floating hologram.
// It's a small set of partially-transparent mesh quads sitting just
// in front of the lens body, sized like a pair of caption lines and
// a status pill. It catches a sliver of the rim light and breathes.
//
// All geometry is additive blending so the lens body still reads
// transparent through it.

export function LensHudProjection({ accent = "#a8c4ff" }: { accent?: string }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (!m.emissiveIntensity && m.emissiveIntensity !== 0) return;
      m.emissiveIntensity = 0.5 + Math.sin(t * 1.1 + i * 0.6) * 0.15;
    });
  });

  // All elements live on a thin plane just above the lens centre,
  // angled like a HUD seen from the wearer's POV (slight tilt
  // toward camera).
  return (
    <group ref={groupRef} position={[0, 0.06, 0.05]} rotation={[-0.2, 0, 0]}>
      {/* Caption line — two stacked thin bars */}
      <mesh position={[0, 0.30, 0]}>
        <planeGeometry args={[0.34, 0.012]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.55}
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[-0.06, 0.27, 0]}>
        <planeGeometry args={[0.22, 0.010]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.4}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Status pill — small rounded rectangle implied by a frame */}
      <mesh position={[0.20, 0.34, 0]}>
        <planeGeometry args={[0.10, 0.026]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.3}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Crosshair guide marker — directly under the iris reticle */}
      <mesh position={[0, -0.04, 0]}>
        <planeGeometry args={[0.08, 0.0015]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.7}
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, -0.04, 0]}>
        <planeGeometry args={[0.0015, 0.05]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.7}
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Tiny indicator dots at corners */}
      {[
        [-0.30,  0.28],
        [ 0.30,  0.28],
        [-0.30, -0.10],
        [ 0.30, -0.10],
      ].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <circleGeometry args={[0.004, 12]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={0.85}
            transparent
            opacity={0.7}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
