"use client";

import { useFrame } from "@react-three/fiber";
import { Float, MeshTransmissionMaterial } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";
import { StudioRig } from "./studio-rig";
import { ModelOrFallback } from "./use-gltf-or-fallback";
import { BrandMark } from "./brand-mark";
import { LensHudProjection } from "./lens-hud-projection";
import { CinematicEffects } from "./cinematic-effects";
import { CameraDrift } from "./camera-drift";

// Sansxel Lens. Medical-grade transparent contact with embedded
// electronics. Layered procedurally to fake real product realism:
//
//   shell        Lathe-curved acrylic disc (transmission, low rough)
//   AR coating   Faint blue-violet ring catches the rim light
//   rim bevel    Thin torus at the disc edge — implies real thickness
//                via a crisp highlight where glass meets air
//   carrier ring Anodized navy track holding the electronics
//   chip layer   Inner secondary metal ring (PCB mount surface)
//   24 LEDs      Sub-mm spheres, low emissive, mostly off-tinted
//   12 chips     Tiny rectangular ICs scattered around the ring
//   8 capacitors Smaller cylindrical SMD parts
//   6 contacts   Gold pads (charge + data interface)
//   etched mark  Sansxel triangles laser-etched into the carrier ring
//   serial       32 microscopic notches around the outer edge
//   iris reticle Hairline ring over the pupil (no glow centre)
//   traces       Concentric copper-blue lines at low opacity
//   HUD          Faint forward projection — caption + crosshair

function ProceduralLens() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.08;
  });

  // Lathe profile: gentle convex outer, shallow centre.
  const lensProfile = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const r = t * 1.0;
      const y = -Math.pow(r, 2.4) * 0.14;
      pts.push(new THREE.Vector2(r, y));
    }
    return pts;
  }, []);

  return (
    <Float speed={0.55} floatIntensity={0.08} rotationIntensity={0.05}>
      <group ref={groupRef} rotation={[Math.PI * 0.18, 0, 0]}>
        {/* SHELL — medical-grade acrylic */}
        <mesh>
          <latheGeometry args={[lensProfile, 128]} />
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.22}
            roughness={0.015}
            ior={1.46}
            chromaticAberration={0.022}
            color="#e6ecfa"
            transparent
            attenuationColor="#a8c4ff"
            attenuationDistance={4.5}
            anisotropy={0.25}
            distortion={0.08}
            distortionScale={0.4}
            temporalDistortion={0.1}
          />
        </mesh>

        {/* RIM BEVEL — a thin torus right at the disc edge that
            catches a sharp highlight from the rim light. Implies
            the lens has real thickness rather than reading as a
            zero-depth disc. */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.022, 0]}>
          <torusGeometry args={[1.0, 0.018, 24, 256]} />
          <meshPhysicalMaterial
            color="#dde6fa"
            transmission={0.6}
            thickness={0.05}
            roughness={0.05}
            ior={1.45}
            transparent
            metalness={0}
          />
        </mesh>

        {/* AR COATING — faint blue-violet sheen on the outer ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
          <ringGeometry args={[0.94, 1.0, 128]} />
          <meshStandardMaterial
            color="#1d2a44"
            transparent
            opacity={0.22}
            side={THREE.DoubleSide}
            metalness={0.3}
            roughness={0.6}
          />
        </mesh>

        {/* CARRIER RING — anodized navy aluminum */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
          <torusGeometry args={[0.95, 0.011, 24, 256]} />
          <meshPhysicalMaterial
            color="#13151c"
            roughness={0.34}
            metalness={1}
            clearcoat={0.65}
            clearcoatRoughness={0.18}
          />
        </mesh>

        {/* CARRIER OUTER CHAMFER — a marginally larger ring, slightly
            brighter, gives the carrier a CNC bevel illusion */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.0035, 0]}>
          <torusGeometry args={[0.962, 0.004, 12, 192]} />
          <meshStandardMaterial color="#2c303a" metalness={1} roughness={0.45} />
        </mesh>

        {/* CHIP LAYER — inner secondary ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.0035, 0]}>
          <torusGeometry args={[0.92, 0.005, 12, 192]} />
          <meshStandardMaterial color="#22242c" metalness={1} roughness={0.45} />
        </mesh>

        {/* 24 SUB-MM LEDs */}
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          const isPrimary = i % 8 === 0;
          const isSecondary = i % 4 === 0 && !isPrimary;
          return (
            <mesh
              key={`led-${i}`}
              position={[Math.cos(a) * 0.95, -0.005, Math.sin(a) * 0.95]}
            >
              <sphereGeometry args={[0.0085, 12, 12]} />
              <meshStandardMaterial
                color={isPrimary ? "#a8c4ff" : isSecondary ? "#7ab5ff" : "#202836"}
                emissive={isPrimary ? "#a8c4ff" : isSecondary ? "#7ab5ff" : "#000000"}
                emissiveIntensity={isPrimary ? 0.95 : isSecondary ? 0.45 : 0}
              />
            </mesh>
          );
        })}

        {/* 12 IC CHIPS — tiny black rectangles around the ring with
            faint silver pin marks (offset between LED positions) */}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2 + Math.PI / 24;
          return (
            <group
              key={`chip-${i}`}
              position={[Math.cos(a) * 0.92, -0.001, Math.sin(a) * 0.92]}
              rotation={[-Math.PI / 2, 0, -a]}
            >
              <mesh>
                <planeGeometry args={[0.018, 0.012]} />
                <meshPhysicalMaterial
                  color="#080a10"
                  metalness={0.4}
                  roughness={0.55}
                  clearcoat={0.6}
                  clearcoatRoughness={0.3}
                />
              </mesh>
              {/* Pin marks: 2 thin silver bands on the chip ends */}
              <mesh position={[-0.007, 0, 0.0001]}>
                <planeGeometry args={[0.002, 0.012]} />
                <meshStandardMaterial color="#5a6378" metalness={1} roughness={0.4} />
              </mesh>
              <mesh position={[0.007, 0, 0.0001]}>
                <planeGeometry args={[0.002, 0.012]} />
                <meshStandardMaterial color="#5a6378" metalness={1} roughness={0.4} />
              </mesh>
            </group>
          );
        })}

        {/* 8 SMD CAPACITORS — tiny cylinders between the chips */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2 + Math.PI / 16;
          return (
            <mesh
              key={`cap-${i}`}
              position={[Math.cos(a) * 0.905, -0.001, Math.sin(a) * 0.905]}
              rotation={[Math.PI / 2, 0, -a]}
            >
              <cylinderGeometry args={[0.0045, 0.0045, 0.005, 12]} />
              <meshStandardMaterial color="#ddd2a3" metalness={0.95} roughness={0.4} />
            </mesh>
          );
        })}

        {/* 6 GOLD CONTACT PADS */}
        {Array.from({ length: 6 }).map((_, i) => {
          const a = (i / 6) * Math.PI * 2 + Math.PI / 12;
          return (
            <mesh
              key={`pad-${i}`}
              position={[Math.cos(a) * 0.965, 0.001, Math.sin(a) * 0.965]}
              rotation={[-Math.PI / 2, 0, -a]}
            >
              <planeGeometry args={[0.018, 0.034]} />
              <meshPhysicalMaterial
                color="#caa56a"
                metalness={1}
                roughness={0.28}
                clearcoat={0.4}
                clearcoatRoughness={0.3}
              />
            </mesh>
          );
        })}

        {/* ETCHED SANSXEL MARK — laser etched on the carrier ring
            inner face, visible only when light grazes it */}
        <BrandMark
          size={0.05}
          position={[0, 0.001, 0.84]}
          rotation={[-Math.PI / 2, 0, 0]}
          color="#1a2030"
          opacity={0.85}
        />

        {/* IRIS RETICLE — hairline ring */}
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.18, 0.184, 128]} />
          <meshStandardMaterial color="#a8c4ff" emissive="#a8c4ff" emissiveIntensity={0.3} side={THREE.DoubleSide} />
        </mesh>

        {/* CONCENTRIC TRACES — barely-visible display routing under
            the acrylic. Halved opacity from the previous pass so they
            stop dominating as line-art. */}
        <mesh position={[0, 0.0011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.553, 128]} />
          <meshBasicMaterial color="#7ab5ff" transparent opacity={0.06} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.0012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.72, 0.722, 128]} />
          <meshBasicMaterial color="#7ab5ff" transparent opacity={0.04} side={THREE.DoubleSide} />
        </mesh>

        {/* Radial trace stubs and outer trace ring removed — they
            read as a wiring diagram, not as embedded electronics
            seen through medical-grade acrylic. */}

        {/* LASER-ETCHED LOT NUMBER — 32 microscopic notches */}
        {Array.from({ length: 32 }).map((_, i) => {
          const a = (i / 32) * Math.PI * 2;
          return (
            <mesh
              key={`etch-${i}`}
              position={[Math.cos(a) * 0.985, -0.005, Math.sin(a) * 0.985]}
            >
              <boxGeometry args={[0.004, 0.001, 0.002]} />
              <meshBasicMaterial color="#3b4358" />
            </mesh>
          );
        })}

        {/* HUD PROJECTION — faint forward-facing UI */}
        <LensHudProjection accent="#a8c4ff" />
      </group>
    </Float>
  );
}

export function LensObject({ effects = true }: { effects?: boolean } = {}) {
  return (
    <>
      <StudioRig
        contactShadowY={-0.6}
        contactShadowOpacity={0.5}
        contactShadowBlur={3}
        fogNear={4}
        fogFar={10}
        reflectiveFloor
      />
      <CameraDrift amplitudeX={0.15} amplitudeY={0.08} amplitudeZ={0.10} periodSeconds={9} />
      <ModelOrFallback url="/models/lens-v1.glb" fallback={<ProceduralLens />} />
      {effects && <CinematicEffects intensity="product" />}
    </>
  );
}
