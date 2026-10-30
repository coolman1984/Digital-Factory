# Phase 0 baseline: the plant as it is today (2026-10-30)

Plan: `docs/PLANT-UPGRADE-PLAN.md`. Every later phase reruns this and compares at the same poses.

**Machine:** the owner's PC. NVIDIA GeForce RTX 3060 12 GB (Chrome: ANGLE Direct3D11), Intel Core i5-12400F, 16 GB, Windows 11.
**How:** headless Chrome on the real GPU, 1440 x 900, quality `high`, dark theme (headless default), 5 s sample per pose:

```bash
node tools/bench/bench.mjs --gpu --suite tools/bench/phase0.json --out E:/df-bench/<run>
```

Full output (all 17 pictures) was written to `E:\df-bench\phase0-2026-10-30\`; the key pictures and `report.json` are in `phase0/`.
Headless frames are not tied to the screen refresh, so fps above 60 shows headroom, not what a monitor displays.

## Numbers

| Page | Pose | fps | p95 frame (ms) | Draw calls | Triangles | JS heap (MB) |
|---|---|---|---|---|---|---|
| plant | overview | 159 | 10.0 | 649 | 1.64 M | 149 |
| plant | mainlines | 148 | 10.1 | 779 | 2.88 M | 88 |
| plant | ml3-mid | 170 | 10.0 | 484 | 2.32 M | 112 |
| plant | ml3-close | 176 | 10.0 | 435 | 2.19 M | 104 |
| plant | ml3-eye | 169 | 10.0 | 585 | 2.27 M | 140 |
| plant | smd | 181 | 10.0 | 456 | 2.78 M | 142 |
| plant | lcm | 188 | 10.0 | 397 | 2.18 M | 125 |
| plant | injection | 198 | 5.1 | 301 | 2.12 M | 136 |
| plant | press | 187 | 10.0 | 308 | 2.12 M | 122 |
| plant | fg-docks | 189 | 9.9 | 428 | 2.19 M | 105 |
| plant | cinematic | 87 | 15.1 | 1,185 | 4.15 M | 104 |
| line (ML-3 slice) | overview | 200 | 5.1 | 634 | 0.99 M | 21 |
| line | eye | 151 | 10.1 | 620 | 0.96 M | 18 |
| line | cell | 149 | 10.1 | 542 | 0.94 M | 22 |
| line | robot | 139 | 10.1 | 504 | 0.92 M | 21 |
| line | test | 144 | 10.1 | 492 | 0.88 M | 24 |
| line | pack | 136 | 10.1 | 542 | 0.91 M | 20 |

Load: the plant is ready in about 9.5 s, the line slice in about 1 s (local server, warm disk).

## What this says

- The RTX 3060 has a lot of headroom: every plant pose holds a p95 frame of 10 ms (cinematic 15 ms).
- The ML-3 slice costs about 1 M triangles and 500–600 draw calls for **one stretch of one line**. Copying it six times
  as it is would add about 6 M triangles and 3,000+ draw calls: phase 2 must use instancing and lighter far versions.
- The cinematic camera is the heaviest pose (4.15 M triangles, 1,185 calls): use it as the worst case.

## Budgets for the phases (on this PC, at these poses)

- p95 frame **at most 16.7 ms** (60 fps) at every pose, cinematic included.
- Draw calls **at most 1,500**; triangles **at most 6 M** at any pose.
- JS heap **at most 300 MB**; plant ready **at most 15 s**.
- Laptop and phone budgets come from phase 8 measurements.

## UI reference

The plant pictures in `phase0/` include the whole interface (top bar, KPI row, area list, Walk / Fly-through / Cameras /
X-ray / Present, Standard / Studio / Run a drill, the right panel, the bottom tabs and flow row). Phase gates compare
everything outside the 3D canvas against these; any change there fails the phase.
