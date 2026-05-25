"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export function Glasses3D({ bare = false }: { bare?: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;
    const width  = mount.clientWidth  || 600;
    const height = mount.clientHeight || 480;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    // ── materials ────────────────────────────────────────────────────────
    const mFrame  = new THREE.LineBasicMaterial({ color: 0xC7CDD7, transparent: true, opacity: 0.90 });
    const mInner  = new THREE.LineBasicMaterial({ color: 0xC7CDD7, transparent: true, opacity: 0.22 });
    const mGuide  = new THREE.LineBasicMaterial({ color: 0x5A6478, transparent: true, opacity: 0.30 });
    const mAcc    = new THREE.LineBasicMaterial({ color: 0x5CE5D5, transparent: true, opacity: 0.78 });

    const glasses = new THREE.Group();

    // ── lens shape: wide oval, realistic glasses proportions ─────────────
    const RX = 1.38, RY = 0.92;   // wider than tall — like actual frames

    function ellipsePts(rx: number, ry: number, n = 80): THREE.Vector3[] {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * rx, Math.sin(a) * ry, 0));
      }
      return pts;
    }

    function makeLens() {
      const g = new THREE.Group();
      // Outer frame
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ellipsePts(RX, RY)), mFrame));
      // Inner channel line (frame depth)
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ellipsePts(RX - 0.10, RY - 0.08)), mInner));
      // Iris (smart lens indicator — dashed teal ellipse)
      const irisPts: THREE.Vector3[] = [];
      const IR = 48, irx = 0.34, iry = 0.24;
      for (let i = 0; i < IR; i++) {
        const a0 = (i / IR) * Math.PI * 2;
        const a1 = ((i + 0.5) / IR) * Math.PI * 2;
        irisPts.push(new THREE.Vector3(Math.cos(a0) * irx, Math.sin(a0) * iry, 0));
        irisPts.push(new THREE.Vector3(Math.cos(a1) * irx, Math.sin(a1) * iry, 0));
      }
      g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(irisPts), mAcc));
      // Horizontal CAD guide through lens center
      g.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-RX - 0.18, 0, 0), new THREE.Vector3(RX + 0.18, 0, 0)]),
        mGuide
      ));
      // Vertical CAD guide
      g.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -RY - 0.18, 0), new THREE.Vector3(0, RY + 0.18, 0)]),
        mGuide
      ));
      return g;
    }

    // ── cameras on the frame — snapped exactly to the ellipse ───────────
    function makeCameraRing() {
      const g = new THREE.Group();
      // 8 cameras at evenly spaced angles, sitting ON the outer frame ellipse
      for (let i = 0; i < 8; i++) {
        const a   = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.044, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xDCE2EC })
        );
        dot.position.set(Math.cos(a) * RX, Math.sin(a) * RY, 0.02);
        g.add(dot);
      }
      return g;
    }

    const cx = 1.56;   // lens center x offset from origin
    const leftLens  = new THREE.Group();
    leftLens.add(makeLens(), makeCameraRing());
    leftLens.position.set(-cx, 0, 0);

    const rightLens = leftLens.clone(true);
    rightLens.position.set(cx, 0, 0);
    glasses.add(leftLens, rightLens);

    // ── nose bridge — curved arc ─────────────────────────────────────────
    const bridgePts: THREE.Vector3[] = [];
    const bw = 0.82;   // half-bridge width
    for (let i = 0; i <= 28; i++) {
      const s = i / 28;
      bridgePts.push(new THREE.Vector3(
        (s - 0.5) * bw * 2,
        0.52 + Math.sin(s * Math.PI) * 0.18,
        0
      ));
    }
    glasses.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bridgePts), mFrame));

    // stem x = outer lens edge — stem runs along Z from this x
    const stemX = cx + RX + 0.06;   // ≈ 3.00

    // ── temples (stems) — taper from front to back ───────────────────────
    function makeStem(sign: number) {
      const s = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.016, 3.4, 8),
        new THREE.MeshBasicMaterial({ color: 0xB8BEC8 })
      );
      s.rotation.x = Math.PI / 2;
      s.rotation.z = sign * 0.05;
      s.position.set(sign * stemX, 0.04, -1.7);
      return s;
    }
    glasses.add(makeStem(-1), makeStem(1));

    // ── stem cameras — 4 per temple + 1 rear, evenly spaced ─────────────
    function makeStemCams(sign: number) {
      const g  = new THREE.Group();
      const zs = [-0.45, -1.15, -1.90, -2.70, -3.25];  // 5 cams including rear
      for (const z of zs) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.040, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xDCE2EC })
        );
        dot.position.set(sign * stemX, 0.06, z);
        g.add(dot);
      }
      return g;
    }
    glasses.add(makeStemCams(-1), makeStemCams(1));

    // ── bone-conduction speaker ──────────────────────────────────────────
    function makeSpeaker(sign: number) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.068, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x5CE5D5 })
      );
      dot.position.set(sign * stemX, 0.06, -1.55);
      return dot;
    }
    glasses.add(makeSpeaker(-1), makeSpeaker(1));

    // ── pulsing arcs — inward toward each other ──────────────────────────
    const ARC_RADII = [0.16, 0.29, 0.43];
    const arcMats: THREE.LineBasicMaterial[] = [];

    function makeSoundArcs(sign: number) {
      const g = new THREE.Group();
      const sx = sign * stemX;
      for (const r of ARC_RADII) {
        const arcSpan = Math.PI * 0.42;
        const center  = sign > 0 ? Math.PI : 0;   // right→left, left→right
        const pts: THREE.Vector3[] = [];
        for (let j = 0; j <= 20; j++) {
          const a = center - arcSpan / 2 + (j / 20) * arcSpan;
          pts.push(new THREE.Vector3(sx + Math.cos(a) * r, 0.06 + Math.sin(a) * r, -1.55));
        }
        const mat = new THREE.LineBasicMaterial({ color: 0x5CE5D5, transparent: true, opacity: 0 });
        arcMats.push(mat);
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
      }
      return g;
    }
    glasses.add(makeSoundArcs(-1), makeSoundArcs(1));

    // ── ground grid ──────────────────────────────────────────────────────
    const grid = new THREE.GridHelper(12, 12, 0x5A6478, 0x3D4659);
    grid.position.y = -2.0;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.15;
    scene.add(grid, glasses);

    // ── animation loop ───────────────────────────────────────────────────
    let frameId: number, t = 0;
    const targetRot = { x: -0.06, y: 0 };
    const animate = () => {
      t += 0.006;
      targetRot.y = Math.sin(t) * 0.40;
      targetRot.x = -0.06 + Math.sin(t * 0.7) * 0.05;
      glasses.rotation.y += (targetRot.y - glasses.rotation.y) * 0.05;
      glasses.rotation.x += (targetRot.x - glasses.rotation.x) * 0.05;

      arcMats.forEach((mat, idx) => {
        const i     = idx % ARC_RADII.length;
        const phase = ((t * 1.2 - i * 0.35) % 1 + 1) % 1;
        mat.opacity = Math.sin(phase * Math.PI) * 0.72;
      });

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    // ── resize ───────────────────────────────────────────────────────────
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight || w * 0.8;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(onResize); ro.observe(mount); }
    else window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameId);
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return (
    <div style={{
      position: "relative", width: "100%",
      height: bare ? "100%" : undefined,
      aspectRatio: bare ? undefined : "5 / 4",
      background: bare ? "transparent" : "#0E1421",
      border: bare ? "none" : "1px solid rgba(199,205,215,0.10)",
      overflow: "hidden",
    }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      {!bare && (
        <>
          <div style={{ position: "absolute", top: 14, left: 14, fontFamily: "JetBrains Mono, monospace", fontSize: 11, letterSpacing: "0.05em", color: "#5A6478" }}>VRA·01 · CAD MODEL</div>
          <div style={{ position: "absolute", top: 14, right: 14, fontFamily: "JetBrains Mono, monospace", fontSize: 11, letterSpacing: "0.05em", color: "#5CE5D5", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#5CE5D5", boxShadow: "0 0 8px rgba(92,229,213,0.4)", display: "inline-block" }} />
            LIVE PREVIEW
          </div>
          <div style={{ position: "absolute", bottom: 14, left: 14, fontFamily: "JetBrains Mono, monospace", fontSize: 11, letterSpacing: "0.05em", color: "#5A6478" }}>rotation · auto-orbit</div>
          <div style={{ position: "absolute", bottom: 14, right: 14, fontFamily: "JetBrains Mono, monospace", fontSize: 11, letterSpacing: "0.05em", color: "#5A6478" }}>wireframe / phosphor</div>
        </>
      )}
    </div>
  );
}
