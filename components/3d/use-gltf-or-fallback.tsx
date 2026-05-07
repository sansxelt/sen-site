"use client";

import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useMemo, type ReactNode } from "react";
import * as THREE from "three";

// Load an authored GLB if it exists at /public/models/<name>.glb,
// otherwise render the procedural fallback. Drop a CAD-quality GLB
// into public/models/ and the hero scene upgrades automatically.
//
// Usage:
//   <ModelOrFallback url="/models/lens-v1.glb" fallback={<ProceduralLens/>} />
//
// Notes:
// - useGLTF throws on miss, so we wrap in Suspense + ErrorBoundary.
// - The user has not authored the GLBs yet. This file is the wiring.
// - When a GLB loads we walk the scene and coerce MeshStandardMaterial
//   into MeshPhysicalMaterial (clearcoat, metalness) so a vanilla
//   export from Blender/Fusion still reads as one product family.

type Props = {
  url: string;
  fallback: ReactNode;
  scale?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
};

class GLBBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // Silent. The GLB just isn't there yet.
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function GLBScene({ url, scale, position, rotation }: Omit<Props, "fallback">) {
  const { scene } = useGLTF(url);

  const cloned = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      const mat = obj.material;
      if (Array.isArray(mat)) return;
      if (mat instanceof THREE.MeshStandardMaterial && !(mat instanceof THREE.MeshPhysicalMaterial)) {
        const upgraded = new THREE.MeshPhysicalMaterial({
          color: mat.color,
          map: mat.map,
          normalMap: mat.normalMap,
          roughnessMap: mat.roughnessMap,
          metalnessMap: mat.metalnessMap,
          roughness: mat.roughness,
          metalness: mat.metalness,
          clearcoat: 0.6,
          clearcoatRoughness: 0.18,
        });
        obj.material = upgraded;
      }
    });
    return root;
  }, [scene]);

  return (
    <primitive
      object={cloned}
      scale={scale ?? 1}
      position={position ?? [0, 0, 0]}
      rotation={rotation ?? [0, 0, 0]}
    />
  );
}

export function ModelOrFallback({ url, fallback, scale, position, rotation }: Props) {
  return (
    <GLBBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <GLBScene url={url} scale={scale} position={position} rotation={rotation} />
      </Suspense>
    </GLBBoundary>
  );
}
