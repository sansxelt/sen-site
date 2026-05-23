// Glasses3D.jsx
// Three.js wireframe model of the Vraelis device.
// Replaces the static SVG schematic in the hero.
// Looks like a CAD model spinning slowly on a turntable.

function Glasses3D({ bare = false }) {
  const mountRef = React.useRef(null);

  React.useEffect(() => {
    if (!mountRef.current || typeof THREE === "undefined") return;
    const mount = mountRef.current;
    const width  = mount.clientWidth || 600;
    const height = mount.clientHeight || 480;

    // Scene + camera + renderer
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 13);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    // Materials
    const wireFg  = new THREE.LineBasicMaterial({ color: 0xC7CDD7, transparent: true, opacity: 0.88 });
    const wireAcc = new THREE.LineBasicMaterial({ color: 0x5CE5D5, transparent: true, opacity: 0.92 });
    const wireDim = new THREE.LineBasicMaterial({ color: 0x5A6478, transparent: true, opacity: 0.85 });

    // Glasses group
    const glasses = new THREE.Group();

    // Make a wireframe ring (one lens frame) from a torus
    function makeLensRing() {
      const geo = new THREE.TorusGeometry(1.25, 0.045, 8, 56);
      // Stretch slightly horizontally for the brand's lens shape
      geo.scale(1, 0.82, 1);
      return new THREE.LineSegments(new THREE.WireframeGeometry(geo), wireFg);
    }

    // Inner iris reticle — a dashed circle (faked with many short
    // segments), in the phosphor accent color
    function makeIris() {
      const segments = 56;
      const radius = 0.40;
      const points = [];
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 0.6) / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a0) * radius, Math.sin(a0) * radius * 0.82, 0));
        points.push(new THREE.Vector3(Math.cos(a1) * radius, Math.sin(a1) * radius * 0.82, 0));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.LineSegments(geo, wireAcc);
    }

    // Pupil dot — a small accent solid
    function makePupil() {
      const geo = new THREE.SphereGeometry(0.06, 12, 12);
      const mat = new THREE.MeshBasicMaterial({ color: 0x5CE5D5 });
      return new THREE.Mesh(geo, mat);
    }

    // 8-camera ring dots around each lens
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

    // Left + right lens assemblies
    const leftLens = new THREE.Group();
    leftLens.add(makeLensRing());
    leftLens.add(makeIris());
    leftLens.add(makePupil());
    leftLens.add(makeCameraRing());
    leftLens.position.set(-1.55, 0, 0);

    const rightLens = leftLens.clone(true);
    rightLens.position.set(1.55, 0, 0);

    glasses.add(leftLens, rightLens);

    // Bridge bar between lenses
    const bridge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1.4, 8),
      new THREE.MeshBasicMaterial({ color: 0xC7CDD7 })
    );
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.55, 0);
    glasses.add(bridge);

    // Stems — long thin cylinders extending backwards from each lens
    function makeStem(sign) {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.025, 3.2, 8),
        new THREE.MeshBasicMaterial({ color: 0xC7CDD7 })
      );
      stem.rotation.x = Math.PI / 2;
      stem.rotation.z = sign * 0.07;
      stem.position.set(sign * 2.85, 0.1, -1.4);
      return stem;
    }
    const leftStem  = makeStem(-1);
    const rightStem = makeStem(1);
    glasses.add(leftStem, rightStem);

    // Mic port indicators — tiny red spheres on temple ends
    function makeMicPort(x) {
      const mp = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xFF3D5E })
      );
      mp.position.set(x, 0.1, -2.9);
      return mp;
    }
    glasses.add(makeMicPort(-2.85), makeMicPort(2.85));

    // Faint ground reference grid below the model
    const gridSize = 10;
    const gridDiv  = 10;
    const grid = new THREE.GridHelper(gridSize, gridDiv, 0x5A6478, 0x3D4659);
    grid.position.y = -2.2;
    grid.material.transparent = true;
    grid.material.opacity = 0.18;
    scene.add(grid);

    scene.add(glasses);

    // Render loop — slow oscillating turntable
    let frameId;
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

    // Responsive resize
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight || w * 0.8;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(onResize);
      ro.observe(mount);
    } else {
      window.addEventListener("resize", onResize);
    }

    // Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: bare ? "100%" : undefined,
      aspectRatio: bare ? undefined : "5 / 4",
      background: bare ? "transparent" : "var(--bg-1)",
      border: bare ? "none" : "1px solid var(--line-2)",
      overflow: "hidden",
    }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {!bare && (<>
        <div style={{ position: "absolute", top: 14, left: 14, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.05em", color: "var(--fg-3)" }}>
          VRA·01 · CAD MODEL
        </div>
        <div style={{ position: "absolute", top: 14, right: 14, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.05em", color: "var(--acc)" }}>
          <span className="dot dot--acc" style={{ marginRight: 6, verticalAlign: "middle" }} />
          LIVE PREVIEW
        </div>
        <div style={{ position: "absolute", bottom: 14, left: 14, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.05em", color: "var(--fg-4)" }}>
          rotation · auto-orbit
        </div>
        <div style={{ position: "absolute", bottom: 14, right: 14, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.05em", color: "var(--fg-4)" }}>
          wireframe / phosphor
        </div>
      </>)}
    </div>
  );
}

Object.assign(window, { Glasses3D });
