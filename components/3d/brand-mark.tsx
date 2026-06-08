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
    // Source path (100×100): M14,23 L17,19 L33,19 L25,32 L50,55 L75,32 L67,19 L83,19 L86,23 L50,82 Z
    // norm: centre=(50,50), scale=72 → [(x-50)/72, -(y-50)/72]
    const n = (x: number, y: number): [number, number] =>
      [(x - 50) / 72, -(y - 50) / 72];

    const s = new THREE.Shape();
    s.moveTo(...n(14, 23));
    s.lineTo(...n(17, 19));
    s.lineTo(...n(33, 19));
    s.lineTo(...n(25, 32));
    s.lineTo(...n(50, 55));
    s.lineTo(...n(75, 32));
    s.lineTo(...n(67, 19));
    s.lineTo(...n(83, 19));
    s.lineTo(...n(86, 23));
    s.lineTo(...n(50, 82));
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
