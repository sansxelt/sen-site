"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

// The faint UI Lens projects forward. NOT a sci-fi hologram, NOT a
// blueprint crosshair. A soft set of caption bars and corner dots
// that read as ambient HUD light spilling off the lens surface.
// Additive blending so the lens body still reads transparent
// through it.
//
// Construction-line crosshair was removed — it pushed the scene
// toward "engineering schematic" instead of "luxury hardware".

export function LensHudProjection({ accent = "#a8c4ff" }: { accent?: string }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (!m.emissiveIntensity && m.emissiveIntensity !== 0) return;
      m.emissiveIntensity = 0.32 + Math.sin(t * 0.9 + i * 0.6) * 0.10;
    });
  });

  return (
    <group ref={groupRef} position={[0, 0.06, 0.05]} rotation={[-0.2, 0, 0]}>
      {/* Caption line — two stacked thin bars, very soft */}
      <mesh position={[0, 0.30, 0]}>
        <planeGeometry args={[0.30, 0.010]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.35}
          transparent
          opacity={0.32}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[-0.06, 0.27, 0]}>
        <planeGeometry args={[0.18, 0.008]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.25}
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Status pill — tiny rounded rectangle implied by a frame */}
      <mesh position={[0.18, 0.34, 0]}>
        <planeGeometry args={[0.09, 0.022]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.18}
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Two ambient corner dots — subtle, no crosshair */}
      {[
        [-0.26,  0.26],
        [ 0.26, -0.06],
      ].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <circleGeometry args={[0.0035, 12]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={0.55}
            transparent
            opacity={0.45}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
