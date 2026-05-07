"use client";

import { useMemo } from "react";
import * as THREE from "three";

// Etched Sansxel brand mark. The logo is three triangles around a
// pivot (see /public/logo-cyan.svg). Rendered as flat thin geometry
// so it reads as a laser-etched mark on a metal surface, not a
// floating UI element.
//
// Use anywhere a real product would carry the brand: lid centre,
// stem side, ring inner face. Default colour is a low-contrast
// graphite — the etch is supposed to hide and reveal under the rim
// light, not announce itself.

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
  // Triangle shapes mirror the polygons in the SVG, normalized to
  // a unit-ish bounding box, then scaled by `size`.
  const shapes = useMemo(() => {
    const make = (pts: [number, number][]) => {
      const s = new THREE.Shape();
      s.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
      s.closePath();
      return s;
    };

    // SVG centre is at (340, 340), normalize to centre at origin and
    // a half-extent ≈ 0.5
    const norm = (x: number, y: number): [number, number] =>
      [(x - 340) / 600, -(y - 340) / 600];

    const tri1 = make([norm(340, 340), norm(116, 116), norm(340, 60)]);
    const tri2 = make([norm(340, 340), norm(564, 116), norm(620, 340)]);
    const tri3 = make([norm(340, 340), norm(396, 620), norm(144, 564)]);
    return [tri1, tri2, tri3];
  }, []);

  return (
    <group position={position} rotation={rotation} scale={[size, size, size]}>
      {shapes.map((shape, i) => (
        <mesh key={i}>
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
      ))}
      {/* Centre pivot dot — punched through */}
      <mesh position={[0, 0, 0.001]}>
        <circleGeometry args={[0.022, 16]} />
        <meshBasicMaterial color="#020308" transparent={opacity < 1} opacity={opacity} />
      </mesh>
    </group>
  );
}
