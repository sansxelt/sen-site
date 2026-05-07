"use client";

import { useFrame } from "@react-three/fiber";
import { Float, MeshTransmissionMaterial } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";
import { StudioRig } from "./studio-rig";
import { ModelOrFallback } from "./use-gltf-or-fallback";

// Sansxel Lens. Medical-grade transparent contact with embedded
// electronics, not sci-fi fantasy. Composition:
//   - Lathe-curved acrylic disc (anti-reflective coating)
//   - Outer electronics ring: precision anodized track
//   - 24 sub-millimetre LEDs (tiny, restrained emissive)
//   - 6 gold pad contacts at the ring (charge + data interface)
//   - Iris reticle: hairline ring, no glowing centre
//   - Concentric trace pattern: faint copper-blue at low opacity
//   - Laser-etched lot number on the carrier ring (text via Drei
//     not used here to keep bundle small — simulated as a thin
//     ring of small dots)
//
// If /models/lens-v1.glb exists it takes over. Until then this
// procedural geometry is what renders.

function ProceduralLens() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.08;
  });

  // Lathe profile: gentle convex outer + a faint inner step where
  // the electronics ring sits.
  const lensProfile = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const r = t * 1.0;
      const y = -Math.pow(r, 2.4) * 0.14;
      pts.push(new THREE.Vector2(r, y));
    }
    return pts;
  }, []);

  return (
    <Float speed={0.55} floatIntensity={0.08} rotationIntensity={0.05}>
      <group ref={groupRef} rotation={[Math.PI * 0.18, 0, 0]}>
        {/* Lens body: medical-grade hydrogel acrylic.
            transmission 1, ior 1.43, very low chromatic aberration.
            Anti-reflective coating simulated by a clearcoat with
            faint blue tint. */}
        <mesh>
          <latheGeometry args={[lensProfile, 128]} />
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.16}
            roughness={0.02}
            ior={1.43}
            chromaticAberration={0.008}
            color="#e6ecfa"
            transparent
            attenuationColor="#a8c4ff"
            attenuationDistance={6}
            anisotropy={0.15}
          />
        </mesh>

        {/* Anti-reflective coating sheen — a faint blue-violet tint
            that catches a sliver of the rim light */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
          <ringGeometry args={[0.94, 1.0, 128]} />
          <meshStandardMaterial
            color="#1d2a44"
            transparent
            opacity={0.22}
            side={THREE.DoubleSide}
            metalness={0.3}
            roughness={0.6}
          />
        </mesh>

        {/* Outer electronics carrier ring: anodized dark navy */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
          <torusGeometry args={[0.95, 0.011, 24, 256]} />
          <meshPhysicalMaterial
            color="#13151c"
            roughness={0.34}
            metalness={1}
            clearcoat={0.65}
            clearcoatRoughness={0.18}
          />
        </mesh>

        {/* Inner secondary ring (chip layer) */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.0035, 0]}>
          <torusGeometry args={[0.92, 0.005, 12, 192]} />
          <meshStandardMaterial color="#22242c" metalness={1} roughness={0.45} />
        </mesh>

        {/* 24 sub-mm LEDs — tiny, low intensity, mostly off-tinted */}
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          const isPrimary = i % 8 === 0;
          const isSecondary = i % 4 === 0 && !isPrimary;
          return (
            <mesh
              key={`led-${i}`}
              position={[Math.cos(a) * 0.95, -0.005, Math.sin(a) * 0.95]}
            >
              <sphereGeometry args={[0.0085, 12, 12]} />
              <meshStandardMaterial
                color={isPrimary ? "#a8c4ff" : isSecondary ? "#7ab5ff" : "#202836"}
                emissive={isPrimary ? "#a8c4ff" : isSecondary ? "#7ab5ff" : "#000000"}
                emissiveIntensity={isPrimary ? 0.95 : isSecondary ? 0.45 : 0}
              />
            </mesh>
          );
        })}

        {/* 6 gold chip contacts (charge + data pads). These are the
            single most "real product" detail — flat anodized brass
            squares around the ring. */}
        {Array.from({ length: 6 }).map((_, i) => {
          const a = (i / 6) * Math.PI * 2 + Math.PI / 24;
          return (
            <mesh
              key={`pad-${i}`}
              position={[Math.cos(a) * 0.965, 0.001, Math.sin(a) * 0.965]}
              rotation={[-Math.PI / 2, 0, -a]}
            >
              <planeGeometry args={[0.018, 0.034]} />
              <meshPhysicalMaterial
                color="#caa56a"
                metalness={1}
                roughness={0.28}
                clearcoat={0.4}
                clearcoatRoughness={0.3}
              />
            </mesh>
          );
        })}

        {/* Iris reticle — fine hairline only, no glow centre. Reads
            as the optical axis of the device, not a HUD. */}
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.18, 0.184, 128]} />
          <meshStandardMaterial color="#a8c4ff" emissive="#a8c4ff" emissiveIntensity={0.3} side={THREE.DoubleSide} />
        </mesh>

        {/* Concentric electrical traces — very faint, like you'd see
            on a flexible PCB under glass */}
        <mesh position={[0, 0.0011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.553, 128]} />
          <meshBasicMaterial color="#7ab5ff" transparent opacity={0.12} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.0012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.72, 0.722, 128]} />
          <meshBasicMaterial color="#7ab5ff" transparent opacity={0.10} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.0013, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.83, 0.831, 128]} />
          <meshBasicMaterial color="#7ab5ff" transparent opacity={0.07} side={THREE.DoubleSide} />
        </mesh>

        {/* Laser-etched lot number — 32 microscopic notches on the
            outermost ring. Reads as "this is a manufactured part",
            not "this is concept art". */}
        {Array.from({ length: 32 }).map((_, i) => {
          const a = (i / 32) * Math.PI * 2;
          return (
            <mesh
              key={`etch-${i}`}
              position={[Math.cos(a) * 0.985, -0.005, Math.sin(a) * 0.985]}
            >
              <boxGeometry args={[0.004, 0.001, 0.002]} />
              <meshBasicMaterial color="#3b4358" />
            </mesh>
          );
        })}
      </group>
    </Float>
  );
}

export function LensObject() {
  return (
    <>
      <StudioRig
        contactShadowY={-0.6}
        contactShadowOpacity={0.5}
        contactShadowBlur={3}
        fogNear={4}
        fogFar={10}
      />
      <ModelOrFallback url="/models/lens-v1.glb" fallback={<ProceduralLens />} />
    </>
  );
}
