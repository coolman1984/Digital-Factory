# Premium 3D Image Quality & Benchmark Directive — 2026-10-29

Owner feedback: 3D visuals are below target; lighting feels cheap, images have visible noise, resolution/sharpness is weak, and color palettes are inconsistent. Fix these systematically, with evidence. Do not treat this document as approval to merge/deploy or install arbitrary unreviewed code.

## Verified open-source research (inspect current source, license, dependencies, activity and compatibility before adoption)
- https://github.com/EL4CTEO/blender-skills — Blender skills: lighting-lookdev, rendering, PBR, baking, hard surface, asset QA, game optimization.
- https://github.com/RobLe3/cc-blender-skill — reference-to-3d, reference-look-calibration, multiview-fit-loop, source-locked validation.
- https://github.com/ra100/blender-claude-plugin — shader/compositing/scene-rendering API and recipes.
- https://github.com/blender/blender — canonical Blender and AgX/OCIO implementation.
- https://github.com/mrdoob/three.js — canonical color management, output pass, TAA example, WebGL/WebGPU differences.
- https://github.com/pmndrs/postprocessing — three.js postprocessing and color/precision guidance.
- https://github.com/pmndrs/threejs-journey — educational shader, lighting and postprocessing examples.
These are candidates, not preapproved dependencies. Study and adapt approaches, never blindly copy copyrighted proprietary competitor assets.

## First: diagnose, do not blindly turn up render samples
Collect source .blend settings, Cycles samples, adaptive sampling threshold, bounce counts, OIDN configuration, compositor nodes, resolution percentage, view transform, exposure, light sizes and energy, scene unit scale, material roughness/metalness and normal maps.
For browser collect renderer type/version, DPR, internal resolution, antialiasing, outputColorSpace, toneMapping, exposure, shadow maps, environment lighting, color-space texture tags, composer pass order, dynamic quality governor, bloom, grain, dithering, DOF and temporal effects.
Classify visible noise: stochastic path tracing, denoiser artifacts, aliasing/shimmer, undersampling, compression, texture moire, procedural shader noise, shadow acne, or deliberate grain. Each requires a different fix.

## Blender photographic quality pipeline
- Create a controlled neutral calibration scene (gray card, white card, chrome and roughness spheres, reference machine) and lock exposure/white balance.
- Test AgX vs Khronos PBR Neutral for distinct goals, do not stack incompatible transforms. Keep scene-referred linear values correct; output PNG sRGB and optional EXR for grading.
- Use motivated large area lights, believable overhead industrial lighting, softbox reflections and balanced fill. Avoid tiny emissive meshes as primary sources, excessive bloom and unmotivated colored lights.
- Render controlled A/B sample-count and denoiser comparisons at target output resolution (not just upscale). Verify denoising preserves microdetail, labels, edge fidelity and textures. Save raw noisy, denoised and final outputs.
- Diagnose fireflies, glass noise, clamping tradeoffs, light paths and glossy surfaces. Do not over-smooth or over-sharpen.
- Audit physically plausible PBR values, bevel scale, normals, UVs, texel density, baked maps and material consistency.
- Define camera focal lengths, exposure, depth of field only where appropriate, and high-quality still presets distinct from interactive previews.

## Browser image-quality pipeline
- Verify THREE.ColorManagement, sRGB color texture tagging, linear non-color maps, renderer.outputColorSpace and one tone-mapping/output transform. Inspect custom shaders and postprocessing precision.
- Compare native device pixel ratio, controlled DPR caps, MSAA and appropriate temporal AA (with motion artifacts measured). Avoid stacking multiple AA passes.
- Inspect shadows, environment maps, physically plausible lights, contact shadows and AO. Test ghosting, shimmering, moire, jagged edges and banding on moving conveyor scenes.
- Make film grain/noise opt-in and off in the clean quality baseline. Restrict bloom and chromatic effects to justified hero modes; keep factory operating views sharp and readable.
- Profile GPU frame times and memory before adopting SSR, GTAO, TAA or additional passes. Preserve fallback for weak hardware.

## Competitor/benchmark method
Build a documented visual benchmark board using publicly accessible demos and lawful screenshots from top industrial digital-twin / premium 3D product visualization examples. For each: source, date, renderer if verifiable, lighting setup inferred (mark inferred), materials, camera, color, AA, shadows, performance and what is reproducible in our stack. Do not claim to know proprietary source code or techniques without evidence.
Prioritize official Blender/Three.js examples and credible engineering showcases; distinguish offline hero rendering from real-time WebGL.

## Mandatory first deliverable: one controlled comparison
Pick Mounter B and one realistic TV assembly station. Capture identical camera framing at current settings. Then create A/B variants for lighting, noise, material, color and anti-aliasing, changing one variable at a time. Save 100% pixel crops and final full-resolution output. Test one moving camera shot in browser. Record exact settings, screenshots, measured metrics, failures and regressions in docs/RENDER_QUALITY_AUDIT.md.

## Quality gates
- No visible objectionable noise, fireflies, temporal ghosting or moire in approved final images at 100% view; test high-contrast metal edges, fine grids and TV screen patterns.
- Consistent whites, neutral grays, brand accents, material response and exposure across views.
- Source image dimensions and effective rendering dimensions explicitly reported; do not claim 4K from upscaling.
- Image comparisons include same camera, lighting conditions and device profile; capture real browser output separately from Blender stills.
- Functional factory operations, legible labels and acceptable frame time maintained; no unmeasured claims of 60 FPS.
- Record dependency licenses, actual installed skills, and exact tests; no paid API or hidden costs.
- Commit incremental work only to claude/affectionate-bardeen-n1bjgx. Do not merge or deploy without approval.

## Immediate execution order
1. Read this directive plus docs/BLENDER.md, docs/BLENDER-PLAN.md and docs/VISUAL_QUALITY_DIRECTIVE.md.
2. Audit renderer and identify top five root causes with file/line references and evidence.
3. Evaluate the GitHub resources above; choose relevant skills per step, document what was actually used.
4. Fix color-management and unwanted noise first, then lighting/materials, then AA/resolution, then cinematic polish.
5. Produce A/B evidence and ask owner to review before expanding to the rest of the plant.
