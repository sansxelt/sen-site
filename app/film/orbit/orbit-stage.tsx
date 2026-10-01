"use client";

/* THE DRONE ORBIT, SHOT B OF THE HOMEPAGE FILM (founder's notes, 2026-10-01).

   "The drone should stay the same position and the 3D camera would go around the drone simulating different
   environments." So the drone holds in the air at the origin while the camera circles it, and four real
   places sweep in behind it, one after another: a glass building at night, a warehouse, a field at sunset,
   and a mountain valley in the morning. The last one is chosen to match the real footage the film cuts to
   next (a hand catching a drone under a blue sky over arid mountains), so the change from render to real is
   a match cut.

   THE PLACES ARE REAL PHOTOGRAPHS: 360 degree panoramas from Poly Haven (CC0), drawn on a sphere that rides
   with the camera so they sit at infinity. Each change is a wipe that travels across the frame with a thin
   seam of light. The drone is lit by the place it is in: every frame the background is captured into a cube
   map at the drone and prefiltered (PMREM), so its reflections always show the world behind it, mid-wipe too.

   Nothing renders on its own. window.__film.renderAt(t) draws one exact frame; record() encodes the shot
   with WebCodecs (../encode.ts) as a high-bitrate intermediate the compositing step cuts and grades. */
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { DroneModel, newDrive, type Drive } from "@/app/dev-preview/v6/_system/drone-model";
import { encodeMp4, sliceBase64 } from "../encode";
import { aimRightOfCentre, ease, k01, lerp, rotorAngle } from "../sets/kit";

const W = 1920, H = 1080, FPS = 30;
export const LENGTH = 9.6;

type Env = { src: string; yaw: number; gain: number; sun: [number, number]; sunI: number; sunC: string; led: number };
// yaw turns each panorama so its best part sits behind the drone while it is on screen. sun is the (u, v)
// of the panorama's brightest region, measured from the image, for the one directional light.
const ENVS: Env[] = [
  { src: "/film/asset/env-modern-buildings-night.jpg", yaw: 0.0, gain: 0.78, sun: [0.289, 0.305], sunI: 0.5, sunC: "#D6DEFF", led: 1 },
  { src: "/film/asset/env-autoshop-01.jpg", yaw: 0.0, gain: 0.86, sun: [0.355, 0.152], sunI: 0.9, sunC: "#F2F5FF", led: 0.6 },
  { src: "/film/asset/env-bambanani-sunset.jpg", yaw: 0.0, gain: 0.96, sun: [0.568, 0.32], sunI: 2.2, sunC: "#FFD6A8", led: 0 },
  { src: "/film/asset/env-kiara-3-morning.jpg", yaw: 0.0, gain: 1.0, sun: [0.613, 0.371], sunI: 2.6, sunC: "#FFF4E2", led: 0 },
];
// Each wipe starts here and lasts WIPE seconds; the place before it holds until then.
const WIPES = [2.25, 4.55, 6.85];
const WIPE = 0.8;

/** Which two places are on screen at time t, and how far the wipe between them has gone (0 to 1). */
function envAt(t: number) {
  let a = 0;
  for (let i = 0; i < WIPES.length; i++) if (t >= WIPES[i] + WIPE) a = i + 1;
  const i = Math.min(a, WIPES.length - 1);
  const start = WIPES[i];
  if (a < ENVS.length - 1 && t >= start && t < start + WIPE) return { a, b: a + 1, k: (t - start) / WIPE };
  return { a, b: Math.min(a + 1, ENVS.length - 1), k: 0 };
}

/** The drone: holding its position, a slow breath of height and attitude; it starts down at the end. */
function droneAt(t: number) {
  const fall = ease(k01(t, LENGTH - 1.5, LENGTH));
  return {
    y: Math.sin(t * 1.6) * 0.03 - fall * 0.9,
    yaw: -0.35 + Math.sin(t * 0.33) * 0.06,
    pitch: Math.sin(t * 0.9) * 0.025 + fall * 0.05,
    roll: Math.cos(t * 0.7) * 0.025,
  };
}

/** The camera: most of a circle around the drone, rising slightly, closing in a little. */
function cameraAt(t: number) {
  const u = ease(k01(t, 0, LENGTH));
  const a = lerp(0.55, 0.55 + Math.PI * 1.45, u);
  const r = lerp(5.9, 5.0, u);
  const y = lerp(0.22, 0.5, u) - ease(k01(t, LENGTH - 1.5, LENGTH)) * 0.45;
  return new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
}

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAG = /* glsl */ `
uniform sampler2D tA; uniform sampler2D tB;
uniform float yA; uniform float yB; uniform float gA; uniform float gB;
uniform float edge; uniform float k; uniform float seam; uniform float capture; uniform float lod;
varying vec3 vDir;
vec2 eq(vec3 d, float yaw) {
  float c = cos(yaw), s = sin(yaw);
  vec3 r = vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);
  return vec2(atan(r.z, r.x) * 0.15915494 + 0.5, asin(clamp(r.y, -1.0, 1.0)) * 0.31830989 + 0.5);
}
void main() {
  vec3 d = normalize(vDir);
  vec3 a = textureLod(tA, eq(d, yA), lod).rgb * gA;
  vec3 b = textureLod(tB, eq(d, yB), lod).rgb * gB;
  float x = atan(d.z, d.x) - edge;
  x = atan(sin(x), cos(x));
  // On screen the new place travels across the frame behind its edge; in the cube capture that lights the
  // drone it is a plain crossfade, so the light changes as smoothly as the picture.
  float m = capture > 0.5 ? k : (k <= 0.0 ? 0.0 : (k >= 1.0 ? 1.0 : 1.0 - smoothstep(-0.11, 0.11, x)));
  vec3 col = mix(a, b, m);
  // a faint sweep of light along the edge, brightest at its core, never a hard bar
  float on = capture > 0.5 ? 0.0 : seam;
  col += vec3(0.90, 0.95, 1.0) * on * (exp(-pow(x / 0.0045, 2.0)) * 0.35 + exp(-pow(x / 0.06, 2.0)) * 0.10);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

type FilmState = { t: number };

// Panoramas still loading: a frame rendered now would be black, so the recorder waits for this.
const loaded = { n: 0 };

function World({ film, drive }: { film: React.MutableRefObject<FilmState>; drive: React.MutableRefObject<Drive> }) {
  const { gl, scene, camera } = useThree();
  const sphere = useRef<THREE.Mesh>(null);
  const sunA = useRef<THREE.DirectionalLight>(null);
  const sunB = useRef<THREE.DirectionalLight>(null);
  const textures = useMemo(() => {
    const loader = new THREE.TextureLoader();
    return ENVS.map((e) => {
      const tex = loader.load(e.src, () => { loaded.n++; });
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = 16;
      return tex;
    });
  }, []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, toneMapped: false,
    uniforms: {
      tA: { value: textures[0] }, tB: { value: textures[1] }, yA: { value: 0 }, yB: { value: 0 }, gA: { value: 1 }, gB: { value: 1 },
      edge: { value: 0 }, k: { value: 0 }, seam: { value: 0 }, capture: { value: 0 }, lod: { value: 1.7 },
    },
  }), [textures]);
  const cube = useMemo(() => {
    const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: false });
    const cam = new THREE.CubeCamera(0.1, 200, rt);
    cam.layers.set(1);
    return { rt, cam, pmrem: new THREE.PMREMGenerator(gl) };
  }, [gl]);
  const envRT = useRef<THREE.WebGLRenderTarget | null>(null);

  useEffect(() => { sphere.current?.layers.enable(1); }, []);

  useFrame(() => {
    const t = film.current.t;
    const d = droneAt(t);
    Object.assign(drive.current, { y: d.y, spin: 1, yaw: d.yaw, pitch: d.pitch, roll: d.roll, rot: rotorAngle(t, () => 1), t });

    const { a, b, k } = envAt(t);
    const A = ENVS[a], B = ENVS[b];
    drive.current.led = lerp(A.led, B.led, k);

    // camera
    const pos = cameraAt(t);
    camera.position.copy(pos);
    // aimed below the drone, so it rides above the middle of the frame with the horizon behind it
    aimRightOfCentre(camera, new THREE.Vector3(0, d.y - 0.42, 0), 0.17 * pos.length());
    camera.updateMatrixWorld();

    // the wipe travels across what the camera sees
    const f = new THREE.Vector3(); camera.getWorldDirection(f);
    const look = Math.atan2(f.z, f.x);
    const u = material.uniforms;
    u.tA.value = textures[a]; u.tB.value = textures[b];
    u.yA.value = A.yaw; u.yB.value = B.yaw; u.gA.value = A.gain; u.gB.value = B.gain;
    u.k.value = k;
    u.edge.value = look - lerp(-1.15, 1.15, ease(k));
    u.seam.value = k > 0 && k < 1 ? Math.sin(k * Math.PI) : 0;

    // light the drone with the world around it
    if (sphere.current) {
      sphere.current.position.set(0, 0, 0);
      u.capture.value = 1;
      cube.cam.position.set(0, d.y, 0);
      cube.cam.update(gl, scene);
      u.capture.value = 0;
      sphere.current.position.copy(camera.position);
      const next = cube.pmrem.fromCubemap(cube.rt.texture);
      scene.environment = next.texture;
      envRT.current?.dispose();
      envRT.current = next;
    }

    // one sun per place, crossfaded
    const sunDir = (e: Env) => {
      const phi = (e.sun[0] - 0.5) * Math.PI * 2, el = (0.5 - e.sun[1]) * Math.PI;
      const v = new THREE.Vector3(Math.cos(el) * Math.cos(phi), Math.sin(el), Math.cos(el) * Math.sin(phi));
      return v.applyAxisAngle(new THREE.Vector3(0, 1, 0), e.yaw).multiplyScalar(10);
    };
    if (sunA.current) { sunA.current.position.copy(sunDir(A)); sunA.current.intensity = A.sunI * (1 - k); sunA.current.color.set(A.sunC); }
    if (sunB.current) { sunB.current.position.copy(sunDir(B)); sunB.current.intensity = B.sunI * k; sunB.current.color.set(B.sunC); }
  }, -1);

  return (
    <>
      <mesh ref={sphere} material={material} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[90, 128, 64]} />
      </mesh>
      <directionalLight ref={sunA} />
      <directionalLight ref={sunB} />
      <ambientLight intensity={0.04} />
    </>
  );
}

function Recorder({ film }: { film: React.MutableRefObject<FilmState> }) {
  const { gl, advance } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const renderAt = (t: number) => { film.current.t = t; advance(t * 1000, true); };
    let out: Uint8Array | null = null;
    const api = {
      length: LENGTH, fps: FPS,
      ready: () => loaded.n >= ENVS.length,
      renderAt: (t: number) => { renderAt(t); return true; },
      still(t: number, q = 0.9) { renderAt(t); renderAt(t); return canvas.toDataURL("image/jpeg", q); },
      async record(bitrate = 40_000_000) {
        const r = await encodeMp4({
          width: W, height: H, fps: FPS, frames: Math.round(LENGTH * FPS), bitrate, gop: 15,
          draw: (i, ctx) => { renderAt(i / FPS); ctx.drawImage(canvas, 0, 0, W, H); },
        });
        out = r.bytes;
        return { bytes: r.bytes.length, frames: r.frames, keys: r.keys };
      },
      slice: (i: number) => sliceBase64(out, i),
    };
    (window as unknown as { __film: typeof api }).__film = api;
    renderAt(0);
  }, [gl, advance, film]);
  return null;
}

export function OrbitStage() {
  const drive = useRef<Drive>(newDrive());
  const film = useRef<FilmState>({ t: 0 });
  return (
    <div style={{ width: W, height: H, background: "#000" }}>
      <Canvas
        frameloop="never" dpr={1} style={{ width: W, height: H }}
        camera={{ position: [0, 0, 3.4], fov: 30, near: 0.05, far: 400 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        <World film={film} drive={drive} />
        <DroneModel drive={drive} />
        <EffectComposer multisampling={8}>
          <Bloom intensity={0.28} luminanceThreshold={0.86} luminanceSmoothing={0.2} mipmapBlur />
          <Vignette offset={0.32} darkness={0.5} />
        </EffectComposer>
        <Recorder film={film} />
      </Canvas>
    </div>
  );
}
