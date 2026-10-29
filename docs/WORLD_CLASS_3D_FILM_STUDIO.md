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
- https://github.com/Vincentwei1021/video-shotcraft : primary video-shotcraft candidate, verified against its repository README on 2026-10-29. Remotion-based product/screen-capture motion recipes, editing and sound; not a substitute for Blender virtual cinematography or a general 3D renderer. Evaluate selected recipes before reuse; pin a revision after review.
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
A. Audit existing Digital-Factory, Animation and 3D-Modeling repo pipelines and their instructions; reuse existing work. Record inspected branches and commits, working capabilities, gaps and asset provenance before assigning ownership.
B. Produce skills decision matrix: source, role, popularity/activity (measured), compatibility, license, dependency costs, risk, pilot verdict. Don't install all packs.
C. Select minimal stack: Blender + one core Blender skills pack + official Remotion skills + FFmpeg + OpenColorIO concepts; add Motion Canvas/OTIO only if pilot needs them.
D. Build the calibrated lookdev scene and mandatory three-shot quality proof defined below; collect comparable before/after evidence. Do not begin full-film production while this gate is failed or blocked.
E. Assemble 60–90s pilot from actual renders and original motion graphics, with editable timeline and review evidence.
F. Report blockers and ask owner for review before scaling.
Keep branch isolated. No merge, deploy, or paid services without explicit approval.

## Repository responsibilities and shared asset contract
This is the proposed ownership model, not a claim that integrations already exist.
- Digital-Factory: orchestration, existing simulated plant state, browser inspection and interactive delivery. Preserve the current Three.js architecture, command boundaries, brand and bilingual guide rules.
- 3D-Modeling: proposed home of editable canonical assemblies, reference records, materials, stable part IDs, units, pivots, assembled transforms and film/browser export recipes. Inspect the actual repository and its instructions before adopting this responsibility or moving assets.
- Animation: shot direction, authored motion, rendering, compositing, editing, titles, sound and film masters, following its existing house workflow.
- One asset manifest links source repository + commit, asset version, part IDs, dimensions, axis convention, hierarchy, materials, motion semantics, provenance and derived output paths. Preserve an existing canonical source where it already works; do not duplicate or relocate it just to match this proposal.
- Produce separate high-detail film and optimized browser derivatives. Compare scale, pivots, materials and animation after export; shared geometry alone does not ensure identical appearance.
- Keep repositories separate. Shared assets do not authorize merging repositories or creating a second factory simulation.

## Mandatory first quality gate: three actual shots
Use one bounded representative assembly where possible. This extends the existing 30-second single-assembly experiment rather than creating a competing pilot. The full 60–90 second factory film remains the later milestone.

| Shot | Proposed duration | Evidence required |
| --- | --- | --- |
| Q01: machine close-up | 4–6 s | Metal, plastic and rubber separation; edge detail; contact shadows; readable highlights; no distracting grain or loss of fine detail from denoising |
| Q02: credible working motion | 6–10 s | Explicit pivots and timing; no visible penetration, jumps or drifting labels; continuity of moving parts and camera; precise return to assembled transforms where reassembly is shown |
| Q03: wider industrial view | 4–6 s | Clear scale, grounded equipment, coherent palette, controlled exposure, useful composition and stable moving-camera detail |

For this documentation update, no shot has been rendered and no numerical artistic score is claimed.
Before execution, record target hardware, installed tools, renderer/version and a feasible time budget. Use a 1920x1080, 30 fps review draft unless the existing workflow or owner brief specifies otherwise; preserve genuine output dimensions and report render time. Set browser performance budgets from named target hardware separately.

For each shot deliver:
1. Editable scene or reproducible source plus asset/shot manifest.
2. Actual full-frame images and matching 100% crops of critical surfaces, before and after, with the same framing/resolution and documented changes.
3. Render settings: engine, samples, denoiser, exposure, view transform, resolution, frame rate, frame range, hardware and measured time.
4. A moving preview inspected at normal speed and frame by frame for flicker, shimmer, ghosting, collisions and exposure jumps. Do not certify motion from still images.
5. A short visual comparison to selected reference views; identify improvements, remaining gaps and any illustrative internals.
6. Gate record: PASS / FAIL / BLOCKED for geometry, materials, lighting, color, temporal stability, camera/readability and reproducibility. PASS requires actual reviewed output with no unresolved visible critical defect; missing evidence is BLOCKED. Numerical render metrics do not replace artistic review.

Complete and report this bounded proof for owner review before scaling to the complete film. Continue necessary local corrections within the proof scope; record the limiting defect if it cannot be resolved.

## Applied owner vision and selected references
Read AGENTS.md, CLAUDE.md, VISION_3D_AND_MOTION.md, REFERENCE_PACK_3D_AND_DIGITAL_TWINS.md and EXPERIMENT_FIRST_INDUSTRIAL_SCENE.md before implementation.
- Exploded view/reassembly: include within Q02 where it clarifies the assembly; preserve transforms and stable IDs.
- Ghosted exterior and cutaway: assess on the same bounded assembly using actual modeled internals; test as supplemental views to avoid crowding the three shots. Mark missing internals or section caps as blocked rather than pretending transparency creates them.
- Working internals and part inspection: include a readable motion/part example with anchored labels. Interactive inspection must not mutate production state.
- Cinematic presentation and editing: apply purposeful close-up/wide framing, restrained camera motion, clear pacing and a consistent finish across Q01–Q03.
- Footage integration: deferred for the first synthetic assembly proof; add only when authorized footage or real application captures explain a concrete step.
- References selected from the existing pack: Blender Studio Charge for industrial lighting/material/camera study; BMW/NVIDIA FactoryExplorer for industrial hierarchy and readability; Khronos glTF Sample Assets for export/material calibration; Three.js material/clipping examples for browser inspection technique. FlexSim remains a process-flow benchmark when later production-flow shots require it, not a renderer dependency.
- Selection records the purpose, not completed visual study. The implementing agent must record actual image/clip URLs, time ranges where applicable, geometry source and observed techniques before claiming reference comparison.
- Preserve the existing fictional Plant EG-01 disclosures and visual-factory workflow. The current change is documentation only: no installation, scene execution, runtime change or quality proof is implied.

## Immediate implementing-agent handoff
1. Read the repository instructions and this directive; inspect all three actual repositories and record branch/commit evidence.
2. Inventory existing tools, assets and working adapters. Report what is installed, tested, planned or blocked separately.
3. Evaluate a minimal stack: one primary Blender skill pack, specialist references only as needed, the existing interactive renderer, and the established Animation finishing workflow. Verify current skill counts and compatibility rather than treating catalog counts as fixed.
4. Build and review Q01–Q03 from shared source assets; produce the gate evidence and a concise report.
5. Propose scaling to the factory-film pilot only after the proof review. No paid APIs, merge or deployment without owner authorization.
