"""Look-dev calibration chart: the studio rig, cards of known reflectance, reference spheres and the materials we ship.

Used to lock exposure and the view transform before judging any machine (docs/RENDER_QUALITY_AUDIT.md). The cards are
matte with linear reflectance 0.04 (black), 0.18 (photographic mid-grey) and 0.90 (white); the spheres are chrome and
neutral grey at roughness 0.1 / 0.4 / 0.8; the swatches are the shared material library plus the plant's area colours.
Writes the render and a JSON of where each sample's centre lands in the image, so output values can be measured.

    python lookdev.py --out chart.png [--view AgX|"Khronos PBR Neutral"] [--look "AgX - Medium High Contrast"]
                      [--exposure 0] [--samples 128] [--res 1600x900] [--points chart.json]
"""
import sys, os, math, json, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from bpy_extras.object_utils import world_to_camera_view
import dflib as L
from dflib import Part, assembly, principled

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--out', required=True); ap.add_argument('--view', default='AgX'); ap.add_argument('--look', default='AgX - Medium High Contrast')
ap.add_argument('--exposure', type=float, default=0.0); ap.add_argument('--samples', type=int, default=128); ap.add_argument('--res', default='1600x900')
ap.add_argument('--points', default=''); ap.add_argument('--rig', default='studio', choices=['studio', 'studio2', 'hall'])
A = ap.parse_args(argv)
L.init(lod='full')

lin = lambda v: (v, v, v, 1.0)
principled('card_black', lin(0.04), rough=0.9, spec=0.3); principled('card_grey', lin(0.18), rough=0.9, spec=0.3); principled('card_white', lin(0.90), rough=0.9, spec=0.3)
principled('chrome', '#FFFFFF', metal=1.0, rough=0.03)
for r in (0.1, 0.4, 0.8): principled(f'grey_r{int(r * 10)}', lin(0.18), rough=r)
# the plant's own colours (assembly_area.py), so palette decisions are judged on the same chart
principled('bin_blue', '#1D5FB8', rough=0.45); principled('uniform_blue', '#1F4FB5', rough=0.8); principled('cardboard', '#B98D5B', rough=0.85)
principled('esd_mat', '#3E7A5A', rough=0.8); principled('tube_cream', '#E6DFCC', rough=0.45, coat=0.3); principled('balancer_yellow', '#E9B80C', rough=0.4, coat=0.3)

assembly('CHART', 'Look-dev calibration chart')
p = Part('CHART.cards', 'Black, mid-grey and white cards', 'CHART', bevel=0)
pts = {}
for i, (m, x) in enumerate((('card_black', -0.75), ('card_grey', 0.0), ('card_white', 0.75))):
    p.box((0.6, 0.02, 0.6), (x, 0.4, 1.25), m); pts[m] = (x, 0.385, 1.25)
s = Part('CHART.spheres', 'Chrome and grey spheres at three roughnesses', 'CHART', bevel=0)
for i, m in enumerate(('chrome', 'grey_r1', 'grey_r4', 'grey_r8')):
    x = -0.9 + i * 0.6; s.sphere(0.2, (x, -0.2, 0.2), m, seg=48, rings=24); pts[m] = (x, -0.4, 0.26)
w = Part('CHART.swatches', 'Material swatches', 'CHART', bevel=0.004)
sw = ['paint_white', 'paint_grey', 'paint_blue', 'alu_brushed', 'steel_polished', 'plastic_black', 'rubber',
      'bin_blue', 'uniform_blue', 'cardboard', 'esd_mat', 'tube_cream', 'balancer_yellow', 'pcb_green']
for i, m in enumerate(sw):
    x = -1.3 + (i % 7) * 0.43; z = 0.72 if i < 7 else 0.4
    w.box((0.36, 0.06, 0.26), (x, 0.1, z), m); pts[m] = (x, 0.07, z)
for q in (p, s, w): q.build()

if A.rig in ('studio', 'studio2'): L.studio(scale=1.0, center=(0, 0, 0.7), rot_deg=0, rig='v2' if A.rig == 'studio2' else 'v1')
else:
    # the assembly-area rig as found (bright world, small bay lights, one big key) for comparison
    L.cyclorama(1.0, 0); L.world('#C9CED6', 0.65)
    for gx in (-1.5, 1.5): L.area(f'light.bay{gx}', (gx, 0, 6.5), (gx, 0, 0), 1.2, 260, (1.0, 0.98, 0.95), size_y=0.6)
    L.area('light.key', (-8, -12, 9), (0, -1.5, 0.9), 6.0, 2400, (1.0, 0.97, 0.93))
cam = L.camera((0, 1.05, 4.6), (0, 0.72, 0), fov=26, fstop=0)
L.render(os.path.abspath(A.out), samples=A.samples, res=A.res, view=A.view, look=A.look, exposure=A.exposure, threshold=0.01, clamp=10)
if A.points:
    sc = bpy.context.scene; rx, ry = (int(v) for v in A.res.split('x')); out = {}
    for k, (x, y, z) in pts.items():
        c = world_to_camera_view(sc, cam, __import__('mathutils').Vector((x, y, z))); out[k] = [round(c.x * rx), round((1 - c.y) * ry)]
    json.dump(out, open(A.points, 'w'), indent=1); print('WROTE', A.points)
