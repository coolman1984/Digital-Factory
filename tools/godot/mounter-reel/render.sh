#!/bin/bash
# render.sh <out_dir> [godot_binary]: the 6-second reel in N parallel slices (one renderer thread each), then one MP4.
# Measured on 4 CPU cores with software Vulkan: about 2x the throughput of one process using all cores.
set -e
OUT=${1:-out}; GODOT=${2:-godot}; N=${SLICES:-4}; FRAMES=180; PRE=30
ARGS="--fsr=0.67 --no-msaa --exposure=1.1 --fill=2.0 ${EXTRA:-}"; RES=${RES:-1920x1080}
mkdir -p "$OUT"; DIR=$(cd "$(dirname "$0")" && pwd)
[ -n "$ASSEMBLE_ONLY" ] || for i in $(seq 0 $((N - 1))); do
  a=$((i * FRAMES / N)); b=$(((i + 1) * FRAMES / N)); mkdir -p "$OUT/s$i"
  LP_NUM_THREADS=${LP_NUM_THREADS:-1} $GODOT --path "$DIR" --write-movie "$OUT/s$i/f.png" --fixed-fps 30 --resolution $RES \
    -- $ARGS --range=$a,$b > "$OUT/s$i.log" 2>&1 &
done
[ -n "$ASSEMBLE_ONLY" ] || wait
# keep each slice's frames after its warm-up, in order (b - a of them: the slice's last frame is the next one's first)
k=0; rm -rf "$OUT/all"; mkdir -p "$OUT/all"
for i in $(seq 0 $((N - 1))); do
  a=$((i * FRAMES / N)); b=$(((i + 1) * FRAMES / N))
  for f in $(ls "$OUT/s$i"/f*.png | sort | tail -n +$((PRE + 1)) | head -n $((b - a))); do cp "$f" "$OUT/all/$(printf 'f%04d.png' $k)"; k=$((k + 1)); done
done
ffmpeg -v error -y -framerate 30 -i "$OUT/all/f%04d.png" -frames:v $FRAMES -c:v libx264 -crf 17 -preset slow -pix_fmt yuv420p -movflags +faststart "$OUT/mounter-reel.mp4"
echo "frames: $k -> $OUT/mounter-reel.mp4"
