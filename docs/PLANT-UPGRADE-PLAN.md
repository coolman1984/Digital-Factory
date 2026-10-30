# Plan: the same plant, much better graphics

Owner direction, 2026-10-30: keep Plant EG-01 exactly as it is laid out today (`plant.html`: the hall, the six main lines,
the SMD, LCM and parts areas, the stores, the docks) and keep the **user interface unchanged** (toolbar, Walk / Fly-through /
Cameras / X-ray / Present, the bottom tabs, the panels, the labels). Improve only what the plant looks like: real line
shapes with people working in cells, better machines, building, light and materials. Reference: Samsung's Kaluga TV plant
and the other TV plants in `docs/REFERENCES-TV-PLANT.md`.

This plan supersedes the order of `docs/BLENDER-PLAN.md` from phase 2 on; its architecture, gates and realism rule stay.

## Fixed rules (never broken by any phase)

1. **UI frozen.** No change to the HTML, CSS or controls of `plant.html` and `app.html`. Every phase ends with the same
   UI screenshot compared before and after; any difference outside the 3D canvas fails the phase.
2. **Layout frozen.** The engine (`engine.js`) owns where every station, line and area stands. Graphics follow it; they
   never move it. Labels, hotspots, problems and the time machine keep working on the same ids.
3. **Engine boundary.** Visual work never writes to the world; state still changes only through `E.*` / `AG.*` commands.
4. **One look system.** `assets/js/vfx/` and the shared materials; no second renderer in the browser.
5. **Honest.** Fictional plant, simulated data, illustrative machines; no vendor names or logos on models.
6. **Owner review** with before/after screenshots at the same camera poses closes every phase.

## The owner's machine (measured 2026-10-30)

| Part | What it is | What it means for us |
|---|---|---|
| Graphics card | NVIDIA GeForce RTX 3060, **12 GB**, driver 621.01 | Blender GPU rendering (OptiX), fast light baking; the browser target GPU |
| Processor | Intel Core i5-12400F, 6 cores / 12 threads | Fine for Blender scripts and exports |
| Memory | 16 GB, 8 GB page file | One heavy job at a time (Blender bake **or** a browser benchmark, not both) |
| Disks | C: 16 GB free, I: 23 GB free, **E: 120 GB free** | Keep Blender caches, bakes and film frames on E:, not in the repo |
| Blender | 5.2.3 LTS, `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`; sees the RTX 3060 for **OptiX and CUDA** | Run `tools/blender/*.py` here with GPU instead of the cloud CPU (minutes → seconds per still) |
| Godot | 4.7.2 stable, portable, `C:\Users\mflma\Downloads\Godot_v4.7.2-stable_win64.exe\` | Already used for the Mounter B reel (`tools/godot/mounter-reel`); move to a stable folder (e.g. `E:\Tools\Godot\`) |

Benchmark note: the headless benchmark (`tools/bench`, entry `E-line`) runs on a software GPU, so its frame rate
(about 1 fps) is meaningless; its counts are real. The ML-3 slice alone draws **about 950 k triangles and 500–600 draw
calls**. Six such lines at that detail would not run on a laptop; the RTX 3060 needs LODs and instancing too. Real
frame times must be measured in Chrome on this PC with `?perf=1`.

## What we can use (already in `I:\Design`)

- **This repo:** `tools/blender/` (dflib, `main_line_kit.py`, `assembly_area.py`, `end_of_line.py`, `bake_lighting.py`,
  `mounter.py`), the ML-3 slice (`line.html`, `assets/models/areas/ml3/slice.glb`), the inspection studio (`inspect.html`),
  the Godot reel, `tools/bench`, `tools/checks/windows.mjs`, `check-glb.mjs`, skills `visual-factory` and `web-design-pipeline`.
- **Animation repo:** the film studio (house method, editing, sound, titles) for the phase-7 film; it reuses our GLBs.
- **Code-Graphics-Repos:** read-only references: `three.js` (examples: instancing, LOD, clipping), `blender-mcp`,
  `fake-bpy-module` (autocomplete for Blender scripts), `awesome-blender`, `remotion`, `motion-canvas`.

## What the references show (Samsung Kaluga first)

From the 2010 press tour of Samsung's Kaluga plant ([iXBT photo report](https://www.ixbt.com/dvd/samsung-1st-3dled.shtml);
studied, not copied):
- A hanging board per line: **"Cell Line", 28 people**: line leader 1, repair 1, assembly 12, function inspection 4,
  final inspection 4, unloading 2, relief 2, packing 2 (as read from the photo; small digits uncertain).
- Operators in **royal-blue work jackets**, some with a light vest; gloves; they stand at waist-high benches on both
  sides of a flat line.
- The first operator takes the LCD panel out of an EPS container, peels the films, lays a board, plugs a flat cable,
  places thermal pads and closes a cover; the next ones fit the rest and screw on the back cover.
- Benches with grey frames, cardboard part boxes beside each operator, silver antistatic bags, inspectors walking the line.
- Samsung Russia's QLED launch page and Investkaluga describe the plant's shops: assembly, PCB/microchip, plastic moulding.

Together with LG Gumi (sets face down on matted belts, aluminium frames with monitors over each station, upright test
rows, aging rooms) this gives the look of every main line: **people at cells and benches along a straight line**, not
machines in a row.

## Phases

| # | Phase | What changes on screen | Done when |
|---|---|---|---|
| 0 | **Baseline** | Nothing. Fixed camera poses of `plant.html` (overview, each area, eye level on a line); UI screenshot; real frame time, draw calls, triangles and memory in Chrome on the RTX 3060 | **Done 2026-10-30**: `docs/bench/PHASE0.md` (RTX 3060, budgets set); waiting for the owner's review |
| 1 | **Reference sheet** | Nothing. Per area: what the photos show (people, benches, bins, frames, monitors, floor marks, light), sizes we can estimate, confidence | `REFERENCES-TV-PLANT.md` extended with Kaluga and a per-line staffing table |
| 2 | **Main lines with cells** (owner priority) | The six main lines get the ML-3 slice look: sub-assembly cells with standing workers, the straight conveyor with benches on both sides, frames with monitors and task lights, screwdrivers on balancers, test and packing ends; workers animated (simple loops, instanced) | All six lines in place on the engine's layout; side by side with three references; frame time within the budget set in phase 0 **First slice done 2026-10-30** (`docs/bench/PHASE2.md`): operator bays and U-cells on all six lines, within budget; still to do: work loops for the figures, the test and packing ends, the reference comparison |
| 3 | **GPU pipeline on the PC** | Same scene, better light: Blender on the RTX bakes lighting and ambient occlusion for the kits and the hall; KTX2 textures; LOD0/1/2 per kit | `node tools/blender/build.mjs --kind …` runs on the PC; gates pass; before/after at the bench poses |
| 4 | **Building and floor** | Epoxy floor with joints, ESD zones, yellow lanes and walkways; walls, columns, trusses, skylights, high-bay lights, ducts | Before/after screenshots; frame time not worse |
| 5 | **Machines** | SMD line kinds (mounters from Mounter B first), the inspection studio opened from any machine in the plant (BLENDER-PLAN phase 2), then end of line, LCM clean room, parts plants | Each kind has LODs, its studio model and its tour |
| 6 | **People and life** | More workers with simple walk and work cycles, forklifts and AGVs already in the engine get better models | No teleporting; reduced motion respected |
| 7 | **Film and stills** | Nothing in the page. Godot and Blender (GPU) render a cinematic reel and stills from the same GLBs; edited in the Animation studio | One finished, reviewed film |
| 8 | **Real-device pass** | Budgets tuned on the RTX 3060, a laptop and a phone; the quality governor's levels set from the numbers | Numbers recorded per device |

**Budgets** are set in phase 0 from the baseline, not promised here. Starting targets to test against: the whole plant
under about 1.5 M visible triangles and 1,000 draw calls at the overview on the RTX 3060; full-detail models only in
the inspection studio and at eye level near the camera.

## Owner-vision techniques (assessed)

| Technique | Decision |
|---|---|
| Exploded view, X-ray, cutaway, part inspection | Use: already in `inspect.html`; phase 5 opens it from the plant |
| Working internals | Use: worker loops (phase 2), machine cycles (phase 5) |
| Cinematic presentation | Use: the existing Present mode gets the new look automatically; film in phase 7 |
| Editing and motion design | Phase 7, Animation repo |
| Footage integration | Deferred: no real plant footage; software captures may join the film |

## Risks

- **Speed.** Detail costs frames; every phase is measured on the RTX 3060 before it is called done.
- **Disk space.** C: and I: are nearly full; bakes and frames go to E:.
- **Memory.** 16 GB: never run Blender, Godot and a browser benchmark at once.
- **Accuracy.** Internals and staffing are illustrative; the plant says so.

## Whole-plant rebuild in Blender (owner direction, 2026-10-30)

The owner wants every area to look like a real plant: the rest of the main line, presses, LCM, injection, the vehicles
and carts between areas, the stores and warehouses. Same layout, same UI, same engine; each area is rebuilt in Blender
from real photos, packed for the browser and dropped into the same footprint, one area per owner review. The method is the
one proven on the main-line bay (`kaluga_line.py`, `people.py`): photo study → Blender kit → hall still next to the photos →
plant variant → benchmark → review.

| Order | Area | Real references to model from | Notes |
|---|---|---|---|
| A | Main-line end: function test, aging, white balance, QA, packing | LG Gumi tour (upright sets on test fixtures, colour bars, long aging rows, silver profile frames, green belts); Kaluga packing (EPS, cartons, roller conveyors) | The owner's screenshot of this area triggered the request |
| B | Injection | Gigazine Kaluga 2010 tour: blue-and-yellow moulding machines in a row, yellow overhead crane, take-out robots, blue bins; ENGEL electronics page (two-platen machines for big back covers) | Also the EPS (cushion) moulding area: white foam stacks |
| C | Press | Appliance press lines (coil reel, straightener, servo feed, 3-6 presses in a row, light curtains, part racks) | Weakest photo set: find a real tour video first |
| D | LCM | Panel-module booths: filtered ceilings, white garments, films stacked on fixtures, foam trays | No good real photos yet: research first |
| E | Logistics between areas | Milk-run tugger trains with carts, AMRs (TCL Huizhou), forklifts, line-side supermarkets and flow racks | Vehicles move with the engine's existing routes |
| F | Stores and warehouses | Selective pallet racks (blue uprights, orange beams), dock doors with levellers | |
| G | The building | White roof, dark trusses, rows of linear lights, light floor with lane tape, as in the Kaluga hall | Poly Haven CC0 textures (REFERENCE_PACK §3) for floor and wall surfaces |

Budget: the cinematic pose is at 1,400 calls and 5.7 M triangles of 1,500 and 6 M, so every area must replace more than it
adds (the old procedural geometry it covers is removed, not hidden under the new kit).
