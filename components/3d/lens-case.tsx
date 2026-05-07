"use client";

import { useFrame } from "@react-three/fiber";
import { Float, RoundedBox } from "@react-three/drei";
import { useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { StudioRig } from "./studio-rig";

// Lens Case. AirPods-medical hybrid: precise rounded-rectangle base
// + lid that rotates open on a slow loop. Two curved liquid-charging
// wells inside (Pair A cyan, Pair B violet). Single status LED on
// the bottom front edge.
//
// All MeshPhysicalMaterial: matte black aluminum + glossy clearcoat,
// reads as a real product not a render concept.

function CaseLid({ open }: { open: number }) {
  const lidRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (lidRef.current) lidRef.current.rotation.x = -open * Math.PI * 0.55;
  });

  const w = 1.7, d = 1.2, h = 0.48;

  return (
    <group ref={lidRef} position={[0, h, -d / 2]}>
      <RoundedBox
        args={[w, h, d]}
        radius={0.18}
        smoothness={6}
        position={[0, h / 2, d / 2]}
      >
        <meshPhysicalMaterial
          color="#0c0c12"
          roughness={0.30}
          metalness={0.85}
          clearcoat={1}
          clearcoatRoughness={0.05}
          reflectivity={0.95}
        />
      </RoundedBox>
    </group>
  );
}

function CaseBase() {
  const w = 1.7, d = 1.2, h = 0.48;
  return (
    <group>
      <RoundedBox args={[w, h, d]} radius={0.18} smoothness={6}>
        <meshPhysicalMaterial
          color="#0c0c12"
          roughness={0.30}
          metalness={0.85}
          clearcoat={1}
          clearcoatRoughness={0.05}
          reflectivity={0.95}
        />
      </RoundedBox>

      {/* Bottom front status LED ring (slimmest detail that signals
          "this is a product"). Recessed into the chamfer. */}
      <mesh position={[0, -h / 2 + 0.02, d / 2 + 0.001]}>
        <ringGeometry args={[0.030, 0.045, 32]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.4} side={THREE.DoubleSide} />
      </mesh>

      {/* Hinge bar at the back: brushed steel pin */}
      <mesh position={[0, h / 2 - 0.02, -d / 2 + 0.04]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, w - 0.4, 24]} />
        <meshStandardMaterial color="#3a3d49" metalness={1} roughness={0.55} />
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
    m.emissiveIntensity = 0.55 + Math.sin(t * 1.1 + x * 3) * 0.15;
  });
  return (
    <group position={[x, 0.02, 0]}>
      {/* Well rim (CNC'd into the base) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.225, 0.008, 12, 64]} />
        <meshPhysicalMaterial color="#1a1c24" metalness={1} roughness={0.42} />
      </mesh>
      {/* Well wall (dark interior) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.12, 48, 1, true]} />
        <meshStandardMaterial color="#04050a" side={THREE.DoubleSide} roughness={0.7} />
      </mesh>
      {/* Liquid surface (curved meniscus) */}
      <mesh ref={liquidRef} position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.20, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          transparent
          opacity={0.9}
          metalness={0.4}
          roughness={0.18}
        />
      </mesh>
    </group>
  );
}

function Case() {
  const [open, setOpen] = useState(0);

  useEffect(() => {
    let raf = 0;
    let direction = 1;
    let value = 0;
    const tick = () => {
      value += direction * 0.005;
      if (value >= 1) { value = 1; direction = -1; }
      if (value <= 0) { value = 0; direction =  1; }
      setOpen(value);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Float speed={0.55} floatIntensity={0.10} rotationIntensity={0.04}>
      <group rotation={[0.18, 0.4, 0]} position={[0, -0.2, 0]}>
        <CaseBase />
        <CaseLid open={open} />
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
      <StudioRig contactShadowY={-0.85} contactShadowOpacity={0.55} contactShadowBlur={3} />
      <Case />
    </>
  );
}
