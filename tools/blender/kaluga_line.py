"""A TV main-line section as it looks on the Samsung Kaluga floor (docs/REFERENCES-TV-PLANT.md §2c, the 28-300.ru photo report).

What the photos show, and this script builds:
  - a free-roller conveyor at 0.9 m: four aluminium rails of beige plastic rollers carrying TVs face-down on grey jigs, a return
    deck underneath, cream lean pipe legs with levelling feet;
  - a cream lean-pipe frame over the line (28 mm pipe, dark joints): top rails at 2.1 m, a centre rail of yellow spring
    balancers holding screwdrivers on coiled cords, a wire cable tray, work-instruction monitors on arms facing each side,
    a stack light (red, amber, green), white test instruments with green displays on a shelf;
  - green ESD walkways along both sides, operators in royal-blue jackets or quilted vests with dark gloves.

KLINE.bay is one 3.6 m bay (the same length as the plant's CELLS.bay), anchored on the line centre at the floor, X along the
flow, operators on -Y facing +Y and on +Y facing -Y. --hall adds the building for stills (light floor with tape lanes, dark
steel trusses, rows of linear lights, more lines behind) and is never exported.
Illustrative reconstruction: generic equipment, no vendor design, no real plant layout; the people are generic figures.

    blender -b --factory-startup -P kaluga_line.py -- --out still.png --hall --shot line --samples 128 --gpu
    blender -b --factory-startup -P kaluga_line.py -- --glb kline.glb --manifest parts.json --lod plant
"""
import sys, os, math, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, Matrix
import dflib as L
from dflib import Part, assembly, principled
import people as W

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--glb', default=''); ap.add_argument('--manifest', default=''); ap.add_argument('--out', default='')
ap.add_argument('--samples', type=int, default=128); ap.add_argument('--res', default='1600x1000'); ap.add_argument('--lod', default='full')
ap.add_argument('--hall', action='store_true'); ap.add_argument('--shot', default='line'); ap.add_argument('--gpu', action='store_true')
A = ap.parse_args(argv)
L.init(lod=A.lod); W.materials()
H = math.pi / 2
LOW = A.lod in ('far', 'plant')

principled('pipe_cream', '#E7E0CB', rough=0.38, coat=0.35, coat_rough=0.15)      # plastic-coated steel lean pipe
principled('joint_dark', '#3B3E44', metal=1.0, rough=0.45)
principled('roller_beige', '#DCCDA6', rough=0.42)
principled('rail_alu', '#B9BEC4', metal=1.0, rough=0.3, aniso=0.4)
principled('balancer_yellow', '#EDB90E', rough=0.35, coat=0.4)
principled('driver_green', '#2F4A3E', rough=0.45)
principled('cord_black', '#141517', rough=0.5)
principled('bezel_black', '#16171A', rough=0.35)
principled('ui_page', '#E9EEF5', emission='#E9EEF5', strength=1.6)
principled('ui_blue', '#2140C8', emission='#2A50E0', strength=1.6)
principled('ui_green', '#3FBF5A', emission='#3FBF5A', strength=1.6)
principled('ui_row', '#9AA6B8', emission='#9AA6B8', strength=1.2)
principled('lcd_green', '#9BE07A', emission='#7FDA5A', strength=2.0)
principled('instr_white', '#E9E9E4', rough=0.45)
principled('btn_orange', '#F07A1A', rough=0.4)
principled('jig_grey', '#6C7178', metal=0.6, rough=0.45)
principled('tv_back', '#1A1B1E', rough=0.4, coat=0.3)
principled('chassis', '#BFC4CA', metal=1.0, rough=0.32)
principled('connector_white', '#EDEDE8', rough=0.5)
principled('esd_green', '#2F7A55', rough=0.55)
principled('shelf_grey', '#8A9097', rough=0.5)
principled('basket_blue', '#2F7BD8', rough=0.4)
principled('wire_tray', '#D8D2BF', metal=0.7, rough=0.4)
principled('stack_white', '#ECEDEE', rough=0.4)
principled('stack_red', '#E0262A', emission='#FF3030', strength=0.0, rough=0.2)
principled('stack_amber', '#F5A000', emission='#FFB000', strength=0.0, rough=0.2)
principled('stack_green', '#2EE06A', emission='#2EE06A', strength=6.0, rough=0.2)

TR = 0.014            # 28 mm lean pipe
BL = 3.6              # bay length along the flow
CW = 0.42             # half width of the conveyor frame
ZT = 0.88             # top of the rollers
RAILS = (-0.31, -0.105, 0.105, 0.31)


def pipe(p, a, b, mat='pipe_cream', r=TR):
    a, b = Vector(a), Vector(b); d = b - a
    p.cyl(r, d.length, tuple((a + b) / 2), mat, rot=tuple(d.to_track_quat('Z', 'Y').to_euler()), seg=8 if LOW else 14)


def joint(j, at):
    j.box((0.04, 0.04, 0.04), at, 'joint_dark')


def conveyor(cv, rl, jt):
    """Four rails of free rollers at ZT, a return deck at 0.36 m, lean-pipe legs and side pipes."""
    pitch = 0.075 if not LOW else 0.15
    n = int(BL / pitch)
    for y in RAILS:
        rl.box((BL, 0.03, 0.035), (0, y, ZT - 0.04), 'rail_alu')
        for k in range(n):
            x = -BL / 2 + pitch / 2 + k * pitch
            rl.cyl(0.024, 0.06, (x, y, ZT - 0.024), 'roller_beige', rot=(H, 0, 0), seg=8 if LOW else 18)
    for y in (-0.21, 0.21):                                       # the return deck
        rl.box((BL, 0.03, 0.035), (0, y, 0.33), 'rail_alu')
        if not LOW:
            for k in range(0, n, 2):
                rl.cyl(0.022, 0.06, (-BL / 2 + pitch + k * pitch, y, 0.37), 'roller_beige', rot=(H, 0, 0), seg=14)
    for x in (-BL / 2 + 0.1, 0.0, BL / 2 - 0.1):                  # legs, cross members, levelling feet
        for sy in (-1, 1):
            pipe(cv, (x, sy * CW, 0.04), (x, sy * CW, ZT - 0.06)); joint(jt, (x, sy * CW, ZT - 0.06)); joint(jt, (x, sy * CW, 0.33))
            cv.cyl(0.03, 0.02, (x, sy * CW, 0.01), 'joint_dark', seg=12)
        pipe(cv, (x, -CW, ZT - 0.06), (x, CW, ZT - 0.06)); pipe(cv, (x, -CW, 0.31), (x, CW, 0.31))
    for sy in (-1, 1):
        pipe(cv, (-BL / 2, sy * CW, ZT - 0.06), (BL / 2, sy * CW, ZT - 0.06))     # side pipes, the edge the operator leans on
        pipe(cv, (-BL / 2, sy * CW, 0.31), (BL / 2, sy * CW, 0.31))
        pipe(cv, (-BL / 2, sy * (CW + 0.08), 0.74), (BL / 2, sy * (CW + 0.08), 0.74))  # the knee rail of the photos
        for x in (-BL / 2 + 0.1, 0.0, BL / 2 - 0.1):
            pipe(cv, (x, sy * CW, 0.74), (x, sy * (CW + 0.08), 0.74)); joint(jt, (x, sy * (CW + 0.08), 0.74))


def frame(fr, jt, tray):
    """The overhead lean frame: posts at both ends on both sides, top rails, the balancer rail, a wire cable tray."""
    xs = (-BL / 2 + 0.1, BL / 2 - 0.1)
    for x in xs:
        for sy in (-1, 1):
            pipe(fr, (x, sy * CW, ZT - 0.06), (x, sy * CW, 2.12)); joint(jt, (x, sy * CW, 2.12))
        pipe(fr, (x, -CW, 2.12), (x, CW, 2.12))
        pipe(fr, (x, -CW, 1.24), (x, CW, 1.24)); joint(jt, (x, -CW, 1.24)); joint(jt, (x, CW, 1.24))
    for sy in (-1, 1): pipe(fr, (xs[0], sy * CW, 2.12), (xs[1], sy * CW, 2.12))
    pipe(fr, (xs[0], 0.0, 2.02), (xs[1], 0.0, 2.02))                               # balancer rail
    for x in xs: pipe(fr, (x, 0, 2.02), (x, 0, 2.12)); joint(jt, (x, 0, 2.02))
    # far-side instrument shelf at 1.24 m
    fr.box((BL - 0.3, 0.34, 0.02), (0, CW - 0.05, 1.25), 'shelf_grey')
    for sy in (-1, 1): pipe(fr, (xs[0], sy * CW, 1.24), (xs[1], sy * CW, 1.24))
    # wire cable tray above the frame
    tray.box((BL, 0.012, 0.06), (0, -0.16, 2.3), 'wire_tray'); tray.box((BL, 0.012, 0.06), (0, 0.16, 2.3), 'wire_tray')
    step = 0.1 if not LOW else 0.3
    for k in range(int(BL / step)):
        tray.box((0.006, 0.33, 0.006), (-BL / 2 + step / 2 + k * step, 0, 2.27), 'wire_tray')
    for x in xs: pipe(tray, (x, 0, 2.12), (x, 0, 2.27), 'joint_dark', r=0.008)


def monitor(sc, x, y, z, face):
    """A black monitor on an arm, facing the operator side `face` (-1 looks toward -Y): a test sequence on screen."""
    tilt = math.radians(10) * -face
    M = Matrix.Translation((x, y, z)) @ Matrix.Rotation(tilt, 4, 'X')
    put = lambda size, off, mat: sc.box(size, tuple(M @ Vector(off)), mat, rot=(tilt, 0, 0))
    put((0.44, 0.035, 0.32), (0, 0, 0), 'bezel_black')
    put((0.4, 0.004, 0.27), (0, face * 0.019, -0.005), 'ui_page')
    put((0.4, 0.004, 0.035), (0, face * 0.0205, 0.115), 'ui_blue')
    put((0.4, 0.004, 0.012), (0, face * 0.0205, 0.09), 'ui_green')
    for r in range(6): put((0.24, 0.004, 0.01), (-0.06, face * 0.0205, 0.06 - r * 0.026), 'ui_row')
    for r in range(4): put((0.08, 0.004, 0.022), (0.15, face * 0.0205, 0.05 - r * 0.04), 'ui_blue')
    sc.box((0.05, 0.05, 0.12), (x, y - face * 0.04, z - 0.2), 'joint_dark')


def tools(tl, cords):
    """Yellow spring balancers on the centre rail; each holds a screwdriver on a steel wire, a coiled cord to the controller."""
    for x, drop in ((-1.25, 1.36), (-0.75, 1.42), (-0.25, 1.30), (0.6, 1.40), (1.1, 1.34)):
        tl.cyl(0.006, 0.08, (x, 0, 1.98), 'joint_dark', seg=8)
        tl.cyl(0.062, 0.05, (x, 0, 1.9), 'balancer_yellow', rot=(H, 0, 0), seg=10 if LOW else 28)
        tl.cyl(0.026, 0.056, (x, 0, 1.9), 'joint_dark', rot=(H, 0, 0), seg=8 if LOW else 16)
        tl.cyl(0.0025, 1.9 - 0.06 - drop - 0.14, (x, 0, (1.84 + drop + 0.14) / 2), 'steel_dark', seg=6)
        tl.cyl(0.02, 0.2, (x, 0, drop + 0.04), 'driver_green', seg=8 if LOW else 16)
        tl.cyl(0.013, 0.06, (x, 0, drop - 0.09), 'cord_black', seg=8 if LOW else 12)
        tl.cyl(0.003, 0.05, (x, 0, drop - 0.14), 'steel_polished', seg=6)
        if not LOW:   # coiled cord: a helix up to the frame
            pts = []
            for i in range(40):
                t = i / 39; a = t * 14 * math.pi
                pts.append((x + 0.02 * math.cos(a) + t * 0.05, 0.02 * math.sin(a), drop + 0.15 + t * (2.0 - drop - 0.15)))
            cords.sweep(pts, 0.0035, 'cord_black', seg=6, steps=2)


def instruments(ins):
    """White test instruments with green displays and orange keys, stacked on the far-side shelf."""
    for x in (-1.0, 0.9):
        for k in range(2):
            z = 1.30 + k * 0.1
            ins.box((0.42, 0.28, 0.09), (x, CW - 0.06, z), 'instr_white')
            ins.box((0.12, 0.004, 0.03), (x - 0.08, CW - 0.2, z + 0.01), 'lcd_green')
            for b in range(3): ins.box((0.022, 0.006, 0.018), (x + 0.07 + b * 0.03, CW - 0.2, z + 0.01), 'btn_orange')
    ins.box((0.3, 0.2, 0.08), (0.1, CW - 0.05, 1.3), 'basket_blue')   # a screw basket


def stack_light(sl):
    x = BL / 2 - 0.1
    sl.cyl(0.012, 0.25, (x, CW, 2.25), 'stack_white', seg=10)
    for k, m in enumerate(('stack_green', 'stack_amber', 'stack_red')):
        sl.cyl(0.032, 0.07, (x, CW, 2.41 + k * 0.072), m, seg=10 if LOW else 20)
    sl.cyl(0.033, 0.02, (x, CW, 2.63), 'stack_white', seg=10 if LOW else 20)


def tv_set(tv, x, open_back=True):
    """A TV face-down on its jig: grey jig plate, black back cover, the opened back with chassis and board."""
    tv.box((1.02, 0.68, 0.025), (x, 0, ZT + 0.0125), 'jig_grey')
    for sx in (-1, 1):
        for sy in (-1, 1): tv.box((0.05, 0.05, 0.03), (x + sx * 0.46, sy * 0.3, ZT + 0.04), 'joint_dark')
    tv.box((0.98, 0.58, 0.035), (x, 0, ZT + 0.045), 'tv_back')
    if open_back:
        tv.box((0.42, 0.26, 0.012), (x + 0.12, 0.02, ZT + 0.068), 'chassis')
        tv.box((0.24, 0.16, 0.008), (x + 0.06, 0.03, ZT + 0.078), 'pcb_green')
        tv.box((0.12, 0.12, 0.008), (x + 0.25, -0.02, ZT + 0.078), 'pcb_green')
        for k in range(4): tv.box((0.02, 0.012, 0.012), (x - 0.03 + k * 0.03, -0.06, ZT + 0.088), 'connector_white')
        tv.box((0.04, 0.05, 0.02), (x + 0.22, 0.06, ZT + 0.09), 'comp_black')
    else:
        tv.box((0.6, 0.32, 0.02), (x + 0.06, 0, ZT + 0.072), 'tv_back')


# ---------------------------------------------------------------- KLINE.bay
def bay():
    assembly('KLINE.bay', 'One 3.6 m bay of a TV main line after the Samsung Kaluga photos: roller conveyor, lean frame, tools, screens, operators')
    fl = Part('KLINE.bay.floor', 'Green ESD walkways along both sides', 'KLINE.bay', bevel=0)
    for sy in (-1, 1): fl.box((BL, 0.95, 0.006), (0, sy * (CW + 0.6), 0.003), 'esd_green')
    fl.build()
    cv = Part('KLINE.bay.conveyor', 'Free-roller conveyor frame: lean-pipe legs, side and knee rails', 'KLINE.bay', bevel=0)
    rl = Part('KLINE.bay.rollers', 'Roller rails: beige free rollers on aluminium rails, return deck below', 'KLINE.bay', bevel=0)
    jt = Part('KLINE.bay.joints', 'Lean-pipe joints and levelling feet', 'KLINE.bay', bevel=0)
    conveyor(cv, rl, jt); cv.build(); rl.build()
    fr = Part('KLINE.bay.frame', 'Overhead lean frame with the balancer rail and the instrument shelf', 'KLINE.bay', bevel=0)
    tray = Part('KLINE.bay.tray', 'Wire cable tray over the frame', 'KLINE.bay', bevel=0)
    frame(fr, jt, tray); fr.build(); jt.build(); tray.build()
    tl = Part('KLINE.bay.tools', 'Screwdrivers on yellow spring balancers', 'KLINE.bay', bevel=0)
    cords = Part('KLINE.bay.cords', 'Coiled screwdriver cords', 'KLINE.bay', bevel=0)
    tools(tl, cords); tl.build()
    if cords.bm.faces: cords.build()
    sc = Part('KLINE.bay.screens', 'Monitors with the test sequence, one facing each side', 'KLINE.bay', bevel=0)
    monitor(sc, -0.45, -0.08, 1.58, face=-1); monitor(sc, 0.35, 0.08, 1.58, face=1)
    for x, y in ((-0.45, -0.08), (0.35, 0.08)): pipe(sc, (x, y * 0.5, 1.4), (x, y * 0.5, 2.02), 'pipe_cream')
    sc.build()
    ins = Part('KLINE.bay.instruments', 'Test instruments and a screw basket on the shelf', 'KLINE.bay', bevel=0)
    instruments(ins); ins.build()
    sl = Part('KLINE.bay.stack', 'Stack light: green running, amber, red', 'KLINE.bay', bevel=0)
    stack_light(sl); sl.build()
    tv = Part('KLINE.bay.sets', 'TVs face-down on jigs, backs open for the board work', 'KLINE.bay', bevel=0)
    tv_set(tv, -0.95); tv_set(tv, 0.75, open_back=False); tv.build()
    pp = Part('KLINE.bay.operators', 'Operators at the line (generic illustrative figures)', 'KLINE.bay', bevel=0)
    y0 = CW + 0.38
    W.worker(pp, -1.05, -y0, face=0.0, look='vest', sex='f', hair='blonde', height=1.67,
             hands=((-0.12, 0.4, 1.0), (0.12, 0.30, 1.34)), lean=0.12, glove=False)
    W.worker(pp, 0.7, -y0, face=0.0, look='jacket', sex='f', hair='red', height=1.64,
             hands=((-0.16, 0.42, 0.97), (0.14, 0.43, 0.98)), lean=0.16)
    W.worker(pp, -0.6, y0, face=math.pi, look='jacket', sex='m', hair='brown', height=1.80,
             hands=((-0.15, 0.40, 0.98), (0.18, 0.38, 1.0)), lean=0.14)
    W.worker(pp, 1.05, y0, face=math.pi, look='polo', sex='f', hair='black', height=1.66,
             hands=((-0.1, 0.36, 1.0), (0.14, 0.40, 0.99)), lean=0.1)
    pp.build()


bay()

if A.manifest:
    L.manifest(A.manifest, 'kline', 'Main-line bay after the Samsung Kaluga photos',
               'Illustrative reconstruction after public photos of a real TV line (Samsung Kaluga, 2010); generic equipment and people, not a real plant or vendor design.')
if A.glb:
    L.export_glb(os.path.abspath(A.glb), 'KLINE.')
    print('WROTE', A.glb)


# ---------------------------------------------------------------- the hall, for stills only
def hall():
    principled('floor_epoxy', '#C4C7CA', rough=0.28, noise_bump=0.15)
    principled('tape_yellow', '#E8C21A', rough=0.5)
    principled('tape_blue', '#2457C8', rough=0.5)
    principled('roof_white', '#E6E8EA', rough=0.7)
    principled('truss_brown', '#4E2C26', metal=0.3, rough=0.5)
    principled('duct_silver', '#B4B9BF', metal=1.0, rough=0.35)
    principled('lamp', '#FFFFFF', emission='#F4F7FF', strength=14.0)
    principled('wall_white', '#E4E6E8', rough=0.8)
    root = assembly('HALL', 'building for stills')
    fl = Part('HALL.floor', 'floor', 'HALL', bevel=0)
    fl.box((80, 50, 0.02), (6, 0, -0.01), 'floor_epoxy')
    for y in (-2.25, 2.25, 6.75, -6.75):
        fl.box((60, 0.08, 0.004), (6, y, 0.002), 'tape_yellow')
    for y in (-2.0, 2.0, 6.5, -6.5): fl.box((60, 0.05, 0.004), (6, y, 0.002), 'tape_blue')
    fl.build()
    rf = Part('HALL.roof', 'roof and trusses', 'HALL', bevel=0)
    rf.box((80, 50, 0.1), (6, 0, 8.2), 'roof_white')
    for x in range(-30, 44, 6):                         # trusses across the hall
        rf.box((0.25, 50, 0.5), (x, 0, 7.6), 'truss_brown')
        for y in range(-24, 25, 2):
            rf.box((0.06, 0.06, 0.9), (x, y, 7.7), 'truss_brown', rot=(0.0, 0.6 if (y // 2) % 2 else -0.6, 0))
    for y in range(-24, 25, 3): rf.box((80, 0.12, 0.2), (6, y, 8.0), 'truss_brown')
    for y in (-3.4, 1.2, 5.6): rf.cyl(0.3, 80, (6, y, 6.9), 'duct_silver', rot=(0, H, 0), seg=24)
    rf.build()
    lp = Part('HALL.lamps', 'linear lights', 'HALL', bevel=0)
    for y in (-4.5, -2.25, 0.0, 2.25, 4.5, 6.75, -6.75, 9.0):
        for x in range(-26, 40, 4):
            lp.box((3.4, 0.12, 0.04), (x, y, 6.2), 'lamp'); lp.box((3.4, 0.16, 0.06), (x, y, 6.25), 'duct_silver')
    lp.build()
    wl = Part('HALL.walls', 'walls', 'HALL', bevel=0)
    wl.box((0.3, 50, 8.2), (36, 0, 4.1), 'wall_white'); wl.box((80, 0.3, 8.2), (6, 22, 4.1), 'wall_white')
    wl.build()
    w = bpy.data.worlds.new('hall'); bpy.context.scene.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = L.srgb('#D9DDE2'); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
    # more bays and more lines: linked copies of the bay (shared meshes, so Cycles instances them)
    src = [o for o in bpy.data.objects if o.parent == L.ASSEMBLIES['KLINE.bay']]
    for line_y in (0.0, 4.5, 9.0, -4.5):
        for k in range(-2, 9):
            if line_y == 0.0 and k == 0: continue
            for o in src:
                if o.name == 'KLINE.bay.operators' and (k % 2 or abs(line_y) > 5): continue
                c = o.copy(); c.parent = None; L.COL().objects.link(c)
                c.matrix_world = Matrix.Translation((k * BL, line_y, 0)) @ o.matrix_world


def cam(pos, look, lens=24, fstop=0):
    cd = bpy.data.cameras.new('camera'); cd.lens = lens; cd.sensor_width = 36
    if fstop: cd.dof.use_dof = True; cd.dof.aperture_fstop = fstop; cd.dof.focus_distance = (Vector(look) - Vector(pos)).length
    c = bpy.data.objects.new('camera', cd); L.COL().objects.link(c); c.location = pos
    c.rotation_euler = (Vector(look) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler(); bpy.context.scene.camera = c


if A.out:
    if A.hall: hall()
    else: L.studio(scale=2.2, center=(0, 0, 1.0), rot_deg=0)
    shots = {   # Blender axes: X along the flow, operators' main side -Y
        'line': ((-2.6, -1.35, 1.62), (4.0, 0.25, 1.05), 20),        # like the photo report: down the line from the operator side
        'over': ((-6.5, -7.0, 4.2), (4.0, 2.0, 0.9), 22),            # the floor from a mezzanine
        'close': ((-0.2, -1.6, 1.55), (-0.9, 0.1, 1.0), 26),         # an operator at work
    }
    p, t, lens = shots[A.shot]
    cam(p, t, lens)
    L.render(os.path.abspath(A.out), samples=A.samples, res=A.res, gpu=A.gpu, look='AgX - Base Contrast')
