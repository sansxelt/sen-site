"use client";

import { useFrame } from "@react-three/fiber";
import { Float, MeshTransmissionMaterial, Sparkles } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

// Lens = the eye. A transparent contact lens (lathe-curved disc),
// inner electronics ring with tiny LEDs, and a faint HUD projection
// floating in front. R&D-feeling, scientific.

function ContactLens() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.12;
  });

  const lensProfile = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const r = t * 1.0;
      const y = -Math.pow(r, 2) * 0.18;
      pts.push(new THREE.Vector2(r, y));
    }
    return pts;
  }, []);

  return (
    <Float speed={0.8} floatIntensity={0.2} rotationIntensity={0.1}>
      <group ref={groupRef} rotation={[Math.PI * 0.18, 0, 0]}>
        {/* The lens itself: revolved profile */}
        <mesh>
          <latheGeometry args={[lensProfile, 64]} />
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.2}
            roughness={0.0}
            ior={1.45}
            chromaticAberration={0.03}
            color="#cdd6f4"
            transparent
          />
        </mesh>
        {/* Outer electronics ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <torusGeometry args={[0.95, 0.012, 12, 96]} />
          <meshStandardMaterial color="#c084fc" emissive="#c084fc" emissiveIntensity={1.4} />
        </mesh>
        {/* Tiny LEDs around the ring */}
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95]}
            >
              <sphereGeometry args={[0.018, 12, 12]} />
              <meshStandardMaterial
                color={i % 4 === 0 ? "#a8c4ff" : "#c084fc"}
                emissive={i % 4 === 0 ? "#a8c4ff" : "#c084fc"}
                emissiveIntensity={2}
              />
            </mesh>
          );
        })}
        {/* Pupil/center marker */}
        <mesh position={[0, 0.02, 0]}>
          <ringGeometry args={[0.18, 0.22, 64]} />
          <meshBasicMaterial color="#a8c4ff" transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.025, 0]}>
          <circleGeometry args={[0.12, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.18} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </Float>
  );
}

function HUDStrip({ y, opacity, width = 1.4 }: { y: number; opacity: number; width?: number }) {
  return (
    <mesh position={[0, y, 1.2]}>
      <planeGeometry args={[width, 0.025]} />
      <meshBasicMaterial color="#a8c4ff" transparent opacity={opacity} />
    </mesh>
  );
}

function HUD() {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.x = Math.sin(t * 0.4) * 0.05;
  });
  return (
    <group ref={ref}>
      <HUDStrip y={0.6}  opacity={0.55} width={1.6} />
      <HUDStrip y={0.5}  opacity={0.30} width={1.2} />
      <HUDStrip y={-0.6} opacity={0.40} width={1.4} />
      <HUDStrip y={-0.7} opacity={0.20} width={0.9} />
      {/* Tiny corner brackets */}
      {[
        [-0.85,  0.78],
        [ 0.85,  0.78],
        [-0.85, -0.78],
        [ 0.85, -0.78],
      ].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 1.2]}>
          <ringGeometry args={[0.04, 0.05, 16]} />
          <meshBasicMaterial color="#a8c4ff" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

export function LensObject({ withHud = true }: { withHud?: boolean }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[3, 4, 3]}  intensity={1.6} color="#c084fc" />
      <pointLight position={[-3, -2, 3]} intensity={0.8} color="#a8c4ff" />
      <pointLight position={[0, 0, 4]}   intensity={1.0} color="#ffffff" />

      <ContactLens />
      {withHud && <HUD />}
      <Sparkles count={25} scale={[5, 4, 2]} size={1.0} speed={0.3} opacity={0.4} color="#c084fc" />
    </>
  );
}
