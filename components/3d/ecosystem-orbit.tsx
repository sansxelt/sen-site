"use client";

import { useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { StudioRig } from "./studio-rig";
import { CinematicEffects } from "./cinematic-effects";
import { CameraDrift } from "./camera-drift";
import { NebulaBackdrop } from "./nebula-backdrop";

// Cinematic ecosystem orbit. Central memory core (engineered sphere
// in a brushed-metal housing with a glass dome interior); five product
// modules orbit at varying inclinations on visible orbit lines so the
// motion reads as a system, not a particle field.
//
// Restraint pass:
//   - Smaller modules (size 0.16–0.20 instead of 0.20–0.22)
//   - Real orbit ring lines drawn at each radius (faint blue)
//   - Lower emissive on LEDs (0.65 instead of 0.85)
//   - Tighter rotation speeds, less wobble
//   - Depth fog from StudioRig pulls the back orbit into atmosphere

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
  size = 0.18,
  variant = "module",
}: NodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef  = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * speed;
    if (meshRef.current && variant === "module") {
      meshRef.current.rotation.y += delta * 0.32;
    }
  });

  return (
    <group rotation={[inclination, 0, 0]}>
      <group ref={groupRef} rotation={[0, phase, 0]}>
        <group position={[radius, 0, 0]}>
          {variant === "module" ? (
            <>
              {/* Small disc/puck device, brushed metal body */}
              <mesh ref={meshRef}>
                <cylinderGeometry args={[size, size, size * 0.4, 64]} />
                <meshPhysicalMaterial
                  color="#10121a"
                  roughness={0.30}
                  metalness={0.92}
                  clearcoat={0.85}
                  clearcoatRoughness={0.18}
                  reflectivity={0.8}
                />
              </mesh>
              {/* Equator LED ring — restrained */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[size + 0.003, 0.003, 8, 96]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={0.65}
                />
              </mesh>
              {/* Single status dot on the cap */}
              <mesh position={[0, size * 0.21 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.018, 24]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} />
              </mesh>
            </>
          ) : (
            <mesh>
              <boxGeometry args={[size * 1.4, size * 0.9, size * 0.16]} />
              <meshPhysicalMaterial
                color="#0c0c12"
                roughness={0.16}
                metalness={0.5}
                clearcoat={1}
                clearcoatRoughness={0.06}
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
    if (innerRef.current) innerRef.current.rotation.y += delta * 0.15;
    if (ringRef.current)  ringRef.current.rotation.z  += delta * 0.06;
    if (ring2Ref.current) ring2Ref.current.rotation.x += delta * 0.04;
    if (innerRef.current) {
      const m = innerRef.current.material as THREE.MeshPhysicalMaterial;
      m.emissiveIntensity = 0.14 + Math.sin(state.clock.elapsedTime * 0.7) * 0.03;
    }
  });

  return (
    <group>
      {/* Outer brushed metal housing */}
      <mesh>
        <sphereGeometry args={[1.05, 64, 64]} />
        <meshPhysicalMaterial
          color="#0d0e14"
          roughness={0.42}
          metalness={0.95}
          clearcoat={0.55}
          clearcoatRoughness={0.4}
        />
      </mesh>

      {/* Equatorial cut */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.05, 0.018, 16, 192]} />
        <meshStandardMaterial color="#0a0a12" metalness={0.95} roughness={0.45} />
      </mesh>

      {/* Polar cut */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[1.05, 0.014, 12, 192]} />
        <meshStandardMaterial color="#0a0a12" metalness={0.95} roughness={0.5} />
      </mesh>

      {/* Inner glass dome */}
      <Float speed={0.5} rotationIntensity={0.08} floatIntensity={0.06}>
        <mesh ref={innerRef}>
          <sphereGeometry args={[0.78, 64, 64]} />
          <meshPhysicalMaterial
            color="#a8c4ff"
            transmission={0.85}
            thickness={0.6}
            roughness={0.05}
            ior={1.45}
            attenuationColor="#5eaaff"
            attenuationDistance={2}
            transparent
            emissive="#5eaaff"
            emissiveIntensity={0.14}
          />
        </mesh>
      </Float>

      {/* Two precise indicator rings around the housing */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.22, 0.005, 8, 192]} />
        <meshStandardMaterial color="#a8c4ff" emissive="#a8c4ff" emissiveIntensity={0.45} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 3, Math.PI / 4, 0]}>
        <torusGeometry args={[1.42, 0.0035, 8, 192]} />
        <meshStandardMaterial color="#7ab5ff" emissive="#7ab5ff" emissiveIntensity={0.30} />
      </mesh>
    </group>
  );
}

const NODES: NodeProps[] = [
  { radius: 2.5, speed: 0.16, inclination:  0.18, phase: 0.0, color: "#22d3ee", size: 0.18 },
  { radius: 3.1, speed: 0.11, inclination: -0.45, phase: 1.8, color: "#c084fc", size: 0.16 },
  { radius: 2.9, speed: 0.14, inclination:  0.55, phase: 3.4, color: "#60a5fa", size: 0.16 },
  { radius: 3.7, speed: 0.09, inclination: -0.22, phase: 4.7, color: "#dbeafe", size: 0.13, variant: "device" },
  { radius: 4.0, speed: 0.07, inclination:  0.32, phase: 5.5, color: "#caa56a", size: 0.13, variant: "device" },
];

export function EcosystemOrbit({ effects = true }: { effects?: boolean } = {}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y -= delta * 0.028;
  });

  return (
    <>
      <StudioRig
        contactShadowY={-1.6}
        contactShadowOpacity={0.30}
        contactShadowBlur={3.5}
        fogNear={7}
        fogFar={22}
        dust
      />
      <CameraDrift amplitudeX={0.32} amplitudeY={0.18} amplitudeZ={0.22} periodSeconds={14} />

      {/* Atmospheric depth — replaces the schematic orbit ring lines.
          A faint additive sphere reads as deep-space haze; the
          motion of the modules implies the orbit instead of drawing
          it. */}
      <NebulaBackdrop colorA="#1a3870" colorB="#0a0a14" intensity={0.55} />

      <group ref={groupRef}>
        <MemoryCore />
        {NODES.map((n, i) => <OrbitingNode key={i} {...n} />)}
      </group>

      {effects && <CinematicEffects intensity="atmospheric" />}
    </>
  );
}
