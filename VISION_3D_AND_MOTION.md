# Owner vision — 3D inspection, cinematic motion and editing

Owner direction recorded on 2026-10-29. **Mandatory reading before planning, implementing or reviewing visual, 3D, animation, editing or presentation work.** This is an enduring creative/engineering brief, not a claim that its features are implemented.

## Required companion references

Read [REFERENCE_PACK_3D_AND_DIGITAL_TWINS.md](REFERENCE_PACK_3D_AND_DIGITAL_TWINS.md) before relevant 3D, inspection, motion or editing work. Select and record applicable industrial, geometry and technical references; verify source rights and compatibility before reuse. These are external references, not installed features.

## Required behavior at the start of work

Read this document and the repository's existing instructions before choosing tools or designing shots/screens. In the task plan, explicitly assess the relevant capabilities below: use, defer with a concrete reason, or not applicable. Never silently ignore them. Do not force every effect into every project: the effect must explain the product or process and support the owner's brief.

The present request authorizes documentation only. It does not authorize installing software, rewriting engines, producing a new film, changing live factory data, or automatically executing this entire roadmap. On a future implementation request, use these goals to propose and execute a bounded, reviewable slice. Preserve the existing house method, brand, approvals, testing and production rules.

## First proposed practical experiment

Read [EXPERIMENT_FIRST_INDUSTRIAL_SCENE.md](EXPERIMENT_FIRST_INDUSTRIAL_SCENE.md) when planning the first practical scene: one detailed assembly, staged explosion/reassembly, ghosted working internals, a cutaway and cinematic presentation. Owner scope is personal learning; this is a documented candidate for future implementation, not an automatic task or a completed scene.

## North star

Build a polished, technically credible industrial presentation experience: detailed equipment, convincing materials and light, deliberate camera work, readable explanations and smooth interaction. Aim for leading professional examples; prove progress with reference comparisons and actual output, never claim "world best" from code or test passes alone.

Digital Factory is the interactive factory/product experience. Animation is the code-driven film, editing and presentation studio. They should reuse suitable source assets, part IDs and visual language without requiring a repository merge or a second competing simulation.

## Techniques every relevant plan must consider

1. **Exploded view and reassembly.** Separate a machine into meaningful assemblies and parts along authored paths; stagger the movement; preserve the assembled transforms; show anchored labels and each part's role; return precisely to the original state. Add a reversible amount/progress control for interactive use.
2. **X-ray / ghosted exterior.** Make the casing translucent or selectively hide it while keeping internals readable. This is a visualization of modeled parts, not a scan or discovery of invisible real machinery. Avoid transparency sorting artifacts and unreadable layers.
3. **Cutaway / cross-section / moving slice.** Reveal the interior with a movable clipping plane or a deliberately authored sectional model. Include believable section surfaces/caps where required: clipping alone does not create missing solids or internal details.
4. **Working internals.** Animate appropriate gears, conveyors, actuators, clamps, robotic joints and material flow. Use credible pivots, constraints, timings and safe illustrative sequences. Do not label decorative motion as an engineering simulation.
5. **Part inspection.** Select, isolate, highlight, frame and inspect a named part; explain its function and relationships. Keep labels legible and linked to stable part identifiers.
6. **Cinematic product presentation.** Plan close-ups, orbit/dolly moves, controlled focus, macro details, reveal shots and assembly transitions. Use physically plausible metal, plastic, glass and rubber, real-world scale, clean exposure and contact shadows. Detail important edges and connections rather than disguising simplistic geometry with glow.
7. **Editing and motion design.** Deliberate cuts and pacing; motivated match cuts and graphic transitions; picture/sound synchronization; controlled speed changes; clear titles, captions and callouts; readable pauses; sound design and a consistent color finish. Avoid generic transitions and effects applied without purpose.
8. **Footage integration.** Where useful, combine real footage or real application captures with graphics/3D using tracking, masks and compositing. Clearly distinguish recorded software operation, live interaction and illustrative animation.

## One asset, two delivery paths

Author each relevant machine as a hierarchy of separate, named components with stable IDs, correct scale/origins/pivots, assembly relationships, source provenance and neutral assembled transforms. Keep the editable source and derive optimized browser assets and film assets. Link any displayed machine state to the existing application model rather than inventing a second operational truth.

- Interactive: browser-ready geometry/materials, reversible inspection controls, touch/keyboard alternatives, restore/reset, reduced motion and measured performance on target Windows machines and mobile where required.
- Film: higher-detail assets when justified, authored shot list and timing, renderable image/video layers, editing, sound, titles and final delivery checks.
- Sharing geometry does not guarantee identical renderer output. Check material/color/animation compatibility and compare the actual browser view and film frames.

## Tool selection and integration

Use existing capabilities first and record actual installation, adapter and verification status.
- Blender: editable assets, animation, lighting, heavy 3D rendering, simulations, camera tracking and compositing. Python scripts/background execution are a valid first automation route; a working local connector is optional, not assumed.
- Three.js: existing interactive 3D/browser path. Plan upgrades only with a concrete benefit, compatibility checks and a before/after benchmark; an engine switch or WebGPU migration is not a quality guarantee.
- Existing 2D/SVG/Canvas/motion tools and PixiJS when warranted: typography, diagrams, particles, UI and motion layers. Respect the repository's maturity labels.
- FFmpeg/ffprobe: editing/media assembly, trimming, speed, audio, captions, format conversion, encoding and measurement.
- FreeCAD: optional dimension-driven engineering geometry. It is not a substitute for artistic lighting or an accurate source drawing.
- Inkscape / ImageMagick: optional vector and batch-image preparation.
- Natron: optional advanced compositing/tracking/keying if a real task exceeds the current tools; evaluate its integration before adopting.
- Do not add all tools by default. Prefer local/free workflows; identify paid services, asset licences and hardware needs before selecting them. Do not imply the coding agent can operate an uninstalled or unconnected application.

## Accuracy and asset truth

A photograph does not provide verified hidden components. Use authorized CAD, drawings, manuals, measurements or reference photos for real machines. Track the source and confidence for modeled internals. Label inferred/fictional internals as an illustrative educational reconstruction in the delivered experience. Never imply such a model is approved for real maintenance, safety or control.

Retain fictional-plant and simulated-data disclosures already required by Digital Factory. Separate decorative inspection actions from operational commands; inspection must not alter production state or its audit trail.

## First proof and acceptance

Start with one representative machine and one concise shot sequence, not a factory-wide rewrite. Establish baseline screenshots and target hardware first.

Evidence should cover: assembled, exploded, ghosted and sectioned states; a working internal-motion example; accurate reset/reassembly; anchored readable labels; no visible part collisions along intended paths; acceptable browser load/frame time/memory on named hardware; and a real exported film checked at normal speed for pacing, text, sound and color. Set numerical budgets from the actual target/brief rather than promising universal 60 fps.

Record implemented / tested / planned / blocked separately with evidence and limitations. Technical gates alone cannot certify artistic quality. Include visual review and compare like-for-like views with the chosen professional references.

## Technical reference entry points

- Blender scripting: https://docs.blender.org/api/main/info_tips_and_tricks.html
- Blender features: https://www.blender.org/features/
- Three.js material clipping: https://threejs.org/docs/pages/Material.html
- Three.js examples: https://threejs.org/examples/
- FFmpeg: https://ffmpeg.org/ffmpeg.html
- FreeCAD: https://www.freecad.org/features.php
- Natron: https://natrongithub.github.io/about

References describe possibilities, not completed integration or permission to copy assets.

## Digital Factory application notes

Keep the existing Three.js view, shared look/material system, asset pipeline and performance governor as the starting point. Read `CLAUDE.md` and `docs/VISUAL-FACTORY.md`. Extend the plant/product inspection experience using the existing engine/UI architecture; do not assume its current X-ray view provides complete modeled machine internals. Follow existing engine command boundaries for any real simulated state change. If visible controls or explanations change, update the bilingual guide and glossary as already required. This documentation change introduces no screen or operational behavior.
