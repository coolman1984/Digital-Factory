# WORLD-CLASS 3D + FILM STUDIO: SKILLS AND PRODUCTION DIRECTIVE
Date: 2026-10-29. Target: Digital-Factory branch claude/affectionate-bardeen-n1bjgx.
Owner goal: world-class photorealistic industrial 3D, animated explainers, product demos, cinematic videos, editorial finishing, motion graphics, sound and bilingual presentations. This is a RESEARCH + PILOT mandate, not permission to install arbitrary tools, merge, deploy or spend money.

## Principles
1. Separate realtime factory WebGL from offline cinematic Blender rendering. Share versioned assets, physical dimensions, animation semantics and production data.
2. A skills library is instructions, not proof of quality. Read every SKILL.md and script before installing, pin a commit, inspect licensing, dependencies, API costs, network access and security. No paid APIs. No unapproved vendor branding or copied proprietary artwork.
3. Establish one calibrated studio look: camera/lens, exposure, white balance, color management, physically credible lighting, PBR material library, sharpness, antialiasing, render samples and denoising. Disable gratuitous grain, haze, bloom and chromatic aberration in clean master.
4. Make 4K a genuine 3840x2160 render target only where hardware/time permit; save 16-bit EXR/PNG intermediates as appropriate, generate video from image sequences, never call upscale native 4K.
5. All shot/asset changes require visual review at 100% crops and full frame; animation requires frame-by-frame continuity review, not just one hero still.

## Research catalog (evaluate; not all are agent skills)
### Agent skill packs
- https://github.com/EL4CTEO/blender-skills : 22 Blender skills covering modeling, PBR, baking, animation, rendering, QA and optimization.
- https://github.com/RobLe3/cc-blender-skill : 30 chain-loadable skills; reference locked reconstruction, look calibration, camera, animation, render.
- https://github.com/edemaistre/blender-expert-skills : 13 expert-oriented skills; lighting, previs, geometry nodes, animation, rigging, etc.
- https://github.com/MAX-786/claude-3d-harness : curated multi-skill orchestration; review overlaps and third-party provenance before using.
- https://github.com/remotion-dev/skills : OFFICIAL Remotion agent skills for compositing, titles, transitions, captions, sound and video rendering.
- https://github.com/sfgdfgd/-skill : video-shotcraft recipes for cinematic product-video storyboards and motion, inspect license/assets and quality first.
- https://github.com/kevinbadi/blender-skills : camera moves (dolly, crane, orbit), HDRI, product polish; avoid Meshy API dependent skills.
### Production engineering (reference implementations, not skills)
- https://studio.blender.org/tools/ and https://github.com/paulgolter/blender-studio-tools : Blender Studio shot builder, asset pipeline, render review, contact sheets.
- https://github.com/AcademySoftwareFoundation/OpenColorIO : film/VFX color management, investigate OCIO/ACES interoperability.
- https://github.com/AcademySoftwareFoundation/OpenTimelineIO : editorial timeline interchange; metadata and cut structure.
- https://github.com/motion-canvas/motion-canvas : programmable voiceover-synced explanatory diagrams, not general NLE.
- https://github.com/ManimCommunity/manim : precise technical/mathematical explainer animation.
- https://github.com/KDE/kdenlive : nonlinear editorial finishing, Windows-capable.
- https://github.com/FFmpeg/FFmpeg : encode, QC, conform, audio/video muxing.
- https://github.com/AcademySoftwareFoundation/OpenCue : optional future distributed render scheduling; avoid unnecessary infra now.
- https://github.com/mrdoob/three.js and https://github.com/pmndrs/postprocessing : interactive graphics, AA and color output.
- https://github.com/cgwire/awesome-cg-vfx-pipeline : discovery directory, not endorsement.

## Build a STUDIO operating model
Roles (can be AI subagents or checklist roles): creative director, industrial technical director, reference researcher, art director, modeler, texture/lookdev artist, lighting TD, rigging/animation TD, virtual cinematographer, compositor/colorist, motion designer, editor, sound designer, QA reviewer and producer. Each role produces inspectable artifacts; one coordinating agent owns shot approvals and dependency graph.

Deliver production folder conventions for briefs, scripts, storyboards, animatics, assets, shots, cameras, renders, edit, audio, grade, masters, QC and licenses. Implement a machine-readable shot manifest with scene, start/end frame, FPS, lens, camera path, lighting preset, asset versions, overlays, captions, audio cue, source and review status. Track changes and rerenders per shot. Prefer project-local skills over global changes.

## Required showcase pilot: 60–90 second TV manufacturing film
Storyboard: 1) cinematic plant establishing shot, 2) macro SMD placement detail, 3) subassembly operators and conveyor handoff, 4) TV panel fastening and inspection, 5) quality-test hero reveal, 6) packing/palletizing, 7) digital-twin overlay showing station metrics, 8) final premium product/factory reveal. Only show operations present in the fictional plant; don't invent real-world live data.
Deliver:
- Beat sheet, storyboard frames, 1st animatic with timing and camera path, and sound/VO plan.
- A consistent industrial look bible with neutral materials, accent colors, lighting, lens and contrast rules.
- A/B lighting and denoising tests for Mounter B and one assembly shot; include actual resolution, samples, render times and 100% crops.
- Editable shot source (Blender scripts/.blend when feasible), render sequences, compositing recipe, editable timeline, and encoded review MP4. If assets too large for Git, use reproducible local outputs + manifests and small previews; don't bloat repository.
- Motion graphics and explainer overlays (flow arrows, parts callouts, cycle steps, KPIs) designed for legibility and visual hierarchy, not generic HUD clutter.
- Bilingual typography QA; no overlapping Arabic, test RTL and glyph rendering.
- Frame-by-frame QA: flicker, temporal noise, ghosting, exposure shifts, texture shimmer, motion continuity, object penetration, clipping, captions safe areas, audio peak/loudness, encoding.
- Three outputs from same timeline when approved: 16:9 presentation master, short 9:16 cutdown, and interactive factory tour cues. Each independent composition, never crop a combined board.

## Competitive benchmark
Choose 5-8 legitimate public examples from Blender Studio, industrial digital-twin vendors, premium product CGI studios and motion-design showcases. Record URLs, date, visual attributes, identifiable technology vs hypothesis, and a comparison rubric: geometry, lighting, materials, color, camera, transitions, animation weight, sound, typography, narrative clarity, sharpness and final encode. Do not claim access to proprietary pipelines. Borrow techniques, not copyrighted content.

## Execution order and gates
A. Audit existing Digital-Factory and Animation repo pipelines; reuse existing work.
B. Produce skills decision matrix: source, role, popularity/activity (measured), compatibility, license, dependency costs, risk, pilot verdict. Don't install all packs.
C. Select minimal stack: Blender + one core Blender skills pack + official Remotion skills + FFmpeg + OpenColorIO concepts; add Motion Canvas/OTIO only if pilot needs them.
D. Build calibrated lookdev scene and 3-shot proof, collect before/after.
E. Assemble 60–90s pilot from actual renders and original motion graphics, with editable timeline and review evidence.
F. Report blockers and ask owner for review before scaling.
Keep branch isolated. No merge, deploy, or paid services without explicit approval.
