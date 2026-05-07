Drop authored CAD-quality GLBs here.

Expected files (procedural fallback used until each appears):
  lens-v1.glb            — transparent contact lens, electronics ring, reticle
  lens-case-v1.glb       — chamfered case body + lid, charging wells
  whisper-v1.glb         — earbud stem, dome, grille, mic ring
  workshop-tablet-v1.glb — anchored tablet device, bezel, stand

Authoring guidelines:
  - Real-world scale, units in metres. Lens body ~14mm diameter.
  - Origin at the geometric centre, +Y up.
  - Embed PBR materials (baseColor / roughness / metalness / normal).
    The loader will coerce StandardMaterial into PhysicalMaterial and
    add clearcoat 0.6 / clearcoatRoughness 0.18 for studio consistency.
  - Compress with Draco or meshopt; <500 KB per asset is the budget.
  - No baked lighting; rely on the StudioRig (HDRI + soft area lights).

Loader: components/3d/use-gltf-or-fallback.tsx
