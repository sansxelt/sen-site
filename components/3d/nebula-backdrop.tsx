"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Nebula backdrop. A very large faint additive sphere placed far
// behind the subject. Inside it sits a soft volumetric gradient that
// reads as deep-space atmosphere, replacing the schematic ring lines
// that used to draw orbits explicitly. Slowly rotates so it feels
// alive but never pulls the eye.
//
// The gradient is procedural via a ShaderMaterial — radial soft glow
// that fades to transparent at the equator so the subject reads in
// front of "depth" instead of a flat backdrop.

const VERT = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vView = normalize(cameraPosition - worldPos.xyz);
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */`
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uIntensity;
  varying vec3  vNormal;
  varying vec3  vView;

  void main() {
    // Concentric soft bands that fade out at the silhouette
    float band = smoothstep(-0.6, 0.6, vNormal.y);
    vec3  col  = mix(uColorB, uColorA, band);

    // Fresnel-style edge fade so the backdrop dissolves at glancing
    // angles (avoids visible sphere geometry)
    float edge = pow(abs(dot(vNormal, vView)), 1.4);
    float a    = (1.0 - edge) * uIntensity;

    gl_FragColor = vec4(col * a, a);
  }
`;

type Props = {
  colorA?: string;
  colorB?: string;
  intensity?: number;
  radius?: number;
  rotateSpeed?: number;
};

export function NebulaBackdrop({
  colorA = "#1a3870",
  colorB = "#0a0a14",
  intensity = 0.55,
  radius = 18,
  rotateSpeed = 0.012,
}: Props) {
  const ref = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uIntensity: { value: intensity },
    }),
    [colorA, colorB, intensity],
  );

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * rotateSpeed;
  });

  return (
    <mesh ref={ref} renderOrder={-1}>
      <sphereGeometry args={[radius, 48, 48]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
