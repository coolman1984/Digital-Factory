# Blender: how we use it

Record started 2026-10-29. Owner request: use Blender to bring the plant's graphics up to a professional
standard, starting with one machine. First subject: the SMD placement machine (Mounter B, line SMD-4).
Read `VISION_3D_AND_MOTION.md` and `EXPERIMENT_FIRST_INDUSTRIAL_SCENE.md` first.

## Status

| Item | State | Evidence |
|---|---|---|
| Blender in the cloud session | **Works** | `pip install bpy==5.2.3` (Blender 5.2.3 LTS as a Python module, from PyPI). Cycles on the CPU, OpenImageDenoise, AgX. `download.blender.org` is blocked by the session's network policy; PyPI is not. |
| Blender on the owner's PC | **Not connected** | No Remote Control folder was shared with the session. The vendored Blender MCP add-on (Animation repo, `studio/toolkit/blender-mcp`) is still unverified there. |
| Mounter B, built from code | **Implemented** | `tools/blender/mounter.py`: 40 named parts in 14 assemblies, about 0.4 M triangles after bevels. |
| Assembled, exploded, X-ray, cutaway stills | **Rendered** | 1920x1200, 128 samples, Cycles CPU, 4 cores. Not committed (renders are outputs); the commands below rebuild them. |
| Bilingual callouts | **Implemented** | `tools/blender/label.py`, anchored to each part's projected position. |
| Working motion, film, browser GLB in the plant | **Planned** | The part manifest and the gantry/head transforms are ready for animation and glTF export (`--glb`). Not yet exported, checked with `check-glb.mjs` or shown in `plant.html`. |

## Commands

```bash
python3 -m venv ~/.venvs/bpy && ~/.venvs/bpy/bin/pip install bpy==5.2.3      # about 400 MB, once
P=~/.venvs/bpy/bin/python
$P tools/blender/mounter.py --state assembled --samples 128 --res 1920x1200 --out out/assembled.png --anchors out/assembled.json
$P tools/blender/mounter.py --state exploded  ...      # also: ghost, cut; --shot hero|wide|head|top
$P tools/blender/mounter.py --manifest out/parts.json --blend out/mounter.blend --glb out/mounter.glb
python3 tools/blender/label.py out/assembled.png out/assembled.json out/assembled-labelled.jpg   # Pillow with raqm
```

On a desktop Blender: `blender -b -P tools/blender/mounter.py -- --state cut --out cut.png`.
A quick look: `--samples 16 --res 800x500` renders in about 15 s here.

## How the asset is built (the rules we follow)

- **One asset, many outputs.** Every component is an object named `MNT.<assembly>.<part>` with custom properties
  `part_id`, `role`, `explode` (an offset vector), `source` and `shell`. Assemblies are empties; exploding moves the
  empties, so the assembled transforms are never lost and reassembly is exact. The manifest (`--manifest`) lists them.
- **Motion lives on transforms.** The gantry's Y position and the head's X position are their assemblies' locations, so
  an animation or the live plant can drive them without touching geometry.
- **Hard-surface look.** Every part gets a Bevel modifier (angle limit 32 degrees, 2 to 3 segments, harden normals) and a
  Weighted Normal modifier (keep sharp). Edges sharper than 32 degrees are marked sharp in bmesh, faces are smooth: flat
  panels stay crisp, cylinders shade round, and every edge catches a highlight. Real panel gaps (4 mm) instead of painted seams.
- **Materials.** Principled BSDF with physical values: metals metallic 1 and roughness 0.12 to 0.38 (anisotropy on
  brushed aluminium), powder-coat paint with a micro-noise bump and a slight coat, glass by transmission. Base colours are
  written as sRGB hex and converted to linear once (`srgb()`).
- **Glass does not cast shadows** (`visible_shadow = False`): Cycles does not trace caustics through glass by default,
  so a glass hood would otherwise darken everything under it.
- **X-ray view.** Shell parts switch to a transparent shader with a fresnel (Layer Weight, facing) edge glow in brand
  blue. Transparent BSDF, not refraction, so nothing is distorted or sorted wrongly.
- **Cutaway.** A Boolean modifier (Exact solver, difference) with `material_mode = 'TRANSFER'`: the cut faces take the
  cutter's red-orange section material, so the section reads as solid caps. Only shells are cut; the internals stay whole.
  Clipping alone would leave hollow skins (the forum lesson in the research below).
- **Studio.** A curved cyclorama, a large key softbox front-left, a broad dim fill, two rims behind and a top strip for a
  long highlight on the glass; AgX with the Medium High Contrast look; depth of field at f/11 (f/5.6 for close-ups).
- **Determinism.** A seeded generator places the board's components, so the same command gives the same scene.

## Pitfalls met (Blender 5.2)

- `bpy.types.RenderSettings` enum listings come back as `['NONE']` in the module build; setting values directly works
  (`engine = 'CYCLES'`, `view_transform = 'AgX'`, `look = 'AgX - Medium High Contrast'`; the look name keeps the prefix).
- `Material.use_nodes` and `World.use_nodes` print a deprecation warning for Blender 6.0; they still work in 5.2.
- Boolean solvers in 5.2: `FLOAT`, `EXACT`, `MANIFOLD`. `EXACT` is the safe choice for multi-part shells.
- `CUEW initialization failed` is harmless: there is no GPU in the session.

## Research (2026-10-29)

Sources found and what we took from them. `developer.blender.org` is not reachable from this session, so API changes were
checked by probing the installed 5.2.3 build.

- Blender API, Bevel modifier (`limit_method`, `harden_normals`, version differences):
  [5.1](https://docs.blender.org/api/5.1/bpy.types.BevelModifier.html), [5.3](https://docs.blender.org/api/5.3/bpy.types.BevelModifier.html).
- Weighted normals as the last step after bevels and booleans: [Weighted Normals node](https://superhivemarket.com/products/weighted-normals-node).
- Cutaway methods (boolean vs shader, section caps, animated section boxes):
  [Section Pro](https://blenderartists.org/t/section-pro-floor-plans-technical-drawings-dxf-export-for-blender/1646788),
  [RadCut](https://superhivemarket.com/products/radcut--cutaway--cross-section-renders),
  [assembly cutaway thread](https://blenderartists.org/t/cross-section-cutoff-animation-of-an-assembly/656980) (the section must be modelled).
- Lighting: three-point with a weaker fill (about half the key), large sources for soft shadows, softbox shapes for
  believable reflections: [lighting fundamentals](https://uhiyama-lab.com/en/notes/blender/lighting-fundamentals-realistic-light/),
  [One-Click 3-Point](https://superhivemarket.com/products/one-click-3-point-studio-lighting).
- Headless Cycles: use enough samples (very low counts produce artefacts) and OIDN:
  [nixpkgs render test](https://code.ornl.gov/nix/nixpkgs/-/commit/0c101e7a04f04ee97aa273f59a67284322d6f535),
  [Cycles operators 5.0](https://docs.blender.org/api/5.0/bpy.ops.cycles.html).
- Blender 5.0 API breaks (bpy.props storage, private bundled modules, BGL removed):
  [5.0 Python API notes](https://developer.blender.org/docs/release_notes/5.0/python_api/), [5.0 release](https://www.blender.org/download/releases/5-0/).
- Machine anatomy (gantry, multi-nozzle head with Z and theta, feeders, fiducial and component cameras, conveyor):
  [Pick-and-place machine](https://en.wikipedia.org/wiki/Pick-and-place_machine), [Component placement](https://en.wikipedia.org/wiki/Component_placement).
- Agent skills for Blender (third-party, **not installed**; read the code before adopting any):
  [blender-mcp skill (vladmdgolam)](https://claudemarketplaces.com/skills/vladmdgolam/agent-skills/blender-mcp) (headless glTF export;
  warns that MCP export calls time out and procedural materials vanish in glTF),
  [blender-skills pack](https://skillsllm.com/skill/blender-skills), [overview](https://skillselion.com/guides/best-blender-skills-for-claude-code).
  The procedural-materials warning matters here: our noise bumps will not survive glTF; the browser path needs baked maps.

## Next

1. Connect the owner's PC (Remote Control) and run the same script in his Blender, GPU rendering, then try Blender MCP.
2. Working motion: the gantry and head moving through a pick-and-place cycle, nozzles dropping, the board advancing.
3. A short film (Animation repo, house method) and the browser GLB (baked textures, `check-glb.mjs`, the far LOD) in `plant.html`.
