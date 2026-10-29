# Vertical slice: one stretch of a real TV line, working in the browser

**Done means** (from `docs/VISUAL_QUALITY_DIRECTIVE.md`): a U-shaped sub-assembly cell feeding the main TV assembly
conveyor, one functional test and one packing station, built from the references, animated (deterministic, no teleporting
workpieces), navigable in a real browser page with overview, eye-level and detail views, bilingual labels, and linked
from the live plant; evidenced by real browser captures (wide, mid, close) and a 20–40 s walkthrough video, side-by-side
comparisons with at least three source images, performance numbers at fixed poses, and no regressions (commands and
results listed). Owner review before moving on. Nothing is merged or deployed.

## Audit of the branch against the directive (2026-10-29)

| Directive item | State on the branch | Gap |
|---|---|---|
| Cell → main conveyor → test → packing, as one scene | Blender: `assembly_area.py` (cells, 14 m pallet line, stations, robot, upright test, QA room, building) and `end_of_line.py` (packing, taping, strapping, palletizing, wrapper, racks, forklift, dock). Stills only. | Not in the browser; no motion; packing lives in a separate script |
| Reference-to-model matrix | `REFERENCES-TV-PLANT.md` has sources and observations | No per-station matrix with dimensions, posture, confidence |
| Process separation (panel fab, BLU, SMT/PBA, final assembly) | Plant engine already separates SMD, LCM and main lines | Slice must say it shows final assembly only |
| Geometry: balancers, ESD mats, monitors, bins, flow racks, guards | Present in the Blender area (pass 3, after LG Gumi and Samsung Kaluga photos) | People are stylised figures without rigs |
| Materials baked for glTF | Mounter only (factors, no procedural bumps in glTF) | Same approach for the area; no baking yet |
| Motion | Mounter head cycle in the studio; plant gantries | Pallet indexing, screwing, test tilt, carton sealing not built |
| Cameras: overview, eye level, detail | Studio presets for the mounter | Needed for the slice |
| Inspect model working, return to plant read-only | Done for Mounter B (explode, X-ray, cut, parts, back link) | Keep working (regression check) |
| Browser evidence, video, comparisons, performance | Studio and plant captures exist for the mounter | Needed for the slice |

## Checklist

- [x] Audit (this file)
- [x] Reference-to-model matrix per station (`REFERENCES-TV-PLANT.md` §5)
- [x] Blender: per-pallet objects and per-step TV states so the line can index; packing station placed after the test
- [x] Export the slice GLBs (light for the browser), gates (`check-glb.mjs`)
- [x] `line.html`: the slice in the browser on the shared look system: views (overview, eye level, detail), labels AR/EN,
      deterministic animation (pallet indexing, screwdriver dips, robot fastening, test tilt, carton taping), reduced motion
- [x] Links: live plant main line ML-3 → slice; slice → plant; studio unaffected
- [ ] Evidence: real browser captures (wide, mid, close), 30 s walkthrough video rendered frame by frame from the page
- [ ] Side-by-side with three or more reference images (internal, not committed where licences forbid)
- [ ] Performance at fixed poses (frame time, calls, triangles, memory, load) on this machine's software GPU
- [ ] Regression checks: QA gate, impeccable detect, check-glb, windows.mjs, studio and plant smoke runs
- [ ] Owner review request with links to the evidence
