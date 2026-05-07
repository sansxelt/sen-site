"use client";

import { useFrame } from "@react-three/fiber";
import { Float, MeshTransmissionMaterial } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

// Whisper = the voice. A stylized earbud (capsule body + spherical
// driver), with a halo of waveform particles propagating outward,
// and a thin connection beam back toward the Workshop core.

function WaveformRing({ radius, height, segments = 96, color = "#60a5fa", speed = 1, intensity = 0.05 }: {
  radius: number; height: number; segments?: number; color?: string; speed?: number; intensity?: number;
}) {
  const ref = useRef<THREE.LineSegments>(null);
  const positions = useMemo(() => new Float32Array(segments * 6), [segments]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const r = radius + Math.sin(a * 6 + t) * intensity;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = Math.sin(a * 4 + t * 2) * height;
      const next = (i + 1) % segments;
      const an = (next / segments) * Math.PI * 2;
      const rn = radius + Math.sin(an * 6 + t) * intensity;
      positions[i * 6 + 0] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = Math.cos(an) * rn;
      positions[i * 6 + 4] = Math.sin(an * 4 + t * 2) * height;
      positions[i * 6 + 5] = Math.sin(an) * rn;
    }
    const geo = ref.current.geometry as THREE.BufferGeometry;
    const attr = geo.getAttribute("position") as THREE.BufferAttribute;
    attr.array = positions;
    attr.needsUpdate = true;
  });

  return (
    <lineSegments ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={segments * 2}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={0.5} />
    </lineSegments>
  );
}

function Earbud() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.18;
  });

  return (
    <group ref={groupRef}>
      <Float speed={1.2} floatIntensity={0.35} rotationIntensity={0.15}>
        {/* Main body (capsule via stretched sphere) */}
        <mesh position={[0, 0, 0]}>
          <capsuleGeometry args={[0.32, 0.6, 12, 24]} />
          <meshPhysicalMaterial
            color="#0c1224"
            roughness={0.18}
            metalness={0.6}
            clearcoat={1}
            clearcoatRoughness={0.1}
          />
        </mesh>
        {/* Glass driver dome */}
        <mesh position={[0, 0.55, 0]}>
          <sphereGeometry args={[0.36, 32, 32]} />
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.3}
            roughness={0.0}
            ior={1.4}
            chromaticAberration={0.02}
            color="#a8c4ff"
            transparent
          />
        </mesh>
        {/* Speaker mesh ring */}
        <mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18, 0.012, 8, 32]} />
          <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={1.5} />
        </mesh>
        {/* Bottom mic ring */}
        <mesh position={[0, -0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.20, 0.008, 8, 32]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.2} />
        </mesh>
      </Float>
    </group>
  );
}

export function WhisperEarbud() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 3, 4]} intensity={1.3} color="#60a5fa" />
      <pointLight position={[-3, -2, 2]} intensity={0.6} color="#a8c4ff" />
      <pointLight position={[0, 0, 0]}   intensity={0.7} color="#ffffff" distance={3} />

      <Earbud />

      <WaveformRing radius={1.3} height={0.05} color="#60a5fa" speed={1.2} />
      <WaveformRing radius={1.8} height={0.08} color="#a8c4ff" speed={0.8} intensity={0.08} />
      <WaveformRing radius={2.4} height={0.12} color="#7ab5ff" speed={0.6} intensity={0.12} />
    </>
  );
}
