"use client";

import { useMemo } from "react";
import * as THREE from "three";

// V chevron brand mark etched onto 3D product surfaces.
// Rendered as flat thin geometry so it reads as a laser-etched mark
// on a metal surface — not a floating UI element.

type Props = {
  size?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
};

export function BrandMark({
  size = 0.06,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color = "#3b4358",
  emissive,
  emissiveIntensity = 0,
  opacity = 1,
}: Props) {
  const shape = useMemo(() => {
    // V chevron matching logo-*.svg path, normalized to centre at origin.
    // Source path (100×100): M18,19 L36,19 L30,29 L50,61 L70,29 L64,19 L82,19 L50,79 Z
    // norm: centre=(50,49), scale=64 → [(x-50)/64, -(y-49)/64]
    const n = (x: number, y: number): [number, number] =>
      [(x - 50) / 64, -(y - 49) / 64];

    const s = new THREE.Shape();
    s.moveTo(...n(18, 19));
    s.lineTo(...n(36, 19));
    s.lineTo(...n(30, 29));
    s.lineTo(...n(50, 61));
    s.lineTo(...n(70, 29));
    s.lineTo(...n(64, 19));
    s.lineTo(...n(82, 19));
    s.lineTo(...n(50, 79));
    s.closePath();
    return s;
  }, []);

  return (
    <group position={position} rotation={rotation} scale={[size, size, size]}>
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial
          color={color}
          metalness={1}
          roughness={0.55}
          emissive={emissive ?? color}
          emissiveIntensity={emissiveIntensity}
          transparent={opacity < 1}
          opacity={opacity}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
