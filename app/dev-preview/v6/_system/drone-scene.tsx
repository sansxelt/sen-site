"use client";

/* THE HOMEPAGE DRONE, LIVE (founder, 2026-10-01: "what I was imagining was a drone thing").

   The interactive version of the drone (_system/drone-model.tsx) in a light studio: real reflections from
   light panels, a soft contact shadow on a low round pad, and a camera and yaw that follow the pointer a
   little. Where the hero shows the film (public/home/film.mp4) this is not mounted; it stays for the
   places the page wants the drone live.

   THE MOTION IS THE PRODUCT'S DEVICE STORY, NOT A RESULT. It hovers, comes home to its pad, lands, lets the
   rotors spin down, then lifts off again. Nothing on screen claims a run happened.

   No model or HDR file is fetched. Reduced motion renders one still frame, and nothing renders off screen. */
import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { DroneModel, Pad, PAD_TOP, newDrive, type Drive } from "./drone-model";

const HOVER_Y = 0.85;
const LOOP = 15;
const DESCEND: [number, number] = [5.5, 8.6];
const LANDED: [number, number] = [8.6, 11.4];
const LIFT: [number, number] = [11.4, 14.2];

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Where the drone is in its loop: height above the pad and how fast the rotors turn (0..1). */
function phase(time: number) {
  const t = time % LOOP;
  if (t < DESCEND[0]) return { y: HOVER_Y, spin: 1 };
  if (t < DESCEND[1]) return { y: HOVER_Y * (1 - ease(clamp01((t - DESCEND[0]) / (DESCEND[1] - DESCEND[0])))), spin: 1 };
  if (t < LANDED[1]) return { y: 0, spin: 1 - ease(clamp01((t - LANDED[0]) / 1.6)) * 0.97 };
  if (t < LIFT[1]) {
    const u = clamp01((t - LIFT[0]) / (LIFT[1] - LIFT[0]));
    return { y: HOVER_Y * ease(clamp01((u - 0.3) / 0.7)), spin: 0.03 + 0.97 * ease(clamp01(u / 0.35)) };
  }
  return { y: HOVER_Y, spin: 1 };
}

/** Writes the drone's Drive each frame from the loop and the pointer, with a little damping. */
function Pilot({ drive, still }: { drive: React.MutableRefObject<Drive>; still: boolean }) {
  const { pointer, camera } = useThree();
  useFrame((state) => {
    const t = still ? 3 : state.clock.elapsedTime;
    const p = phase(t);
    const d = drive.current;
    const k = 1 / 60;
    const air = p.y > 0.04 ? 1 : 0.1;
    d.spin = still ? 0.7 : p.spin;
    d.y = p.y + (p.y > 0.04 ? Math.sin(t * 1.6) * 0.04 : 0);
    d.yaw = THREE.MathUtils.damp(d.yaw, -0.62 + Math.sin(t * 0.16) * 0.32 + pointer.x * 0.3, 2, k);
    d.pitch = THREE.MathUtils.damp(d.pitch, (Math.sin(t * 0.9) * 0.04 - pointer.y * 0.05) * air, 3, k);
    d.roll = THREE.MathUtils.damp(d.roll, Math.cos(t * 0.7) * 0.035 * air, 3, k);
    if (!still) {
      camera.position.x = THREE.MathUtils.damp(camera.position.x, 4.8 + pointer.x * 0.35, 1.4, k);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, 2.2 + pointer.y * 0.22, 1.4, k);
      camera.lookAt(0, 0.12, 0);
    }
  });
  return null;
}

export default function DroneScene() {
  const host = useRef<HTMLDivElement>(null);
  const drive = useRef<Drive>(newDrive());
  const [still] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = host.current;
    if (!el || still) return;
    const io = new IntersectionObserver((es) => setOnScreen(es.some((e) => e.isIntersecting)), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, [still]);
  const frameloop = still ? "demand" : onScreen ? "always" : "never";
  return (
    <div ref={host} className="dr-host" aria-hidden>
      <Canvas
        frameloop={frameloop}
        dpr={[1, 2]}
        shadows
        camera={{ position: [4.8, 2.2, 6.2], fov: 30, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ camera }) => camera.lookAt(0, 0.12, 0)}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 7, 4]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-5, 2.5, -3]} intensity={0.7} />
        <directionalLight position={[-1.5, 3, -6]} intensity={1.4} />
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={3.2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
          <Lightformer form="rect" intensity={2} position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
          <Lightformer form="rect" intensity={2} position={[6, 2, -2]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} />
          <Lightformer form="rect" intensity={1} position={[0, 1.5, 7]} scale={[7, 1.5, 1]} />
          <Lightformer form="rect" intensity={2.4} position={[0, 2.5, -7]} rotation-y={Math.PI} scale={[9, 1.2, 1]} />
        </Environment>
        <Pilot drive={drive} still={still} />
        <DroneModel drive={drive} />
        <Pad />
        <ContactShadows position={[0, PAD_TOP + 0.005, 0]} scale={6} blur={2.2} opacity={0.4} far={2.5} resolution={512} color="#0A0A0B" frames={still ? 1 : Infinity} />
      </Canvas>
    </div>
  );
}
