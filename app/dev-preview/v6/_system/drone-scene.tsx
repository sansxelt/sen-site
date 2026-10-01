"use client";

/* THE HOMEPAGE DRONE (founder, 2026-10-01: "what I was imagining was a drone thing").

   One procedural folding-arm quadcopter in a light studio, in the family look of the sansxel product renders:
   glossy ink hull with clearcoat, steel motor bells, composite arms, curved two-blade propellers, real
   reflections from light panels, a soft contact shadow on a low round pad. No HUD, no glowing orbs, no drawn
   rings: materials and motion carry it.

   THE MOTION IS THE PRODUCT'S DEVICE STORY, NOT A RESULT. It hovers, comes home to its pad, lands, lets the
   rotors spin down, then lifts off again: the "Return home, then still Landed" check the homepage describes.
   Nothing on screen claims a run happened.

   Built from primitives, so there is no model file to fetch, and the environment is made of Lightformers, so
   there is no HDR file either: the scene makes no network request. Reduced motion renders one still frame,
   and nothing renders while the scene is off screen. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

const INK = "#121318";
const INK_2 = "#1C1E24";
const STEEL = "#B4BAC4";
const GLASS = "#0A1018";

const HOVER_Y = 0.85;
const LOOP = 15;
const DESCEND: [number, number] = [5.5, 8.6];
const LANDED: [number, number] = [8.6, 11.4];
const LIFT: [number, number] = [11.4, 14.2];
const FOOT_Y = -0.24;   // the feet, relative to the drone's origin
const PAD_TOP = FOOT_Y;  // the drone lands with its feet on the pad

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Where the drone is in its loop: height above the pad and how fast the rotors turn (0..1). */
function phase(time: number) {
  const t = time % LOOP;
  if (t < DESCEND[0]) return { y: HOVER_Y, spin: 1, settle: 0 };
  if (t < DESCEND[1]) {
    const k = ease(clamp01((t - DESCEND[0]) / (DESCEND[1] - DESCEND[0])));
    return { y: HOVER_Y * (1 - k), spin: 1, settle: 0 };
  }
  if (t < LANDED[1]) {
    const k = clamp01((t - LANDED[0]) / 1.6);
    return { y: 0, spin: 1 - ease(k) * 0.97, settle: k };
  }
  if (t < LIFT[1]) {
    const u = clamp01((t - LIFT[0]) / (LIFT[1] - LIFT[0]));
    const spinUp = clamp01(u / 0.35);
    const rise = ease(clamp01((u - 0.3) / 0.7));
    return { y: HOVER_Y * rise, spin: 0.03 + 0.97 * ease(spinUp), settle: 1 - spinUp };
  }
  return { y: HOVER_Y, spin: 1, settle: 0 };
}

/** A tapered, slightly curved blade, as a thin extruded plan form. Shared by all eight blades. */
function useBladeGeometry() {
  return useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0.04, -0.03);
    s.bezierCurveTo(0.16, -0.075, 0.36, -0.06, 0.5, -0.016);
    s.quadraticCurveTo(0.52, 0, 0.5, 0.012);
    s.bezierCurveTo(0.38, 0.04, 0.17, 0.05, 0.04, 0.03);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 24 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
}

function Propeller({ dir, spin, blade }: { dir: 1 | -1; spin: React.MutableRefObject<number>; blade: THREE.BufferGeometry }) {
  const hub = useRef<THREE.Group>(null);
  const disc = useRef<THREE.MeshBasicMaterial>(null);
  const mat = useRef<THREE.MeshPhysicalMaterial>(null);
  useFrame((_, dt) => {
    const s = spin.current;
    if (hub.current) hub.current.rotation.y += dir * Math.min(dt, 0.05) * (1.5 + s * 64);
    // At speed the eye sees a disc, not blades: fade one in as the other fades out.
    if (disc.current) disc.current.opacity = 0.13 * s;
    if (mat.current) mat.current.opacity = 1 - 0.8 * s;
  });
  return (
    <group>
      <group ref={hub}>
        {[0, Math.PI].map((r) => (
          <mesh key={r} geometry={blade} rotation={[0, r, 0.1 * dir]}>
            <meshPhysicalMaterial ref={r ? undefined : mat} color={INK_2} roughness={0.3} metalness={0.15} clearcoat={0.8} transparent opacity={1} />
          </mesh>
        ))}
        <mesh position={[0, 0.012, 0]}>
          <cylinderGeometry args={[0.045, 0.05, 0.035, 28]} />
          <meshPhysicalMaterial color={STEEL} metalness={1} roughness={0.2} />
        </mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <circleGeometry args={[0.52, 72]} />
        <meshBasicMaterial ref={disc} color="#30333A" transparent opacity={0.13} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** A rounded arm laid from one point to another. */
function Arm({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const { mid, len, rot } = useMemo(() => {
    const d = new THREE.Vector3().subVectors(to, from);
    const yaw = Math.atan2(d.x, d.z);
    const pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z));
    return { mid: new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5), len: d.length(), rot: new THREE.Euler(pitch, yaw, 0, "YXZ") };
  }, [from, to]);
  return (
    <group position={mid} rotation={rot}>
      <RoundedBox args={[0.11, 0.075, len]} radius={0.032} smoothness={6} castShadow>
        <meshPhysicalMaterial color={INK_2} metalness={0.35} roughness={0.38} clearcoat={0.7} clearcoatRoughness={0.2} />
      </RoundedBox>
    </group>
  );
}

function Drone({ still }: { still: boolean }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const spin = useRef(1);
  const blade = useBladeGeometry();
  const { pointer } = useThree();

  // Folding-arm layout: front arms sweep forward and sit a little higher, rear arms sweep back and lower.
  const rotors = useMemo(() => {
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    return [
      { from: v(0.36, 0.06, 0.42), at: v(1.12, 0.1, 0.92), dir: 1 as const },
      { from: v(-0.36, 0.06, 0.42), at: v(-1.12, 0.1, 0.92), dir: -1 as const },
      { from: v(0.36, -0.03, -0.46), at: v(1.12, 0.0, -0.94), dir: -1 as const },
      { from: v(-0.36, -0.03, -0.46), at: v(-1.12, 0.0, -0.94), dir: 1 as const },
    ];
  }, []);

  useFrame((state) => {
    const t = still ? 3 : state.clock.elapsedTime;
    const p = phase(t);
    spin.current = still ? 0.7 : p.spin;
    const k = 1 / 60;
    if (root.current) {
      const bob = p.y > 0.04 ? Math.sin(t * 1.6) * 0.04 : 0;
      root.current.position.y = p.y + bob;
      const yaw = -0.62 + Math.sin(t * 0.16) * 0.32 + pointer.x * 0.3;
      root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, yaw, 2, k);
    }
    if (body.current) {
      // Flying, a drone is never quite level: a small pitch and roll that settle on the pad.
      const air = p.y > 0.04 ? 1 : 0.1;
      body.current.rotation.x = THREE.MathUtils.damp(body.current.rotation.x, (Math.sin(t * 0.9) * 0.04 - pointer.y * 0.05) * air, 3, k);
      body.current.rotation.z = THREE.MathUtils.damp(body.current.rotation.z, Math.cos(t * 0.7) * 0.035 * air, 3, k);
    }
  });

  const hull = { color: INK, metalness: 0.45, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.4 } as const;

  return (
    <group ref={root} scale={0.86}>
      <group ref={body}>
        {/* hull: a rounded core, a domed top cover and a rounded nose */}
        <RoundedBox args={[0.84, 0.26, 1.5]} radius={0.12} smoothness={8} castShadow>
          <meshPhysicalMaterial {...hull} />
        </RoundedBox>
        <mesh position={[0, 0.1, -0.06]} scale={[0.4, 0.1, 0.7]} castShadow>
          <sphereGeometry args={[1, 64, 32]} />
          <meshPhysicalMaterial {...hull} color="#16171D" roughness={0.18} />
        </mesh>
        <mesh position={[0, 0.0, 0.66]} scale={[0.4, 0.13, 0.22]} castShadow>
          <sphereGeometry args={[1, 64, 32]} />
          <meshPhysicalMaterial {...hull} />
        </mesh>
        {/* steel accent along the top cover */}
        <mesh position={[0, 0.198, -0.06]} scale={[0.012, 0.006, 0.5]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshPhysicalMaterial color={STEEL} metalness={1} roughness={0.2} />
        </mesh>
        {/* side air vents */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.421, 0.0, -0.1]}>
            {[0, 1, 2, 3].map((n) => (
              <mesh key={n} position={[0, 0, -0.18 + n * 0.09]}>
                <boxGeometry args={[0.006, 0.07, 0.05]} />
                <meshPhysicalMaterial color="#050506" roughness={0.9} />
              </mesh>
            ))}
          </group>
        ))}
        {/* forward sensors */}
        {[-0.13, 0.13].map((x) => (
          <mesh key={x} position={[x, 0.04, 0.86]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.01, 32]} />
            <meshPhysicalMaterial color={GLASS} roughness={0.02} metalness={0.3} clearcoat={1} clearcoatRoughness={0} />
          </mesh>
        ))}
        {/* rear seam: the battery */}
        <mesh position={[0, 0.131, -0.5]}>
          <boxGeometry args={[0.46, 0.008, 0.02]} />
          <meshPhysicalMaterial color={STEEL} metalness={1} roughness={0.3} />
        </mesh>
        {/* gimbal and camera, under the nose */}
        <group position={[0, -0.05, 0.78]}>
          <mesh>
            <boxGeometry args={[0.2, 0.06, 0.12]} />
            <meshPhysicalMaterial color={INK_2} metalness={0.4} roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.075, 0.03]} castShadow>
            <sphereGeometry args={[0.085, 48, 48]} />
            <meshPhysicalMaterial {...hull} />
          </mesh>
          <mesh position={[0, -0.075, 0.112]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.048, 0.048, 0.02, 48]} />
            <meshPhysicalMaterial color={GLASS} metalness={0.3} roughness={0.02} clearcoat={1} clearcoatRoughness={0} />
          </mesh>
          <mesh position={[0, -0.075, 0.123]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.05, 0.006, 12, 48]} />
            <meshPhysicalMaterial color={STEEL} metalness={1} roughness={0.2} />
          </mesh>
        </group>

        {rotors.map((r, i) => (
          <group key={i}>
            <Arm from={r.from} to={r.at} />
            <group position={r.at}>
              <mesh castShadow>
                <cylinderGeometry args={[0.105, 0.115, 0.13, 48]} />
                <meshPhysicalMaterial {...hull} />
              </mesh>
              <mesh position={[0, 0.085, 0]}>
                <cylinderGeometry args={[0.09, 0.1, 0.045, 48]} />
                <meshPhysicalMaterial color={STEEL} metalness={1} roughness={0.22} />
              </mesh>
              <group position={[0, 0.125, 0]}>
                <Propeller dir={r.dir} spin={spin} blade={blade} />
              </group>
              {/* leg, down to the shared foot line */}
              <mesh position={[0, (FOOT_Y - r.at.y - 0.065) / 2 - 0.0325, 0]}>
                <cylinderGeometry args={[0.026, 0.034, Math.abs(FOOT_Y - r.at.y) - 0.065, 20]} />
                <meshPhysicalMaterial color={INK_2} metalness={0.3} roughness={0.45} />
              </mesh>
              <mesh position={[0, FOOT_Y - r.at.y + 0.014, 0]} scale={[1, 0.45, 1]}>
                <sphereGeometry args={[0.05, 24, 24]} />
                <meshPhysicalMaterial color="#2B2E35" roughness={0.85} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

/** The home pad: a low matte disc with a lighter inset, so the landing has somewhere to land. */
function Pad() {
  return (
    <group position={[0, PAD_TOP * 0.86 - 0.02, 0]} scale={[0.86, 1, 0.86]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[1.95, 2.0, 0.04, 96]} />
        <meshPhysicalMaterial color="#E4E4E0" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.021, 0]} receiveShadow>
        <cylinderGeometry args={[1.25, 1.25, 0.004, 96]} />
        <meshPhysicalMaterial color="#ECECE8" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Rig({ still }: { still: boolean }) {
  const { camera, pointer } = useThree();
  useFrame(() => {
    if (still) return;
    // Handheld: the camera drifts a little with the pointer.
    camera.position.x = THREE.MathUtils.damp(camera.position.x, 4.8 + pointer.x * 0.35, 1.4, 1 / 60);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 2.2 + pointer.y * 0.22, 1.4, 1 / 60);
    camera.lookAt(0, 0.12, 0);
  });
  return null;
}

export default function DroneScene() {
  const host = useRef<HTMLDivElement>(null);
  const [still] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  // Render only while the scene is on screen; reduced motion renders a single still frame.
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
        <Rig still={still} />
        <Drone still={still} />
        <Pad />
        <ContactShadows position={[0, PAD_TOP * 0.86 + 0.005, 0]} scale={6} blur={2.2} opacity={0.4} far={2.5} resolution={512} color="#0A0A0B" frames={still ? 1 : Infinity} />
      </Canvas>
    </div>
  );
}
