"use client";

import { useFrame } from "@react-three/fiber";
import { Float, RoundedBox, Text } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { StudioRig } from "./studio-rig";

// Workshop = the brain. Three engineered glass dashboard panels
// (chat, workshop, files) arranged in 3D space. Each panel is a
// precise rounded box with brushed aluminum bezel and a faintly
// emissive content area. No particle systems, no neon glow, just
// product hardware.

type PanelProps = {
  position: [number, number, number];
  size: [number, number];
  label: string;
  accent?: string;
  rotation?: [number, number, number];
};

function GlassPanel({ position, size, label, accent = "#a8c4ff", rotation = [0, 0, 0] }: PanelProps) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.position.y = position[1] + Math.sin(t * 0.45 + position[0]) * 0.04;
  });

  const w = size[0], h = size[1];

  return (
    <Float speed={0.85} floatIntensity={0.16} rotationIntensity={0.08}>
      <group ref={groupRef} position={position} rotation={rotation}>
        {/* Bezel: brushed aluminum frame */}
        <RoundedBox args={[w + 0.04, h + 0.04, 0.05]} radius={0.04} smoothness={4}>
          <meshPhysicalMaterial
            color="#1a1c24"
            roughness={0.45}
            metalness={0.95}
            clearcoat={0.6}
            clearcoatRoughness={0.3}
          />
        </RoundedBox>

        {/* Display: dark glass with subtle blue tint */}
        <mesh position={[0, 0, 0.027]}>
          <planeGeometry args={[w - 0.02, h - 0.02]} />
          <meshPhysicalMaterial
            color="#04060c"
            roughness={0.18}
            metalness={0.1}
            clearcoat={1}
            clearcoatRoughness={0.06}
            emissive="#1d2540"
            emissiveIntensity={0.55}
          />
        </mesh>

        {/* Top accent stripe (active app) */}
        <mesh position={[-(w / 2) + 0.08, h / 2 - 0.10, 0.029]}>
          <planeGeometry args={[0.10, 0.012]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} />
        </mesh>

        {/* Three "rows" — UI suggestion */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.04 - i * 0.10, 0.029]}>
            <planeGeometry args={[w - 0.20 - i * 0.06, 0.018]} />
            <meshStandardMaterial color={accent} transparent opacity={0.16 - i * 0.04} />
          </mesh>
        ))}

        <Text
          position={[-(w / 2) + 0.20, h / 2 - 0.10, 0.030]}
          fontSize={0.075}
          color={accent}
          anchorX="left"
          anchorY="middle"
          letterSpacing={0.06}
        >
          {label}
        </Text>
      </group>
    </Float>
  );
}

function MemoryCard({ angle, radius, speed, label }: { angle: number; radius: number; speed: number; label: string }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * speed;
  });
  return (
    <group ref={groupRef} rotation={[0, angle, 0]}>
      <Float speed={1.0} floatIntensity={0.12}>
        <group position={[radius, 0.3, 0]}>
          <RoundedBox args={[0.6, 0.36, 0.025]} radius={0.04} smoothness={4}>
            <meshPhysicalMaterial
              color="#0a0c14"
              roughness={0.22}
              metalness={0.5}
              clearcoat={1}
              clearcoatRoughness={0.08}
            />
          </RoundedBox>
          <mesh position={[0, 0.10, 0.014]}>
            <planeGeometry args={[0.45, 0.012]} />
            <meshStandardMaterial color="#a8c4ff" emissive="#a8c4ff" emissiveIntensity={0.55} />
          </mesh>
          <mesh position={[0, 0.045, 0.014]}>
            <planeGeometry args={[0.36, 0.01]} />
            <meshBasicMaterial color="#a8c4ff" transparent opacity={0.4} />
          </mesh>
          <mesh position={[0, -0.01, 0.014]}>
            <planeGeometry args={[0.40, 0.01]} />
            <meshBasicMaterial color="#a8c4ff" transparent opacity={0.3} />
          </mesh>
          <Text
            position={[-0.24, -0.10, 0.014]}
            fontSize={0.04}
            color="#a8c4ff"
            anchorX="left"
            anchorY="middle"
            letterSpacing={0.05}
          >
            {label}
          </Text>
        </group>
      </Float>
    </group>
  );
}

export function WorkshopBrain() {
  return (
    <>
      <StudioRig contactShadowY={-1.4} contactShadowOpacity={0.45} />

      <GlassPanel position={[-1.5, 0.2, 0]}    size={[1.4, 0.95]} label="CHAT"     accent="#a8c4ff" rotation={[0, 0.18, 0]} />
      <GlassPanel position={[ 0.0, -0.15, -0.3]} size={[1.5, 1.10]} label="WORKSHOP" accent="#60a5fa" />
      <GlassPanel position={[ 1.5, 0.30, -0.05]} size={[1.2, 0.85]} label="FILES"    accent="#22d3ee" rotation={[0, -0.25, 0]} />

      {["mem · plan", "mem · prefs", "mem · facts", "mem · notes"].map((m, i) => (
        <MemoryCard
          key={i}
          angle={(i * Math.PI * 2) / 4}
          radius={2.7}
          speed={0.10 + i * 0.012}
          label={m}
        />
      ))}
    </>
  );
}
