"use client";

import { useFrame } from "@react-three/fiber";
import { Float, RoundedBox } from "@react-three/drei";
import { useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { StudioRig } from "./studio-rig";
import { ModelOrFallback } from "./use-gltf-or-fallback";

// Lens charging case. Reads as a physical object you could hold:
// chamfered aluminum body, soft-touch interior, two CNC-milled
// charging wells with gold pin contacts. Lid hinges open on a slow
// breathing loop; status LED is a single warm pinpoint.
//
// Material strategy:
//   exterior:  anodized matte black aluminum, clearcoat 1, low rough
//   chamfer:   slightly brighter ring around the top edge, the
//              brushed bevel that gives a real product its weight
//   interior:  soft-touch dark grey, high roughness, no clearcoat
//   wells:     CNC torus rim + dark cylinder wall + curved liquid
//              meniscus + 2 gold pin contacts at the base
//   hinge:     visible seam line + brushed steel pin
//   vent:      single thin slot on the back face (electronics venting)
//
// Drop /models/lens-case-v1.glb to override.

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
          color="#0a0a10"
          roughness={0.32}
          metalness={0.92}
          clearcoat={1}
          clearcoatRoughness={0.06}
          reflectivity={0.95}
        />
      </RoundedBox>

      {/* Chamfer highlight — a faint top-edge ring that catches the
          rim light. The detail that says "machined". */}
      <mesh position={[0, h - 0.002, d / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[d * 0.32, d * 0.34, 4, 1, 0, Math.PI * 2]} />
        <meshStandardMaterial color="#2c303a" metalness={1} roughness={0.45} />
      </mesh>

      {/* Subtle laser-etched logo notch on lid centre */}
      <mesh position={[0, h - 0.001, d / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.04, 0.052, 32]} />
        <meshStandardMaterial color="#1a1c24" metalness={1} roughness={0.55} />
      </mesh>
    </group>
  );
}

function ChargingWell({ x, color }: { x: number; color: string }) {
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

      {/* Recessed conical wall — the well floor angles inward */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.18, 0.10, 64, 1, true]} />
        <meshStandardMaterial
          color="#06070b"
          side={THREE.DoubleSide}
          roughness={0.85}
          metalness={0.2}
        />
      </mesh>

      {/* Curved liquid meniscus — restrained emissive (not glowing) */}
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

      {/* 2 gold charging pin contacts at the floor of the well — the
          detail that says "contact lens drops in here, plug in" */}
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
        {/* Base shell — anodized aluminum exterior */}
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

        {/* Soft-touch interior — visible only when lid opens. Higher
            roughness, no clearcoat, slightly warmer black. */}
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

        {/* Chamfer ring — top edge highlight that catches rim light */}
        <mesh position={[0, h / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[d * 0.49, d * 0.51, 4, 1, 0, Math.PI * 2]} />
          <meshStandardMaterial color="#2c303a" metalness={1} roughness={0.45} />
        </mesh>

        {/* Hinge seam — fine line across the back top edge */}
        <mesh position={[0, h / 2 - 0.005, -d / 2 + 0.02]} rotation={[0, 0, 0]}>
          <boxGeometry args={[w - 0.4, 0.0015, 0.002]} />
          <meshStandardMaterial color="#1a1c24" metalness={1} roughness={0.6} />
        </mesh>

        {/* Hinge pin — brushed steel cylinder */}
        <mesh position={[0, h / 2 - 0.012, -d / 2 + 0.04]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.018, 0.018, w - 0.4, 24]} />
          <meshStandardMaterial color="#3a3d49" metalness={1} roughness={0.5} />
        </mesh>

        {/* Vent slot — back face, electronics ventilation */}
        <mesh position={[0, -h / 4, -d / 2 - 0.001]}>
          <planeGeometry args={[0.42, 0.018]} />
          <meshStandardMaterial color="#02030a" />
        </mesh>
        {/* Vent ribs — thin black slats inside */}
        {Array.from({ length: 7 }).map((_, i) => (
          <mesh
            key={`vent-${i}`}
            position={[-0.18 + i * 0.06, -h / 4, -d / 2 - 0.0005]}
          >
            <planeGeometry args={[0.002, 0.018]} />
            <meshStandardMaterial color="#1a1c24" />
          </mesh>
        ))}

        {/* Status LED — tiny pinpoint at the bottom front edge */}
        <mesh position={[w / 2 - 0.18, -h / 2 + 0.02, d / 2 + 0.001]}>
          <circleGeometry args={[0.008, 24]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.6} />
        </mesh>

        {/* Front laser-etched product code */}
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh
            key={`mark-${i}`}
            position={[-0.36 + i * 0.04, -h / 2 + 0.06, d / 2 + 0.001]}
          >
            <planeGeometry args={[0.012, 0.004]} />
            <meshBasicMaterial color="#2c303a" />
          </mesh>
        ))}

        {/* Lid */}
        <CaseLid open={open} w={w} d={d} h={h} />

        {/* Charging wells — only visible when lid is open */}
        <group position={[0, 0.215, 0]}>
          <ChargingWell x={-0.42} color="#22d3ee" />
          <ChargingWell x={ 0.42} color="#c084fc" />
        </group>
      </group>
    </Float>
  );
}

export function LensCase() {
  return (
    <>
      <StudioRig
        contactShadowY={-0.85}
        contactShadowOpacity={0.55}
        contactShadowBlur={3.2}
        fogNear={5}
        fogFar={12}
      />
      <ModelOrFallback url="/models/lens-case-v1.glb" fallback={<Case />} />
    </>
  );
}
