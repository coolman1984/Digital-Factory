# Plan: the whole plant from Blender, and an inspection studio for every machine

Owner request, 2026-10-29: rebuild the plant's look with Blender (machines, all production lines, floor, walls, roofs,
everything), keep it under control, and let a click on any machine open a white studio like the Mounter B renders, where
the machine can be exploded, seen in X-ray and cut open, with every inner part named, to present to customers.

This is the plan. Phase 0 is done (`docs/BLENDER.md`). Every later phase starts only when the one before it has been
reviewed by the owner with screenshots of the real page.

## What we have today

- Plant EG-01 in `plant.html`: 196 stations of 27 kinds (18 mounters, 18 robots, 20 injection machines, six of most others),
  all built procedurally from boxes and cylinders in `assets/js/plant/scene.js` (about 2,300 lines), merged by material
  and instanced; a procedural epoxy floor, sandwich-panel cladding and trusses; a quality governor; an X-ray view of the hall.
- The simulation (`engine.js`) owns where every station stands and what it is doing. It must not change for any of this.
- Blender 5.2.3 runs headless in the cloud session (no GPU). The owner's PC has Blender, not yet connected.
- Mounter B exists as a Blender script with 40 named parts, explode offsets and four rendered states.

## The architecture: one asset factory, three outputs

```
tools/blender/lib/        shared: materials, part builder, bevel rules, studio, export, bake, checks
tools/blender/machines/   one generator per kind: mounter.py, printer.py, reflow.py, robot.py ... (27)
tools/blender/building/   modular kit: floor bay, wall bay, column, roof truss, skylight, lights, ducts, trays
        │  python build.py --kind mounter          (Blender in the cloud, or on the owner's PC)
        ▼
assets/models/machines/<kind>/
   inspect.glb      full detail, every part a named node, roles and explode vectors in glTF extras, baked textures
   plant.glb        LOD0 / LOD1 / LOD2, merged by material, for 18 copies on the floor (instanced)
   parts.json       part ids, Arabic and English names, roles, explode vectors, motion channels, sources
   film.blend       the same parts for the Animation repo (higher detail when the film needs it)
assets/models/building/   kit pieces with baked lighting
```

Why code, not hand modelling, for the source: every machine is a reviewable script with stable part ids, it rebuilds
identically, any agent (Claude, Codex) can edit it, and a fix in `lib/` improves all 27 kinds at once. A hero piece can
still be finished by hand in Blender on the owner's PC; the script stays the record of the part ids.

**The plant keeps its brain.** `scene.js` asks the registry (`assets/models/machines.json`) for each station's kind:
if a GLB exists it places LOD instances at the engine's position, otherwise it keeps today's procedural model. Machines
move from procedural to Blender one kind at a time, with no broken state in between. Status lights, gantry motion and
X-ray keep reading the engine; the look system (`DFLook`, `DFMaterials`) and the governor stay in charge.

## The inspection studio (click a machine, enter the white studio)

1. **Enter.** Click a machine (or its deep link `plant.html#inspect:SMD4-MounterB`): the camera flies to it, the hall fades
   to a white cyclorama with soft studio light and a contact shadow, and the full-detail `inspect.glb` streams in
   (the plant LOD stays on screen until it arrives).
2. **Look.** Orbit, zoom, presets (front, top, three-quarter, close-up of the head).
3. **Explode.** A slider from assembled to exploded, staged by assembly; reassembly returns to the exact transforms.
4. **X-ray.** The shells turn to a blue-edged ghost; internals stay solid and readable.
5. **Cut.** A movable section plane (three.js clipping planes) with solid red caps (stencil), so a cut never shows hollow skins.
6. **Parts.** A list of every part with its Arabic and English name and role; picking one isolates, highlights and frames
   it, with a label anchored to it. The same names as the Blender renders, from `parts.json`.
7. **Working motion.** Play and pause the machine's cycle (pick, place, board advance). Decorative, labelled as illustrative.
8. **Live state, read only.** The station's real state from the engine (running, its counts, its last alarm). Inspection
   never writes to the plant or its audit trail.
9. **Present.** A guided customer tour per machine (assembled, exploded, X-ray, cut, the key parts, back to assembled)
   and a "back to the plant" that flies home. Keyboard and touch controls, reduced motion, and the guide updated in both languages.

## Keeping it under control

- **One command per kind:** `node tools/blender/build.mjs --kind mounter` runs Blender, exports, then runs the gates.
- **Gates for every asset:** Khronos validator 0 errors, `check-glb.mjs` (metres, origin, named parts, normals),
  triangle and texture budgets per LOD, part ids unchanged against the last build (a renamed part breaks labels and films),
  and a contact sheet of the four states compared with the last approved one.
- **Budgets (to fix from measurement on the owner's PC, not promised now):** plant LOD0 under about 60 k triangles per kind,
  LOD2 under 2 k; inspect models up to about 500 k (one at a time); textures KTX2, 1 k on the floor, 2 k in the studio.
- **Benchmark before and after** every phase (`tools/bench`), on the cloud's software GPU for relative numbers and with
  `?perf=1` on the owner's Windows machine for real ones.
- **Two ways to run Blender:** the cloud session (headless, scripts, stills: about 5 minutes per 1920x1200 still on 4 CPU
  cores) and the owner's PC through Remote Control (GPU renders, film frames, Blender MCP for live editing). Both run the same scripts.
- **Honesty:** every machine is labelled an illustrative reconstruction of a generic machine; no vendor names or logos.

## Phases

| # | Phase | Done when |
|---|---|---|
| 0 | Mounter B in Blender, four states, bilingual labels | **Done** (2026-10-29) |
| 1 | Pipeline: `lib/`, GLB export with baked textures, gates; a standalone inspection studio for Mounter B with explode, X-ray, cut, parts list, labels | **Studio built** (`inspect.html`, 2026-10-29); waiting for the owner's review. Not yet done: the shared `lib/` split and baked textures |
| 2 | The studio inside the plant: click any mounter → studio → back; the 18 mounters on the floor become Blender LODs | Works from every mounter; benchmark not worse than the agreed budget |
| 3 | The main assembly area as in real TV plants (`docs/REFERENCES-TV-PLANT.md`): square and U-shaped sub-assembly cells with standing operators, bins, flow racks and screwdrivers on balancers; the straight pallet conveyor with stoppers and operators on both sides; dark white-balance booths, sound booths and function test; the repair loop; the aging loop of lit sets | Each piece compared side by side with the references and recorded; the area reads as people at work, not machines in a row |
| 4 | End of line: carton erecting, cushions, sealing and strapping; palletizing and the stretch-wrapper; the finished-goods racks with forklifts; the docks with 40 ft containers being loaded | as phase 3 |
| 5 | The building: epoxy floor with joints and markings (ESD in SMD, lanes and walkways), wall and column kit, roof trusses, skylights, high-bay lights, ducts and trays, baked lighting | Before/after screenshots at the bench poses; frame time within budget |
| 6 | The rest of the SMD line: loader, printer, SPI, reflow, AOI, unloader, writer, ICT (identical machines only where real lines repeat them) | Each kind has its inspect model, LODs and tour |
| 7 | Panel and backlight (LCM) clean room: glass partitions, LED strips and films, robots with cameras placing the open cell | as phase 3 |
| 8 | Parts plants and the rest: injection with moulds and robots, presses and dies, powder coating, EPS moulding; vehicles, people, offices | as phase 3 |
| 9 | Film: a cinematic reel from the same assets in the Animation studio (house method, sound, titles) | One finished, reviewed film |
| 10 | Real-device pass: measured on the owner's Windows machine and a phone; budgets tuned | Numbers recorded with the machine named |

Order (revised 2026-10-29 on the owner's direction): after Mounter B, the main assembly area and the end of line, because
they carry the story a visitor follows (cells, the line, testing, packing, pallets, containers) and they must look like real
TV plants, each area different; then the building; then the remaining machines.

**Realism rule.** Every area is modelled from references (`docs/REFERENCES-TV-PLANT.md`), never from one shape repeated.
Repeat a machine only where real plants repeat it (an SMD line's identical mounters). Before an area is called done, put
our render beside its references and record what matches and what does not.

## Each technique from the owner vision

| Technique | Where it lands |
|---|---|
| Exploded view and reassembly | Phase 1 studio slider; explode vectors authored per part in Blender |
| X-ray / ghosted exterior | Phase 1 studio; shells flagged in the manifest |
| Cutaway / moving section | Phase 1 studio, clipping plane with stencil caps; Blender boolean caps for stills and film |
| Working internals | Phase 1 for the mounter's head and gantry; each later kind gets its cycle |
| Part inspection | Phase 1 parts list, isolate, frame, anchored labels |
| Cinematic presentation | Customer tour per machine (phase 1 onward); the film in phase 9 |
| Editing and motion design | Phase 9, Animation repo |
| Footage integration | Deferred: no real footage of a plant is available; recorded software captures can join the film in phase 9 |

## Risks, said plainly

- **Browser speed.** 196 detailed machines will not fit a laptop GPU without LODs and instancing; only the studio loads
  full detail, one machine at a time. Real numbers need the owner's PC.
- **Materials across renderers.** Blender's procedural shaders do not travel in glTF; they must be baked to textures,
  and the browser will never match a Cycles still exactly. We compare like-for-like views and say where they differ.
- **Cloud has no GPU.** Stills are fine; film frames and heavy bakes are better on the owner's PC.
- **Accuracy.** Internals are illustrative, not engineering data. The studio and every render say so.
