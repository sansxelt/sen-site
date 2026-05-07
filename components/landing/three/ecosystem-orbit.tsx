"use client";

import { useFrame } from "@react-three/fiber";
import { Float, Sparkles, MeshDistortMaterial, Trail } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

// Cinematic ecosystem orbit. Central glowing memory core (the
// "brain"), with the three product modules orbiting at different
// inclinations: Workshop (cyan, primary), Lens (violet), Whisper
// (blue). Plus ambient sparkles for depth.
//
// No GLB assets, everything is procedural geometry + emissive
// materials, so the chunk stays under ~50KB on top of three+drei.

type NodeProps = {
  radius: number;
  speed: number;
  inclination: number;
  phase: number;
  color: string;
  size?: number;
  geometry?: "sphere" | "torus" | "box";
};

function OrbitingNode({
  radius,
  speed,
  inclination,
  phase,
  color,
  size = 0.18,
  geometry = "sphere",
}: NodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef  = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * speed;
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.6;
      meshRef.current.rotation.z += delta * 0.4;
    }
  });

  return (
    <group rotation={[inclination, 0, 0]}>
      <group ref={groupRef} rotation={[0, phase, 0]}>
        <Trail
          width={0.5}
          length={6}
          color={color}
          attenuation={(t) => t * t}
        >
          <mesh ref={meshRef} position={[radius, 0, 0]}>
            {geometry === "sphere" && <sphereGeometry args={[size, 32, 32]} />}
            {geometry === "torus"  && <torusGeometry args={[size, size * 0.35, 16, 48]} />}
            {geometry === "box"    && <boxGeometry args={[size * 1.4, size * 1.4, size * 1.4]} />}
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1.8}
              roughness={0.3}
              metalness={0.6}
            />
          </mesh>
        </Trail>
      </group>
    </group>
  );
}

function MemoryCore() {
  const innerRef = useRef<THREE.Mesh>(null);
  const ringRef  = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (innerRef.current) {
      innerRef.current.rotation.y += delta * 0.18;
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.4) * 0.04;
      innerRef.current.scale.setScalar(pulse);
    }
    if (ringRef.current)  ringRef.current.rotation.z += delta * 0.10;
    if (ring2Ref.current) ring2Ref.current.rotation.x += delta * 0.07;
  });

  return (
    <group>
      {/* Outer halo */}
      <mesh>
        <sphereGeometry args={[1.35, 32, 32]} />
        <meshBasicMaterial color="#5eaaff" transparent opacity={0.04} />
      </mesh>
      {/* Soft glow shell */}
      <mesh>
        <sphereGeometry args={[0.95, 48, 48]} />
        <meshBasicMaterial color="#a8c4ff" transparent opacity={0.10} />
      </mesh>
      {/* Distorted inner core */}
      <Float speed={1.3} rotationIntensity={0.25} floatIntensity={0.4}>
        <mesh ref={innerRef}>
          <icosahedronGeometry args={[0.65, 4]} />
          <MeshDistortMaterial
            color="#a8c4ff"
            emissive="#5eaaff"
            emissiveIntensity={1.2}
            distort={0.32}
            speed={1.6}
            roughness={0.15}
            metalness={0.7}
          />
        </mesh>
      </Float>
      {/* Equatorial rings */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.15, 0.008, 8, 96]} />
        <meshBasicMaterial color="#a8c4ff" transparent opacity={0.4} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 3, Math.PI / 4, 0]}>
        <torusGeometry args={[1.55, 0.005, 8, 96]} />
        <meshBasicMaterial color="#7ab5ff" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

const NODES: NodeProps[] = [
  // Workshop core surrogate, biggest, closest, cyan
  { radius: 2.4, speed: 0.20, inclination:  0.2, phase: 0.0, color: "#22d3ee", size: 0.22 },
  // Lens, violet, slightly inclined
  { radius: 3.1, speed: 0.14, inclination: -0.5, phase: 1.8, color: "#c084fc", size: 0.18 },
  // Whisper, blue, deeper inclination
  { radius: 2.8, speed: 0.17, inclination:  0.6, phase: 3.4, color: "#60a5fa", size: 0.18 },
  // Phone, neutral white-blue
  { radius: 3.6, speed: 0.10, inclination: -0.25, phase: 4.7, color: "#e0e7ff", size: 0.13, geometry: "box" },
  // Desktop, amber accent
  { radius: 4.0, speed: 0.08, inclination:  0.35, phase: 5.5, color: "#fbbf24", size: 0.13, geometry: "box" },
];

export function EcosystemOrbit() {
  // Slow drift on the whole system so it never feels static
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y -= delta * 0.04;
  });

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[5, 5, 5]}  intensity={1.2} color="#a8c4ff" />
      <pointLight position={[-5, -3, 2]} intensity={0.8} color="#7ab5ff" />
      <pointLight position={[0, 0, 0]}   intensity={1.5} color="#ffffff" distance={6} />

      <group ref={groupRef}>
        <MemoryCore />
        {NODES.map((n, i) => <OrbitingNode key={i} {...n} />)}
      </group>

      <Sparkles
        count={50}
        scale={[10, 8, 8]}
        size={1.5}
        speed={0.3}
        opacity={0.4}
        color="#a8c4ff"
      />
    </>
  );
}
