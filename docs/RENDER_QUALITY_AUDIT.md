# Render quality audit (2026-10-29)

Directive: `docs/RENDER_QUALITY_DIRECTIVE.md`. Method: collect the actual settings, look at 100% crops, classify each visible
defect, then change one variable at a time and compare at the same camera. Blender stills and browser captures are kept
apart. Evidence images live outside the repository (`/home/user/mnt-out/rq/` in the session; the ones the owner sees are
sent with the report).

## 1. Settings as found

**Blender** (`tools/blender/dflib.py` `render()`, `mounter.py` lines 784–792, `assembly_area.py` lines 522–529)

| Setting | Value | Note |
|---|---|---|
| Engine, device | Cycles, CPU (4 cores in the cloud session) | GPU path exists (`--gpu`) for the owner's PC |
| Samples / adaptive threshold | 96 (mounter), 72 (area stills) / 0.02 | 0.02 stops early in soft shadow and glossy areas |
| Denoiser | OpenImageDenoise, default passes | Applied to the final image only; no noisy/denoised pair kept |
| Bounces | 10 max, caustics off, filter glossy 1.0 | No indirect clamp |
| View transform | AgX, look "Medium High Contrast", exposure 0 | No calibration target in the scene |
| Output | PNG 8-bit sRGB | No EXR, no 16-bit |
| Lights (studio) | Five area lights (key 2.4×1.6 m, fill, two rims, top), world #3A3F47 at 0.35 | Reasonable for one machine |
| Lights (assembly area) | World #C9CED6 at **0.65**, 1.2×0.6 m bay lights at 6.5 m, one 6 m key | The bright world fills every shadow |
| Materials | Principled, flat colours; micro bump only (noise scale 900) | No breakup at visible scale, no edge highlight, no AO in glTF |

**Browser**

| Page | Tone mapping, exposure | Environment and lights | AA | AO | Post |
|---|---|---|---|---|---|
| `line.html` (`assets/js/line/line.js:29`, `:58`, `:261–275`) | Neutral, **1.2** | PMREM soft-box env ×**1.35**, hemi 1.1, sun 1.6 | MSAA 4 (off on low) | GTAO on "high" only; capture quality `q=2` had none | OutputPass → grade (vignette 0.45, dither) |
| `inspect.html` (`assets/js/inspect/inspect.js:28`, `:304–324`) | Neutral, 1.0 | PMREM soft-box env | MSAA 4 | GTAO on the two high levels | grade "product" |
| `plant.html` (`assets/js/plant/scene.js:52–53`, `:106–126`) | Neutral, 0.95 | Lightformer env 0.44, sun 2.6 | MSAA 4, DPR ≤ 1.5 | GTAO on high | **Bloom always on** (0.3 light, 0.7 dark), grade |

## 2. What the 100% crops show (classified)

- **Not path-tracing grain.** The stills have no visible stochastic noise; the problem is the opposite: the denoiser has
  smoothed low-sample regions into a waxy, clay-like surface with soft edges (`area/v3_line.png` bins, rollers, people).
- **Flat light, low local contrast.** Shadows under benches and between bins are nearly as bright as lit faces.
- **Flat, inconsistent colour.** Bins, shirts, aprons and frames share one saturated blue; nothing has wear, print or
  roughness change, so surfaces read as plastic toys.
- **Two colour pipelines.** Blender photos go through AgX Medium High Contrast; the live three.js view through Khronos PBR
  Neutral. The studio swaps between them at rest, so colour and contrast jump when the photo fades in.
- **No contact grounding in the browser at default quality.** Without AO, stations and people float on the floor.

## 3. Top five root causes (ranked by visible effect)

1. **Over-filled lighting.** Bright world (0.65) in the area stills and stacked exposure × environment × hemisphere in
   `line.html` flatten form and shadow. Fix: low ambient, motivated large overhead sources, one shaping key.
2. **Denoiser hiding undersampling.** 72–96 samples at threshold 0.02 leave the denoiser to invent surfaces. Fix:
   threshold 0.005–0.01, more samples where needed, indirect clamp against fireflies, keep raw and denoised outputs.
3. **Materials without breakup or edges.** Uniform albedo and roughness, no edge highlight. Fix: a shared breakup
   (large-scale roughness and albedo variation), render-time bevel normals in Cycles, a calmer, consistent palette; bake AO
   for the browser.
4. **Two colour transforms.** Pick one output transform for both paths and calibrate exposure on a grey card.
5. **Missing contact shadow and AO in the browser at the quality actually shown.** Fix: cheap contact AO at every level
   (baked AO in the GLB, GTAO only where affordable), and bloom off in operating views.

## 4. Experiments and results

(filled in as each A/B is rendered: settings, render time, full frame and 100% crop paths, verdict)
