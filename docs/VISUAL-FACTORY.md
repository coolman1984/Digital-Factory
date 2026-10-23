# The visual factory: rendering, motion and asset pipeline

How Digital Factory makes its 3D and 2D pictures: the shared look system, the asset pipeline, the motion rules, the
performance policy, the quality gates and the measured results. It upgrades what was there; nothing was rebuilt from
scratch, and every page, project file and stored setting from before still works.

## What changed, in one paragraph

**New shared modules** (`assets/js/vfx/`):
- `look.js`: rendering profiles, the colour grade, toon and anime cel shading, outlines and depth of field.
- `materials.js`: a library of physically based materials.
- `perf.js`: adaptive quality on the measured frame interval, plus a `?perf=1` overlay.
- `presets.js`: GSAP animation presets driven by the page's own loop.
- `atmos.js`: light shafts and dust.

**Asset pipeline** (`tools/assets/`). It builds the QLED 65 in code, bakes ambient occlusion, adds tangents, compresses
with meshopt and writes a far level of detail. It then checks the result with the Khronos validator and our own asset
checks.

**New page:** `showroom.html`, with two studios:
- A. Product studio: studio light, contact shadows, six looks, a materials board and a path-traced still.
- C. Motion studio: PixiJS 8 on WebGPU or WebGL 2, with a hand-over from the 3D studio.

**Live plant (B):**
- The finish pass becomes the shared grade.
- The fly-through gets GSAP pacing, the cinematic grade, light shafts, dust and depth of field (only with headroom).
- Quality adapts on the real frame interval, and every pass is disposed when quality changes.

**Tooling:** a benchmark tool (`tools/bench/`) and a Windows check (`tools/checks/windows.mjs`).

## 1. What we studied, and what we took

| Repository | Licence | What it is | What we used | What we did not, and why |
|---|---|---|---|---|
| cesartevisual/threejs-skills | MIT | Agent skills for three.js: materials, lighting, post-processing, performance, product viewers, accessibility | Their rules became our standards (§5): one tone map and output conversion; data maps never sRGB; dispose owned passes and targets; measure before optimizing; equivalent HTML controls for every 3D action; a reduced-motion path | R3F and WebGPU node pipelines: our pages are plain three.js r170 on WebGL |
| playcanvas/skills | MIT | Agent skills for the PlayCanvas engine | Engine-neutral ideas: prove pixels with deterministic captures (our bench pins poses and quality); cut draw calls in order (hide, batch, instance); deliberate exposure before post | The engine itself: one renderer (three.js) for the 3D pages keeps one asset format and one look system |
| EL4CTEO/blender-skills | MIT | Agent skills for Blender: modelling, UV, baking, rigging, export, asset QA | The asset-QA checklist (real-world scale, origin on the floor, applied transforms, named parts, unit normals, UVs where textured, budgets), the bake-then-export order and the LOD rule | Blender is not installed in this environment; the TV is modelled in code with the same checks (§3). The skills still apply when a real Blender model arrives. |
| pixijs/pixijs-skills | MIT | Agent skills for PixiJS v8 | Application setup with a WebGPU preference and a WebGL fallback; `ParticleContainer` for sparks; built-in filters only (they run on both backends); `destroy({ releaseGlobalResources })`; text accessibility through HTML | Custom GLSL filters: they need a WGSL twin to run on WebGPU |
| gkjohnson/three-gpu-pathtracer | MIT | GPU path tracing for three.js | Release 0.0.23 (the last one on WebGL 2 for three r151+), bundled on demand, for the showroom's path-traced still | 0.0.24 and later need three r180+ and WebGPU; that is a core upgrade (§7) |
| donmccurdy/glTF-Transform | MIT | Read, edit, optimize and write glTF | The asset pipeline: document building, KHR material extensions, dedup, weld, MikkTSpace tangents, reorder, quantize, meshopt compression, simplify (LOD) | KTX2 texture compression: it needs the `toktx` binary (not available here), and our textures are small procedural PNGs (§3) |
| greensock/GSAP | GSAP Standard "no charge" licence | Animation timelines | Camera moves, shot timelines, the reel's typography; GSAP is driven from each page's own loop | Not used in a product that competes with Webflow's site builder (the one restriction in the licence) |
| playcanvas/supersplat | MIT | An editor for 3D Gaussian splats | Evaluated only | Plant EG-01 is fictional: there is no real place to capture. Splats cannot be edited per material, give no collision, and cannot carry the twin's per-machine state. Use them for a captured real site or product when a client supplies one, beside meshes, never instead of them |

## 2. The audit before the upgrade (baseline)

**Engines:**
- three.js r170, vendored and bundled once as `window.THREE`, for the live plant.
- Canvas 2D for the website hero, the command room's floor map and the 2D views.
- No GSAP, no PixiJS.

**Editor and timeline:**
- Plant Studio is a design layer edited by chat, by hand or by agents, with revisions and undo.
- The fly-through is a fixed CatmullRom spline at constant speed. There is no shot timeline.

**Materials and light:**
- MeshStandard and MeshPhysical with clearcoat.
- A PMREM environment made of light panels, a shadowed sun, GTAO, bloom, Neutral tone mapping.
- A cos⁴ vignette with dither, and a procedural epoxy floor.

**Assets:**
- Everything is procedural geometry. There are no GLB files and no asset checks.
- Textures are canvas textures.

**Measured on this machine (SwiftShader, so frame rates are relative only):**
- About 450 draw calls per frame.
- About 1.3 to 2.1 million triangles per frame at high quality, about twice the visible 0.9 M, because GTAO and the shadow map render the scene again.
- About 53 MB of JS heap.
- The heaviest single item is the instanced workers: about 148 k triangles.

**Gaps:**
- No depth of field, colour grading, stylized looks or GLB pipeline.
- Quality changes leaked their passes, because `EffectComposer.dispose()` frees only its own two targets.
- The adaptive-quality signal measured JavaScript time, not the frame interval, so a GPU-bound frame never stepped down.

## 3. The asset pipeline (`tools/assets/`)

```bash
cd tools/assets && npm i
node build-tv.mjs                        # writes assets/models/tv-qled65.glb, tv-qled65-lod1.glb, tv-qled65.build.json
node check-glb.mjs ../../assets/models/tv-qled65.glb
node check-glb.mjs ../../assets/models/tv-qled65-lod1.glb --max-tris 5000 --max-kb 100
```

| Step | What it does |
|---|---|
| Model | Hard-surface parts in metres, +Y up, front +Z, origin on the floor, every part named. Zero-area triangles are dropped. |
| Textures | Brushed-metal, fabric-weave and moulding-stipple normal maps and a roughness map, drawn in code (seeded, so the same build gives the same bytes). |
| Bake | Ambient occlusion per vertex: 48 cosine-weighted rays per vertex, 12 cm reach, against the whole model (three-mesh-bvh), stored in `COLOR_0`. Mean 0.76, minimum 0.35. |
| Materials | glTF PBR plus `KHR_materials_clearcoat` (screen glass), `_sheen` (speaker fabric), `_anisotropy` (brushed stand, anodised frame), `_ior`, `_emissive_strength` (status LED). |
| Optimize | dedup, unweld → MikkTSpace tangents → weld, reorder, quantize, `EXT_meshopt_compression`. |
| LOD | A far level simplified to 25 % (meshopt), with normal maps removed. The viewer streams it first, then swaps in the full model within 6 m. |
| Validate | The Khronos glTF validator reports 0 errors. Our checks also pass: scale, origin, names, finite positions, unit normals, no zero-area triangles, UVs where textured, a triangle budget and a size budget. |

**Results:**
- `tv-qled65.glb`: 7,618 triangles, 348 KB.
- `tv-qled65-lod1.glb`: 2,574 triangles, 41 KB.

**Texture compression:** KTX2/Basis is the right format once a model brings real photographic textures. It needs `toktx` (KTX-Software) in the pipeline, plus the Basis transcoder (about 600 KB) in the page.

**Rigging:** skeletal animation, morph targets and rigging come from Blender (see blender-skills). They are not used here.

## 4. Rendering profiles and art directions (`assets/js/vfx/look.js`)

Frame order: RenderPass → GTAO → edges → depth of field → bloom → OutputPass (tone map and sRGB, once) → grade
(linear-light grade, cos⁴ vignette, letterbox, ±1 LSB TPDF dither, opaque alpha).

| Profile | Grade | Vignette | Other |
|---|---|---|---|
| Realistic | neutral | 0.45 (0.75 dark) | default everywhere |
| Product | contrast 1.05, clean whites | 0.35 | depth of field on |
| Cinematic | contrast 1.1, saturation 0.9, warm highs, teal lift, exposure 0.82 | 0.75 | 2.39:1 letterbox; depth of field; the plant's fly-through |
| Toon | saturation 1.15 | 0.2 | 4 cel bands on the reflected light (emissive screens keep their picture), outlines |
| Anime | saturation 1.28, warm | 0.25 | 3 bands, rim light, ink outlines |
| Outlined | saturation 0.85 | 0.2 | realistic shading with edges from depth and normals |

**Cel shading** is a define (`DF_TOON`) on the same physically based materials. There are no duplicate materials.

**Outlines** are one extra scene pass, drawn with normals and depth. In the toon looks this pass replaces GTAO.

**Debug views:** `edge.uniforms.debug` = 1 shows the edge mask, and 2 shows view depth.

**Materials library** (`assets/js/vfx/materials.js`):
- brushed aluminium, anodised graphite, chrome, gold
- clear, frosted and tinted glass
- fabric, velvet
- matte and gloss plastic, car paint, rubber
- skin (wrapped diffuse and sheen), concrete, ceramic

## 5. Standards

**Colour:**
- Light in linear. Hex colours are sRGB and go through `THREE.Color`.
- Tone mapping is Khronos PBR Neutral, so the brand colours stay faithful. Apply it once, in OutputPass.
- The grade comes after it, in display-referred linear light.

**Textures:** base colour and emissive maps are sRGB. Normal, roughness, AO and metal maps are linear data.

**Assets:**
- Units in metres, +Y up, origin on the floor, named parts.
- Budgets: a hero product of 20 k triangles or less, and 600 KB or less; a far LOD of 5 k triangles or less.
- Every GLB passes `check-glb.mjs`.

**Motion:**
- One requestAnimationFrame per page. GSAP is detached (`DFMotion.drive()`) and advanced by that loop (`DFMotion.tick`).
- Ease-out curves, 1.4–1.6 s camera moves, 0.8–0.9 s entrances.
- With reduced motion, camera moves become cuts, the reel shows its final frame, and the sparks are off.

**Interaction:** every 3D action has an HTML control. Product studio keys: arrows, +, − and 0. Tabs: arrow keys.

**Text in canvases:**
- Arabic is set word by word, so the letters stay joined.
- It is wrapped in RLE…PDF so punctuation falls in place.
- Where Arabic meets Latin there is an em space, because fallback faces can run the two together.

## 6. Performance policy (`assets/js/vfx/perf.js`)

**The adaptive quality ladder** is driven by the frame interval, which includes GPU time:
- It steps down after 2 s above budget × 1.3, and back up after 10 s below budget × 0.75.
- It waits 3 s after each change while shaders compile.
- It does nothing while the tab is hidden or the viewer has chosen a level.

**Ladders:**
- Plant: high at 1.5 dpr → high at 1.25 → medium at 1.25 → medium at 1.0 → low. Phones stay at 1 dpr.
- Showroom: dpr 2 / MSAA 4 / GTAO → 1.5 → 1.25 without GTAO → 1 without MSAA or bloom. Phones start at 1.25.

**Disposal:** every quality or look change disposes every pass and its targets (`DFLook.disposeComposer`). Leaving the motion studio destroys the Pixi app with its global resources.

**Load on demand:**
- GSAP and the depth-of-field add-ons load with the plant's first fly-through.
- PixiJS (840 KB) loads only for the motion studio.
- The path tracer (208 KB) loads only for the still.
- The model streams far LOD first.

**Draw calls:** the plant was already instanced (338 meshes for 6,241 instances). The atmosphere adds 2 draw calls.

**Depth of field** renders the scene's depth once more, about a third more draw calls. In the plant it is on only at high quality with headroom (frame interval below 60 % of budget), or when chosen by hand.

**WebGPU:**
- PixiJS asks for WebGPU and falls back to WebGL 2.
- The three.js pages stay on WebGL 2. r170's EffectComposer, GTAO and the 0.0.23 path tracer are WebGL-only, and moving to `WebGPURenderer` means rewriting the post chain as node passes (§7).

**Measure on your own device:** add `?perf=1` to any 3D page. It shows fps, p50/p95, draw calls, triangles, GPU resources, heap, level and backend.

## 7. Benchmarks: before and after

**How:** `node tools/bench/bench.mjs` runs the same suite (`tools/bench/suite.json`): the same assets, poses, viewport sizes (1440×900 desktop, 390×844 at 2× mobile) and quality level, with a 5 s sample per pose.

**Before for each production:**

| Production | Before | After |
|---|---|---|
| A · Product studio | the same model and poses under the factory's earlier pipeline (`?pipeline=legacy`: generic room environment, no contact shadows, no studio rig, the old finish pass) | the new pipeline |
| B · Plant | `main` before this change | this change |
| C · Motion studio | the same reel on PixiJS's Canvas 2D renderer (`?pipeline=legacy`), which is the kind of renderer the factory used for 2D before; the website's canvas hero is also recorded | the WebGL/WebGPU reel |

**Machine:**
- Headless Chrome with SwiftShader (a software GPU) on 4 Xeon threads.
- Frame times there are 100–500× slower than on a real GPU, so they compare runs with each other and say nothing about 60 fps.
- Draw calls, triangles, programs, textures, heap, bytes and load time do not depend on the GPU.

| Production · device · pose | Draw calls | Triangles | Programs | Heap MB |
|---|---|---|---|---|
| A · desktop · hero | 105 → 107 | 138.6 k → 138.6 k | 28 → 29 | 9.8 → 9.8 |
| A · desktop · materials | 103 → 105 | 272.6 k → 272.6 k | 34 → 35 | 8.9 → 7.6 |
| A · mobile · hero | 105 → 107 | 138.6 k → 138.6 k | 29 → 29 | 11.3 → 10.7 |
| B · desktop · overview | 468 → 468 | 1.27 M → 1.27 M | 40 → 40 | 52.6 → 52.9 |
| B · desktop · close | 270 → 256 | 1.95 M → 2.07 M | 46 → 46 | 56.5 → 55.9 |
| B · desktop · fly-through, depth of field on (chosen by hand) | 452 → 613 | 1.98 M → 2.91 M | 46 → 52 | 58.9 → 53.7 |
| C · desktop · reel (Canvas 2D → WebGL 2) | 1 batch for 1,400 sparks | – | – | 10.7 → 13.1 (4.3 → 4.1 fps on SwiftShader) |
| C · mobile · reel (Canvas 2D → WebGL 2) | 1 batch for 700 sparks | – | – | 10.6 → 11.3 (5.6 → 7.3 fps on SwiftShader) |

**What this shows:**
- **A:** the studio rig, contact shadows (re-rendered only on change) and the grade cost 2 draw calls and 1 program for the visible gain in the comparisons below.
- **B:** the plant's normal views are unchanged in cost. The fly-through's extra cost is depth of field, which turns itself off without headroom. Load time fell from 37.7 s to 35.0 s on this machine, within noise.
- **C:** WebGL batches the reel's sparks into one draw and adds the glow and liquid filters the Canvas renderer cannot run. On SwiftShader it measured even with Canvas 2D at desktop size and 30 % faster at phone size; a real GPU is where batching shows most.

Raw reports are in `docs/bench/baseline.json` and `docs/bench/after.json`. Comparisons (before on the left, after on the right):

- `docs/bench/product-hero.jpg`, `docs/bench/product-stand.jpg`: rim light on the frame, contact shadows under the stand, the studio strips in the brushed metal.
- `docs/bench/plant-cinematic.jpg`: the letterbox, the grade, depth of field and haze in the fly-through.
- `docs/bench/motion-reel.jpg`: Canvas 2D without filters on the left, WebGL with glow and liquid displacement on the right.

## 8. Quality gates

```bash
node .claude/skills/web-design-pipeline/scripts/qa.mjs index.html app.html deck.html plant.html --theme-key df-theme
node .claude/skills/web-design-pipeline/scripts/qa.mjs showroom.html --theme-key df-theme
.claude/skills/impeccable/scripts/impeccable detect index.html app.html deck.html guide.html plant.html showroom.html assets/css
node tools/assets/check-glb.mjs assets/models/tv-qled65.glb          # from tools/assets after npm i
node tools/bench/bench.mjs --out .design-pipeline/bench/<name>       # then tools/bench/compare.mjs before.json after.json
node tools/checks/windows.mjs [--pwsh <path>]                        # NTFS names, case clashes, path length, portable scripts, UTF-8, the .ps1 parses
```

The reusable skill is `.claude/skills/visual-factory/SKILL.md`.

## 9. Limits, said plainly

**Not measured on real devices:**
- No frame rate here was measured on a real GPU, phone or tablet. Every number above comes from a software GPU.
- The 60 fps desktop and 30–60 fps mobile targets are not claimed. Measure them with `?perf=1` on the target devices.

**Not tested:**
- **WebGPU:** this environment has none. The PixiJS WebGPU path is the library's own, and only its WebGL fallback was exercised.
- **Windows:** no real Windows machine was used. The Windows checks are static, plus a parse of the PowerShell installer with PowerShell 7.4 on Linux.
- **Assistive technology:** no screen reader was tested. Keyboard paths and reduced motion were.

**Path tracing:**
- It converges in seconds on a desktop GPU (estimate). On this software GPU it reached 46 samples in about a minute.
- It uses a gradient sky and two area lights instead of the raster soft-box environment (PMREM cube maps are not path-traceable).

**Product and models:**
- The QLED 65 is fictional and modelled in code. There are no photo-scanned assets, no Blender models, no rigs and no splats.
- The pipeline accepts them when they come.

**Plant:** the plant's toon, anime and outlined looks exist as `Plant.V.setLook(id)`. Only the showroom exposes them in the interface.
