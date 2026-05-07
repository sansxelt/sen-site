"use client";

import { useFrame } from "@react-three/fiber";
import { Float, RoundedBox, Text, Sparkles } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

// Workshop = brain. Floating glass dashboard panels (chat, files,
// projects, memory) arranged in 3D space, slowly drifting. Memory
// cards orbit the central panel. Subtle and dense, not gimmicky.

type PanelProps = {
  position: [number, number, number];
  size: [number, number];
  label: string;
  color?: string;
  rotation?: [number, number, number];
};

function GlassPanel({ position, size, label, color = "#a8c4ff", rotation = [0, 0, 0] }: PanelProps) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.position.y = position[1] + Math.sin(t * 0.5 + position[0]) * 0.06;
  });

  return (
    <Float speed={1.0} floatIntensity={0.25} rotationIntensity={0.18}>
      <group ref={groupRef} position={position} rotation={rotation}>
        <RoundedBox args={[size[0], size[1], 0.04]} radius={0.05} smoothness={4}>
          <meshPhysicalMaterial
            color="#0a0a14"
            roughness={0.15}
            metalness={0.1}
            transmission={0.6}
            transparent
            opacity={0.85}
            clearcoat={1}
            clearcoatRoughness={0.1}
          />
        </RoundedBox>
        {/* Top accent stripe */}
        <mesh position={[0, size[1] / 2 - 0.08, 0.025]}>
          <planeGeometry args={[size[0] - 0.1, 0.02]} />
          <meshBasicMaterial color={color} transparent opacity={0.55} />
        </mesh>
        {/* Bottom row of "rows" */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.05 - i * 0.12, 0.025]}>
            <planeGeometry args={[size[0] - 0.2 - i * 0.1, 0.04]} />
            <meshBasicMaterial color={color} transparent opacity={0.18} />
          </mesh>
        ))}
        <Text
          position={[-(size[0] / 2) + 0.12, size[1] / 2 - 0.18, 0.03]}
          fontSize={0.08}
          color={color}
          anchorX="left"
          anchorY="middle"
          letterSpacing={0.05}
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
      <Float speed={1.2} floatIntensity={0.2}>
        <group position={[radius, 0.2, 0]}>
          <RoundedBox args={[0.55, 0.32, 0.02]} radius={0.04} smoothness={4}>
            <meshPhysicalMaterial
              color="#0e1424"
              transmission={0.4}
              transparent
              opacity={0.9}
              roughness={0.1}
              metalness={0.2}
            />
          </RoundedBox>
          <mesh position={[0, 0.10, 0.013]}>
            <planeGeometry args={[0.45, 0.02]} />
            <meshBasicMaterial color="#a8c4ff" />
          </mesh>
          <mesh position={[0, 0.04, 0.013]}>
            <planeGeometry args={[0.35, 0.015]} />
            <meshBasicMaterial color="#a8c4ff" transparent opacity={0.45} />
          </mesh>
          <mesh position={[0, -0.02, 0.013]}>
            <planeGeometry args={[0.4, 0.015]} />
            <meshBasicMaterial color="#a8c4ff" transparent opacity={0.35} />
          </mesh>
          <Text
            position={[-0.22, -0.10, 0.013]}
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
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 4, 4]} intensity={1.4} color="#a8c4ff" />
      <pointLight position={[-3, -2, 2]} intensity={0.7} color="#60a5fa" />

      {/* Three glass panels at varying depths */}
      <GlassPanel position={[-1.4, 0.2, 0]}   size={[1.4, 0.95]} label="CHAT"     color="#a8c4ff" rotation={[0, 0.18, 0]} />
      <GlassPanel position={[ 0.0, -0.2, -0.4]} size={[1.5, 1.1]} label="WORKSHOP" color="#60a5fa" />
      <GlassPanel position={[ 1.5, 0.3, -0.1]} size={[1.2, 0.85]} label="FILES"    color="#22d3ee" rotation={[0, -0.25, 0]} />

      {/* Memory cards orbiting */}
      {["mem · plan",  "mem · prefs",  "mem · facts", "mem · notes"].map((m, i) => (
        <MemoryCard
          key={i}
          angle={(i * Math.PI * 2) / 4}
          radius={2.6}
          speed={0.12 + i * 0.02}
          label={m}
        />
      ))}

      <Sparkles count={30} scale={[8, 5, 5]} size={1.2} speed={0.2} opacity={0.35} color="#a8c4ff" />
    </>
  );
}
