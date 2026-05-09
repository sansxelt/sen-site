"use client";

import { useFrame } from "@react-three/fiber";
import { Float, RoundedBox, Text } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { StudioRig } from "./studio-rig";
import { ModelOrFallback } from "./use-gltf-or-fallback";
import { CinematicEffects } from "./cinematic-effects";
import { CameraDrift } from "./camera-drift";

// Workshop. Redesigned around an anchored hardware silhouette: one
// premium tablet device on a CNC stand at centre, two thin satellite
// tiles flanking it. Reads as workspace hardware on a desk, not as
// floating sci-fi panels.
//
// Composition:
//   base:        perforated CNC plate (echoes the ecosystem-connection
//                base, ties Workshop to the rest of the family)
//   tablet:      single rounded-bezel device, 16:10 screen, anodized
//                aluminum frame, glass front, integrated stand
//   screen UI:   chat-style row layout (bezel-respecting), one accent
//                stripe for the active app, three suggestion rows,
//                "WORKSHOP · CONTEXT" header
//   satellites:  two thinner side tiles (chat history, projects)
//                anchored to the same base, slightly offset for depth
//   memory bus:  4 small drives sliding underneath (slow loop) — the
//                detail that says "this is a real machine"
//
// Drop /models/workshop-tablet-v1.glb to override the central device.

function CncBase() {
  return (
    <group position={[0, -1.0, 0]}>
      {/* Perforated plate */}
      <RoundedBox args={[5.4, 0.06, 2.4]} radius={0.04} smoothness={4} position={[0, 0, 0]}>
        <meshPhysicalMaterial
          color="#0c0d12"
          metalness={0.95}
          roughness={0.42}
          clearcoat={0.4}
          clearcoatRoughness={0.4}
        />
      </RoundedBox>
      {/* Top edge chamfer */}
      <mesh position={[0, 0.031, 0]}>
        <ringGeometry args={[1.3, 1.32, 4, 1, 0, Math.PI * 2]} />
        <meshStandardMaterial color="#2c303a" metalness={1} roughness={0.45} />
      </mesh>
      {/* Perforation grid — restrained, only on the upper face */}
      {Array.from({ length: 9 }).map((_, i) =>
        Array.from({ length: 4 }).map((__, j) => (
          <mesh
            key={`perf-${i}-${j}`}
            position={[-2.4 + i * 0.6, 0.032, -0.9 + j * 0.6]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[0.022, 16]} />
            <meshStandardMaterial color="#040508" />
          </mesh>
        ))
      )}
    </group>
  );
}

type ScreenProps = {
  position: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number];
  label: string;
  accent: string;
  rows?: number;
  scale?: number;
};

function ScreenDevice({ position, rotation = [0, 0, 0], size, label, accent, rows = 4, scale = 1 }: ScreenProps) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    // Very subtle breathing, not the previous big float
    const t = state.clock.elapsedTime;
    groupRef.current.position.y = position[1] + Math.sin(t * 0.4 + position[0]) * 0.01;
  });

  const w = size[0], h = size[1];

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* Bezel frame — anodized aluminum */}
      <RoundedBox args={[w + 0.08, h + 0.08, 0.04]} radius={0.04} smoothness={5}>
        <meshPhysicalMaterial
          color="#15171f"
          roughness={0.32}
          metalness={0.95}
          clearcoat={0.85}
          clearcoatRoughness={0.18}
        />
      </RoundedBox>

      {/* Inner bezel highlight — chamfer ring */}
      <mesh position={[0, 0, 0.022]}>
        <ringGeometry args={[Math.min(w, h) * 0.32, Math.min(w, h) * 0.34, 4, 1, 0, Math.PI * 2]} />
        <meshStandardMaterial color="#2c303a" metalness={1} roughness={0.5} />
      </mesh>

      {/* Display surface — dark glass with subtle blue tint */}
      <mesh position={[0, 0, 0.024]}>
        <planeGeometry args={[w, h]} />
        <meshPhysicalMaterial
          color="#03050a"
          roughness={0.14}
          metalness={0.05}
          clearcoat={1}
          clearcoatRoughness={0.04}
          emissive="#101a30"
          emissiveIntensity={0.42}
        />
      </mesh>

      {/* Header bar — accent stripe */}
      <mesh position={[-(w / 2) + 0.08, h / 2 - 0.07, 0.026]}>
        <planeGeometry args={[0.10, 0.008]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} />
      </mesh>

      <Text
        position={[-(w / 2) + 0.20, h / 2 - 0.07, 0.026]}
        fontSize={0.055}
        color={accent}
        anchorX="left"
        anchorY="middle"
        letterSpacing={0.06}
      >
        {label}
      </Text>

      {/* Header divider */}
      <mesh position={[0, h / 2 - 0.13, 0.026]}>
        <planeGeometry args={[w - 0.12, 0.0015]} />
        <meshBasicMaterial color={accent} transparent opacity={0.25} />
      </mesh>

      {/* Content rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <group key={i} position={[0, h / 2 - 0.20 - i * 0.10, 0.026]}>
          <mesh position={[-(w / 2) + 0.13, 0, 0]}>
            <circleGeometry args={[0.012, 16]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} />
          </mesh>
          <mesh position={[0.04, 0, 0]}>
            <planeGeometry args={[w - 0.30 - i * 0.08, 0.014]} />
            <meshStandardMaterial color={accent} transparent opacity={0.18 - i * 0.025} />
          </mesh>
        </group>
      ))}

      {/* Bottom status bar */}
      <mesh position={[(w / 2) - 0.10, -h / 2 + 0.06, 0.026]}>
        <planeGeometry args={[0.06, 0.008]} />
        <meshStandardMaterial color={accent} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

function CentralTablet() {
  return (
    <group position={[0, 0.05, 0]}>
      {/* Stand — thin metal arm anchoring the tablet to the base */}
      <mesh position={[0, -0.55, -0.18]}>
        <boxGeometry args={[0.28, 0.06, 0.02]} />
        <meshStandardMaterial color="#1a1c24" metalness={1} roughness={0.45} />
      </mesh>
      <mesh position={[0, -0.30, -0.10]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.04, 0.55, 0.02]} />
        <meshStandardMaterial color="#1a1c24" metalness={1} roughness={0.4} />
      </mesh>

      {/* The tablet itself */}
      <ScreenDevice
        position={[0, 0.1, 0]}
        rotation={[-0.06, 0, 0]}
        size={[1.7, 1.1]}
        label="WORKSHOP"
        accent="#a8c4ff"
        rows={5}
      />
    </group>
  );
}

function MemoryDrive({ x, phase, color }: { x: number; phase: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.x = x + Math.sin(t * 0.4 + phase) * 0.18;
  });
  return (
    <group position={[0, -0.92, 0]}>
      <mesh ref={ref} position={[x, 0, 0]}>
        <boxGeometry args={[0.32, 0.05, 0.18]} />
        <meshPhysicalMaterial
          color="#0c0d12"
          metalness={0.95}
          roughness={0.4}
          clearcoat={0.7}
        />
      </mesh>
      <mesh position={[x, 0.026, 0.07]}>
        <planeGeometry args={[0.12, 0.004]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}

function ProceduralWorkshop() {
  return (
    <>
      <CncBase />
      <CentralTablet />

      {/* Two satellite tiles — chat history (left), projects (right) */}
      <ScreenDevice
        position={[-1.85, 0.05, 0.05]}
        rotation={[-0.06, 0.32, 0]}
        size={[0.95, 0.78]}
        label="CHAT"
        accent="#7ab5ff"
        rows={4}
        scale={0.95}
      />
      <ScreenDevice
        position={[1.85, 0.05, 0.05]}
        rotation={[-0.06, -0.32, 0]}
        size={[0.95, 0.78]}
        label="FILES"
        accent="#22d3ee"
        rows={4}
        scale={0.95}
      />

      {/* Memory drives sliding underneath the tablet */}
      <MemoryDrive x={-0.6} phase={0.0} color="#a8c4ff" />
      <MemoryDrive x={ 0.0} phase={1.4} color="#7ab5ff" />
      <MemoryDrive x={ 0.6} phase={2.8} color="#22d3ee" />
    </>
  );
}

export function WorkshopBrain({ effects = true }: { effects?: boolean } = {}) {
  return (
    <>
      <StudioRig
        contactShadowY={-1.0}
        contactShadowOpacity={0.55}
        contactShadowBlur={3.4}
        fogNear={6}
        fogFar={14}
        dust
        reflectiveFloor
      />
      <CameraDrift amplitudeX={0.22} amplitudeY={0.10} amplitudeZ={0.14} periodSeconds={11} />
      <ModelOrFallback
        url="/models/workshop-tablet-v1.glb"
        fallback={<ProceduralWorkshop />}
      />
      {effects && <CinematicEffects intensity="atmospheric" />}
    </>
  );
}
