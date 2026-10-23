---
name: visual-factory
description: >-
  How Digital Factory makes 3D and 2D pictures: three.js r170 pages with the shared look system (assets/js/vfx), the
  GLB asset pipeline (tools/assets), PixiJS 8 motion graphics, GSAP motion driven by the page loop, adaptive quality and
  the benchmark and asset gates. Use for any change to a 3D scene, a material, a light, post-processing, a camera move,
  an animation, a 2D motion piece, a model or texture, or to rendering performance on showroom.html or plant.html.
---

# Visual factory

Read `docs/VISUAL-FACTORY.md` first: it records the standards, the profiles, the ladders, the measured baseline and
the limits. These are the working rules.

## Before changing anything
1. Run the benchmark on the pages you will touch and keep the report: `node tools/bench/bench.mjs --only <production> --out .design-pipeline/bench/before-<topic>`.
2. Take screenshots at the suite's poses. They are part of the bench output.

## Rules
- **One renderer per page and one loop.**
  - three.js r170 (`window.THREE`). Add-ons load on demand from `assets/vendor/three/three-extras.iife.min.js` (GLTFLoader, MeshoptDecoder, BokehPass, the blur shaders) through `DFLook.extras()`.
  - Never add a second copy of three.js.
  - GSAP never owns the clock: call `DFMotion.drive()` once and `DFMotion.tick(now)` from the page's requestAnimationFrame (or the Pixi ticker).
- **The look is data.** Add or change a profile in `DFLook.PROFILES`; do not hand-tune passes per page.
  - Frame order: RenderPass → GTAO → edges → DOF → bloom → OutputPass → `DFLook.gradePass`.
  - Tone map once (Neutral). The grade's output is opaque.
- **Materials come from `DFMaterials`** or follow its values: albedo in linear 0.04–0.85, metals with no diffuse, layers only where the surface has them. Mark colour maps sRGB and data maps linear.
- **Stylized looks are switches** on the same materials (`DFLook.setToon`) plus `DFLook.edgePass`. Never duplicate materials or meshes for a look.
- **Assets go through the pipeline:**
  - Build or convert in `tools/assets/`.
  - `check-glb.mjs` must PASS: Khronos validator 0 errors, metres, origin on the floor, named parts, unit normals, UVs where textured, within budget.
  - Ship a far LOD and stream it first.
- **Performance:**
  - Change quality only through the governor ladder (`DFPerf.governor`).
  - Dispose every pass and target on rebuild (`DFLook.disposeComposer`).
  - Load heavy libraries on first use.
  - An effect that renders the scene again (depth of field, outlines, CCTV) needs a reason and a headroom condition.
- **Accessibility:**
  - Every 3D action has an HTML control.
  - Keyboard paths work.
  - `prefers-reduced-motion` turns moves into cuts and stops particles.
  - Canvas Arabic is set word by word and wrapped in RLE…PDF.
- **Change the plant only through the engine's commands** (CLAUDE.md). The look system draws; it never writes to the world.

## Gates before shipping
```bash
node tools/bench/bench.mjs --out .design-pipeline/bench/after-<topic>      # then:
node tools/bench/compare.mjs .design-pipeline/bench/before-<topic>/report.json .design-pipeline/bench/after-<topic>/report.json
(cd tools/assets && node check-glb.mjs ../../assets/models/<file>.glb)
node .claude/skills/web-design-pipeline/scripts/qa.mjs <pages> --theme-key df-theme
.claude/skills/impeccable/scripts/impeccable detect <pages> assets/css
node tools/checks/windows.mjs
```

Report the numbers as measured, with the machine. SwiftShader frame times are relative only; never claim a frame rate
for a device you did not measure on (ask for `?perf=1` readings from the device instead).
