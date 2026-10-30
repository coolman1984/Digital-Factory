# Phase 2, first slice: people at work on the six main lines (2026-10-30)

Plan: `docs/PLANT-UPGRADE-PLAN.md`. Baseline: `PHASE0.md`. Same machine, same poses, same command:

```bash
node tools/bench/bench.mjs --gpu --suite tools/bench/phase0.json --only P0-plant --out E:/df-bench/phase2-a
```

## What changed on screen

- **Operator bays** (`CELLS.bay`) in every clear gap between a main line's assembly stations, before the function test:
  four per line, 24 in the plant. Each bay: two operators on the main side and one on the far side, green ESD mats, gravity
  flow racks with blue bins, part boxes, a lean-tube frame over the line with an LED task light, a stack light, work-instruction
  monitors and screwdrivers on yellow balancers. After the Samsung Kaluga cell line (`docs/REFERENCES-TV-PLANT.md` §2c).
- **A U-shaped sub-assembly cell** (`CELLS.u`) beside each line's board station, on the far side: three benches, five
  operators, flow racks outside the U, a roller conveyor to the station edge. Six in the plant.
- Kit: `tools/blender/cells_kit.py` (Blender 5.2.3 on the RTX 3060, OptiX), packed to `assets/models/areas/cells/cells-plant.glb`
  (150 KB, 11,900 triangles for both nodes). Drawn by `assets/js/plant/scene.js` with the existing
  `placeModel` (instanced, theme and X-ray aware); never loaded on phones (`lowPower`) and hidden at the `low` quality level (the Light picture mode).
- **Unchanged:** the UI (no HTML or CSS touched), the layout, the engine, its operators and staffing, labels and hotspots.

Pictures: `phase2/P0-plant-desktop-ml3-eye.jpg` (compare `phase0/` at the same pose), `phase2/cells-kit-blender.jpg`.

## Numbers (before → after)

| Pose | fps | p95 (ms) | Draw calls | Triangles |
|---|---|---|---|---|
| overview | 159 → 146 | 10.0 → 10.1 | 649 → 703 | 1.64 M → 1.85 M |
| mainlines | 148 → 123 | 10.1 → 10.1 | 779 → 876 | 2.88 M → 3.24 M |
| ml3-mid | 170 → 155 | 10.0 → 10.0 | 484 → 579 | 2.32 M → 2.68 M |
| ml3-close | 176 → 156 | 10.0 → 10.1 | 435 → 529 | 2.19 M → 2.55 M |
| ml3-eye | 169 → 150 | 10.0 → 10.1 | 585 → 681 | 2.27 M → 2.63 M |
| cinematic | 87 → 103 | 15.1 → 15.0 | 1,185 → 1,321 | 4.15 M → 4.67 M |

All poses stay inside the phase 0 budgets (p95 ≤ 16.7 ms, ≤ 1,500 calls, ≤ 6 M triangles). Headless fps varies run to run
by about ±15 %; the p95 frame time is the steadier measure.

## Gates

- `node tools/assets/check-glb.mjs assets/models/areas/cells/cells-plant.glb --max-tris 80000 --max-kb 600 --size 0.3,8`: PASS
  (the kit is 7.7 m long because the cell stands 4 m off the line, so the default 3 m size limit does not apply). Console: no errors on `plant.html`.
- `qa.mjs plant.html`: READY with the page's existing warnings (small text, weight, LCP, CLS: UI-level, unchanged by this slice).
- `qa.mjs guide.html`: CDP timeout (the known long-page limit noted in `CLAUDE.md`).
- `impeccable detect plant.html guide.html`: two existing advisories on `plant.html` (not touched here).

## Not done yet in phase 2

- The figures stand still (no work loop yet).
- The test, aging, white-balance and packing ends keep their current models; the reference comparison side by side for this
  slice is still to be recorded.

# Phase 2, second slice: the Kaluga line bay in the plant (2026-10-30)

The owner judged the first slice's figures and bays too crude. This slice rebuilds them in Blender from the photo study
(`docs/REFERENCES-TV-PLANT.md` §2d) and puts them in the same places:
- `tools/blender/people.py`: workers from a joint skeleton (skin modifier and subdivision), clothing from the nearest bone,
  hands placed by a two-bone reach; heads with hair, eyes and brows. Used by both kits.
- `tools/blender/kaluga_line.py`: one 3.6 m main-line bay (`KLINE.bay`) as the Kaluga photos show it. The `--lod plant`
  build drops the TVs and the return deck and sets the rollers at the plant belt's 0.74 m, so the engine's own sets ride them.
  Packed: `assets/models/areas/kline/kline-plant.glb` (183 KB, 16,020 triangles). Stills with `--hall`: `docs/bench/kline/{line,over,close}.jpg`.
- `scene.js` places `KLINE.bay` where `CELLS.bay` was (same spots, same Light-mode and phone rules); `CELLS.u` keeps its
  benches with the new workers (`cells-plant.glb`, 234 KB, 21,912 triangles).

| Pose | slice 1 → slice 2: fps | p95 (ms) | Draw calls | Triangles |
|---|---|---|---|---|
| overview | 146 → 165 | 10.1 → 10.0 | 703 → 732 | 1.85 M → 2.26 M |
| mainlines | 123 → 150 | 10.1 → 10.1 | 876 → 930 | 3.24 M → 3.96 M |
| ml3-eye | 150 → 167 | 10.1 → 10.0 | 681 → 735 | 2.63 M → 3.35 M |
| cinematic | 103 → 113 | 15.0 → 10.1 | 1,321 → 1,400 | 4.67 M → 5.70 M |

Inside budget, but the cinematic pose is now close to the 1,500-call and 6 M-triangle limits: the next slices must pay for
what they add. Gates: `check-glb` PASS on both kits (`--max-tris 200000 --max-kb 900 --size 0.3,8`); no console errors.

Honest gap: in the browser the hall's lighting is dim and the models read far darker than in the Blender stills; the bright
Kaluga hall (white roof, rows of linear lights, light floor) belongs to the building and lighting work (plan phase 4).

## Hall lighting and matte people (2026-10-30)

- The dark theme now darkens the page, not the hall: the dark palette keeps the hall lit a little below the light theme
  (floor, walls, paint, sun 2.0, hemisphere 0.62, exposure 0.95, bloom 0.32), and model paint and stock are no longer
  dimmed to 55 %. Only the sky outside stays dark. Light theme unchanged.
- The owner saw faces and hands glowing: the plant's own figures used the library's fabric sheen and wrapped skin, which
  bloom lit like lamps. They now use plain matte surfaces.
- Same counts as before (lighting only): ml3-eye p95 10 ms, 735 calls, 3.35 M; cinematic p95 14.9 ms, 1,400 calls, 5.70 M.
  Picture: `docs/bench/kline/plant-lit-dark-theme.jpg`.

# Area A: the main-line end (2026-10-30)

`tools/blender/line_end_kit.py` (LG Gumi test and aging, Kaluga packing): ML.fct, ML.aging, ML.wb, ML.qa, ML.packer in the
engine's footprints; packed `assets/models/machines/lineend/lineend-plant.glb` (193 KB, 13,192 triangles). `scene.js` maps
those five kinds to it (aging joins the Blender kinds; the moving sets stay the engine's). The plant's own figures now dress
as the Kaluga staff: royal-blue jackets, dark gloves on operators, hair instead of hard hats, the leader in a beige vest;
helmets and high-visibility vests only for drivers; vests matte (their sheen glowed). New poses `ml3-end`, `ml3-pack`.

| Pose | fps | p95 (ms) | calls | triangles |
|---|---|---|---|---|
| ml3-eye | 154 | 10.0 | 791 | 3.46 M |
| ml3-end | 157 | 10.1 | 732 | 3.46 M |
| ml3-pack | 173 | 10.0 | 596 | 3.17 M |
| cinematic | 104 | 10.1 | 1,477 | 5.86 M |

Pictures: `docs/bench/kline/line-end-blender.jpg` (Blender stills), `docs/bench/kline/plant-line-end.jpg` (in the plant).
The cinematic pose is at the edge of the 1,500-call budget: the injection and press kits must keep few materials.
