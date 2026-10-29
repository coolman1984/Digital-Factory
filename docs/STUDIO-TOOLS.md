# Studio tools: what we use, what the owner proposed, and the verdict (2026-10-29)

Owner request: the repositories already in the studio are Digital-Factory, Animation and 3D-Modeling; eleven more were
proposed. Each was checked (repository read, licence, what it gives this studio). Rule: learn, adapt, integrate. Nothing is
installed until a task needs it and a before/after shows the gain (`VISION_3D_AND_MOTION.md`, "Tool selection").

| Proposed | Licence | What it is (checked) | Verdict | Why |
|---|---|---|---|---|
| EL4CTEO/blender-skills | MIT | 22 Agent Skills for Blender 5.2: hard-surface, PBR, **texture baking** (`bake_maps.py`: AO, normal, curvature, ORM packing, GPU with CPU fallback), game optimisation and LODs, web export, asset QA | **Adopt (adapt)** | Our gap is flat materials in the browser; its baking script targets our Blender (5.2.3). Use its recipe to bake AO/ORM into the slice and plant GLBs. Read, not installed globally |
| RobLe3/cc-blender-skill | MIT | 30 skills around Blender MCP: reference-to-3d, **reference-look-calibration**, multiview fitting, render validation | **Adopt (method)** | Matches our reference-comparison method (`docs/SLICE.md`); its look-calibration loop is the next step for the side-by-sides |
| ra100/blender-claude-plugin | MIT | API references for Blender 5.x: ~373 geometry nodes, shader, compositor, modifiers, Python | **Reference** | Lookup while writing Blender code; no runtime |
| Blender Studio Pipeline | GPL (Blender Studio tools) | Production tracking (Kitsu), render farm (Flamenco), asset pipeline for a team | **Later** | Built for multi-person film studios; we are code-driven with one owner. Revisit for a farm on the owner's PC |
| pmndrs/postprocessing | Zlib | Merged-pass post effects for three.js (fewer full-screen passes than three's EffectComposer) | **Later, with a benchmark** | Could lower the plant's post cost; adopt only after a before/after on the fixed poses (`tools/bench/`) |
| mrdoob/three.js | MIT | The browser 3D engine | **Already in** | r170 vendored in `assets/vendor/three/`; upgrades need a benchmark |
| Remotion (+ its skills) | Remotion licence: free for individuals and companies up to 3 people; larger companies need a paid company licence | React video rendering | **Owner decision** | Animation already has its Studio Engine; Remotion's licence may cost money for a company |
| Video Shotcraft | Apache-2.0 | 124 shot recipe cards | **Already in** | Vendored in the Animation toolkit (`studio/toolkit`, skill `video-shotcraft`) |
| Motion Canvas | MIT | Code-driven 2D explainer animation | **Not now** | Animation's engine and HyperFrames cover 2D motion; no gap it fills today |
| OpenColorIO | BSD-3 | Colour management | **Already in (Blender)** | Blender ships OCIO (AgX view used for every still); the browser uses ACES/AgX tone mapping in `assets/js/vfx/look.js` |
| OpenTimelineIO | Apache-2.0 | Editorial timeline exchange | **Already in (Animation)** | The live-action editor hands off as OTIO |

First use: bake ambient occlusion into the main-line station kit and the slice (planned next; evidence will be a
before/after at the same pose).
