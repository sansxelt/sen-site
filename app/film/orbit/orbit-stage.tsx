"use client";

/* THE DRONE, FILMED: ONE CONTINUOUS TAKE FOR THE HOMEPAGE FILM (rebuilt 2026-10-01).

   The founder's notes asked for the drone to hold its place while the camera goes around it through
   different environments. The first version did that literally, and the founder, on seeing it: "some scenes
   genuinely just look simulated". They did, for reasons a real camera would never produce. The camera flew a
   ten metre circle around the drone while every place behind it was a photograph taken from one spot, so the
   ground under the drone never moved the way ground moves. The drone cast no shadow, it was as sharp as a wall
   fifty metres away, nothing blurred with motion, and it was glossy and the size of a car next to the garage
   doors.

   So the camera now does only what a person filming can do from where each photograph was taken: it stays on
   that spot and turns, and its hand breathes a little. A 360 degree photograph is exactly right for a camera
   that only turns. The drone is real size (about 60 cm across) and in moulded graphite plastic. It sits on a
   pad on the garage floor two metres away, spins up, lifts off, then flies a slow circle around the camera
   holding its heading, so the camera still sees it from every side while the places change behind it. Its
   shadow falls on the photographed ground from that place's own light (measured from the HDR files). Focus is
   on the drone, so the far background softens the way a lens does; each frame is the average of five instants
   across half a frame's time, so whatever moves blurs. Grade and grain come in the compose step, with the real
   footage.

   THE PLACES ARE REAL PHOTOGRAPHS, Poly Haven panoramas (CC0): a garage, a plaza on a river at night, a field
   at sunset, a mountain ridge in the morning. The last matches the real footage the film cuts to next (a hand
   catching a drone under a blue sky over arid mountains). Each change is a wipe that travels across the frame
   with a thin seam of light. The drone is lit by the place it is in: every frame the photograph is captured into
   a cube map at the drone and prefiltered (PMREM), so its reflections always show the world around it.

   ?portrait renders the phone cut (1080x1920). Nothing renders on its own: window.__film.renderAt(t) draws one
   exact frame, and record() encodes the take with WebCodecs (../encode.ts) as a high-bitrate intermediate that
   the compositing step cuts and grades. */
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { DroneModel, Pad, PAD_TOP, newDrive, type Drive } from "@/app/dev-preview/v6/_system/drone-model";
import { encodeMp4, sliceBase64 } from "../encode";
import { ease, k01, lerp, rotorAngle } from "../sets/kit";

// ?portrait renders the phone cut: 1080x1920 and a wider vertical field of view, so the drone still fits across
// the narrow frame, with the drone lower down, under the phone's headline, which sits near the top of its frame.
const PORTRAIT = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("portrait");
const W = PORTRAIT ? 1080 : 1920, H = PORTRAIT ? 1920 : 1080, FPS = 30;
export const LENGTH = 14.8;
const FOV = PORTRAIT ? 50 : 30;
/** Half the frame's horizontal field of view, in radians. */
const HALF_W = Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (W / H));
/** How far above the drone the camera aims, as an angle, so the drone sits low in the frame, under the headline:
 *  further on the pad, where the camera looks down on it and it fills more of the frame. */
const AIM_PAD = THREE.MathUtils.degToRad(PORTRAIT ? 12 : 10);
const AIM_FLY = THREE.MathUtils.degToRad(PORTRAIT ? 8.5 : 6.5);

// ── THE WORLD IN METRES ───────────────────────────────────────────────────────────────────────────────────
/** The photographs' camera height above the ground (a tripod). */
const CAM_H = 1.62;
/** The model is about 2.2 units across its rotors; the drone is about 60 cm. */
const M = 0.27;
/** The drone's origin at rest: its feet on the pad, the pad on the floor. */
const REST_Y = -CAM_H - (PAD_TOP - 0.04) * M;
/** The pad's top, a centimetre above the floor: the contact shadow lies there, so it shows on the pad too. */
const PAD_TOP_Y = REST_Y + PAD_TOP * M;
/** Chest height, where it holds while it circles. */
const HOVER_Y = -0.38;
/** Where the pad is, around the camera (radians), and how far away. */
const TH0 = 0.55;
const D_PAD = PORTRAIT ? 2.1 : 1.85;
/** The circle it flies around the camera, and how much of it. */
const D_RING = PORTRAIT ? 2.9 : 2.4;
const SWEEP = Math.PI * 1.05;
/** It faces the camera three quarters on from the pad, and holds that heading all the way round. */
const YAW0 = TH0 + Math.PI - 0.6;

type Env = {
  src: string; yaw: number; gain: number;
  /** The brightest light in the HDR (u, v of the full equirect), its strength and colour, for the one sun. */
  sun: [number, number]; sunI: number; sunC: string;
  led: number;
  /** How dark the sun's shadow is (a hard sun, a diffuse room), and the soft contact shadow under the drone. */
  shade: number; ao: number;
  /** Roughly how far the background is, for the depth of field (a room's walls, a horizon). */
  far: number;
};
// Measured from the 16k HDRs (scratchpad hdri): the garage's light is diffuse (its brightest patch carries 1% of
// the light), the plaza's is a floodlight across the river, the field's sun sits 3.8 degrees above the horizon,
// and the ridge's carries 81% of the light from 21.5 degrees up. The ridge is turned so that sun is behind the
// camera while the drone is there: the drone is lit from the front and its shadow falls on the rock beyond it.
const ENVS: Env[] = [
  { src: "/film/asset/env16b-autoshop-01.jpg", yaw: 0.0, gain: 0.9, sun: [0.693, 0.24], sunI: 0.5, sunC: "#F2F5FF", led: 0.6, shade: 0.18, ao: 0.62, far: 16 },
  { src: "/film/asset/env16b-modern-buildings-night.jpg", yaw: -0.45, gain: 0.8, sun: [0.169, 0.477], sunI: 0.45, sunC: "#D6DEFF", led: 1, shade: 0.16, ao: 0.42, far: 60 },
  { src: "/film/asset/env16b-bambanani-sunset.jpg", yaw: 0.0, gain: 0.96, sun: [0.6, 0.479], sunI: 1.9, sunC: "#FFD2A0", led: 0, shade: 0.42, ao: 0.32, far: 300 },
  { src: "/film/asset/env16b-kiara-3-morning.jpg", yaw: -0.38, gain: 1.0, sun: [0.616, 0.38], sunI: 2.8, sunC: "#FFF4E2", led: 0, shade: 0.55, ao: 0.3, far: 300 },
];
// Each wipe starts here and lasts WIPE seconds; the place before it holds until then.
const WIPES = [6.7, 9.0, 11.3];
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

const spinAt = (t: number) => ease(k01(t, 0.8, 2.6));

/** Where the drone is (world metres) at time t: on the pad, then up, then around the camera, then down. */
function dronePos(t: number) {
  const lift = ease(k01(t, 2.5, 4.8));
  const out = ease(k01(t, 3.6, 5.8));
  // a sine ease: a slow, even circle (the cubic one peaked at 75 degrees a second, a whip pan)
  const go = 0.5 - 0.5 * Math.cos(Math.PI * k01(t, 4.4, LENGTH));
  const fall = ease(k01(t, LENGTH - 1.6, LENGTH));
  const th = TH0 + SWEEP * go;
  const r = lerp(D_PAD, D_RING, out);
  const y = lerp(REST_Y, HOVER_Y, lift) + Math.sin(t * 1.6) * 0.012 * lift - fall * 0.55;
  return new THREE.Vector3(Math.sin(th) * r, y, Math.cos(th) * r);
}

/** Its attitude: level on the pad; flying, it leans into its motion as a multirotor does, plus a little air. */
function droneAttitude(t: number) {
  const airborne = k01(t, 2.6, 3.4);
  const v = dronePos(t + 0.05).sub(dronePos(t - 0.05)).divideScalar(0.1);
  const yaw = YAW0 + Math.sin(t * 0.33) * 0.05 * airborne;
  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  return {
    yaw,
    pitch: (v.dot(fwd) * 0.07 + Math.sin(t * 0.9) * 0.012) * airborne,
    roll: (-v.dot(right) * 0.07 + Math.cos(t * 0.7) * 0.012) * airborne,
  };
}

/** A hand holding a camera is never still: a small, slow, uneven sway (radians). */
function sway(t: number) {
  return {
    yaw: 0.0038 * (Math.sin(t * 1.31) * 0.6 + Math.sin(t * 2.87 + 1.2) * 0.3 + Math.sin(t * 5.3 + 0.4) * 0.1),
    pitch: 0.0032 * (Math.sin(t * 1.07 + 0.7) * 0.6 + Math.sin(t * 3.21 + 2.1) * 0.3 + Math.sin(t * 6.1 + 1.7) * 0.1),
  };
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
uniform float edge; uniform float k; uniform float seam; uniform float capture;
uniform float focus; uniform float camH; uniform float farD; uniform float cocK; uniform float texelPx;
varying vec3 vDir;
vec2 eq(vec3 d, float yaw) {
  float c = cos(yaw), s = sin(yaw);
  vec3 r = vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);
  // The panoramas are 16k wide and cut to the band the camera can see, +30 to -70 degrees of elevation
  // (scratchpad hdri/tonemap2.py), so v is remapped into that band and held at its edges outside it.
  float v = asin(clamp(r.y, -1.0, 1.0)) * 0.31830989 + 0.5;
  return vec2(atan(r.z, r.x) * 0.15915494 + 0.5, clamp((v - 0.1111111) / 0.5555556, 0.0005, 0.9995));
}
void main() {
  vec3 d = normalize(vDir);
  // Depth of field: how far this direction looks (the ground plane below the horizon, else the background),
  // against the focus distance (the drone), gives the blur in pixels, and the blur picks the mip level.
  float dist = d.y < -0.01 ? min(camH / -d.y, farD) : farD;
  float coc = cocK * abs(1.0 / dist - 1.0 / focus);
  float lod = capture > 0.5 ? 2.0 : max(0.35, log2(1.0 + coc * 2.0 * texelPx));
  vec3 a = textureLod(tA, eq(d, yA), lod).rgb * gA;
  vec3 b = textureLod(tB, eq(d, yB), lod).rgb * gB;
  float x = atan(d.z, d.x) - edge;
  x = atan(sin(x), cos(x));
  // On screen the new place travels across the frame behind its edge; in the cube capture that lights the
  // drone it is a plain crossfade, so the light changes as smoothly as the picture. The edge sweeps from the
  // high-angle side to the low one, so the side it has passed (x > 0) is the new place.
  float m = capture > 0.5 ? k : (k <= 0.0 ? 0.0 : (k >= 1.0 ? 1.0 : smoothstep(-0.11, 0.11, x)));
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

/** A soft round shadow, dark in the middle: the contact shadow under the drone. */
function blobTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, "rgba(0,0,0,1)");
  r.addColorStop(0.35, "rgba(0,0,0,0.62)");
  r.addColorStop(0.7, "rgba(0,0,0,0.18)");
  r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The direction of a place's sun, from where it sits in its panorama. */
function sunDir(e: Env) {
  const phi = (e.sun[0] - 0.5) * Math.PI * 2, el = (0.5 - e.sun[1]) * Math.PI;
  const v = new THREE.Vector3(Math.cos(el) * Math.cos(phi), Math.sin(el), Math.cos(el) * Math.sin(phi));
  return v.applyAxisAngle(new THREE.Vector3(0, 1, 0), e.yaw).normalize();
}

function World({ film, drive, drone, pad }: {
  film: React.MutableRefObject<FilmState>; drive: React.MutableRefObject<Drive>;
  drone: React.RefObject<THREE.Group | null>; pad: React.RefObject<THREE.Group | null>;
}) {
  const { gl, scene, camera } = useThree();
  const sphere = useRef<THREE.Mesh>(null);
  const sunA = useRef<THREE.DirectionalLight>(null);
  const sunB = useRef<THREE.DirectionalLight>(null);
  const shadowSun = useRef<THREE.DirectionalLight>(null);
  const shadowMat = useRef<THREE.ShadowMaterial>(null);
  const blob = useRef<THREE.Mesh>(null);
  const blobMat = useRef<THREE.MeshBasicMaterial>(null);
  const blobTex = useMemo(() => blobTexture(), []);
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
      edge: { value: 0 }, k: { value: 0 }, seam: { value: 0 }, capture: { value: 0 },
      focus: { value: 2 }, camH: { value: CAM_H }, farD: { value: 50 },
      // Blur in pixels per dioptre of defocus: under 4 px on a far background with the drone 2.4 m away. A real
      // lens at this distance blurs more; the founder asked for sharp backgrounds, so it stays gentle.
      cocK: { value: PORTRAIT ? 10 : 9 },
      // Panorama texels per screen pixel: 16384 across 360 degrees, against the frame's pixels per radian.
      texelPx: { value: (16384 / (Math.PI * 2)) / (H / THREE.MathUtils.degToRad(FOV)) },
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
  useEffect(() => {
    // Opaque parts cast the shadow; the fading blades and the rotor disc do not (a spinning rotor casts almost none).
    for (const g of [drone.current, pad.current]) g?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.Material;
      mesh.castShadow = g === drone.current && !mat.transparent;
      mesh.receiveShadow = g === pad.current;
    });
    const s = shadowSun.current;
    if (s) {
      s.shadow.mapSize.set(2048, 2048);
      const c = s.shadow.camera as THREE.OrthographicCamera;
      c.left = -1.4; c.right = 1.4; c.top = 1.4; c.bottom = -1.4; c.near = 0.1; c.far = 40;
      s.shadow.bias = -0.0004; s.shadow.normalBias = 0.02; s.shadow.radius = 4;
      scene.add(s.target);
    }
  }, [drone, pad, scene]);

  useFrame(() => {
    const t = film.current.t;
    const p = dronePos(t);
    const att = droneAttitude(t);
    if (drone.current) drone.current.position.copy(p);
    Object.assign(drive.current, { y: 0, spin: spinAt(t), yaw: att.yaw, pitch: att.pitch, roll: att.roll, rot: rotorAngle(t, spinAt), t });

    const { a, b, k } = envAt(t);
    const A = ENVS[a], B = ENVS[b];
    drive.current.led = lerp(A.led, B.led, k) * k01(t, 2.0, 2.6);
    // The pad belongs to the garage; it is out of frame before the first change.
    if (pad.current) pad.current.visible = t < WIPES[0];

    // The camera stays where the photographs were taken and turns to follow the drone, a beat behind it, as a
    // person does, with its aim a little above the drone so the drone sits under the headline.
    camera.position.set(0, 0, 0);
    const aimAt = dronePos(t - 0.12);
    const dist = aimAt.length();
    const aim = lerp(AIM_PAD, AIM_FLY, ease(k01(t, 2.8, 5.0)));
    camera.lookAt(aimAt.clone().add(new THREE.Vector3(0, dist * Math.tan(aim), 0)));
    const sw = sway(t);
    camera.rotateY(sw.yaw);
    camera.rotateX(sw.pitch);
    camera.updateMatrixWorld();

    // the wipe travels across what the camera sees
    const f = new THREE.Vector3(); camera.getWorldDirection(f);
    const look = Math.atan2(f.z, f.x);
    const u = material.uniforms;
    u.tA.value = textures[a]; u.tB.value = textures[b];
    u.yA.value = A.yaw; u.yB.value = B.yaw; u.gA.value = A.gain; u.gB.value = B.gain;
    u.k.value = k;
    // 1.4 times the frame's half width, so the seam is on screen for most of the wipe.
    u.edge.value = look - lerp(-HALF_W * 1.4, HALF_W * 1.4, ease(k));
    u.seam.value = k > 0 && k < 1 ? Math.sin(k * Math.PI) : 0;
    u.focus.value = p.length();
    u.farD.value = lerp(A.far, B.far, k);

    // light the drone with the world around it
    if (sphere.current) {
      sphere.current.position.copy(p);
      u.capture.value = 1;
      cube.cam.position.copy(p);
      cube.cam.update(gl, scene);
      u.capture.value = 0;
      sphere.current.position.set(0, 0, 0);
      const next = cube.pmrem.fromCubemap(cube.rt.texture);
      scene.environment = next.texture;
      envRT.current?.dispose();
      envRT.current = next;
    }

    // one sun per place, crossfaded, for the light on the drone
    if (sunA.current) { sunA.current.position.copy(sunDir(A)).multiplyScalar(10).add(p); sunA.current.target.position.copy(p); sunA.current.target.updateMatrixWorld(); sunA.current.intensity = A.sunI * (1 - k); sunA.current.color.set(A.sunC); }
    if (sunB.current) { sunB.current.position.copy(sunDir(B)).multiplyScalar(10).add(p); sunB.current.target.position.copy(p); sunB.current.target.updateMatrixWorld(); sunB.current.intensity = B.sunI * k; sunB.current.color.set(B.sunC); }
    // and one shadow, from whichever place holds most of the frame
    const S = k < 0.5 ? A : B;
    if (shadowSun.current) {
      const dir = sunDir(S);
      // a sun near the horizon throws the shadow metres away; below 6 degrees it is drawn from 6, still long
      if (dir.y < 0.105) { dir.y = 0.105; dir.normalize(); }
      shadowSun.current.position.copy(p).addScaledVector(dir, 12);
      shadowSun.current.target.position.copy(p);
      shadowSun.current.target.updateMatrixWorld();
    }
    if (shadowMat.current) shadowMat.current.opacity = lerp(A.shade, B.shade, k);
    // the contact shadow: darker and tighter the nearer the drone is to the ground
    const h = Math.max(0, p.y - REST_Y);
    if (blob.current && blobMat.current) {
      blob.current.position.set(p.x, PAD_TOP_Y + 0.002, p.z);
      const size = 0.78 + h * 0.7;
      blob.current.scale.set(size, size, 1);
      blobMat.current.opacity = lerp(A.ao, B.ao, k) * Math.pow(Math.max(0, 1 - h / 1.7), 1.6);
    }
  }, -1);

  return (
    <>
      <mesh ref={sphere} material={material} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[90, 128, 64]} />
      </mesh>
      {/* the photographed ground: it only ever shows a shadow */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -CAM_H, 0]} receiveShadow renderOrder={1}>
        <planeGeometry args={[80, 80]} />
        <shadowMaterial ref={shadowMat} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh ref={blob} rotation-x={-Math.PI / 2} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={blobMat} map={blobTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <directionalLight ref={sunA} />
      <directionalLight ref={sunB} />
      <directionalLight ref={shadowSun} castShadow intensity={0.0001} />
      <ambientLight intensity={0.04} />
    </>
  );
}

function Recorder({ film }: { film: React.MutableRefObject<FilmState> }) {
  const { gl, advance } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const renderAt = (t: number) => { film.current.t = Math.max(0, t); advance(t * 1000, true); };
    let out: Uint8Array | null = null;
    // Motion blur: each frame is the mean of SUB instants spread across 0.4 of a frame (a 144 degree shutter).
    const SUB = 5, SHUTTER = 0.4;
    const api = {
      length: LENGTH, fps: FPS,
      ready: () => loaded.n >= ENVS.length,
      renderAt: (t: number) => { renderAt(t); return true; },
      still(t: number, q = 0.9) { renderAt(t); renderAt(t); return canvas.toDataURL("image/jpeg", q); },
      async record(bitrate = 40_000_000) {
        const r = await encodeMp4({
          width: W, height: H, fps: FPS, frames: Math.round(LENGTH * FPS), bitrate, gop: 15,
          draw: (i, ctx) => {
            for (let s = 0; s < SUB; s++) {
              renderAt((i + (s / (SUB - 1) - 0.5) * SHUTTER) / FPS);
              ctx.globalAlpha = 1 / (s + 1);
              ctx.drawImage(canvas, 0, 0, W, H);
            }
            ctx.globalAlpha = 1;
          },
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
  const drone = useRef<THREE.Group>(null);
  const pad = useRef<THREE.Group>(null);
  const padAt = useMemo(() => new THREE.Vector3(Math.sin(TH0) * D_PAD, REST_Y, Math.cos(TH0) * D_PAD), []);
  return (
    <div style={{ width: W, height: H, background: "#000" }}>
      <Canvas
        frameloop="never" dpr={1} style={{ width: W, height: H }} shadows="soft"
        camera={{ position: [0, 0, 0.001], fov: FOV, near: 0.02, far: 400 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        <World film={film} drive={drive} drone={drone} pad={pad} />
        <group ref={drone} scale={M}>
          <DroneModel drive={drive} finish="satin" />
        </group>
        <group ref={pad} position={padAt} scale={M} rotation-y={YAW0}>
          <Pad tone="mid" />
        </group>
        <EffectComposer multisampling={8}>
          <Bloom intensity={0.2} luminanceThreshold={0.9} luminanceSmoothing={0.2} mipmapBlur />
          <Vignette offset={0.32} darkness={0.42} />
        </EffectComposer>
        <Recorder film={film} />
      </Canvas>
    </div>
  );
}
