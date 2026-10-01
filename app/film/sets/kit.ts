// Shared pieces for the film sets (app/film/sets): the clock every set reads, easing, a seeded random
// source so every render of a set is identical, and canvas textures.
import * as THREE from "three";

/** Every shot the renderer knows. A set answers for one or more of them. */
export type ShotId = "rotor" | "web" | "agent" | "city" | "warehouse" | "record" | "panel" | "approve";

/** What to draw this render: which shot, and the time inside it (seconds, may run before 0 or past the end
 *  so a dissolve can show a shot a little early or late). */
export type Clock = { shot: ShotId; s: number };

/** What the active set asks of the finish: bloom strength and threshold. */
export type Look = { bloom: number; threshold: number; vignette: number };

export const FPS = 30;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const k01 = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const lerp = THREE.MathUtils.lerp;

/** mulberry32: a small seeded random source, so a set is laid out the same way every time it mounts. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The rotors' absolute angle at time s for a spin curve, integrated numerically (the same speed law as
 *  drone-model.tsx: 1.5 + 64 x spin radians a second). */
export function rotorAngle(s: number, spin: (x: number) => number, steps = 90) {
  if (s <= 0) return 0;
  const h = s / steps;
  let a = 0;
  for (let i = 0; i < steps; i++) a += (1.5 + 64 * spin((i + 0.5) * h)) * h;
  return a;
}

/** A canvas texture in sRGB with mipmaps and anisotropy, for anything drawn with the 2D API. */
export function canvasTexture(canvas: HTMLCanvasElement | OffscreenCanvas, repeat = false) {
  const t = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  t.needsUpdate = true;
  return t;
}

/** A vertical gradient as a screen-space background. stops: [position 0 (top) to 1 (bottom), colour]. */
export function gradientTexture(stops: [number, string][], height = 1024) {
  const c = document.createElement("canvas");
  c.width = 4; c.height = height;
  const g = c.getContext("2d")!;
  const lg = g.createLinearGradient(0, 0, 0, height);
  for (const [p, col] of stops) lg.addColorStop(p, col);
  g.fillStyle = lg;
  g.fillRect(0, 0, 4, height);
  return canvasTexture(c);
}

/** A soft round spot (white centre to clear edge) for light pools, glows and contact shadows. */
export function spotTexture(size = 256, inner = 0) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const rg = g.createRadialGradient(size / 2, size / 2, inner * size / 2, size / 2, size / 2, size / 2);
  rg.addColorStop(0, "rgba(255,255,255,1)");
  rg.addColorStop(0.35, "rgba(255,255,255,0.55)");
  rg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rg;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

/** An environment map for reflections, made by rendering a small scene into PMREM. build fills the scene. */
export function makeEnvironment(gl: THREE.WebGLRenderer, build: (scene: THREE.Scene) => void) {
  const scene = new THREE.Scene();
  build(scene);
  const pmrem = new THREE.PMREMGenerator(gl);
  const rt = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | undefined;
    if (mat) mat.dispose();
  });
  return rt.texture;
}

/** A sky dome for makeEnvironment: a gradient by height, from the horizon colour to the zenith colour. */
export function skyDome(scene: THREE.Scene, zenith: string, horizon: string, ground: string, radius = 50) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { z: { value: new THREE.Color(zenith) }, h: { value: new THREE.Color(horizon) }, g: { value: new THREE.Color(ground) } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 z; uniform vec3 h; uniform vec3 g; varying vec3 vP; void main(){ float y = vP.y; vec3 c = y > 0.0 ? mix(h, z, pow(y, 0.6)) : mix(h, g, pow(-y, 0.4)); gl_FragColor = vec4(c, 1.0); }",
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat));
}

/** A bright panel for makeEnvironment (a window, a light strip, the low sun). */
export function glowPanel(scene: THREE.Scene, color: string, intensity: number, pos: [number, number, number], size: [number, number], lookAt: [number, number, number] = [0, 0, 0]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
  m.position.set(...pos);
  m.lookAt(...lookAt);
  scene.add(m);
}

/** Aim so the subject sits right of centre, leaving the left of the frame for the homepage headline. */
export function aimRightOfCentre(camera: THREE.Camera, subject: THREE.Vector3, shift: number) {
  const view = new THREE.Vector3().subVectors(subject, camera.position).normalize();
  const left = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), view).normalize();
  camera.lookAt(subject.clone().addScaledVector(left, shift));
}

export function setFov(camera: THREE.Camera, fov: number) {
  const c = camera as THREE.PerspectiveCamera;
  if (c.fov !== fov) { c.fov = fov; c.updateProjectionMatrix(); }
}
