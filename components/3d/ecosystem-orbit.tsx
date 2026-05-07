"use client";

import { useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { StudioRig } from "./studio-rig";

// Cinematic ecosystem orbit. Central memory core (engineered sphere
// with brushed-metal housing + glass dome), with three product
// modules orbiting at different inclinations: Workshop (cyan),
// Lens (violet), Whisper (blue).
//
// All procedural, no GLB. Materials lean on MeshPhysicalMaterial
// with proper roughness/metalness/clearcoat so reflections from
// the studio HDRI read as real surfaces, not stylized concept art.

type NodeProps = {
  radius: number;
  speed: number;
  inclination: number;
  phase: number;
  color: string;
  size?: number;
  variant?: "module" | "device";
};

function OrbitingNode({
  radius,
  speed,
  inclination,
  phase,
  color,
  size = 0.22,
  variant = "module",
}: NodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef  = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * speed;
    if (meshRef.current && variant === "module") {
      meshRef.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <group rotation={[inclination, 0, 0]}>
      <group ref={groupRef} rotation={[0, phase, 0]}>
        <group position={[radius, 0, 0]}>
          {variant === "module" ? (
            // A small disc/puck device, brushed metal body with a
            // single LED ring on the rim (not a glowing sphere)
            <>
              <mesh ref={meshRef}>
                <cylinderGeometry args={[size, size, size * 0.45, 64]} />
                <meshPhysicalMaterial
                  color="#15161c"
                  roughness={0.32}
                  metalness={0.85}
                  clearcoat={0.9}
                  clearcoatRoughness={0.25}
                  reflectivity={0.7}
                />
              </mesh>
              {/* Equator LED ring */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[size + 0.005, 0.005, 8, 96]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={0.85}
                />
              </mesh>
              {/* Single status dot on the cap */}
              <mesh position={[0, size * 0.225 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.025, 24]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} />
              </mesh>
            </>
          ) : (
            // A clean rounded box (phone/desktop class), matte glass
            <mesh>
              <boxGeometry args={[size * 1.4, size * 0.9, size * 0.18]} />
              <meshPhysicalMaterial
                color="#0c0c12"
                roughness={0.18}
                metalness={0.4}
                clearcoat={1}
                clearcoatRoughness={0.08}
              />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}

function MemoryCore() {
  const innerRef = useRef<THREE.Mesh>(null);
  const ringRef  = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (innerRef.current) innerRef.current.rotation.y += delta * 0.18;
    if (ringRef.current)  ringRef.current.rotation.z  += delta * 0.07;
    if (ring2Ref.current) ring2Ref.current.rotation.x += delta * 0.05;
    // Slow breathing on the inner glass dome
    if (innerRef.current) {
      const m = innerRef.current.material as THREE.MeshPhysicalMaterial;
      m.emissiveIntensity = 0.18 + Math.sin(state.clock.elapsedTime * 0.9) * 0.04;
    }
  });

  return (
    <group>
      {/* Outer brushed metal housing — shows the core is "an
          engineered object", not a magic sphere */}
      <mesh>
        <sphereGeometry args={[1.05, 64, 64]} />
        <meshPhysicalMaterial
          color="#0e0f15"
          roughness={0.42}
          metalness={0.92}
          clearcoat={0.6}
          clearcoatRoughness={0.4}
        />
      </mesh>

      {/* Equatorial cut showing inner glass core */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.05, 0.024, 16, 128]} />
        <meshStandardMaterial color="#0a0a12" metalness={0.95} roughness={0.45} />
      </mesh>

      {/* Inner glass dome — frosted with a faint tint */}
      <Float speed={0.6} rotationIntensity={0.1} floatIntensity={0.08}>
        <mesh ref={innerRef}>
          <sphereGeometry args={[0.78, 64, 64]} />
          <meshPhysicalMaterial
            color="#a8c4ff"
            transmission={0.85}
            thickness={0.6}
            roughness={0.06}
            ior={1.45}
            attenuationColor="#5eaaff"
            attenuationDistance={2}
            transparent
            emissive="#5eaaff"
            emissiveIntensity={0.18}
          />
        </mesh>
      </Float>

      {/* Two precise indicator rings around the housing */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.22, 0.006, 8, 128]} />
        <meshStandardMaterial color="#a8c4ff" emissive="#a8c4ff" emissiveIntensity={0.6} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 3, Math.PI / 4, 0]}>
        <torusGeometry args={[1.42, 0.004, 8, 128]} />
        <meshStandardMaterial color="#7ab5ff" emissive="#7ab5ff" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

const NODES: NodeProps[] = [
  { radius: 2.5, speed: 0.18, inclination:  0.18, phase: 0.0, color: "#22d3ee", size: 0.22 },
  { radius: 3.1, speed: 0.13, inclination: -0.45, phase: 1.8, color: "#c084fc", size: 0.20 },
  { radius: 2.9, speed: 0.16, inclination:  0.55, phase: 3.4, color: "#60a5fa", size: 0.20 },
  { radius: 3.7, speed: 0.10, inclination: -0.22, phase: 4.7, color: "#dbeafe", size: 0.16, variant: "device" },
  { radius: 4.0, speed: 0.08, inclination:  0.32, phase: 5.5, color: "#fbbf24", size: 0.16, variant: "device" },
];

export function EcosystemOrbit() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y -= delta * 0.035;
  });

  return (
    <>
      <StudioRig contactShadowY={-1.6} contactShadowOpacity={0.35} />

      <group ref={groupRef}>
        <MemoryCore />
        {NODES.map((n, i) => <OrbitingNode key={i} {...n} />)}
      </group>
    </>
  );
}
