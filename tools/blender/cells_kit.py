"""Cell kit for the live plant's main lines: the people at work, after Samsung Kaluga and LG Gumi (docs/REFERENCES-TV-PLANT.md §2b, §2c).

Phase 2 of docs/PLANT-UPGRADE-PLAN.md. The plant (plant.html) keeps its layout and its stations; this kit fills the gaps
between a main line's first stations with operators, and puts a U-shaped sub-assembly cell beside the board station.

  CELLS.bay  one 3.6 m stretch of line-side work between two stations: two operators on the main side and one on the far
             side, standing on green ESD mats, gravity flow racks of blue bins and part boxes behind them, a lean-tube frame
             over the line with an LED task light, work-instruction monitors, a stack light and screwdrivers on balancers.
             No conveyor and no sets: the plant draws its own belt and its own moving units.
  CELLS.u    a U-shaped sub-assembly cell centred 4 m beside the line on the far side (three benches, five operators, flow
             racks outside the U), with a roller conveyor that brings the kits to the line edge.

Anchor of both nodes: the line centre line at the station gap (bay) or the board station (cell), on the floor. X along the
flow, the operators' main side -Y (the plant's +z, where the engine's own operators stand), the far side +Y.
Illustrative reconstruction: no real plant's layout, staffing or vendor design.

    python cells_kit.py --glb cells-plant.glb [--manifest parts.json] [--out preview.png --samples 32 --gpu]
"""
import sys, os, math, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, Matrix
import dflib as L
from dflib import Part, assembly, principled

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--glb', default=''); ap.add_argument('--manifest', default=''); ap.add_argument('--out', default='')
ap.add_argument('--samples', type=int, default=32); ap.add_argument('--res', default='1600x900'); ap.add_argument('--lod', default='plant')
ap.add_argument('--gpu', action='store_true')
A = ap.parse_args(argv)
L.init(lod=A.lod)
H = math.pi / 2

principled('tube_cream', '#E6DFCC', rough=0.45, coat=0.3)          # plastic-coated steel pipe of lean frames
principled('joint_black', '#1B1C1F', rough=0.5)
principled('balancer_yellow', '#E9B80C', rough=0.4, coat=0.3)
principled('monitor_white', '#ECEEF0', rough=0.4)
principled('ui_page', '#E8ECF2', emission='#E8ECF2', strength=2.5)
principled('ui_blue', '#1430A0', emission='#2A4BD0', strength=2.5)
principled('esd_mat', '#3E7A5A', rough=0.8)
principled('bin_blue', '#1D5FB8', rough=0.45)
principled('bin_red', '#C23B2E', rough=0.45)
principled('roller_beige', '#D9C7A0', rough=0.4)
principled('cardboard', '#B98D5B', rough=0.85)
principled('chassis', '#B8BEC6', metal=1.0, rough=0.3)
principled('skin', '#B98F70', rough=0.55)
principled('uniform_blue', '#1F4FB5', rough=0.8)                   # the royal-blue work jacket of the Kaluga photos
principled('vest_light', '#C9D3DE', rough=0.8)
principled('shirt_grey', '#7C838D', rough=0.8)
principled('trousers', '#2B2F38', rough=0.85)
principled('shoe', '#15161A', rough=0.6)
principled('cap', '#F2F4F6', rough=0.7)
principled('glove', '#E9ECEF', rough=0.7)

TR = 0.014                    # lean tube radius (28 mm pipe)
BL = 3.6                      # a bay fills the gap between two stations (the plant spaces them 7.5 m, about 4.4 m clear)
LW = 0.625                    # half the plant's pallet conveyor width (1.25 m)
JACKETS = ['uniform_blue', 'uniform_blue', 'uniform_blue', 'vest_light', 'uniform_blue', 'shirt_grey']
_who = [0]


def tube(part, a, b):
    a, b = Vector(a), Vector(b); d = b - a
    part.cyl(TR, d.length, tuple((a + b) / 2), 'tube_cream', rot=tuple(d.to_track_quat('Z', 'Y').to_euler()), seg=8)


def person(part, x, y, face=0.0, reach=0.34):
    """A standing operator facing `face` (0 = +Y, H = -X, -H = +X): cap, jacket, gloved hands at bench height."""
    R = Matrix.Rotation(face, 4, 'Z')
    P = lambda dx, dy, dz: tuple(Vector((x, y, 0)) + (R @ Vector((dx, dy, dz))))
    top = JACKETS[_who[0] % len(JACKETS)]; _who[0] += 1
    for sx in (-1, 1):
        part.cyl(0.065, 0.8, P(sx * 0.09, 0, 0.44), 'trousers', seg=10, r2=0.055)
        part.sphere(0.06, P(sx * 0.09, 0.05, 0.04), 'shoe', scale=(0.8, 1.9, 0.6))
    part.sphere(0.2, P(0, 0, 0.9), 'trousers', scale=(1.0, 0.65, 0.55))
    part.sphere(0.21, P(0, 0, 1.18), top, scale=(1.0, 0.62, 1.45))
    part.cyl(0.05, 0.12, P(0, 0, 1.48), 'skin', seg=10)
    part.sphere(0.105, P(0, 0.01, 1.63), 'skin', scale=(0.92, 1.0, 1.12))
    part.sphere(0.112, P(0, -0.005, 1.69), 'cap', scale=(1.0, 1.05, 0.62))
    for sx in (-1, 1):
        part.sweep([P(sx * 0.22, 0, 1.38), P(sx * 0.25, 0.04, 1.16), P(sx * 0.16, reach * 0.7, 1.03), P(sx * 0.1, reach, 0.98)], 0.042, top)
        part.sphere(0.045, P(sx * 0.1, reach + 0.03, 0.98), 'glove', scale=(0.8, 1.2, 0.6))


def flow_rack(rk, bins, x, y, side, w=0.78, tiers=2):
    """A small gravity flow rack: shelves tilt down toward the operator (side -1: operator at lower y)."""
    for sx in (-w / 2, w / 2):
        rk.box((0.03, 0.03, 1.2), (x + sx, y + side * 0.2, 0.6), 'alu_brushed'); rk.box((0.03, 0.03, 1.0), (x + sx, y - side * 0.2, 0.5), 'alu_brushed')
    for k in range(tiers):
        z = 0.62 + k * 0.36; tilt = side * (-0.2 if k == 0 else 0.15)
        rk.box((w, 0.45, 0.015), (x, y, z), 'steel_dark', rot=(tilt, 0, 0))
        for b in range(3):
            bins.box((0.22, 0.32, 0.12), (x - 0.25 + b * 0.25, y, z + 0.075), 'bin_red' if (k == 1 and b == 2) else 'bin_blue', rot=(tilt, 0, 0))


def monitor(sc, x, y, z, face=-1):
    """A white work-instruction monitor facing the operator (face -1: toward -Y), the page lit with a blue header."""
    sc.box((0.5, 0.04, 0.36), (x, y, z), 'monitor_white', rot=(face * -math.radians(8), 0, 0))
    sc.box((0.44, 0.004, 0.26), (x, y + face * 0.022, z - 0.02), 'ui_page', rot=(face * -math.radians(8), 0, 0))
    sc.box((0.44, 0.004, 0.04), (x, y + face * 0.024, z + 0.13), 'ui_blue', rot=(face * -math.radians(8), 0, 0))
    sc.box((0.06, 0.06, 0.16), (x, y - face * 0.03, z - 0.24), 'monitor_white')


# ---------------------------------------------------------------- CELLS.bay: operators between two stations
def bay():
    assembly('CELLS.bay', 'Line-side work between two stations: operators at the line, flow racks, a lean frame with light, monitors and screwdrivers')
    fl = Part('CELLS.bay.floor', 'Green ESD mats and part boxes on the floor', 'CELLS.bay', bevel=0)
    for sy in (-1, 1): fl.box((BL - 0.2, 0.9, 0.008), (0, sy * (LW + 0.5), 0.004), 'esd_mat')
    for x in (-1.55, 1.45):                                     # stacked cardboard part boxes at the main-side ends
        for k in range(2): fl.box((0.5, 0.36, 0.28), (x, -(LW + 1.35), 0.14 + k * 0.29), 'cardboard', rot=(0, 0, 0.06 * (k * 2 - 1)))
    fl.build()
    fr = Part('CELLS.bay.frame', 'Lean-tube frame over the line: posts, top rails, balancer rail', 'CELLS.bay', bevel=0)
    jt = Part('CELLS.bay.joints', 'Frame joints', 'CELLS.bay', bevel=0)
    x0, x1 = -BL / 2 + 0.15, BL / 2 - 0.15
    for x in (x0, x1):
        for sy in (-1, 1):
            tube(fr, (x, sy * 0.78, 0.0), (x, sy * 0.78, 2.2)); jt.box((0.045, 0.045, 0.045), (x, sy * 0.78, 2.2), 'joint_black')
        tube(fr, (x, -0.78, 2.2), (x, 0.78, 2.2))
    for sy in (-1, 1): tube(fr, (x0, sy * 0.78, 2.2), (x1, sy * 0.78, 2.2))
    tube(fr, (x0, -0.25, 2.1), (x1, -0.25, 2.1))
    fr.build(); jt.build()
    li = Part('CELLS.bay.lights', 'LED task light and the stack light', 'CELLS.bay', bevel=0)
    li.box((2.4, 0.08, 0.025), (0, -0.45, 2.12), 'led_white'); li.box((2.4, 0.1, 0.02), (0, -0.45, 2.145), 'alu_brushed')
    for k, m in enumerate(('led_green', 'lens_amber', 'lens_red')): li.cyl(0.03, 0.055, (x0 + 0.02, -0.78, 2.26 + k * 0.058), m, seg=12)
    li.build()
    sc = Part('CELLS.bay.screens', 'Work-instruction monitors and torque controllers', 'CELLS.bay', bevel=0)
    for x in (-0.8, 0.8): monitor(sc, x, -0.86, 1.62)
    monitor(sc, 0.3, 0.86, 1.62, face=1)
    for x in (-0.25, 1.1): sc.box((0.18, 0.1, 0.12), (x, -0.55, 2.02), 'anodised_dark')
    sc.build()
    tl = Part('CELLS.bay.tools', 'Electric screwdrivers on yellow spring balancers', 'CELLS.bay', bevel=0)
    for bx in (-0.95, -0.55, 0.65, 1.05):
        tl.cyl(0.05, 0.07, (bx, -0.25, 2.03), 'balancer_yellow', rot=(H, 0, 0), seg=12)
        tl.cyl(0.003, 0.55, (bx, -0.25, 1.72), 'steel_dark', seg=6)
        tl.cyl(0.022, 0.24, (bx, -0.25, 1.32), 'plastic_black', seg=10)
    tl.build()
    rk = Part('CELLS.bay.racks', 'Gravity flow racks behind the operators', 'CELLS.bay', bevel=0)
    bins = Part('CELLS.bay.bins', 'Part bins (blue for parts, red for rejects)', 'CELLS.bay', bevel=0)
    for x in (-0.8, 0.8): flow_rack(rk, bins, x, -(LW + 1.25), side=1)
    flow_rack(rk, bins, 0.3, LW + 1.25, side=-1)
    rk.build(); bins.build()
    pp = Part('CELLS.bay.operators', 'Operators at the line (illustrative figures)', 'CELLS.bay', bevel=0)
    person(pp, -0.8, -(LW + 0.42), face=0.0)
    person(pp, 0.8, -(LW + 0.42), face=0.0, reach=0.38)
    person(pp, 0.3, LW + 0.42, face=math.pi)
    pp.build()


# ---------------------------------------------------------------- CELLS.u: U-shaped sub-assembly cell beside the line
def ucell():
    assembly('CELLS.u', 'U-shaped sub-assembly cell beside the line: three benches, operators inside the U, a roller conveyor to the line')
    cx, cy = 0.0, 4.0                                           # the cell centre, 4 m off the line on the far side (+Y)
    fl = Part('CELLS.u.floor', 'ESD mat under the cell', 'CELLS.u', bevel=0)
    fl.box((3.4, 3.0, 0.008), (cx, cy, 0.004), 'esd_mat'); fl.build()
    cb = Part('CELLS.u.benches', 'Cell workbenches with ESD tops and overhead frames', 'CELLS.u', bevel=0)
    ck = Part('CELLS.u.kits', 'Sub-assemblies in progress: board brackets and stand kits', 'CELLS.u', bevel=0)
    # left, back (away from the line) and right benches: (centre, size, the side away from the operator)
    benches = [((cx - 1.2, cy), (0.7, 2.4), (-1, 0)), ((cx, cy + 1.15), (1.7, 0.7), (0, 1)), ((cx + 1.2, cy), (0.7, 2.4), (1, 0))]
    for (bx, by), (bw, bd), (ax, ay) in benches:
        cb.box((bw, bd, 0.04), (bx, by, 0.86), 'esd_mat'); cb.box((bw + 0.02, bd + 0.02, 0.03), (bx, by, 0.83), 'alu_brushed')
        for sx in (-1, 1):
            for sy in (-1, 1): cb.box((0.04, 0.04, 0.82), (bx + sx * (bw / 2 - 0.04), by + sy * (bd / 2 - 0.04), 0.41), 'alu_brushed')
        # an overhead frame on the far edge: two posts, a top rail and a light bar
        long_x = bw > bd; Lb = max(bw, bd)
        ex, ey = bx + ax * (bw / 2 - 0.04), by + ay * (bd / 2 - 0.04)
        for e in (-1, 1):
            cb.box((0.04, 0.04, 1.2), ((bx + e * (Lb / 2 - 0.04), ey, 1.48) if long_x else (ex, by + e * (Lb / 2 - 0.04), 1.48)), 'alu_brushed')
        cb.box(((Lb, 0.05, 0.05) if long_x else (0.05, Lb, 0.05)), ((bx, ey, 2.08) if long_x else (ex, by, 2.08)), 'alu_brushed')
        cb.box(((Lb * 0.8, 0.08, 0.02) if long_x else (0.08, Lb * 0.8, 0.02)), ((bx, ey, 2.04) if long_x else (ex, by, 2.04)), 'led_white')
        for k in range(1 if long_x else 2):
            kx, ky = (bx, by) if long_x else (bx, by - bd / 4 + k * bd / 2)
            ck.box((0.34, 0.24, 0.01), (kx, ky, 0.885), 'chassis'); ck.box((0.24, 0.16, 0.01), (kx, ky, 0.895), 'pcb_green')
    cb.build(); ck.build()
    pp = Part('CELLS.u.operators', 'Cell operators (illustrative figures)', 'CELLS.u', bevel=0)
    for k in range(2):
        person(pp, cx - 0.62, cy - 0.5 + k * 1.0, face=H)          # facing the left bench
        person(pp, cx + 0.62, cy - 0.5 + k * 1.0, face=-H)         # facing the right bench
    person(pp, cx, cy + 0.55, face=0.0)                            # facing the back bench
    pp.build()
    cv = Part('CELLS.u.feed', 'Flow racks outside the U and the roller conveyor to the line', 'CELLS.u', bevel=0)
    cbins = Part('CELLS.u.bins', 'Cell part bins, fed from the aisle', 'CELLS.u', bevel=0)
    for sx in (-1, 1):
        rx = cx + sx * 1.85
        for z in (0.6, 1.0, 1.4):
            cv.box((0.5, 2.2, 0.02), (rx, cy, z), 'steel_dark', rot=(0, sx * 0.15, 0))
            for b in range(4): cbins.box((0.3, 0.42, 0.14), (rx, cy - 0.8 + b * 0.53, z + 0.09), 'bin_blue', rot=(0, sx * 0.15, 0))
        for sy in (-1, 1): cv.box((0.035, 0.035, 1.6), (rx, cy + sy * 1.05, 0.8), 'alu_brushed')
    y0, y1 = 1.25, cy - 1.25                                       # from the open end of the U to the edge of the station (2.4 m deep)
    n = int((y1 - y0) / 0.1)
    for k in range(n): cv.cyl(0.025, 0.5, (cx, y0 + 0.05 + k * (y1 - y0) / n, 0.84), 'roller_beige', rot=(0, H, 0), seg=8)
    for sx in (-1, 1):
        cv.box((0.04, y1 - y0, 0.08), (cx + sx * 0.27, (y0 + y1) / 2, 0.82), 'alu_brushed')
        for y in (y0 + 0.1, y1 - 0.1): cv.box((0.04, 0.04, 0.8), (cx + sx * 0.27, y, 0.4), 'alu_brushed')
    for k in range(2): cbins.box((0.34, 0.24, 0.04), (cx, y0 + 0.4 + k * 0.9, 0.89), 'chassis')
    cv.build(); cbins.build()


bay(); ucell()

if A.manifest:
    L.manifest(A.manifest, 'cells', 'Main-line cell kit (plant level of detail)',
               'Illustrative reconstruction after public photos of real TV lines (Samsung Kaluga, LG Gumi); not a real plant, staffing or vendor design.')
if A.glb:
    L.export_glb(os.path.abspath(A.glb), 'CELLS.')
    print('WROTE', A.glb)
if A.out:
    L.ASSEMBLIES['CELLS.u'].location.x = 4.6
    L.studio(scale=2.6, center=(2.3, 2.0, 1.0), rot_deg=20)
    L.camera((2.3 + 3.5, 7.5, -8.5), (2.3, 0.9, -2.0), fov=42)         # three.js axes (x, up, -y): looking from the main side
    if A.gpu:
        bpy.context.scene.cycles.device = 'GPU'
        pr = bpy.context.preferences.addons['cycles'].preferences; pr.compute_device_type = 'OPTIX'; pr.get_devices()
        for d in pr.devices: d.use = d.type == 'OPTIX'
    L.render(os.path.abspath(A.out), samples=A.samples, res=A.res)
    print('WROTE', A.out)
