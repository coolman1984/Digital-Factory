# Visual Quality Directive — Owner Review Required

Applies to branch `claude/affectionate-bardeen-n1bjgx`. This is guidance, not authorization to merge, deploy, spend money or mark phases approved.

## Objective
Build a technically credible, visually compelling **TV assembly factory**, not a showroom of repeated generic machines. Preserve the simulation engine as the source of truth. Make the real production flow legible from component supply through assembly, inspection, aging, packing, pallets and dispatch.

## Priority: one complete vertical slice
Choose a representative stretch: a U-shaped subassembly cell feeding a main TV assembly conveyor, followed by one functional test and one packaging station. Deliver this as a coherent, animated, navigable scene before expanding to 27 machine types. Preserve existing features and the machine inspection studio.

## Reference-grounded design
- Read `docs/REFERENCES-TV-PLANT.md`, `docs/TV_FACTORY_IMAGE_REFERENCES.md` and `docs/tv-factory-photo-gallery.html`. Verify image URLs, relevance, licensing and source authenticity; the gallery contains links, not locally downloaded images.
- Create a reference-to-model matrix per station: equipment, workpiece orientation, approximate dimensions, operator posture, tools, material in/out, conveyor/fixture geometry, safety envelope, camera viewpoint, confidence and source URL.
- Explicitly separate panel manufacturing, backlight module assembly, SMT/PBA and TV final assembly. Do not represent supplier operations as if performed inside this plant unless the fictional plant layout includes them.
- No exact vendor branding or machine fidelity claims without evidence.

## Art direction and realism gates
- Geometry: correct machine silhouettes and functional subassemblies; realistic floor-to-bench proportions, guarded moving parts, conveyor guides, fixtures, cable carriers, overhead tool balancers, ESD mats, monitor mounts, bins and flow racks.
- Materials: measured-feeling PBR roughness/metalness, believable coated steel/aluminium/plastic/glass; bevels at appropriate scale, texture variation without excessive grime. Bake complex Blender materials for glTF.
- Lighting: motivated industrial ceiling and task lights, restrained highlights, readable shadows, consistent exposure and white balance. Avoid cinematic fog obscuring processes.
- Motion: deterministic and physically plausible pick/place, screw fastening, pallet indexing, inspection and carton sealing; no workpiece teleportation, clipping or unsafe robot/operator overlap. Synchronize with engine state and clearly label illustrative cycles.
- Camera: overview, operator eye-level and machine detail. Preserve usability and bilingual labels.

## Acceptance criteria before moving on
1. A **real browser capture** of the implemented slice, with wide, mid and close views plus a 20–40 second motion walkthrough. Generated stills alone do not count as browser evidence.
2. Side-by-side comparison against at least three relevant source images, with concrete matches and mismatches documented.
3. Inspect model: parts list, pick/highlight, explode, X-ray and cutaway all functional; return-to-plant works and is read-only.
4. No regressions in existing routes, interaction, Arabic/English, responsive UI or simulation. Run automated tests and report exact commands/results.
5. Record frame times, draw calls, triangles, memory and loading time at fixed camera positions; measure on real GPU when available. Prefer instancing, LOD, compressed textures and progressive streaming.
6. Explicitly list known limitations and whether each screenshot is a real browser capture, Blender render or conceptual reference.

## Execution discipline
- First audit current branch against this directive. Identify what already exists and avoid duplicating work.
- Prioritize correcting factory process/layout errors over polishing shaders.
- Implement in small reviewable commits on this branch. Never merge/deploy without owner approval.
- After the vertical slice passes the gates, request owner review with direct links to evidence and a concise next-phase proposal.
- Do not use paid APIs, add secrets, or ingest copyrighted source photos into public assets without license verification.
