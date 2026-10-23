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

## 10. Applied to the whole plant (Plant EG-01)

The look system and the material standards now run across the live plant:

**The floor's traffic system:**
- yellow-edged vehicle lanes on every aisle;
- green walkways with walking symbols every 14 m (none in the forklift-only rack aisles);
- box junctions with zebra crossings on every arm;
- yellow-black hazard hatching on the dock and door aprons.

The hatching is a box-filtered world-space shader (`DFShaders.hazard`). Everything else is merged static geometry: one draw call per paint colour, plus one for the instanced symbols.

**The building:**
- Ribbed insulated cladding runs to the eaves, with a clerestory band (`DFShaders.cladding`: normal-perturbed ribs that fade before they alias, panel joints, a per-panel tint).
- Door heads sit at 4.6 m.
- Each side is one mesh. A side whose outside faces the camera is cut away (doll's-house view), and all four stand while walking.

**People and materials:**
- Fabric uniforms with sheen; skin with wrapped diffuse, in seven tones fixed per person.
- Brushed (anisotropic) aluminium.

**Problems and fixes** (`assets/js/plant/problems.js`). It reads `P.recs` and never writes to the plant.

| Signal | How it shows |
|---|---|
| Problem | A pulsing ring at the machine or store; red when critical, amber for a warning. A column of light marks it from the overview and steps back while walking. |
| Cause → effect | A dashed arc from the cause to where it lands, from the recommendation's new display-only `links` field. Examples: an empty source to the station that will starve; a stopped SMD machine to the PBA lane to each main line. |
| Fix on its way | A green route for technicians walking to a stopped machine and for AGVs on a hot or expedited run. A green ring turns around a machine under repair. |
| Solved | A green ring opens once where a problem cleared. |

Additive light on the dark theme, painted marks on the light theme. Shown with the Status and Flow overlays.

**Cost:** a few draw calls for the rings and columns, one per arc or route (usually under 10), and the walls (4 meshes).

The measured before and after for the plant is in `docs/bench/world-before.json` and `docs/bench/world-after.json`.

Measured on the same machine, at high quality, at the same poses (SwiftShader):

| Pose | Draw calls | Triangles | Programs |
|---|---|---|---|
| desktop · overview | 468 → 485 (+4 %) | 1.27 M → 1.33 M | 40 → 48 |
| desktop · mid | 422 → 424 | 2.09 M → 1.77 M | 46 → 54 |
| desktop · close | 256 → 302 | 2.07 M → 2.04 M | 46 → 54 |
| mobile · overview, high forced | 354 → 401 (+13 %) | 0.84 M → 0.97 M | 57 → 73 |

Phones start at the low level, which has no GTAO and no shadows, so the forced-high mobile row is the worst case.

The floor paint does not cast shadows. The 8 new programs are the new materials: fabric, skin, anisotropic aluminium, cladding, hazard paint, markings, the problem column and the arcs.

**Comparison images:**
- `docs/bench/world-overview.jpg`, `world-mid.jpg`, `world-close.jpg`: before and after, side by side.
- `world-traffic.jpg`, `world-dock.jpg`: the floor.
- `world-problems-dark.jpg`, `world-problems-fix.jpg`: problems, arcs and repairs.


## 11. Machines in real detail, picture modes and the presentation

The goal of this pass: take the plant from a clean 3D mock-up to a lived-in, working plant that holds up in a client
meeting, without leaving the browser budget.

**Finishes** (`DFShaders.surface`, world space, so merged and instanced geometry needs no UVs):

| Finish | On | What it adds |
|---|---|---|
| `powder` | machine paint, frames, racks, steel beams, vehicles, robots, totes | orange-peel stipple in the normal (only close up, faded by pixel footprint), gloss that drifts from panel to panel, handling marks at waist height |
| `brushed` | steel, aluminium | a long grain along the face in the roughness |
| `cast` | cast and dark parts, plastics | a dull grain |
| `rubber` | belts, tyres, mats | a dull stipple |
| all | every finish above, and glass | grime and a contact shade in the last 30 cm above any floor (the ground, the deck and the mezzanines, at 5.4 m); smudged, dustier glass near the floor |

The floor also gets **pools of light** under the high-bay lamps (stronger on the dark theme). A **contact shadow**
(a soft rounded rectangle, one merged mesh) sits under every machine and rack, and travels with every vehicle.

**Detail kit** (merged static geometry, skipped on low-power devices):
- a decal sheet drawn in code: ISO 7010-style warnings, mandatory, fire, first-aid, exit and no-entry signs, a rating plate, a QR asset tag, a barcode, the AIR and 400 V labels, floor arrows;
- on every cabinet: door seams and handles, the rating plate and asset tag, the electrical warning by the vents, an emergency stop beside the screen;
- on the big machines (injection, presses, ovens, reflow, cushion): panelled enclosures with handles and vents, crush and hot-surface warnings, the mould water circuits;
- cable chains over the moving heads; a power conduit down from the cable tray and a blue compressed-air drop with its filter-regulator behind every pneumatic machine;
- welded-mesh guarding on yellow posts (`DFShaders.mesh`: a box-filtered wire grid as alpha, a fine grid close up and a light tint from across the hall) round the robot cells and the palletiser;
- parts totes on the assembly stations' shelves and at each hand, with the work-instruction signs.

**Robots:** a cast base, a yellow turret, joint housings with their servo motors, rounded links and a vacuum gripper
held level by the wrist. The cycle runs in joint space (pick, dwell, lift, traverse, place, dwell, return) with
smootherstep easing, so each move accelerates and decelerates; the cycle clock only runs while the machine runs, so a
stopped robot holds its pose.

**People:** a torso wider than it is deep, hands at the end of each swinging arm and safety shoes under each leg.

**The building:** a yellow-black guard at the foot of every column, extinguisher points and PPE signs on alternate
columns, distribution boards with a conduit to the roof on the outer wall, the red sprinkler main with its heads and
the blue air ring under every truss line, exit signs over the doors, direction arrows on every vehicle lane.

**Picture modes** (`V.setMode`, the picture button): Ultra (device pixels up to 2, finer GTAO, haze in the light, depth
of field in the presentation, focused on the subject with an aperture that shrinks with distance), Standard (the
governor, high to low) and Light (low). The governor never climbs into Ultra on its own (`top` in `DFPerf.governor`).

**Presentation** (`assets/js/plant/present.js`): full screen, the cinematic grade, nine hero shots built from where the
stations stand (overview, SMD, robot cell, injection, press, main line at eye level, aging, shipping, and the most
urgent live problem with its cause and fix), each easing in then drifting under a lower-third caption. Keyboard and
buttons step, pause and leave; reduced motion turns the moves into cuts. It only moves the camera.

**Measured** (`docs/bench/machines-before.json` → `machines-after.json`; same machine, SwiftShader, high quality forced,
the same poses):

| Pose | Draw calls | Triangles drawn | Programs |
|---|---|---|---|
| desktop · overview | 485 → 537 (+11 %) | 1.33 M → 1.52 M (+15 %) | 48 → 63 |
| desktop · mid | 424 → 400 | 1.77 M → 1.56 M | 54 → 69 |
| desktop · close | 302 → 288 | 2.04 M → 2.05 M | 54 → 69 |
| desktop · cinematic | 541 → 558 | 2.94 M → 3.38 M | 60 → 75 |
| mobile · overview, high forced | 401 → 481 (+20 %) | 0.97 M → 1.12 M | 73 → 99 |

- The scene's own geometry grew from 0.93 M to 1.07 M triangles (+15 %); the detail kit is merged by material, so it adds about one draw call per new material.
- Small parts (handles, e-stop boxes, totes, filter bowls) are plain boxes and low-segment cylinders; rounded edges stay on the bodies, where the light shows them.
- Phones (the low-power path) skip the whole detail kit and start at the Light level.
- The new programs are the finishes and the new materials (decals, mesh, contact shadow, robot paint, e-stop, air, sprinkler, totes). They raised the time to the first frame on SwiftShader by about half, because a software GPU compiles shaders on the CPU; a real GPU compiles them in a fraction of that. Read the start-up time on a real device with `?perf=1`.
- A trial of `renderer.compileAsync` before the first frame doubled the programs (48 → 104) and was taken out.
- Instead the first frame is **progressive**: the plant appears over its first sixteen frames, a slice of objects at a time (they wait on a camera layer nothing draws), without the post-processing until it is all there. The shaders compile in small steps between frames, so the page answers input while the plant builds instead of freezing in one long stall.
- Switching the theme no longer recompiles the machine materials (the x-ray switch only marks a material for recompile when its transparency really changes).
- The design pipeline's QA probe has a 30 s budget per step. On this container's software GPU, `plant.html` at 1440 px misses it on `main` too (measured before this change); a 150 s budget did not help, while a direct browser test at 1440 px answers between frames throughout. The plant was gated at 390 and 820 px (0 FAIL) and checked at 1440 px for script errors in English, Arabic and admin mode (none); see `docs/ALLOWANCES.md`.
- SwiftShader frame times swing by tens of percent between runs of the same build; they are not a frame rate.

**Comparison images:** `docs/bench/machines-overview.jpg`, `machines-mid.jpg`, `machines-close.jpg` (before | after);
`present-smd.jpg`, `present-robot.jpg`, `present-injection.jpg`, `present-main.jpg` (presentation shots in Ultra).
