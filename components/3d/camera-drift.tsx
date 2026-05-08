"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

// Slow ambient camera drift. Adds the "the cameraman is alive" feel
// to every scene: the camera oscillates ±0.15 units on a multi-second
// sine wave around its initial position. Not a programmatic dolly,
// not motion sickness, just the suggestion that the frame isn't
// locked to a tripod.
//
// Reads the camera's initial position once at mount so the drift is
// always relative to wherever the canvas placed the camera. This
// means it composes cleanly with the scroll-driven scale on the
// CinematicAct wrapper without fighting it.

type Props = {
  amplitudeX?: number;
  amplitudeY?: number;
  amplitudeZ?: number;
  periodSeconds?: number;
  enabled?: boolean;
};

export function CameraDrift({
  amplitudeX = 0.18,
  amplitudeY = 0.10,
  amplitudeZ = 0.12,
  periodSeconds = 8,
  enabled = true,
}: Props) {
  const { camera } = useThree();
  const baseRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const phaseRef = useRef<number>(Math.random() * Math.PI * 2);

  useEffect(() => {
    baseRef.current = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
  }, [camera]);

  useFrame((state) => {
    if (!enabled || !baseRef.current) return;
    const t = state.clock.elapsedTime + phaseRef.current;
    const w = (Math.PI * 2) / periodSeconds;
    camera.position.x = baseRef.current.x + Math.sin(t * w) * amplitudeX;
    camera.position.y = baseRef.current.y + Math.sin(t * w * 0.7 + 1.3) * amplitudeY;
    camera.position.z = baseRef.current.z + Math.sin(t * w * 0.5 + 2.1) * amplitudeZ;
    camera.lookAt(0, 0, 0);
  });

  return null;
}
