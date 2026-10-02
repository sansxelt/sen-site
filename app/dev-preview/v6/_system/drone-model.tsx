"use client";

/* THE DRONE ITSELF, shared by the homepage scene (_system/drone-scene.tsx) and the film renderer
   (app/film/drone). It has no clock of its own: whoever mounts it writes a Drive each frame (height, rotor
   speed, attitude), so the homepage can follow the pointer and the film can be rendered frame by frame at an
   exact time.

   One procedural folding-arm quadcopter in the family look of the sansxel renders: glossy ink hull with
   clearcoat, steel motor bells, composite arms, curved two-blade propellers that blur into a disc at speed.

   finish="satin" is the film's: moulded graphite plastic, as a real drone is made, instead of the glossy ink
   that reads as a render once the drone sits in a photographed place (founder, 2026-10-01: "some scenes
   genuinely just look simulated"). */
import { createContext, useContext, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

export const INK = "#121318";
export const INK_2 = "#1C1E24";
export const STEEL = "#B4BAC4";
export const GLASS = "#0A1018";
export const SCALE = 0.86;
export const FOOT_Y = -0.24;            // the feet, relative to the drone origin, before SCALE
export const PAD_TOP = FOOT_Y * SCALE;   // the drone lands with its feet on the pad

/** What the drone does this frame. dt, when given, replaces the frame clock (the film renders exact steps).
 *  rot, when given, is the rotors' absolute angle, so a film can render the same instant twice (a dissolve)
 *  and get the same frame. led (0 to 1) lights the navigation lights; t is the clock their strobe reads. */
export type Drive = { y: number; spin: number; yaw: number; pitch: number; roll: number; dt?: number; rot?: number; led?: number; t?: number };
export const newDrive = (): Drive => ({ y: 0, spin: 0, yaw: 0, pitch: 0, roll: 0 });

export type Finish = "gloss" | "satin";
const FinishCtx = createContext<Finish>("gloss");
const SATIN_HULL = { color: "#3A3D43", metalness: 0.06, roughness: 0.5, clearcoat: 0.22, clearcoatRoughness: 0.38, envMapIntensity: 1 } as const;
const SATIN_PART = { color: "#2C2F35", metalness: 0.08, roughness: 0.56, clearcoat: 0.12, clearcoatRoughness: 0.5 } as const;

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

// How a camera sees a spinning blade: in one exposure it sweeps an arc, so it reads as a smear of itself
// rather than a crisp shape or nothing. SMEAR copies of each blade, fanned back along the direction of spin,
// fade in with speed while the solid blade fades out. At rest you see two blades; flying, a soft fan.
const SMEAR = [0.1, 0.22, 0.36, 0.52, 0.7];

function Propeller({ dir, drive, blade }: { dir: 1 | -1; drive: React.MutableRefObject<Drive>; blade: THREE.BufferGeometry }) {
  const hub = useRef<THREE.Group>(null);
  const disc = useRef<THREE.MeshBasicMaterial>(null);
  const solid = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const smear = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const satin = useContext(FinishCtx) === "satin";
  useFrame((_, frameDt) => {
    const s = drive.current.spin;
    const dt = drive.current.dt ?? Math.min(frameDt, 0.05);
    if (hub.current) {
      if (drive.current.rot !== undefined) hub.current.rotation.y = dir * drive.current.rot;
      else hub.current.rotation.y += dir * dt * (1.5 + s * 64);
    }
    if (disc.current) disc.current.opacity = 0.1 * s;
    solid.current.forEach((m) => { if (m) m.opacity = 1 - 0.72 * s; });
    smear.current.forEach((m, i) => { if (m) m.opacity = Math.max(0, s - 0.15) * (0.3 - (i % SMEAR.length) * 0.045); });
  });
  return (
    <group>
      <group ref={hub}>
        {[0, Math.PI].map((r, bi) => (
          <group key={r}>
            <mesh geometry={blade} rotation={[0, r, 0.1 * dir]}>
              <meshPhysicalMaterial ref={(m) => { solid.current[bi] = m; }} color={INK_2} roughness={satin ? 0.55 : 0.3} metalness={satin ? 0.05 : 0.15} clearcoat={satin ? 0.1 : 0.8} transparent opacity={1} />
            </mesh>
            {SMEAR.map((off, k) => (
              <mesh key={k} geometry={blade} rotation={[0, r - dir * off, 0.1 * dir]}>
                <meshBasicMaterial ref={(m) => { smear.current[bi * SMEAR.length + k] = m; }} color="#3A3D45" transparent opacity={0} depthWrite={false} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[0, 0.012, 0]}>
          <cylinderGeometry args={[0.045, 0.05, 0.035, 28]} />
          <meshPhysicalMaterial color={STEEL} metalness={1} roughness={0.2} />
        </mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <circleGeometry args={[0.52, 72]} />
        <meshBasicMaterial ref={disc} color="#30333A" transparent opacity={0.1} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Navigation lights under the motor pods, as on a real aircraft: red on the left, green on the right, white
 *  at the back, and a white strobe on top that flashes once a second. Dark unless drive.led is set. */
const NAV = [
  { at: [-1.12, -0.085, 0.92], color: [1, 0.12, 0.08] },
  { at: [1.12, -0.085, 0.92], color: [0.15, 1, 0.35] },
  { at: [-1.12, -0.175, -0.94], color: [1, 0.96, 0.9] },
  { at: [1.12, -0.175, -0.94], color: [1, 0.96, 0.9] },
] as const;
function NavLights({ drive }: { drive: React.MutableRefObject<Drive> }) {
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const strobe = useRef<THREE.MeshBasicMaterial>(null);
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const k = drive.current.led ?? 0;
    if (group.current) group.current.visible = k > 0;
    if (k <= 0) return;
    NAV.forEach((n, i) => mats.current[i]?.color.setRGB(n.color[0] * 4 * k, n.color[1] * 4 * k, n.color[2] * 4 * k));
    const ph = ((drive.current.t ?? 0) % 1 + 1) % 1;
    const f = ph < 0.06 ? 9 * k : ph > 0.14 && ph < 0.2 ? 5 * k : 0;
    strobe.current?.color.setRGB(f, f, f);
  });
  return (
    <group ref={group} visible={false}>
      {NAV.map((n, i) => (
        <mesh key={i} position={n.at as unknown as [number, number, number]}>
          <sphereGeometry args={[0.03, 16, 16]} />
          <meshBasicMaterial ref={(m) => { mats.current[i] = m; }} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.21, -0.32]}>
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshBasicMaterial ref={strobe} toneMapped={false} color="black" />
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
  const satin = useContext(FinishCtx) === "satin";
  return (
    <group position={mid} rotation={rot}>
      <RoundedBox args={[0.11, 0.075, len]} radius={0.032} smoothness={6} castShadow>
        {satin ? <meshPhysicalMaterial {...SATIN_PART} /> : <meshPhysicalMaterial color={INK_2} metalness={0.35} roughness={0.38} clearcoat={0.7} clearcoatRoughness={0.2} />}
      </RoundedBox>
    </group>
  );
}

export function DroneModel({ drive, finish = "gloss" }: { drive: React.MutableRefObject<Drive>; finish?: Finish }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const blade = useBladeGeometry();
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
  useFrame(() => {
    const d = drive.current;
    if (root.current) { root.current.position.y = d.y; root.current.rotation.y = d.yaw; }
    if (body.current) { body.current.rotation.x = d.pitch; body.current.rotation.z = d.roll; }
  });
  const satin = finish === "satin";
  const hull = satin ? SATIN_HULL : ({ color: INK, metalness: 0.45, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.4 } as const);
  return (
    <FinishCtx.Provider value={finish}>
    <group ref={root} scale={SCALE}>
      <group ref={body}>
        {/* hull: a rounded core, a domed top cover and a rounded nose */}
        <RoundedBox args={[0.84, 0.26, 1.5]} radius={0.12} smoothness={8} castShadow>
          <meshPhysicalMaterial {...hull} />
        </RoundedBox>
        <mesh position={[0, 0.1, -0.06]} scale={[0.4, 0.1, 0.7]} castShadow>
          <sphereGeometry args={[1, 64, 32]} />
          <meshPhysicalMaterial {...hull} color={satin ? "#34373D" : "#16171D"} roughness={satin ? 0.44 : 0.18} />
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

        <NavLights drive={drive} />
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
                <Propeller dir={r.dir} drive={drive} blade={blade} />
              </group>
              {/* leg, down to the shared foot line */}
              <mesh position={[0, (FOOT_Y - r.at.y - 0.065) / 2 - 0.0325, 0]}>
                <cylinderGeometry args={[0.026, 0.034, Math.abs(FOOT_Y - r.at.y) - 0.065, 20]} />
                {satin ? <meshPhysicalMaterial {...SATIN_PART} /> : <meshPhysicalMaterial color={INK_2} metalness={0.3} roughness={0.45} />}
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
    </FinishCtx.Provider>
  );
}

/** The home pad: a low matte disc with a lighter inset. Light on the page, dark in the studio film, and a
 *  rubber grey on the film's garage floor, where the drone's shadow has to show on it. */
export function Pad({ tone = "light" }: { tone?: "light" | "dark" | "mid" }) {
  const [base, inset] = tone === "dark" ? ["#0E0F12", "#15171B"] : tone === "mid" ? ["#5B5F65", "#676B71"] : ["#E4E4E0", "#ECECE8"];
  return (
    <group position={[0, PAD_TOP - 0.02, 0]} scale={[SCALE, 1, SCALE]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[1.95, 2.0, 0.04, 96]} />
        <meshPhysicalMaterial color={base} roughness={tone === "dark" ? 0.55 : 0.8} metalness={tone === "dark" ? 0.2 : 0} envMapIntensity={tone === "dark" ? 0.12 : 1} />
      </mesh>
      <mesh position={[0, 0.021, 0]} receiveShadow>
        <cylinderGeometry args={[1.25, 1.25, 0.004, 96]} />
        <meshPhysicalMaterial color={inset} roughness={0.6} envMapIntensity={tone === "dark" ? 0.12 : 1} />
      </mesh>
    </group>
  );
}
