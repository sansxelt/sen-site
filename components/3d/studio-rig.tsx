"use client";

import { Environment, ContactShadows } from "@react-three/drei";

// Shared studio rig used by every product scene. drei's Environment
// uses a small built-in HDRI ("studio" preset) for realistic
// reflections on metal and glass without us hosting an .hdr asset.
// ContactShadows grounds each product on an invisible "table" so it
// stops feeling like a render and starts feeling like a photo of a
// physical object.
//
// Light setup is two key softboxes (warm-cool rim lighting) plus a
// gentle fill. Avoid colored emissive flood lights — those make
// hardware look toy-like and "AI render"-y.

type Props = {
  contactShadowOpacity?: number;
  contactShadowY?: number;
  contactShadowBlur?: number;
};

export function StudioRig({
  contactShadowOpacity = 0.5,
  contactShadowY = -1.2,
  contactShadowBlur = 2.4,
}: Props) {
  return (
    <>
      {/* Soft ambient fill */}
      <ambientLight intensity={0.18} />

      {/* Key light (warm-ish) */}
      <directionalLight
        position={[4, 6, 5]}
        intensity={1.1}
        color="#ffffff"
      />

      {/* Fill light (cool) */}
      <directionalLight
        position={[-5, 3, 4]}
        intensity={0.45}
        color="#aac4ff"
      />

      {/* Back rim for separation */}
      <directionalLight
        position={[0, 2, -5]}
        intensity={0.55}
        color="#e6e6ff"
      />

      <Environment preset="studio" environmentIntensity={0.45} />

      <ContactShadows
        position={[0, contactShadowY, 0]}
        opacity={contactShadowOpacity}
        scale={10}
        blur={contactShadowBlur}
        far={4}
        resolution={512}
        color="#000000"
      />
    </>
  );
}
