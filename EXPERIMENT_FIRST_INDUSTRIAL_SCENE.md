# First strong industrial scene — personal learning experiment

Owner request: 2026-10-29. **Status: DOCUMENTED / NOT IMPLEMENTED.**

This is a concrete candidate experiment for Claude Code, Codex or a future implementing agent. The owner explicitly requested adding the idea to both repositories, not having the documenting assistant build or render it now. Reading this document is not an automatic instruction to execute it.

## Purpose and scope

Create one visually impressive, readable industrial scene that demonstrates the owner vision in practice before scaling to an entire factory. This is private personal experimentation and learning, with no external publication or client delivery in the present brief. A standalone rights-review exercise is not a requested prerequisite for this documentation scope. Keep source links and creator information as ordinary project provenance; retain existing project rules when actual assets are used.

Read [the owner vision](VISION_3D_AND_MOTION.md) and [the reference pack](REFERENCE_PACK_3D_AND_DIGITAL_TWINS.md). Aim high in detail, materials, lighting and motion, while keeping the subject small enough to finish and review. The experiment succeeds through an actual convincing scene, not through adding tool names or declaring a renderer powerful.

## Proposed subject, replaceable when implementation starts

One compact conveyor drive assembly: outer casing, motor/coupling, gears or transmission, shafts and a short driven conveyor section. This offers a clear shell, meaningful internal parts, visible motion and a natural exploded view. A better documented machine or open assembly may replace it if it serves the same goals; do not model a whole factory for this test.

Choose a source assembly from the reference pack, or author a clearly labeled illustrative mechanism. Preserve a canonical hierarchy, stable part IDs, meaningful pivots, assembled transforms and shared scale. Internal parts must exist as geometry. A transparent shell cannot reveal details that were never modeled. Identify approximated motion or geometry honestly.

## Proposed 30-second storyboard

The timing is a starting proposal for the future implementation, not an export requested now.

| Time | Shot and action | What must be clear |
| --- | --- | --- |
| 0–4 s | Hero close-up with deliberate light and a restrained camera move | Convincing metal, casing, scale and grounded contact shadows |
| 4–10 s | Casing and assemblies separate in a staged exploded view | Order, depth and part relationships; a few anchored labels |
| 10–14 s | Parts reassemble precisely | No drift, jumps or leftover offsets |
| 14–20 s | Shell becomes ghosted; working parts continue moving | Readable internals, no distracting transparency artifacts |
| 20–26 s | A controlled cutaway reveals the mechanism in motion | Clean section boundary and understandable transmission of motion |
| 26–30 s | Return to the assembled hero view | Strong final composition and smooth visual continuity |

Do not display all effects at once. Avoid excessive glow, random camera shakes, unreadable labels or spectacle that obscures how the machine works. Actual gear ratios, constraints or flow claims must come from an explicit model; the film is not evidence of physically validated machinery.

## Two uses of the same authored assembly

**Digital Factory — interactive experiment:** a separate bounded prototype or isolated scene using the existing Three.js path. Provide orbit/inspection, a reversible explode amount, shell visibility/ghosting, a cutaway control and pause/play for working parts. Preserve the fictional Plant EG-01 and shared simulation architecture. Inspection animation must not mutate production state or introduce a competing plant simulation.

**Animation — cinematic experiment:** prepare the detailed assembly and authored motion in Blender when local readiness is verified. Use the existing studio workflow for the short scene's editing, restrained labels, transitions, sound and export. Begin with the existing 16:9 / 30 fps defaults unless a later implementation request specifies otherwise; a 1080p draft is a practical proposed review target. Follow the house method and production rules. A browser GLB derivative and a film source may need different geometry/material budgets while sharing part identities.

Choose the first output based on the next actual implementation request; creating both is a candidate goal, not an instruction to launch parallel work or a requirement to finish both before reviewing one.

## Reference and execution approach for a future request

- Select one industrial visual benchmark, one actual geometry source and one relevant technical example. Use the reference pack's BMW/NVIDIA/Siemens examples for industrial clarity, Blender Studio for cinematography, and FlexSim for process readability where applicable. FlexSim is not required software for an exploded-view shot.
- Verify local Blender and asset-conversion readiness before promising an output. Do not install a heavy platform, rewrite the engine or add paid services merely to run this experiment.
- Start with one short draft, inspect actual output, and correct the most visible problems. The existing repository's finite review/testing rules still apply.
- Keep reusable part metadata and motion definitions separate from presentation-specific lighting, camera and edit decisions.

## Evidence for declaring the experiment demonstrated

1. A complete short preview or functioning interactive prototype exists and has been watched/used, with its location recorded.
2. Explode and reassembly preserve the original assembled state; labels remain anchored and readable.
3. Ghosting and cutaway reveal real modeled internals; boundaries, depth and working motion read clearly.
4. Actual frames are compared with selected named references for geometry, materials, light, camera and clarity.
5. For a browser output, record loading and responsiveness on named hardware; for film, check the exported timing, image and sound. Report limitations and approximate mechanisms without claiming industrial validation.

No asset was downloaded, scene built, renderer run or runtime capability proven by writing this brief. On implementation completion, update this status and attach actual evidence. If it does not reach the intended visual bar, record the specific gap rather than marking the experiment complete.
