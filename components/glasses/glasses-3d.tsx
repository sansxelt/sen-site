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

    const wireFg  = new THREE.LineBasicMaterial({ color: 0xC7CDD7, transparent: true, opacity: 0.88 });
    const wireAcc = new THREE.LineBasicMaterial({ color: 0x5CE5D5, transparent: true, opacity: 0.92 });

    const glasses = new THREE.Group();

    function makeLensRing() {
      const geo = new THREE.TorusGeometry(1.25, 0.045, 8, 56);
      geo.scale(1, 0.82, 1);
      return new THREE.LineSegments(new THREE.WireframeGeometry(geo), wireFg);
    }

    function makeIris() {
      const segments = 56;
      const radius = 0.40;
      const points: THREE.Vector3[] = [];
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 0.6) / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a0) * radius, Math.sin(a0) * radius * 0.82, 0));
        points.push(new THREE.Vector3(Math.cos(a1) * radius, Math.sin(a1) * radius * 0.82, 0));
      }
      return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), wireAcc);
    }

    function makePupil() {
      return new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x5CE5D5 })
      );
    }

    function makeCameraRing(radiusX = 1.34, radiusY = 1.10) {
      const group = new THREE.Group();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.045, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xECEFF4 })
        );
        dot.position.set(Math.cos(a) * radiusX, Math.sin(a) * radiusY, 0.04);
        group.add(dot);
      }
      return group;
    }

    const leftLens = new THREE.Group();
    leftLens.add(makeLensRing(), makeIris(), makePupil(), makeCameraRing());
    leftLens.position.set(-1.55, 0, 0);

    const rightLens = leftLens.clone(true);
    rightLens.position.set(1.55, 0, 0);
    glasses.add(leftLens, rightLens);

    const bridge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1.4, 8),
      new THREE.MeshBasicMaterial({ color: 0xC7CDD7 })
    );
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.55, 0);
    glasses.add(bridge);

    function makeStem(sign: number) {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.025, 3.2, 8),
        new THREE.MeshBasicMaterial({ color: 0xC7CDD7 })
      );
      stem.rotation.x = Math.PI / 2;
      stem.rotation.z = sign * 0.07;
      stem.position.set(sign * 2.85, 0.1, -1.4);
      return stem;
    }
    glasses.add(makeStem(-1), makeStem(1));

    function makeMicPort(x: number) {
      const mp = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xFF3D5E })
      );
      mp.position.set(x, 0.1, -2.9);
      return mp;
    }
    glasses.add(makeMicPort(-2.85), makeMicPort(2.85));

    // Stem cameras — 3 dots per stem spaced along the length,
    // plus one at the very back end for 360° rear capture.
    function makeStemCameras(sign: number) {
      const group = new THREE.Group();
      const stemCamPositions = [
        { z: -0.6, y: 0.15 },
        { z: -1.4, y: 0.12 },
        { z: -2.1, y: 0.1  },
        { z: -2.9, y: 0.1  }, // rear-facing / back end
      ];
      for (const pos of stemCamPositions) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.045, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xECEFF4 })
        );
        dot.position.set(sign * 2.85, pos.y, pos.z);
        group.add(dot);
      }
      return group;
    }
    glasses.add(makeStemCameras(-1), makeStemCameras(1));

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
