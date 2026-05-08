"use client";

import { EffectComposer, Bloom, Vignette, ChromaticAberration, Noise } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { Vector2 } from "three";
import { useMemo } from "react";

// Cinematic post-processing stack used by every hero scene. Reads as
// "shot on film", not "rendered in browser":
//
//   Bloom            tight threshold so only LEDs and gold contacts
//                    bloom, not the whole scene
//   Vignette         soft darkening at the edges, anchors the eye
//   Chromatic ab.    very subtle — adds the lens-realism cue without
//                    looking glitchy
//   Noise            barely-visible film grain, breaks up the perfect
//                    digital surface
//
// Three intensity presets:
//   "atmospheric" — orbit/architecture: heavier bloom, softer vignette
//   "product"     — single-product close-ups: tight bloom on highlights
//   "macro"       — extreme close-ups: minimal effects so detail reads

type Intensity = "atmospheric" | "product" | "macro";

type Props = { intensity?: Intensity };

const PRESETS: Record<Intensity, {
  bloomIntensity: number;
  bloomLuminanceThreshold: number;
  bloomLuminanceSmoothing: number;
  vignetteOffset: number;
  vignetteDarkness: number;
  chromaticOffset: number;
  noiseOpacity: number;
}> = {
  atmospheric: {
    bloomIntensity: 1.4,
    bloomLuminanceThreshold: 0.55,
    bloomLuminanceSmoothing: 0.5,
    vignetteOffset: 0.30,
    vignetteDarkness: 0.85,
    chromaticOffset: 0.0008,
    noiseOpacity: 0.06,
  },
  product: {
    bloomIntensity: 1.1,
    bloomLuminanceThreshold: 0.65,
    bloomLuminanceSmoothing: 0.4,
    vignetteOffset: 0.25,
    vignetteDarkness: 0.75,
    chromaticOffset: 0.0006,
    noiseOpacity: 0.05,
  },
  macro: {
    bloomIntensity: 0.7,
    bloomLuminanceThreshold: 0.75,
    bloomLuminanceSmoothing: 0.3,
    vignetteOffset: 0.20,
    vignetteDarkness: 0.55,
    chromaticOffset: 0.0004,
    noiseOpacity: 0.04,
  },
};

export function CinematicEffects({ intensity = "product" }: Props) {
  const p = PRESETS[intensity];
  const chromatic = useMemo(() => new Vector2(p.chromaticOffset, p.chromaticOffset), [p.chromaticOffset]);

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={p.bloomIntensity}
        luminanceThreshold={p.bloomLuminanceThreshold}
        luminanceSmoothing={p.bloomLuminanceSmoothing}
        mipmapBlur
      />
      <ChromaticAberration
        offset={chromatic}
        radialModulation={false}
        modulationOffset={0}
      />
      <Vignette
        offset={p.vignetteOffset}
        darkness={p.vignetteDarkness}
        blendFunction={BlendFunction.NORMAL}
      />
      <Noise
        opacity={p.noiseOpacity}
        blendFunction={BlendFunction.OVERLAY}
      />
    </EffectComposer>
  );
}
