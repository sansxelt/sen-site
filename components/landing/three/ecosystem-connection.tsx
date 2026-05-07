"use client";

import { useFrame } from "@react-three/fiber";
import { Float, RoundedBox, Sparkles, Text } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

// Ecosystem connection scene. Three product nodes (Workshop, Whisper,
// Lens) on a plane, connected by traveling-light beams to a central
// memory layer below. Drives home that everything writes to and reads
// from one persistent context.

type NodeDef = { pos: [number, number, number]; color: string; label: string };

const NODES: NodeDef[] = [
  { pos: [-1.7, 0.8, 0],   color: "#22d3ee", label: "WORKSHOP" },
  { pos: [ 0.0, 0.8, -0.2], color: "#60a5fa", label: "WHISPER" },
  { pos: [ 1.7, 0.8, 0],   color: "#c084fc", label: "LENS" },
];

function ProductNode({ node }: { node: NodeDef }) {
  return (
    <Float speed={1} floatIntensity={0.18}>
      <group position={node.pos}>
        <RoundedBox args={[0.6, 0.6, 0.18]} radius={0.08} smoothness={4}>
          <meshPhysicalMaterial
            color="#0a0a14"
            roughness={0.18}
            metalness={0.7}
            clearcoat={1}
            clearcoatRoughness={0.08}
          />
        </RoundedBox>
        {/* Top glowing dot */}
        <mesh position={[0, 0.18, 0.1]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={2} />
        </mesh>
        <Text
          position={[0, -0.18, 0.1]}
          fontSize={0.07}
          color={node.color}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.08}
        >
          {node.label}
        </Text>
      </group>
    </Float>
  );
}

function MemoryLayer() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const m = ref.current.material as THREE.MeshStandardMaterial;
    const t = state.clock.elapsedTime;
    m.emissiveIntensity = 0.3 + Math.sin(t * 0.8) * 0.15;
  });
  return (
    <group position={[0, -1.0, 0]}>
      {/* Base plate */}
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial
          color="#0a0e1f"
          emissive="#5eaaff"
          emissiveIntensity={0.3}
          transparent
          opacity={0.65}
          roughness={0.4}
          metalness={0.5}
        />
      </mesh>
      {/* Grid lines */}
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={`v${i}`} position={[-2.5 + i * 0.5, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.005, 3]} />
          <meshBasicMaterial color="#a8c4ff" transparent opacity={0.18} />
        </mesh>
      ))}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={`h${i}`} position={[0, 0, -1.4 + i * 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[6, 0.005]} />
          <meshBasicMaterial color="#a8c4ff" transparent opacity={0.18} />
        </mesh>
      ))}
      <Text
        position={[0, 0.01, 1.3]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.10}
        color="#a8c4ff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.2}
      >
        MEMORY  ·  CONTEXT  ·  PROJECTS
      </Text>
    </group>
  );
}

function TravelingBeam({ from, to, color, phase }: { from: [number, number, number]; to: [number, number, number]; color: string; phase: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const dir = useMemo(() => new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]), [from, to]);
  const length = dir.length();
  const mid    = useMemo(() => new THREE.Vector3((to[0] + from[0]) / 2, (to[1] + from[1]) / 2, (to[2] + from[2]) / 2), [from, to]);
  const quat   = useMemo(() => {
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const d = dir.clone().normalize();
    q.setFromUnitVectors(up, d);
    return q;
  }, [dir]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime + phase;
    const m = ref.current.material as THREE.MeshBasicMaterial;
    m.opacity = 0.18 + Math.abs(Math.sin(t * 1.6)) * 0.5;
  });

  return (
    <mesh ref={ref} position={mid.toArray()} quaternion={quat}>
      <cylinderGeometry args={[0.005, 0.005, length, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.5} />
    </mesh>
  );
}

export function EcosystemConnection() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[3, 4, 3]} intensity={1.2} color="#a8c4ff" />
      <pointLight position={[-3, 2, 3]} intensity={0.8} color="#60a5fa" />
      <pointLight position={[0, 2, 4]}  intensity={0.6} color="#ffffff" />

      {NODES.map((n) => <ProductNode key={n.label} node={n} />)}

      {NODES.map((n, i) => (
        <TravelingBeam
          key={n.label}
          from={n.pos}
          to={[0, -1, 0]}
          color={n.color}
          phase={i * 1.2}
        />
      ))}

      <MemoryLayer />

      <Sparkles count={35} scale={[6, 4, 4]} size={1.0} speed={0.25} opacity={0.35} color="#a8c4ff" />
    </>
  );
}
