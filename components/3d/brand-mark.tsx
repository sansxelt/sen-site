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
    // V chevron points from logo-*.svg, normalized to centre at origin.
    // SVG coords (680×680 grid, centre 340): polygon points 109,102
    // 224,102 340,388 456,102 571,102 340,564
    const norm = (x: number, y: number): [number, number] =>
      [(x - 340) / 600, -(y - 340) / 600];

    const pts: [number, number][] = [
      norm(109, 102),
      norm(224, 102),
      norm(340, 388),
      norm(456, 102),
      norm(571, 102),
      norm(340, 564),
    ];

    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
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
