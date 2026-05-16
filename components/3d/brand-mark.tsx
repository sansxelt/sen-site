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
    // Source path (100×100): M12,12 L30,12 Q38,38 50,43 Q62,38 70,12 L88,12 L50,84 Z
    // norm: centre=(50,50), scale=96 → [(x-50)/96, -(y-50)/96]
    const n = (x: number, y: number): [number, number] =>
      [(x - 50) / 96, -(y - 50) / 96];

    const s = new THREE.Shape();
    s.moveTo(...n(12, 12));
    s.lineTo(...n(30, 12));
    s.quadraticCurveTo(...n(38, 38), ...n(50, 43));
    s.quadraticCurveTo(...n(62, 38), ...n(70, 12));
    s.lineTo(...n(88, 12));
    s.lineTo(...n(50, 84));
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
