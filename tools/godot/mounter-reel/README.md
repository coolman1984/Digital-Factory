# Mounter B reel (Godot 4)

A 6-second product move of Mounter B rendered by Godot's Forward+ renderer: a studio sky for reflections, a soft key with
shadows, SDFGI and SSIL bounce light, SSAO contact shadows, screen-space reflections, TAA + MSAA. The model is the same
Blender asset the machine studio uses, loaded at run time.

Why a game engine next to Blender: Blender (Cycles) gives the reference stills and film frames; Godot draws a frame in a
fraction of a second on a graphics card, so moves, previews and social cuts are fast to iterate. Same asset, two paths.

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
