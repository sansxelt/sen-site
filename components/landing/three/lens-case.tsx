"use client";

import { useFrame } from "@react-three/fiber";
import { Float, RoundedBox } from "@react-three/drei";
import { useRef, useState, useEffect } from "react";
import * as THREE from "three";

// Lens Case = AirPods-style smart charging case for two pairs of
// Lens. Opens on a slow loop. Two liquid charging wells visible in
// the lid interior with subtle pulsing.

function CasePart({ open, isLid }: { open: number; isLid: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    if (isLid) {
      ref.current.rotation.x = -open * Math.PI * 0.55;
    }
  });

  const w = 1.7, d = 1.2, h = 0.5;

  return (
    <group ref={ref} position={isLid ? [0, h, -d / 2] : [0, 0, 0]}>
      <RoundedBox
        args={[w, h, d]}
        radius={0.15}
        smoothness={5}
        position={isLid ? [0, h / 2, d / 2] : [0, 0, 0]}
      >
        <meshPhysicalMaterial
          color="#0d0d12"
          roughness={0.15}
          metalness={0.85}
          clearcoat={1}
          clearcoatRoughness={0.06}
          reflectivity={0.95}
        />
      </RoundedBox>
      {/* Bottom thin status LED */}
      {!isLid && (
        <mesh position={[0, -h / 2 - 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.04, 0.05, 24]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  );
}

function ChargingWell({ x, color }: { x: number; color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!meshRef.current) return;
    const m = meshRef.current.material as THREE.MeshStandardMaterial;
    const t = state.clock.elapsedTime;
    m.emissiveIntensity = 0.7 + Math.sin(t * 1.4 + x) * 0.4;
  });
  return (
    <group position={[x, 0.03, 0]}>
      {/* Well */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.1, 32, 1, true]} />
        <meshStandardMaterial color="#020308" side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
      {/* Liquid surface */}
      <mesh ref={meshRef} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.20, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.9}
          transparent
          opacity={0.85}
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
      if (value >= 1) { value = 1; direction = -1; setTimeout(() => { direction = -1; }, 1500); }
      if (value <= 0) { value = 0; direction = 1;  setTimeout(() => { direction =  1; }, 1500); }
      setOpen(value);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Float speed={0.7} floatIntensity={0.18} rotationIntensity={0.06}>
      <group rotation={[0.15, 0.4, 0]} position={[0, -0.2, 0]}>
        <CasePart open={open} isLid={false} />
        <CasePart open={open} isLid={true} />
        {/* Wells visible inside the base */}
        <group position={[0, 0.21, 0]}>
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
      <ambientLight intensity={0.45} />
      <pointLight position={[3, 4, 3]}  intensity={1.4} color="#a8c4ff" />
      <pointLight position={[-3, 2, 4]} intensity={0.9} color="#c084fc" />
      <pointLight position={[0, 5, 2]}  intensity={0.7} color="#ffffff" />
      <Case />
    </>
  );
}
