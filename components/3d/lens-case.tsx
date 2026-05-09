"use client";

import { useFrame } from "@react-three/fiber";
import { Float, RoundedBox, Text } from "@react-three/drei";
import { useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { StudioRig } from "./studio-rig";
import { ModelOrFallback } from "./use-gltf-or-fallback";
import { BrandMark } from "./brand-mark";
import { CinematicEffects } from "./cinematic-effects";
import { CameraDrift } from "./camera-drift";

// Lens charging case. Reads as a real product you could hold:
// chamfered aluminum body, soft-touch interior, two CNC-milled wells
// with gold pin contacts and a 4-LED charging arc each. Lid hinges
// open on a slow loop; status LED is a single warm pinpoint;
// Sansxel mark etched into the lid.
//
// Layered procedural realism:
//   exterior     anodized matte black aluminum
//   chamfer x2   nested rim shells fake the bevel highlight
//   interior     soft-touch dark grey, no clearcoat
//   lid gap      visible seam line on the front face
//   wells        chamfer + conical wall + meniscus + 2 gold pins
//   charge arcs  4 small LEDs above each well showing pair fill level
//   labels       "A" and "B" laser-etched on the well rims
//   hinge        seam line + brushed steel pin
//   vent         milled slot with thin ribs on the back face
//   status LED   single pinpoint on the bottom front edge
//   etched mark  Sansxel triangles on the lid centre
//   serial       6 microscopic notches on the front face

function CaseLid({ open, w, d, h }: { open: number; w: number; d: number; h: number }) {
  const lidRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (lidRef.current) lidRef.current.rotation.x = -open * Math.PI * 0.5;
  });

  return (
    <group ref={lidRef} position={[0, h, -d / 2]}>
      {/* Main lid shell */}
      <RoundedBox
        args={[w, h, d]}
        radius={0.15}
        smoothness={6}
        position={[0, h / 2, d / 2]}
      >
        <meshPhysicalMaterial
          color="#04050a"
          roughness={0.28}
          metalness={0.96}
          clearcoat={1}
          clearcoatRoughness={0.04}
          reflectivity={0.98}
        />
      </RoundedBox>

      {/* Lid inner rim chamfer — slightly larger plate just under
          the lid surface, brighter, gives the lid a CNC bevel */}
      <mesh position={[0, h - 0.001, d / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[d * 0.35, d * 0.37, 4, 1, 0, Math.PI * 2]} />
        <meshStandardMaterial color="#2c303a" metalness={1} roughness={0.45} />
      </mesh>

      {/* Etched Sansxel mark on the lid centre */}
      <BrandMark
        size={0.08}
        position={[0, h - 0.002, d / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        color="#23262e"
        opacity={0.9}
      />
    </group>
  );
}

function ChargingArc({ x, color }: { x: number; color: string }) {
  // 4-LED progress arc above the well showing charge level. Slowly
  // animates filling up so it reads as live, not a static decal.
  const arcRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!arcRef.current) return;
    const t = state.clock.elapsedTime;
    arcRef.current.children.forEach((dot, i) => {
      const m = (dot as THREE.Mesh).material as THREE.MeshStandardMaterial;
      const phase = (t * 0.4 + i * 0.6) % 4;
      m.emissiveIntensity = phase < (i + 1) ? 1.6 : 0.15;
    });
  });
  return (
    <group ref={arcRef} position={[x, 0.018, 0.30]}>
      {[-0.054, -0.018, 0.018, 0.054].map((dx, i) => (
        <mesh key={i} position={[dx, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.008, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function ChargingWell({ x, color, label }: { x: number; color: string; label: string }) {
  const liquidRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!liquidRef.current) return;
    const m = liquidRef.current.material as THREE.MeshStandardMaterial;
    const t = state.clock.elapsedTime;
    m.emissiveIntensity = 0.32 + Math.sin(t * 0.9 + x * 3) * 0.10;
  });
  return (
    <group position={[x, 0.02, 0]}>
      {/* Outer chamfer rim — CNC'd into the surface */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.225, 0.006, 16, 96]} />
        <meshPhysicalMaterial color="#1a1c24" metalness={1} roughness={0.34} clearcoat={0.5} />
      </mesh>

      {/* Outer chamfer — secondary slightly larger ring for bevel */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.003, 0]}>
        <torusGeometry args={[0.235, 0.003, 12, 96]} />
        <meshStandardMaterial color="#2c303a" metalness={1} roughness={0.5} />
      </mesh>

      {/* Recessed conical wall — well floor angles inward */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.18, 0.10, 64, 1, true]} />
        <meshStandardMaterial
          color="#06070b"
          side={THREE.DoubleSide}
          roughness={0.85}
          metalness={0.2}
        />
      </mesh>

      {/* Curved liquid meniscus */}
      <mesh ref={liquidRef} position={[0, -0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.195, 64]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          transparent
          opacity={0.85}
          metalness={0.4}
          roughness={0.15}
          clearcoat={0.7}
          clearcoatRoughness={0.05}
        />
      </mesh>

      {/* 2 gold charging pin contacts */}
      {[-0.06, 0.06].map((dx, i) => (
        <mesh
          key={i}
          position={[dx, -0.058, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.012, 0.012, 0.008, 16]} />
          <meshPhysicalMaterial
            color="#caa56a"
            metalness={1}
            roughness={0.25}
            clearcoat={0.3}
          />
        </mesh>
      ))}

      {/* Pair label — laser-etched single character on the rim */}
      <Text
        position={[0, 0.001, 0.245]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.03}
        color={color}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.06}
      >
        {label}
      </Text>
    </group>
  );
}

function Case() {
  const [open, setOpen] = useState(0);
  const w = 1.7, d = 1.2, h = 0.46;

  useEffect(() => {
    let raf = 0;
    let direction = 1;
    let value = 0;
    const tick = () => {
      value += direction * 0.0035;
      if (value >= 1) { value = 1; direction = -1; }
      if (value <= 0) { value = 0; direction =  1; }
      setOpen(value);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Float speed={0.5} floatIntensity={0.08} rotationIntensity={0.03}>
      <group rotation={[0.16, 0.42, 0]} position={[0, -0.2, 0]}>
        {/* BASE SHELL — anodized aluminum exterior */}
        <RoundedBox args={[w, h, d]} radius={0.15} smoothness={6}>
          <meshPhysicalMaterial
            color="#0a0a10"
            roughness={0.32}
            metalness={0.92}
            clearcoat={1}
            clearcoatRoughness={0.06}
            reflectivity={0.95}
          />
        </RoundedBox>

        {/* SECONDARY CHAMFER SHELL — slightly larger box just under
            the body that catches a hairline highlight at the seam */}
        <RoundedBox args={[w + 0.01, h * 0.98, d + 0.01]} radius={0.155} smoothness={4}>
          <meshStandardMaterial
            color="#1a1c24"
            metalness={1}
            roughness={0.55}
          />
        </RoundedBox>

        {/* SOFT-TOUCH INTERIOR — only visible when lid opens */}
        <RoundedBox
          args={[w * 0.94, h * 0.6, d * 0.92]}
          radius={0.08}
          smoothness={4}
          position={[0, 0.12, 0]}
        >
          <meshStandardMaterial
            color="#15161c"
            roughness={0.92}
            metalness={0}
          />
        </RoundedBox>

        {/* TOP CHAMFER RING */}
        <mesh position={[0, h / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[d * 0.49, d * 0.51, 4, 1, 0, Math.PI * 2]} />
          <meshStandardMaterial color="#2c303a" metalness={1} roughness={0.45} />
        </mesh>

        {/* LID GAP — visible seam line across the front face where
            lid meets base. Reads as "this opens". */}
        <mesh position={[0, h / 2 - 0.005, d / 2 + 0.001]}>
          <planeGeometry args={[w - 0.06, 0.0025]} />
          <meshStandardMaterial color="#02030a" />
        </mesh>
        {/* Wraparound seam on left/right */}
        <mesh position={[-(w / 2) + 0.001, h / 2 - 0.005, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[d - 0.04, 0.0025]} />
          <meshStandardMaterial color="#02030a" />
        </mesh>
        <mesh position={[ (w / 2) - 0.001, h / 2 - 0.005, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[d - 0.04, 0.0025]} />
          <meshStandardMaterial color="#02030a" />
        </mesh>

        {/* HINGE seam line — back top edge */}
        <mesh position={[0, h / 2 - 0.005, -d / 2 + 0.02]}>
          <boxGeometry args={[w - 0.4, 0.0015, 0.002]} />
          <meshStandardMaterial color="#1a1c24" metalness={1} roughness={0.6} />
        </mesh>

        {/* HINGE PIN — brushed steel cylinder */}
        <mesh position={[0, h / 2 - 0.012, -d / 2 + 0.04]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.018, 0.018, w - 0.4, 24]} />
          <meshStandardMaterial color="#3a3d49" metalness={1} roughness={0.5} />
        </mesh>

        {/* VENT SLOT — back face */}
        <mesh position={[0, -h / 4, -d / 2 - 0.001]}>
          <planeGeometry args={[0.42, 0.018]} />
          <meshStandardMaterial color="#02030a" />
        </mesh>
        {Array.from({ length: 7 }).map((_, i) => (
          <mesh
            key={`vent-${i}`}
            position={[-0.18 + i * 0.06, -h / 4, -d / 2 - 0.0005]}
          >
            <planeGeometry args={[0.002, 0.018]} />
            <meshStandardMaterial color="#1a1c24" />
          </mesh>
        ))}

        {/* STATUS LED — tiny pinpoint, bottom front edge */}
        <mesh position={[w / 2 - 0.18, -h / 2 + 0.02, d / 2 + 0.001]}>
          <circleGeometry args={[0.008, 24]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.6} />
        </mesh>

        {/* Product-code rectangles removed — they read as a printed
            label, not as etched typography on metal. Future GLB will
            carry a real serial in normal-mapped relief. */}

        {/* LID */}
        <CaseLid open={open} w={w} d={d} h={h} />

        {/* INTERIOR — wells + charging arcs */}
        <group position={[0, 0.215, 0]}>
          <ChargingWell x={-0.42} color="#22d3ee" label="A" />
          <ChargingWell x={ 0.42} color="#c084fc" label="B" />
          <ChargingArc  x={-0.42} color="#22d3ee" />
          <ChargingArc  x={ 0.42} color="#c084fc" />
        </group>
      </group>
    </Float>
  );
}

export function LensCase({ effects = true }: { effects?: boolean } = {}) {
  return (
    <>
      <StudioRig
        contactShadowY={-0.85}
        contactShadowOpacity={0.55}
        contactShadowBlur={3.2}
        fogNear={5}
        fogFar={12}
        dust
        reflectiveFloor
      />
      <CameraDrift amplitudeX={0.20} amplitudeY={0.10} amplitudeZ={0.14} periodSeconds={10} />
      <ModelOrFallback url="/models/lens-case-v1.glb" fallback={<Case />} />
      {effects && <CinematicEffects intensity="product" />}
    </>
  );
}
