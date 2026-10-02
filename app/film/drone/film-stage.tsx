"use client";

/* THE DRONE FILM, RENDERED FRAME BY FRAME (founder, 2026-10-01: a video opening, like Anduril, Palantir and
   axiom).

   The same drone as the homepage (app/dev-preview/v6/_system/drone-model.tsx) in a dark studio: a glossy
   floor that reflects it, a pool of light on the pad, rim light from behind, fog into black, and a vignette. Four shots over one 16 second loop:

     0.0  to  4.5   close on a front rotor while the motors spin up on the pad
     4.5  to  8.0   low and wide as it lifts off
     8.0  to 12.0   a slow orbit while it hovers
    12.0  to 16.0   high and wide as it comes home and lands; the rotors spin down, and the loop closes on
                    the same landed frame it opens on

   Nothing renders on its own (frameloop "never"). window.__film.record() steps the clock one frame at a
   time, encodes each frame to H.264 with WebCodecs, and packs the result as MP4 (../mp4.ts). The renderer
   is a development tool: page.tsx refuses to render it in production. */
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, MeshReflectorMaterial } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { DroneModel, Pad, PAD_TOP, SCALE, newDrive, type Drive } from "@/app/dev-preview/v6/_system/drone-model";
import { muxMp4, type Sample } from "../mp4";

// ?portrait renders the phone cut (1080x1920), as app/film/orbit does.
const PORTRAIT = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("portrait");
const W = PORTRAIT ? 1080 : 1920, H = PORTRAIT ? 1920 : 1080, FPS = 30, LENGTH = 16;
const FOV = PORTRAIT ? 52 : 32;
const BG = "#08090B";
const HOVER = 1.15;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const k01 = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const lerp = THREE.MathUtils.lerp;

/** The drone's state at time t: lands where it starts, so the loop is seamless. */
function droneAt(t: number) {
  const yaw0 = -0.5;
  if (t < 4.5) return { y: 0, spin: ease(k01(t, 0.6, 4.2)), yaw: yaw0, pitch: 0, roll: 0 };
  if (t < 8) {
    const u = ease(k01(t, 4.5, 7.8));
    return { y: HOVER * u, spin: 1, yaw: yaw0 + 0.05 * u, pitch: -0.03 * Math.sin(u * Math.PI), roll: 0.015 * Math.sin(t * 2) };
  }
  if (t < 12) {
    const u = k01(t, 8, 12);
    return { y: HOVER + Math.sin((t - 8) * 1.6) * 0.035, spin: 1, yaw: yaw0 + 0.05 + 0.35 * ease(u), pitch: Math.sin(t * 0.9) * 0.03, roll: Math.cos(t * 0.7) * 0.03 };
  }
  const u = ease(k01(t, 12, 15));
  return { y: HOVER * (1 - u), spin: 1 - ease(k01(t, 15, 16)), yaw: lerp(yaw0 + 0.4, yaw0, ease(k01(t, 12, 15.5))), pitch: 0.025 * Math.sin(u * Math.PI), roll: 0 };
}

/** The world position of the front right rotor hub, for the close-up. */
function rotorWorld(d: { y: number; yaw: number }) {
  const local = new THREE.Vector3(1.12, 0.1 + 0.125, 0.92).multiplyScalar(SCALE);
  local.applyAxisAngle(new THREE.Vector3(0, 1, 0), d.yaw);
  return local.add(new THREE.Vector3(0, d.y, 0));
}

/** Aim so the subject sits centred and low, a quarter of the frame below its middle: the homepage centres
 *  its headline on the film (since 2026-10-01), so the drone belongs under it, never behind it. */
const HALF_FOV = THREE.MathUtils.degToRad(FOV / 2);
// On a phone the headline sits near the top of its frame, so the drone goes a little lower than on a desktop.
const LOW = PORTRAIT ? 0.42 : 0.5;
function aimBelowHeadline(camera: THREE.Camera, subject: THREE.Vector3) {
  const lift = camera.position.distanceTo(subject) * Math.tan(HALF_FOV) * LOW;
  camera.lookAt(subject.clone().add(new THREE.Vector3(0, lift, 0)));
}

type FilmState = { t: number };

function Director({ drive, film }: { drive: React.MutableRefObject<Drive>; film: React.MutableRefObject<FilmState> }) {
  const { camera } = useThree();
  useFrame(() => {
    const t = film.current.t;
    const d = droneAt(t);
    Object.assign(drive.current, d, { dt: 1 / FPS });
    const body = new THREE.Vector3(0, d.y, 0);
    if (t < 4.5) {
      // 1. close on a front rotor, pushing in slowly as it spins up
      const hub = rotorWorld(d);
      const u = k01(t, 0, 4.5);
      const dir = new THREE.Vector3(0.55, 0.12, 1).normalize();
      camera.position.copy(hub).addScaledVector(dir, lerp(1.9, 1.35, u)).add(new THREE.Vector3(0, -0.05, 0));
      aimBelowHeadline(camera, hub);
    } else if (t < 8) {
      // 2. low and wide as it lifts off
      const u = ease(k01(t, 4.5, 8));
      camera.position.set(lerp(-3.4, -2.9, u), lerp(0.05, 0.55, u), lerp(5.2, 4.6, u));
      aimBelowHeadline(camera, body.clone().add(new THREE.Vector3(0, 0.25, 0)));
    } else if (t < 12) {
      // 3. a slow orbit while it hovers
      const u = k01(t, 8, 12);
      const a = lerp(0.55, 1.05, u), r = 5.6;
      camera.position.set(Math.sin(a) * r, lerp(1.7, 2.0, u), Math.cos(a) * r);
      aimBelowHeadline(camera, body);
    } else {
      // 4. high and wide as it comes home and lands
      const u = k01(t, 12, 16);
      camera.position.set(lerp(3.6, 4.0, u), lerp(4.4, 4.8, u), lerp(4.9, 5.5, u));
      aimBelowHeadline(camera, new THREE.Vector3(0, d.y * 0.6, 0));
    }
  });
  return null;
}

/** The finish: a little bloom on the brightest highlights and a vignette. No grain (it lifted the blacks and
 *  costs bitrate) and no depth of field (the product reads best crisp). */
function Finish() {
  return (
    <EffectComposer multisampling={8}>
      <Bloom intensity={0.22} luminanceThreshold={0.88} luminanceSmoothing={0.2} mipmapBlur />
      <Vignette offset={0.3} darkness={0.62} />
    </EffectComposer>
  );
}

/** Exposes the clock and the recorder to the page. */
function Recorder({ film }: { film: React.MutableRefObject<FilmState> }) {
  const { gl, advance } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const renderAt = (t: number) => { film.current.t = t; advance(t * 1000, true); };
    let out: Uint8Array | null = null;
    const api = {
      length: LENGTH, fps: FPS,
      renderAt: (t: number) => { renderAt(t); return true; },
      /** A still for the video poster, as a JPEG data URL straight from the canvas (no page overlays). */
      poster(t: number, quality = 0.9) { renderAt(t); return canvas.toDataURL("image/jpeg", quality); },
      async record(bitrate = 9_000_000, width = W, height = H) {
        // A smaller file (the phone cut) is drawn down from the full frame before encoding.
        const scaled = width !== W ? new OffscreenCanvas(width, height) : null;
        const ctx = scaled?.getContext("2d") ?? null;
        if (ctx) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; }
        const samples: Sample[] = [];
        let avcC: Uint8Array | null = null;
        const encoder = new VideoEncoder({
          output: (chunk, meta) => {
            const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
            samples.push({ data, pts: chunk.timestamp, key: chunk.type === "key" });
            const desc = meta?.decoderConfig?.description;
            if (desc && !avcC) avcC = new Uint8Array(desc instanceof ArrayBuffer ? desc : (desc as ArrayBufferView).buffer.slice(0));
          },
          error: (e) => { throw e; },
        });
        encoder.configure({ codec: width * height > 1280 * 720 ? "avc1.640033" : "avc1.64001f", width, height, bitrate, framerate: FPS, latencyMode: "quality", avc: { format: "avc" } });
        const frames = LENGTH * FPS;
        for (let i = 0; i < frames; i++) {
          const t = i / FPS;
          renderAt(t);
          if (ctx && scaled) ctx.drawImage(canvas, 0, 0, width, height);
          const vf = new VideoFrame(scaled ?? canvas, { timestamp: Math.round(t * 1e6), duration: Math.round(1e6 / FPS) });
          encoder.encode(vf, { keyFrame: i % (FPS * 2) === 0 });
          vf.close();
          while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2));
        }
        await encoder.flush();
        encoder.close();
        if (!avcC) throw new Error("no avcC from the encoder");
        out = muxMp4({ width, height, fps: FPS, avcC, samples });
        const reordered = samples.some((s, i) => i > 0 && s.pts < samples[i - 1].pts);
        return { bytes: out.length, frames: samples.length, keys: samples.filter((s) => s.key).length, reordered };
      },
      /** The finished file in base64 slices, so the page never hands back one enormous string. */
      slice(i: number, size = 1_500_000) {
        if (!out) return "";
        const part = out.subarray(i * size, (i + 1) * size);
        let s = ""; for (let j = 0; j < part.length; j += 0x8000) s += String.fromCharCode(...part.subarray(j, j + 0x8000));
        return btoa(s);
      },
    };
    (window as unknown as { __film: typeof api }).__film = api;
    renderAt(0);
  }, [gl, advance, film]);
  return null;
}

export function FilmStage() {
  const drive = useRef<Drive>(newDrive());
  const film = useRef<FilmState>({ t: 0 });
  const floorY = PAD_TOP - 0.04;
  const fog = useMemo(() => new THREE.Fog(BG, 5.5, 13), []);
  return (
    <div style={{ width: W, height: H, background: BG }}>
      <Canvas
        frameloop="never"
        dpr={1}
        shadows
        style={{ width: W, height: H }}
        camera={{ position: [4, 2, 6], fov: FOV, near: 0.05, far: 80 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        scene={{ background: new THREE.Color(BG), fog }}
      >
        <ambientLight intensity={0.05} />
        <spotLight position={[1.2, 7, 2.4]} angle={0.3} penumbra={1} intensity={48} decay={2} castShadow shadow-mapSize={[2048, 2048]} color="#F4F6FA" />
        <directionalLight position={[-2.5, 3.5, -6]} intensity={3.4} color="#DCE5FF" />
        <directionalLight position={[6, 1.5, 2]} intensity={0.35} color="#FFFFFF" />
        <Environment resolution={512} frames={1}>
          <Lightformer form="rect" intensity={2.2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[8, 8, 1]} />
          <Lightformer form="rect" intensity={3} position={[-6, 2, 1]} rotation-y={Math.PI / 2} scale={[10, 1.2, 1]} color="#E8EEFF" />
          <Lightformer form="rect" intensity={3} position={[6, 2, -1]} rotation-y={-Math.PI / 2} scale={[10, 1.2, 1]} color="#E8EEFF" />
          <Lightformer form="rect" intensity={4} position={[0, 2.2, -7]} rotation-y={Math.PI} scale={[12, 1, 1]} />
        </Environment>
        <Director drive={drive} film={film} />
        <DroneModel drive={drive} />
        <Pad tone="dark" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <MeshReflectorMaterial
            resolution={1024} mirror={0.6} blur={[300, 60]} mixBlur={0.9} mixStrength={3.2} mixContrast={1.15}
            roughness={0.7} metalness={0.6} depthScale={1.1} minDepthThreshold={0.5} maxDepthThreshold={1.3}
            color="#050506" envMapIntensity={0}
          />
        </mesh>
        <Finish />
        <Recorder film={film} />
      </Canvas>
    </div>
  );
}
