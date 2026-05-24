"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export function Glasses3D({ bare = false }: { bare?: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;
    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 480;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 13);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    const matFg    = new THREE.LineBasicMaterial({ color: 0xC7CDD7, transparent: true, opacity: 0.88 });
    const matFgDim = new THREE.LineBasicMaterial({ color: 0xC7CDD7, transparent: true, opacity: 0.25 });
    const matAcc   = new THREE.LineBasicMaterial({ color: 0x5CE5D5, transparent: true, opacity: 0.80 });

    const glasses = new THREE.Group();

    // Smooth elliptical lens outline — looks like actual glasses
    function makeLensRing() {
      const rx = 1.28, ry = 1.02;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 80; i++) {
        const a = (i / 80) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * rx, Math.sin(a) * ry, 0));
      }
      return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), matFg);
    }

    // Inner frame rim for depth
    function makeLensInner() {
      const rx = 1.16, ry = 0.92;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 80; i++) {
        const a = (i / 80) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * rx, Math.sin(a) * ry, 0));
      }
      return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), matFgDim);
    }

    // Dashed iris — smart-lens indicator
    function makeIris() {
      const segs = 48;
      const rx = 0.36, ry = 0.28;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2;
        const a1 = ((i + 0.52) / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a0) * rx, Math.sin(a0) * ry, 0));
        pts.push(new THREE.Vector3(Math.cos(a1) * rx, Math.sin(a1) * ry, 0));
      }
      return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), matAcc);
    }

    // Camera dots sitting on the outer frame edge
    function makeCameraRing() {
      const group = new THREE.Group();
      const rx = 1.34, ry = 1.08;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.042, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xECEFF4 })
        );
        dot.position.set(Math.cos(a) * rx, Math.sin(a) * ry, 0.02);
        group.add(dot);
      }
      return group;
    }

    const leftLens = new THREE.Group();
    leftLens.add(makeLensRing(), makeLensInner(), makeIris(), makeCameraRing());
    leftLens.position.set(-1.52, 0, 0);

    const rightLens = leftLens.clone(true);
    rightLens.position.set(1.52, 0, 0);
    glasses.add(leftLens, rightLens);

    // Curved nose bridge
    const bridgePts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const s = i / 24;
      const x = (s - 0.5) * 1.08;
      const y = 0.56 + Math.sin(s * Math.PI) * 0.14;
      bridgePts.push(new THREE.Vector3(x, y, 0));
    }
    glasses.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bridgePts), matFg));

    // Stems
    function makeStem(sign: number) {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.030, 0.020, 3.2, 8),
        new THREE.MeshBasicMaterial({ color: 0xC7CDD7 })
      );
      stem.rotation.x = Math.PI / 2;
      stem.rotation.z = sign * 0.06;
      stem.position.set(sign * 2.85, 0.08, -1.4);
      return stem;
    }
    glasses.add(makeStem(-1), makeStem(1));

    // Stem cameras — 4 white dots along each arm including rear
    function makeStemCameras(sign: number) {
      const group = new THREE.Group();
      const positions = [
        { z: -0.6, y: 0.13 },
        { z: -1.4, y: 0.10 },
        { z: -2.1, y: 0.08 },
        { z: -2.9, y: 0.08 },
      ];
      for (const pos of positions) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.042, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xECEFF4 })
        );
        dot.position.set(sign * 2.85, pos.y, pos.z);
        group.add(dot);
      }
      return group;
    }
    glasses.add(makeStemCameras(-1), makeStemCameras(1));

    // Bone-conduction speaker dot
    function makeSpeaker(sign: number) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x5CE5D5 })
      );
      dot.position.set(sign * 2.85, 0.08, -1.5);
      return dot;
    }
    glasses.add(makeSpeaker(-1), makeSpeaker(1));

    // Pulsing arcs pointing DOWNWARD from speaker — toward the ear/skull
    const ARC_RADII = [0.17, 0.30, 0.45];
    const arcMats: THREE.LineBasicMaterial[] = [];

    function makeSoundArcs(sign: number) {
      const group = new THREE.Group();
      for (let i = 0; i < ARC_RADII.length; i++) {
        const r = ARC_RADII[i];
        const arcSpan = Math.PI * 0.45;
        const pts: THREE.Vector3[] = [];
        for (let j = 0; j <= 20; j++) {
          // Point straight down toward the ear/skull
          const a = -Math.PI / 2 - arcSpan / 2 + (j / 20) * arcSpan;
          pts.push(new THREE.Vector3(
            sign * 2.85 + Math.cos(a) * r,
            0.08 + Math.sin(a) * r,
            -1.5
          ));
        }
        const mat = new THREE.LineBasicMaterial({ color: 0x5CE5D5, transparent: true, opacity: 0 });
        arcMats.push(mat);
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
      }
      return group;
    }
    glasses.add(makeSoundArcs(-1), makeSoundArcs(1));

    const grid = new THREE.GridHelper(10, 10, 0x5A6478, 0x3D4659);
    grid.position.y = -2.2;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.18;
    scene.add(grid, glasses);

    let frameId: number;
    let t = 0;
    const targetRot = { x: -0.08, y: 0 };
    const animate = () => {
      t += 0.006;
      targetRot.y = Math.sin(t) * 0.45;
      targetRot.x = -0.08 + Math.sin(t * 0.7) * 0.06;
      glasses.rotation.y += (targetRot.y - glasses.rotation.y) * 0.05;
      glasses.rotation.x += (targetRot.x - glasses.rotation.x) * 0.05;

      arcMats.forEach((mat, idx) => {
        const i = idx % ARC_RADII.length;
        const phase = ((t * 1.2 - i * 0.35) % 1 + 1) % 1;
        mat.opacity = Math.sin(phase * Math.PI) * 0.7;
      });

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight || w * 0.8;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(onResize);
      ro.observe(mount);
    } else {
      window.addEventListener("resize", onResize);
    }

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
      position: "relative",
      width: "100%",
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
