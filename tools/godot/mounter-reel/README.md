# Mounter B reel (Godot 4)

A 6-second product move of Mounter B rendered by Godot's Forward+ renderer: a studio sky for reflections, a soft key with
shadows, SDFGI and SSIL bounce light, SSAO contact shadows, screen-space reflections, TAA + MSAA. The model is the same
Blender asset the machine studio uses, loaded at run time.

Why a game engine next to Blender: Blender (Cycles) gives the reference stills and film frames; Godot draws a frame in a
fraction of a second on a graphics card, so moves, previews and social cuts are fast to iterate. Same asset, two paths.

## Fast render (recommended)

`render.sh out godot` renders the reel in four parallel slices (one renderer thread each), drops each slice's warm-up and
joins them into `out/mounter-reel.mp4`. Settings: FSR 2 at 67% internal resolution, no MSAA, exposure 1.1, a fill light
without specular (lifts the shadow side without glare on the hood glass). Measured on 4 CPU cores with software Vulkan:
6 min 48 s for the reel (about 1.4 s a frame) against 9 min 22 s for one process at native resolution, same sharpness at
100% crops. Details and the measurements: `docs/RENDER_QUALITY_AUDIT.md` E5.

**9:16 social cut:** `RES=1080x1920 EXTRA=--portrait render.sh out-916 godot`: its own camera path for a tall frame (the
whole machine with room above for a title, ending on the nozzles), never a crop of the 16:9 reel. 7 min 15 s on 4 cores.

## Run

1. Export the model next to the project (Blender 5.2 as a Python module, or Blender itself):
   `python tools/blender/mounter.py --lod web --glb tools/godot/mounter-reel/mounter.glb`
2. Render the 180 frames (6 s at 30 fps) with Movie Maker, then encode:
   ```
   godot --path tools/godot/mounter-reel --write-movie out/f.png --fixed-fps 30 --resolution 1920x1080
   ffmpeg -framerate 30 -i out/f%08d.png -c:v libx264 -crf 18 -pix_fmt yuv420p mounter-reel.mp4
   ```
   The first 30 frames are a warm-up (GI and TAA settle on the first pose): encode with `-start_number 30`. One still for look tests: add `-- --frame=150`; `-- --sdfgi` turns on SDFGI (more bounce light, slower, and it blotched the floor on the software renderer).

On a PC with a graphics card this runs near real time. In the cloud session (no GPU) it ran on Mesa's software Vulkan
(llvmpipe) at 2.2–3.4 s a frame at 1920×1080 (9 min 29 s for 210 frames), against about 11.5 min for one Cycles still at the new quality settings.

Tested with Godot 4.4.1-stable (MIT licence). `mounter.glb` is generated, not committed.
Illustrative reconstruction of a generic placement machine; Plant EG-01 is fictional.
