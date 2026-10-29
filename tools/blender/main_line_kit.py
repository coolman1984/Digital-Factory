"""Main-line station kit for the live plant: the stations every main line of Plant EG-01 repeats, built after real TV lines.

The live plant (plant.html) draws each main line as ten stations on a pallet conveyor. Until now six of them were plain
cabinets. This kit replaces them, kind by kind, with stations modelled after the LG Gumi, Samsung Kaluga and Hisense
references (docs/REFERENCES-TV-PLANT.md §2b and §5):

  ML.bench   manual station: pallet conveyor, lean-tube frames on both sides, task lights, work-instruction monitors,
             screwdrivers on yellow spring balancers, a flow rack of blue bins, green ESD mats
  ML.robot   screw-fastening cell: conveyor through a mesh guard with yellow posts, light curtains at the openings, the robot
             pedestal (the arm itself stays the plant's animated robot), screw feeder, controller cabinet, HMI
  ML.fct     function test: the set stands upright on the test conveyor, leaning back about 12°, pattern generator shelf,
             test monitor, signal cables
  ML.wb      white balance: a dark booth (black panels and a curtain), a colour analyser probe on an arm in front of the
             screen, the alignment PC
  ML.qa      final QA: a lit grey inspection booth, inspection lamp, checklist screen, reject rack
  ML.packer  packing: roller conveyor, lift assist (gantry with a vacuum frame), carton erecting table, EPS cushion stacks,
             taping head at the outfeed, accessory bins

Each kind is centred on its footprint (the engine's KIND sizes), X along the flow, the operator side -Y, conveyor top at
0.74 m (the plant's pallet conveyors). Units, the people and the robot arms stay the plant's own animated instances.
Illustrative reconstruction: no real plant's or vendor's design.

    python main_line_kit.py --glb mainline-plant.glb [--manifest parts.json] [--out preview.png --samples 32]
"""
import sys, os, math, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import dflib as L
from dflib import Part, assembly, principled

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--glb', default=''); ap.add_argument('--manifest', default=''); ap.add_argument('--out', default='')
ap.add_argument('--samples', type=int, default=32); ap.add_argument('--res', default='1600x900'); ap.add_argument('--lod', default='plant')
A = ap.parse_args(argv)
L.init(lod=A.lod)
H = math.pi / 2
ZC = 0.74          # conveyor top: where the plant draws the pallets and sets

principled('tube_cream', '#E6DFCC', rough=0.45, coat=0.3)          # plastic-coated steel pipe of lean frames
principled('joint_black', '#1B1C1F', rough=0.5)
principled('balancer_yellow', '#E9B80C', rough=0.4, coat=0.3)
principled('monitor_white', '#ECEEF0', rough=0.4)
principled('ui_page', '#E8ECF2', emission='#E8ECF2', strength=2.5)
principled('ui_blue', '#1430A0', emission='#2A4BD0', strength=2.5)
principled('ui_green', '#1FA34A', emission='#22C55E', strength=2.5)
principled('esd_mat', '#3E7A5A', rough=0.8)
principled('bin_blue', '#1D5FB8', rough=0.45)
principled('bin_red', '#C23B2E', rough=0.45)
principled('roller_beige', '#D9C7A0', rough=0.4)
principled('mesh_fence', '#3A3F46', rough=0.6, alpha=0.38)
principled('safety_yellow', '#F2C500', rough=0.45, coat=0.2)
principled('curtain_black', '#101113', rough=0.9)
principled('booth_grey', '#C9CDD2', rough=0.7)
principled('cardboard', '#B98D5B', rough=0.85)
principled('eps', '#F3F3EF', rough=0.9)
principled('tape', '#C9A86A', rough=0.3)
bars = [('bar_w', '#C0C0C0'), ('bar_y', '#C0C000'), ('bar_c', '#00C0C0'), ('bar_g', '#00C000'), ('bar_m', '#C000C0'), ('bar_r', '#C00000'), ('bar_b', '#0000C0')]
for n, c in bars: principled(n, c, emission=c, strength=3.0)
MAT_NAMES = {}

KIND = {'bench': (3.0, 2.4), 'robot': (3.2, 2.6), 'fct': (3.0, 2.4), 'wb': (3.2, 2.6), 'qa': (3.4, 2.8), 'packer': (4.0, 2.8)}


def conveyor(p, W, rollers=False, z=ZC, w=1.25):
    """A section of the pallet conveyor: twin chain strands (or beige rollers), aluminium side rails, legs and feet."""
    for s in (-1, 1):
        p.box((W, 0.05, 0.12), (0, s * w / 2, z - 0.02), 'alu_brushed')                       # side rail, its lip just above the pallets
        if not rollers: p.box((W, 0.06, 0.02), (0, s * 0.38, z - 0.03), 'plastic_black')      # chain strand
    if rollers:
        n = int(W / 0.12)
        for i in range(n): p.cyl(0.03, w - 0.08, (-W / 2 + 0.06 + i * W / n, 0, z - 0.035), 'roller_beige', rot=(H, 0, 0), seg=8)
    p.box((W, w - 0.1, 0.03), (0, 0, z - 0.12), 'steel_dark')                                  # return pan
    for x in (-W / 2 + 0.1, W / 2 - 0.1):
        for s in (-1, 1):
            p.box((0.05, 0.05, z - 0.1), (x, s * (w / 2 - 0.05), (z - 0.1) / 2), 'alu_brushed')
            p.box((0.12, 0.12, 0.01), (x, s * (w / 2 - 0.05), 0.005), 'steel_dark')
        p.box((0.04, w - 0.1, 0.04), (x, 0, 0.25), 'alu_brushed')


def lean_frame(p, x0, x1, y, h=2.05, light=True):
    """A lean-tube frame along the line on one side: posts, top and middle rails, black joints, an LED task light."""
    for x in (x0, x1):
        p.cyl(0.014, h, (x, y, h / 2), 'tube_cream', seg=8); p.box((0.05, 0.05, 0.05), (x, y, h - 0.03), 'joint_black')
        p.box((0.05, 0.05, 0.05), (x, y, 1.1), 'joint_black'); p.box((0.1, 0.1, 0.01), (x, y, 0.005), 'joint_black')
    p.cyl(0.014, x1 - x0, ((x0 + x1) / 2, y, h - 0.03), 'tube_cream', rot=(0, H, 0), seg=8)
    p.cyl(0.014, x1 - x0, ((x0 + x1) / 2, y, 1.1), 'tube_cream', rot=(0, H, 0), seg=8)
    if light:
        p.cyl(0.014, abs(y) + 0.1, ((x0 + x1) / 2, y / 2, h - 0.03), 'tube_cream', rot=(H, 0, 0), seg=8)
        p.box(((x1 - x0) * 0.7, 0.07, 0.03), ((x0 + x1) / 2, y * 0.55, h - 0.08), 'monitor_white'); p.box(((x1 - x0) * 0.66, 0.05, 0.005), ((x0 + x1) / 2, y * 0.55, h - 0.097), 'led_white')


def monitor(p, x, y, z, face=1, page=True):
    """A white work-instruction monitor on a short arm, facing the operator (face=-1 looks to -Y)."""
    p.box((0.46, 0.04, 0.32), (x, y, z), 'monitor_white'); p.cyl(0.012, 0.18, (x, y - face * 0.1, z - 0.05), 'joint_black', rot=(H, 0, 0), seg=6)
    fy = y + face * 0.022
    if page:
        p.box((0.42, 0.004, 0.27), (x, fy, z), 'ui_page'); p.box((0.42, 0.005, 0.04), (x, fy + face * 0.0005, z + 0.115), 'ui_blue')
        p.box((0.14, 0.005, 0.1), (x - 0.11, fy + face * 0.0005, z - 0.01), 'ui_green')


def balancer(p, x, y, top=1.98, tool=1.05):
    """A yellow spring balancer hanging from the frame, its cable and the electric screwdriver at work height."""
    p.cyl(0.055, 0.1, (x, y, top - 0.08), 'balancer_yellow', rot=(H, 0, 0), seg=10)
    p.cyl(0.003, top - tool - 0.24, (x, y, (top - 0.13 + tool + 0.12) / 2), 'joint_black', seg=4)
    p.cyl(0.022, 0.24, (x, y, tool), 'plastic_black', seg=8); p.cyl(0.006, 0.08, (x, y, tool - 0.16), 'steel_polished', seg=6)


def flow_rack(p, x, y, w=1.0, face=1):
    """An inclined flow rack of blue bins beside the operator, fed from the aisle behind."""
    for dx in (-w / 2, w / 2):
        for dy in (-0.25, 0.25): p.cyl(0.014, 1.5, (x + dx, y + dy, 0.75), 'tube_cream', seg=8)
    for k, z in enumerate((0.75, 1.1, 1.45)):
        p.box((w, 0.55, 0.02), (x, y, z - 0.02), 'alu_brushed', rot=(face * 0.18, 0, 0))
        for i in range(int(w / 0.3)): p.box((0.26, 0.4, 0.13), (x - w / 2 + 0.17 + i * 0.3, y, z + 0.06), 'bin_red' if (i + k) % 5 == 4 else 'bin_blue', rot=(face * 0.18, 0, 0))


def stand_set(p, x, z0, w=1.23, h=0.72, tilt=math.radians(12), screen='bars'):
    """A TV standing on the test conveyor, leaning back by tilt, showing a test picture (colour bars by default)."""
    zc = z0 + h / 2 * math.cos(tilt); yc = 0.05 + h / 2 * math.sin(tilt)
    p.box((w, 0.05, h), (x, yc, zc), 'plastic_black', rot=(-tilt, 0, 0))
    fy, fz = yc - 0.028 * math.cos(tilt), zc - 0.028 * math.sin(tilt)
    if screen == 'bars':
        for k, (n, _) in enumerate(bars):
            bw = (w - 0.04) / 7; cx = x - (w - 0.04) / 2 + (k + 0.5) * bw
            p.box((bw, 0.004, (h - 0.04) * 0.66), (cx, fy - math.sin(tilt) * h * 0.11, fz + math.cos(tilt) * h * 0.11 - 0.0), n, rot=(-tilt, 0, 0))
        p.box((w - 0.04, 0.004, (h - 0.04) * 0.3), (x, fy + math.sin(tilt) * h * 0.33, fz - math.cos(tilt) * h * 0.33), 'ui_page', rot=(-tilt, 0, 0))
    else:
        p.box((w - 0.04, 0.004, h - 0.04), (x, fy, fz), screen, rot=(-tilt, 0, 0))
    p.box((0.5, 0.18, 0.04), (x, 0.1, z0 + 0.02), 'plastic_black')                     # the fixture's base clamp


# ---------------------------------------------------------------- ML.bench: manual station (PBA, SMPS, speakers, cables)
def bench():
    W, D = KIND['bench']; assembly('ML.bench', 'Manual station on the pallet conveyor: lean-tube frames, screwdrivers on balancers, monitors, flow racks')
    p = Part('ML.bench.frame', 'Pallet conveyor, lean frames and task lights', 'ML.bench', bevel=0)
    conveyor(p, W)
    for y in (-0.95, 0.95): lean_frame(p, -W / 2 + 0.12, W / 2 - 0.12, y)
    p.box((W, 0.9, 0.004), (0, -1.55, 0.002), 'esd_mat'); p.box((W, 0.9, 0.004), (0, 1.55, 0.002), 'esd_mat')
    t = Part('ML.bench.tools', 'Screwdrivers on spring balancers and work-instruction monitors', 'ML.bench', bevel=0)
    for x in (-0.75, 0.75):
        balancer(t, x, -0.62); balancer(t, x + 0.2, 0.62)
    monitor(t, -0.2, -0.93, 1.45, face=-1); monitor(t, 0.6, 0.93, 1.45, face=1)
    t.box((0.5, 0.3, 0.05), (1.05, -0.93, 1.12), 'alu_brushed'); t.box((0.3, 0.22, 0.12), (1.05, -0.93, 1.21), 'bin_blue')   # screw tray
    r = Part('ML.bench.racks', 'Flow racks of part bins, fed from the aisle', 'ML.bench', bevel=0)
    flow_rack(r, -0.85, -1.45, 1.0, face=-1); flow_rack(r, 0.95, 1.45, 0.9, face=1)
    for q in (p, t, r): q.build()


# ---------------------------------------------------------------- ML.robot: screw-fastening cell
def robot():
    W, D = KIND['robot']; assembly('ML.robot', 'Robot screw-fastening cell: mesh guard, light curtains, pedestal, screw feeder, controller')
    p = Part('ML.robot.guard', 'Mesh guard with yellow posts; the conveyor openings carry light curtains', 'ML.robot', bevel=0)
    conveyor(p, W)
    hh = 2.1
    posts = [(-W / 2, -D / 2), (0, -D / 2), (W / 2, -D / 2), (-W / 2, D / 2), (0, D / 2), (W / 2, D / 2), (-W / 2, -0.75), (W / 2, -0.75), (-W / 2, 0.75), (W / 2, 0.75)]
    for x, y in posts: p.box((0.06, 0.06, hh), (x, y, hh / 2), 'safety_yellow'); p.box((0.14, 0.14, 0.012), (x, y, 0.006), 'safety_yellow')
    for y in (-D / 2, D / 2):
        p.box((W, 0.01, hh - 0.25), (0, y, 0.15 + (hh - 0.25) / 2), 'mesh_fence'); p.box((W, 0.04, 0.04), (0, y, hh - 0.02), 'safety_yellow'); p.box((W, 0.04, 0.04), (0, y, 0.15), 'safety_yellow')
    for x in (-W / 2, W / 2):            # the flow ends: mesh beside the conveyor opening, a header over it, light curtain posts
        for y0, y1 in ((-D / 2, -0.75), (0.75, D / 2)):
            p.box((0.01, y1 - y0, hh - 0.25), (x, (y0 + y1) / 2, 0.15 + (hh - 0.25) / 2), 'mesh_fence')
        p.box((0.04, 1.5, 0.3), (x, 0, hh - 0.15), 'mesh_fence'); p.box((0.04, 1.5, 0.04), (x, 0, hh - 0.32), 'safety_yellow')
        for y in (-0.7, 0.7): p.box((0.045, 0.045, 1.1), (x, y, 0.7 + 0.55), 'plastic_black'); p.box((0.01, 0.02, 0.95), (x, y - 0.025 * (1 if y > 0 else -1), 1.25), 'lens_red')
    e = Part('ML.robot.equipment', 'Robot pedestal, screw feeder, controller cabinet and HMI', 'ML.robot', bevel=0)
    rx, ry = -W * 0.12, D * 0.3     # where the plant's animated arm stands (scene.js ANIM.arm), on the far side
    e.box((0.62, 0.62, 0.84), (rx, ry, 0.42), 'paint_grey'); e.box((0.7, 0.7, 0.03), (rx, ry, 0.015), 'steel_dark')
    e.box((0.42, 0.32, 0.3), (0.85, 0.85, ZC + 0.05), 'paint_white'); e.cyl(0.11, 0.16, (0.85, 0.85, ZC + 0.28), 'steel_polished', seg=12)   # screw feeder bowl
    e.box((0.6, 0.5, 1.6), (W / 2 + 0.36, 0.95, 0.8), 'paint_white'); e.box((0.62, 0.52, 0.06), (W / 2 + 0.36, 0.95, 1.63), 'paint_blue')     # controller outside the guard
    e.box((0.5, 0.04, 0.34), (0.95, -D / 2 - 0.08, 1.35), 'joint_black'); e.box((0.44, 0.005, 0.28), (0.95, -D / 2 - 0.105, 1.35), 'ui_page')
    e.box((0.1, 0.05, 0.1), (1.32, -D / 2 - 0.06, 1.35), 'estop_yellow'); e.cyl(0.032, 0.04, (1.32, -D / 2 - 0.1, 1.35), 'estop_red', rot=(H, 0, 0), seg=10)
    for q in (p, e): q.build()


# ---------------------------------------------------------------- ML.fct: function test, set upright
def fct():
    W, D = KIND['fct']; assembly('ML.fct', 'Function test: sets stand upright on the test conveyor, leaning back, showing test patterns')
    p = Part('ML.fct.conveyor', 'Test conveyor with a back rest and the fixture clamps', 'ML.fct', bevel=0)
    conveyor(p, W)
    for x in (-W / 2 + 0.12, W / 2 - 0.12): p.cyl(0.014, 1.45, (x, 0.42, ZC + 0.72), 'tube_cream', seg=8)
    p.cyl(0.014, W - 0.24, (0, 0.42, ZC + 0.7), 'tube_cream', rot=(0, H, 0), seg=8); p.cyl(0.014, W - 0.24, (0, 0.42, 1.95), 'tube_cream', rot=(0, H, 0), seg=8)
    lean_frame(p, -W / 2 + 0.12, W / 2 - 0.12, -0.95)
    s = Part('ML.fct.sets', 'Sets under test showing colour bars (the plant draws the moving set; these are the fixtures)', 'ML.fct', bevel=0)
    s.box((W, 0.9, 0.004), (0, -1.5, 0.002), 'esd_mat')
    g = Part('ML.fct.generator', 'Pattern generator shelf, test monitor and signal cables', 'ML.fct', bevel=0)
    g.box((0.9, 0.45, 0.04), (0.6, 0.95, 1.05), 'alu_brushed')
    for i in range(3): g.box((0.26, 0.32, 0.08), (0.32 + i * 0.28, 0.95, 1.11), 'plastic_black'); g.box((0.02, 0.005, 0.01), (0.32 + i * 0.28 + 0.08, 0.79, 1.12), 'led_green')
    for x in (0.18, 1.02): g.cyl(0.014, 1.05, (x, 0.95, 0.525), 'tube_cream', seg=8)
    monitor(g, -0.7, -0.93, 1.45, face=-1)
    for k in range(3): g.sweep([(0.32 + k * 0.28, 0.8, 1.1), (0.1 + k * 0.1, 0.55, 1.2), (-0.1 + k * 0.08, 0.3, ZC + 0.4)], 0.006, 'joint_black')
    balancer(g, -0.3, -0.62, tool=1.2)
    for q in (p, s, g): q.build()


# ---------------------------------------------------------------- ML.wb: white balance in a dark booth
def wb():
    W, D = KIND['wb']; assembly('ML.wb', 'White balance: dark booth, colour analyser probe on an arm, alignment PC')
    p = Part('ML.wb.booth', 'Dark booth: black panels, roof and an entry curtain', 'ML.wb', bevel=0)
    conveyor(p, W)
    for y in (D / 2,): p.box((W, 0.04, 2.3), (0, y, 1.15), 'curtain_black')
    p.box((W, D, 0.04), (0, 0, 2.3), 'curtain_black')
    for x in (-W / 2, W / 2):
        for y0, y1 in ((-D / 2, -0.7), (0.7, D / 2)): p.box((0.04, y1 - y0, 2.3), (x, (y0 + y1) / 2, 1.15), 'curtain_black')
        p.box((0.04, 1.4, 2.3 - ZC - 0.75), (x, 0, ZC + 0.75 + (2.3 - ZC - 0.75) / 2), 'curtain_black')
    p.box((W * 0.55, 0.03, 2.3 - 0.9), (W * 0.2, -D / 2, 0.9 + (2.3 - 0.9) / 2), 'curtain_black')     # front panel above the operator's window
    p.box((W, 0.03, 0.9), (0, -D / 2, 0.45), 'curtain_black')
    for i in range(7): p.box((0.18, 0.02, 1.4), (-W / 2 + 0.2 + i * 0.19, -D / 2 - 0.02, 1.6), 'curtain_black', rot=(0, 0, 0.05 * (i % 3 - 1)))   # strip curtain
    a = Part('ML.wb.analyser', 'Colour analyser probe on a swing arm and the alignment PC', 'ML.wb', bevel=0)
    a.cyl(0.03, 1.5, (0.2, 0.9, 0.75), 'alu_brushed', seg=8); a.cyl(0.02, 0.9, (0.2, 0.45, 1.45), 'alu_brushed', rot=(H, 0, 0), seg=8)
    a.cyl(0.05, 0.14, (0.2, 0.0, 1.45), 'plastic_black', rot=(H, 0, 0), seg=12); a.cyl(0.035, 0.02, (0.2, -0.08, 1.45), 'lens_amber', rot=(H, 0, 0), seg=10)
    stand_set(a, 0.2, ZC, screen='ui_page')
    a.box((0.6, 0.45, 0.75), (-1.1, -0.9, 0.375), 'paint_white'); monitor(a, -1.1, -0.95, 1.05, face=-1)
    for q in (p, a): q.build()


# ---------------------------------------------------------------- ML.qa: final visual inspection
def qa():
    W, D = KIND['qa']; assembly('ML.qa', 'Final QA: lit inspection booth, inspection lamp, checklist screen, reject rack')
    p = Part('ML.qa.booth', 'Grey inspection booth with a light ceiling', 'ML.qa', bevel=0)
    conveyor(p, W)
    p.box((W, 0.04, 2.3), (0, D / 2, 1.15), 'booth_grey'); p.box((W, D * 0.75, 0.05), (0, D * 0.12, 2.3), 'booth_grey')
    for x in (-W / 2, W / 2): p.box((0.04, D * 0.75, 2.3), (x, D * 0.12, 1.15), 'booth_grey')
    for i in range(3): p.box((W * 0.28, 0.5, 0.01), (-W / 3 + i * W / 3, 0.3, 2.27), 'led_white')
    q = Part('ML.qa.station', 'Inspection lamp, checklist screen, the set under inspection and the reject rack', 'ML.qa', bevel=0)
    stand_set(q, -0.3, ZC, screen='bar_w')
    q.cyl(0.014, 0.9, (0.9, -0.6, 1.6), 'tube_cream', seg=8); q.box((0.5, 0.12, 0.05), (0.9, -0.4, 2.05), 'monitor_white'); q.box((0.46, 0.08, 0.005), (0.9, -0.4, 2.02), 'led_white')
    monitor(q, 1.2, -1.0, 1.4, face=-1)
    for k in range(3): q.box((0.9, 0.5, 0.03), (W / 2 + 0.55, 0.6, 0.35 + k * 0.55), 'alu_brushed')
    for x in (W / 2 + 0.12, W / 2 + 0.98):
        for y in (0.37, 0.83): q.cyl(0.014, 1.6, (x, y, 0.8), 'tube_cream', seg=8)
    q.box((0.85, 0.04, 0.5), (W / 2 + 0.55, 0.85, 1.25), 'bin_red')
    q.box((W, 0.9, 0.004), (0, -1.6, 0.002), 'esd_mat')
    for x in (p, q): x.build()


# ---------------------------------------------------------------- ML.packer: packing station with lift assist
def packer():
    W, D = KIND['packer']; assembly('ML.packer', 'Packing: rollers, lift assist with a vacuum frame, carton table, EPS cushions, taping head, accessory bins')
    p = Part('ML.packer.conveyor', 'Roller conveyor and the carton table', 'ML.packer', bevel=0)
    conveyor(p, W, rollers=True)
    p.box((1.4, 1.0, 0.04), (-0.9, -1.45, 0.78), 'alu_brushed')
    for x in (-1.5, -0.3):
        for y in (-1.85, -1.05): p.box((0.05, 0.05, 0.76), (x, y, 0.38), 'alu_brushed')
    l = Part('ML.packer.lift', 'Lift assist: a gantry over the conveyor with a vacuum frame that lowers the set into its carton', 'ML.packer', bevel=0)
    for x in (-1.1, 0.5):
        for y in (-1.25, 1.25): l.box((0.1, 0.1, 2.6), (x, y, 1.3), 'safety_yellow')
        l.box((0.1, 2.6, 0.12), (x, 0, 2.6), 'safety_yellow')
    l.box((1.7, 0.12, 0.12), (-0.3, 0, 2.6), 'safety_yellow'); l.box((0.3, 0.3, 0.25), (-0.3, 0, 2.45), 'paint_grey')
    l.cyl(0.02, 0.9, (-0.3, 0, 1.9), 'steel_polished', seg=8); l.box((1.1, 0.7, 0.05), (-0.3, 0, 1.43), 'alu_brushed')
    for x, y in ((-0.75, -0.28), (0.15, -0.28), (-0.75, 0.28), (0.15, 0.28)): l.cyl(0.05, 0.05, (x, y, 1.39), 'rubber', seg=10)
    c = Part('ML.packer.materials', 'Flat cartons, EPS cushion stacks, accessory bins and the taping head', 'ML.packer', bevel=0)
    for k in range(5): c.box((1.3, 0.85, 0.012), (-0.9, -1.45, 0.81 + k * 0.014), 'cardboard')
    for x in (0.6, 1.1):
        for k in range(6): c.box((0.36, 0.5, 0.11), (x, -1.5, 0.06 + k * 0.115), 'eps')
    for k in range(4): c.box((0.3, 0.4, 0.14), (-1.6 + k * 0.34, 1.5, 1.0), 'bin_blue')
    c.box((1.4, 0.5, 0.04), (-1.1, 1.5, 0.92), 'alu_brushed')
    c.box((0.3, 1.5, 0.3), (1.6, 0, ZC + 0.85), 'paint_white'); c.box((0.08, 0.2, 0.08), (1.6, 0, ZC + 0.66), 'tape')        # taping head over the outfeed
    for y in (-0.75, 0.75): c.box((0.08, 0.08, 1.15), (1.6, y, ZC + 0.4), 'paint_white')
    for q in (p, l, c): q.build()


for f in (bench, robot, fct, wb, qa, packer): f()

if A.manifest:
    L.manifest(A.manifest, 'mainline', 'Main-line station kit (plant level of detail)',
               'Illustrative reconstruction after public photos of real TV lines; not a real plant or vendor design.')
if A.glb:
    L.export_glb(os.path.abspath(A.glb), 'ML.')
    print('WROTE', A.glb)
if A.out:
    # a preview row: the six kinds side by side in the order of the line
    xs = 0.0
    for k in ('bench', 'robot', 'fct', 'wb', 'qa', 'packer'):
        e = L.ASSEMBLIES['ML.' + k]; e.location.x = xs + KIND[k][0] / 2; xs += KIND[k][0] + 1.4
    L.studio(scale=3.2, center=(xs / 2, 0, 1.0), rot_deg=20)
    L.camera((xs / 2 + 4, 6.5, 13.5), (xs / 2, 1.0, 0), fov=40)        # three.js axes (x, up, -y)
    L.render(os.path.abspath(A.out), samples=A.samples, res=A.res)
    print('WROTE', A.out)
