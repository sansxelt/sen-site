"use client";

import { useFrame } from "@react-three/fiber";
import { Float, RoundedBox, Text } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";
import { StudioRig } from "./studio-rig";

// Ecosystem connection. Three product nodes (Workshop, Whisper,
// Lens) sit on a CNC-style perforated base plate, each connected
// down to a central memory bus by a thin copper trace. Reads as a
// circuit diagram in 3D, not a magic energy spell.

type NodeDef = { pos: [number, number, number]; color: string; label: string };

const NODES: NodeDef[] = [
  { pos: [-1.7, 0.85, 0],   color: "#22d3ee", label: "WORKSHOP" },
  { pos: [ 0.0, 0.85, -0.2], color: "#60a5fa", label: "WHISPER" },
  { pos: [ 1.7, 0.85, 0],   color: "#c084fc", label: "LENS" },
];

function ProductNode({ node }: { node: NodeDef }) {
  return (
    <Float speed={0.85} floatIntensity={0.10}>
      <group position={node.pos}>
        <RoundedBox args={[0.62, 0.62, 0.18]} radius={0.07} smoothness={5}>
          <meshPhysicalMaterial
            color="#0e0f15"
            roughness={0.32}
            metalness={0.92}
            clearcoat={0.85}
            clearcoatRoughness={0.18}
          />
        </RoundedBox>
        {/* Status LED — single dot, restrained */}
        <mesh position={[0, 0.16, 0.10]}>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={1.5} />
        </mesh>
        <Text
          position={[0, -0.16, 0.10]}
          fontSize={0.064}
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

function Trace({ from, to, color, phase }: { from: [number, number, number]; to: [number, number, number]; color: string; phase: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const dir = useMemo(
    () => new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]),
    [from, to],
  );
  const length = dir.length();
  const mid    = useMemo(
    () => new THREE.Vector3((to[0] + from[0]) / 2, (to[1] + from[1]) / 2, (to[2] + from[2]) / 2),
    [from, to],
  );
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
    const m = ref.current.material as THREE.MeshStandardMaterial;
    m.emissiveIntensity = 0.4 + Math.abs(Math.sin(t * 1.2)) * 0.7;
  });

  return (
    <mesh ref={ref} position={mid.toArray()} quaternion={quat}>
      <cylinderGeometry args={[0.006, 0.006, length, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
    </mesh>
  );
}

function MemoryBus() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const m = ref.current.material as THREE.MeshStandardMaterial;
    m.emissiveIntensity = 0.32 + Math.sin(state.clock.elapsedTime * 0.7) * 0.06;
  });

  return (
    <group position={[0, -1.0, 0]}>
      {/* CNC perforated base plate */}
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial
          color="#0a0d1a"
          emissive="#1a3870"
          emissiveIntensity={0.32}
          transparent
          opacity={0.85}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      {/* Grid lines: subtle PCB trace pattern */}
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={`v${i}`} position={[-2.5 + i * 0.5, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.004, 3]} />
          <meshBasicMaterial color="#a8c4ff" transparent opacity={0.20} />
        </mesh>
      ))}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={`h${i}`} position={[0, 0, -1.4 + i * 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[6, 0.004]} />
          <meshBasicMaterial color="#a8c4ff" transparent opacity={0.20} />
        </mesh>
      ))}

      <Text
        position={[0, 0.005, 1.32]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.10}
        color="#a8c4ff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.22}
      >
        MEMORY  ·  CONTEXT  ·  PROJECTS
      </Text>
    </group>
  );
}

export function EcosystemConnection() {
  return (
    <>
      <StudioRig contactShadowY={-1.05} contactShadowOpacity={0.4} />

      {NODES.map((n) => <ProductNode key={n.label} node={n} />)}

      {NODES.map((n, i) => (
        <Trace key={n.label} from={n.pos} to={[0, -0.95, 0]} color={n.color} phase={i * 1.1} />
      ))}

      <MemoryBus />
    </>
  );
}
