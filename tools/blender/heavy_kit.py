"""Injection moulding and press machines for the live plant, after real plant photos.

ML.injection  after the Kaluga moulding hall (Gigazine 2010 tour, docs/REFERENCES-TV-PLANT.md §2d): a long charcoal machine
              bed, the clamp unit with four tie bars and a blue mould behind sliding guard doors, the injection unit with a
              heater-banded barrel, a white hopper dryer on a platform with yellow railings and a ladder, a white take-out
              robot rail over the fixed platen, the HMI pedestal, a blue electrical cabinet, water manifolds and hoses, a
              blue part cart and the yellow floor outline.
ML.press      a straight-side stamping press for chassis and back covers: pigeon-blue frame (crown, uprights, bed), the
              flywheel and its yellow guard, bolster and lower die, light curtains at the front opening, a coil reel,
              straightener and servo feed at the entry, a part rack at the exit, a walkway with railings on the crown.

Footprints are the engine's KIND sizes (injection 6.2 x 2.2, press 4.6 x 3.0), centred, X along the machine, the operator
side -Y. The plant keeps animating its own moving platen, robot beam and press slide over these frames, so the frames leave
those spaces open (scene.js ANIM.platen, ANIM.gantry, ANIM.ram).
Illustrative reconstruction: generic machines, no vendor design.

    blender -b --factory-startup -P heavy_kit.py -- --glb heavy-raw.glb --manifest parts.json
    blender -b --factory-startup -P heavy_kit.py -- --lod full --still --out still.png --shot inj --samples 128 --gpu
"""
import sys, os, math, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import dflib as L
from dflib import Part, assembly, principled

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--glb', default=''); ap.add_argument('--manifest', default=''); ap.add_argument('--out', default='')
ap.add_argument('--samples', type=int, default=128); ap.add_argument('--res', default='1600x1000'); ap.add_argument('--lod', default='plant')
ap.add_argument('--still', action='store_true'); ap.add_argument('--shot', default='inj'); ap.add_argument('--gpu', action='store_true')
A = ap.parse_args(argv)
L.init(lod=A.lod)
H = math.pi / 2
LOW = A.lod in ('far', 'plant')
SEG = 10 if LOW else 24
KIND = {'injection': (6.2, 2.2), 'press': (4.6, 3.0)}

# few materials on purpose: every material is one more draw call per machine kind in the plant
principled('mach_charcoal', '#2B2E33', rough=0.45, coat=0.25, noise_bump=0.25)
principled('mach_grey', '#8E949B', rough=0.42, coat=0.2, noise_bump=0.2)
principled('mach_white', '#E7E9EB', rough=0.4, coat=0.3, noise_bump=0.2)
principled('mach_blue', '#5B7896', rough=0.42, coat=0.3, noise_bump=0.25)      # press frame, pigeon blue
principled('mould_blue', '#2F5EA8', metal=0.3, rough=0.4)
principled('safety_yellow', '#F2C200', rough=0.45, coat=0.2)
principled('cabinet_blue', '#2D5B9A', rough=0.45, coat=0.2)
principled('hose_black', '#131416', rough=0.6)
principled('guard_glass', '#DDE6EC', rough=0.05, alpha=0.3)
principled('ui_page', '#E9EEF5', emission='#E9EEF5', strength=1.6)
principled('tape_yellow', '#E8C21A', rough=0.5)


def foot_outline(p, W, D, m=0.35):
    """The yellow floor tape round a machine."""
    for y in (-D / 2 - m, D / 2 + m): p.box((W + 2 * m, 0.06, 0.004), (0, y, 0.002), 'tape_yellow')
    for x in (-W / 2 - m, W / 2 + m): p.box((0.06, D + 2 * m, 0.004), (x, 0, 0.002), 'tape_yellow')


def railing(p, x0, x1, y0, y1, z, h=1.0):
    for (xa, ya), (xb, yb) in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1))):
        L_ = math.hypot(xb - xa, yb - ya); rz = math.atan2(yb - ya, xb - xa)
        for zz in (z + h, z + h * 0.5): p.box((L_, 0.04, 0.04), ((xa + xb) / 2, (ya + yb) / 2, zz), 'safety_yellow', rot=(0, 0, rz))
    for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1)): p.box((0.04, 0.04, h), (x, y, z + h / 2), 'safety_yellow')


def ladder(p, x, y, z0, z1, along='y'):
    for s in (-0.22, 0.22):
        p.box((0.04, 0.04, z1 - z0) if True else None, ((x + s, y, (z0 + z1) / 2) if along == 'y' else (x, y + s, (z0 + z1) / 2)), 'safety_yellow')
    n = int((z1 - z0) / 0.3)
    for k in range(1, n + 1):
        p.box((0.44, 0.03, 0.03) if along == 'y' else (0.03, 0.44, 0.03), (x, y, z0 + k * 0.3), 'safety_yellow')


# ---------------------------------------------------------------- ML.injection
def injection():
    W, D = KIND['injection']; assembly('ML.injection', 'Injection moulding machine: clamp unit, blue mould, injection unit, hopper dryer on a platform, take-out robot rail, cabinet')
    x_rear, x_fix = -W * 0.46, -W * 0.08                       # rear and fixed platens (the plant animates the moving platen between)
    b = Part('ML.injection.machine', 'Machine bed, clamp unit with tie bars and platens, injection unit with barrel and heater bands', 'ML.injection', bevel=0)
    b.box((W, D * 0.78, 0.85), (0, 0, 0.14 + 0.425), 'mach_charcoal')
    b.box((W + 0.05, D * 0.8, 0.14), (0, 0, 0.07), 'mach_grey')
    for x in (x_rear, x_fix):
        b.box((0.32, D * 0.92, 1.6), (x, 0, 0.99 + 0.8), 'mach_charcoal')
        b.box((0.34, D * 0.94, 0.06), (x, 0, 2.6), 'mach_grey')
    for y in (-0.34 * D, 0.34 * D):
        for z in (1.25, 2.3): b.cyl(0.06, x_fix - x_rear + 0.3, ((x_rear + x_fix) / 2, y, z), 'steel_polished', rot=(0, H, 0), seg=SEG)
    b.cyl(0.18, 0.7, (x_rear - 0.5, 0, 1.78), 'mach_grey', rot=(0, H, 0), seg=SEG)            # clamp cylinder behind the rear platen
    # the injection unit
    xi0, xi1 = x_fix + 0.2, W * 0.24
    b.box((xi1 - xi0, 0.5, 0.25), ((xi0 + xi1) / 2, 0, 1.12), 'mach_grey')
    b.cyl(0.11, xi1 - xi0, ((xi0 + xi1) / 2, 0, 1.55), 'steel_dark', rot=(0, H, 0), seg=SEG)
    for k in range(6 if not LOW else 3):
        b.cyl(0.15, 0.14, (xi0 + 0.25 + k * (xi1 - xi0 - 0.4) / (5 if not LOW else 2), 0, 1.55), 'mach_charcoal', rot=(0, H, 0), seg=SEG)
    b.box((W / 2 - xi1, D * 0.62, 0.9), ((xi1 + W / 2) / 2, 0, 1.0 + 0.45), 'mach_charcoal')     # injection drive housing
    b.box((W / 2 - xi1 - 0.1, D * 0.64, 0.05), ((xi1 + W / 2) / 2, 0, 1.92), 'mach_grey')
    b.build()
    m = Part('ML.injection.mould', 'The blue mould on the fixed platen', 'ML.injection', bevel=0)
    m.box((0.42, D * 0.66, 1.3), (x_fix - 0.37, 0, 1.0 + 0.7), 'mould_blue')
    m.box((0.12, D * 0.5, 0.2), (x_fix - 0.37, 0, 2.43), 'steel_dark')                     # lifting eye block
    m.build()
    g = Part('ML.injection.guards', 'Sliding guard doors over the clamp, the dryer platform and the take-out robot rail', 'ML.injection', bevel=0)
    for y in (-D / 2, D / 2):
        g.box((x_fix - x_rear + 0.2, 0.03, 1.45), ((x_rear + x_fix) / 2, y * 0.98, 0.99 + 0.73), 'guard_glass')
        g.box((x_fix - x_rear + 0.2, 0.05, 0.05), ((x_rear + x_fix) / 2, y * 0.98, 2.45), 'mach_grey')
        g.box((x_fix - x_rear + 0.2, 0.05, 0.05), ((x_rear + x_fix) / 2, y * 0.98, 1.0), 'mach_grey')
        for x in (x_rear + 0.1, (x_rear + x_fix) / 2, x_fix - 0.1): g.box((0.05, 0.05, 1.45), (x, y * 0.98, 1.72), 'mach_grey')
    # take-out robot: a white rail across the machine over the fixed platen, out over the operator side to the part cart
    g.box((0.22, D + 1.2, 0.22), (x_fix - 0.3, -0.6, 2.95), 'mach_white')
    g.box((0.3, 0.3, 0.45), (x_fix - 0.3, -0.6, 2.7), 'mach_white')
    g.box((0.12, 0.12, 1.0), (x_fix - 0.3, -0.6, 2.1), 'mach_white')
    for y in (-D / 2 - 1.0, D / 2): g.box((0.12, 0.12, 2.9), (x_fix - 0.3, y, 1.45), 'mach_grey')
    # hopper dryer on a platform with a yellow railing and a ladder
    px, pw = xi1 - 0.4, 1.3
    g.box((pw, D * 0.9, 0.06), (px, 0, 2.0), 'mach_grey')
    railing(g, px - pw / 2, px + pw / 2, -D * 0.45, D * 0.45, 2.03, 0.95)
    g.cyl(0.32, 0.75, (px, 0, 2.03 + 0.38 + 0.3), 'mach_white', seg=SEG); g.cyl(0.32, 0.35, (px, 0, 2.03 + 0.15), 'mach_white', seg=SEG, r2=0.1)
    g.cyl(0.26, 0.3, (px, 0, 3.24), 'mach_white', seg=SEG); g.cyl(0.33, 0.05, (px, 0, 3.4), 'mach_grey', seg=SEG)
    g.box((0.4, 0.4, 0.5), (px + 0.45, 0.2, 2.3), 'mach_white')                              # dryer blower
    ladder(g, px + pw / 2 + 0.05, D * 0.2, 0.0, 2.0, along='x')
    g.sweep([(px, 0.0, 3.42), (px - 0.25, 0.0, 3.62), (px - 0.75, 0.0, 3.4), (xi1 - 1.4, 0.0, 1.75)], 0.035, 'hose_black', seg=8, steps=5)   # loader hose to the feed throat
    g.build()
    e = Part('ML.injection.equipment', 'HMI pedestal, electrical cabinet, water manifolds, part cart, floor outline', 'ML.injection', bevel=0)
    e.box((0.5, 0.35, 1.25), (W * 0.36, -D / 2 - 0.3, 0.63), 'mach_grey'); e.box((0.55, 0.06, 0.42), (W * 0.36, -D / 2 - 0.5, 1.45), 'mach_charcoal')
    e.box((0.48, 0.01, 0.34), (W * 0.36, -D / 2 - 0.535, 1.45), 'ui_page')
    e.box((0.7, 0.55, 1.9), (W / 2 + 0.45, D * 0.15, 0.95), 'cabinet_blue'); e.box((0.72, 0.57, 0.06), (W / 2 + 0.45, D * 0.15, 1.93), 'mach_grey')
    for k in range(4):                                                                          # mould water circuits
        e.cyl(0.02, 1.0, (x_fix - 0.55 + k * 0.1, D / 2 + 0.05, 0.85), 'cabinet_blue' if k % 2 else 'hose_black', seg=8)
    e.box((0.6, 0.12, 0.25), (x_fix - 0.4, D / 2 + 0.06, 1.42), 'steel_dark')
    e.box((1.1, 0.75, 0.6), (x_fix - 0.3, -D / 2 - 1.0, 0.25 + 0.3), 'cabinet_blue')            # blue part cart under the robot drop
    e.box((1.15, 0.8, 0.05), (x_fix - 0.3, -D / 2 - 1.0, 0.2), 'mach_grey')
    for x in (-0.45, 0.45):
        for y in (-0.3, 0.3): e.cyl(0.07, 0.04, (x_fix - 0.3 + x, -D / 2 - 1.0 + y, 0.08), 'hose_black', rot=(H, 0, 0), seg=10)
    foot_outline(e, W + 1.0, D + 0.4)
    e.build()


# ---------------------------------------------------------------- ML.press
def press():
    W, D = KIND['press']; assembly('ML.press', 'Straight-side stamping press: crown, uprights, flywheel and guard, bolster and die, light curtains, coil line, part rack')
    f = Part('ML.press.frame', 'Pigeon-blue frame: bed, uprights, crown, walkway with railings', 'ML.press', bevel=0)
    f.box((W, D, 0.7), (0, 0, 0.14 + 0.35), 'mach_blue'); f.box((W + 0.1, D + 0.1, 0.14), (0, 0, 0.07), 'mach_grey')
    for sx in (-1, 1):
        x = sx * (W / 2 - 0.34)
        f.box((0.62, D * 0.9, 3.2), (x, 0, 0.84 + 1.6), 'mach_blue')
        f.box((0.08, D * 0.92, 3.0), (x - sx * 0.31, 0, 0.94 + 1.5), 'mach_grey')               # gib strips
    f.box((W, D * 0.9, 1.1), (0, 0, 4.0 + 0.55), 'mach_blue')
    f.box((W + 0.2, D + 0.1, 0.06), (0, 0, 5.13), 'mach_grey')
    railing(f, -W / 2 - 0.05, W / 2 + 0.05, -D / 2 - 0.02, D / 2 + 0.02, 5.16, 1.0)
    ladder(f, W / 2 + 0.2, D * 0.3, 0.0, 5.13, along='x')
    f.build()
    d = Part('ML.press.die', 'Bolster, lower die and the die cushion', 'ML.press', bevel=0)
    d.box((W - 1.6, D * 0.7, 0.35), (0, 0, 0.84 + 0.175), 'steel_dark'); d.box((W - 1.8, D * 0.62, 0.25), (0, 0, 1.19 + 0.125), 'mach_charcoal')
    for sx in (-1, 1): d.box((0.1, 0.1, 0.5), (sx * (W - 1.9) / 2, 0, 1.44 + 0.25), 'steel_polished')   # guide posts
    d.build()
    w = Part('ML.press.drive', 'Flywheel, its yellow guard, the drive motor and the clutch housing', 'ML.press', bevel=0)
    w.cyl(0.75, 0.3, (W * 0.3, -D * 0.5, 4.6), 'mach_charcoal', rot=(H, 0, 0), seg=SEG)
    w.cyl(0.82, 0.38, (W * 0.3, -D * 0.5 - 0.02, 4.6), 'safety_yellow', rot=(H, 0, 0), seg=SEG)
    w.box((0.7, 0.6, 0.6), (-W * 0.25, D * 0.2, 5.13 + 0.3), 'mach_grey'); w.cyl(0.25, 0.4, (W * 0.05, D * 0.2, 5.4), 'mach_grey', rot=(0, H, 0), seg=SEG)
    w.box((0.6, 0.55, 1.9), (W / 2 + 0.5, -D * 0.25, 0.95), 'cabinet_blue')
    w.build()
    s = Part('ML.press.safety', 'Light curtains at the front opening, HMI, two-hand station', 'ML.press', bevel=0)
    for sx in (-1, 1):
        x = sx * (W / 2 - 0.75)
        s.box((0.07, 0.07, 2.4), (x, -D * 0.47, 0.84 + 1.2), 'safety_yellow'); s.box((0.02, 0.02, 2.2), (x - sx * 0.04, -D * 0.47 - 0.04, 0.95 + 1.1), 'cabinet_blue')
    s.box((0.55, 0.4, 1.1), (W * 0.2, -D / 2 - 0.45, 0.55), 'mach_grey'); s.box((0.55, 0.06, 0.4), (W * 0.2, -D / 2 - 0.62, 1.32), 'mach_charcoal')
    s.box((0.48, 0.01, 0.32), (W * 0.2, -D / 2 - 0.655, 1.32), 'ui_page')
    s.build()
    c = Part('ML.press.coil', 'Coil reel, straightener and servo feed at the entry, part rack at the exit, floor outline', 'ML.press', bevel=0)
    cx = -W / 2 - 1.4
    c.box((1.4, 1.4, 0.3), (cx, 0, 0.15), 'mach_grey'); c.box((0.3, 0.3, 1.0), (cx, 0.6, 0.8), 'mach_blue')
    c.cyl(0.7, 0.95, (cx, 0, 1.0), 'steel_polished', rot=(H, 0, 0), seg=SEG); c.cyl(0.3, 1.0, (cx, 0, 1.0), 'steel_dark', rot=(H, 0, 0), seg=SEG)
    c.box((0.9, 1.0, 1.0), (-W / 2 - 0.3, 0, 0.14 + 0.5), 'mach_blue')
    for k in range(4): c.cyl(0.08, D * 0.5, (-W / 2 - 0.55 + k * 0.17, 0, 1.2 + (k % 2) * 0.14), 'steel_polished', rot=(H, 0, 0), seg=SEG)
    c.box((0.02, D * 0.42, 1.0), (-W / 2 - 1.1, 0, 1.0), 'steel_polished')                       # strip from the coil into the feed
    rx = W / 2 + 0.6
    for x in (rx - 0.4, rx + 0.4):
        for y in (-0.5, 0.5): c.box((0.05, 0.05, 1.6), (x, y - D * 0.1, 0.8), 'mach_grey')
    for k in range(4): c.box((0.85, 1.05, 0.03), (rx, -D * 0.1, 0.3 + k * 0.4), 'mach_grey')
    for k in range(3): c.box((0.7, 0.9, 0.02), (rx, -D * 0.1, 0.33 + k * 0.4), 'steel_dark')
    foot_outline(c, W + 3.4, D + 0.6)
    c.build()


injection(); press()

if A.manifest:
    L.manifest(A.manifest, 'heavy', 'Injection and press machines (plant level of detail)',
               'Illustrative reconstruction after public photos of a real moulding hall (Samsung Kaluga, 2010) and generic stamping presses; not a vendor design.')
if A.glb:
    L.export_glb(os.path.abspath(A.glb), 'ML.')
    print('WROTE', A.glb)

if A.out:
    import stage, people as Wk
    Wk.materials()
    W, D = KIND['injection']
    # a row of moulding machines as in the photos, and two presses beyond
    src = [o for o in bpy.data.objects if o.parent == L.ASSEMBLIES['ML.injection']]
    for k in range(1, 6):
        for o in src:
            c = o.copy(); c.parent = None; L.COL().objects.link(c); c.matrix_world = o.matrix_world.copy(); c.location.y += k * 4.2
    pr = L.ASSEMBLIES['ML.press']; pr.location = (12.0, 4.0, 0)
    srcp = [o for o in bpy.data.objects if o.parent == pr]
    for o in srcp:
        c = o.copy(); c.parent = None; L.COL().objects.link(c); bpy.context.view_layer.update(); c.matrix_world = o.matrix_world.copy(); c.location.y += 5.5
    pp = Part('STILL.people', 'people', 'ML.injection', bevel=0) if False else None
    assembly('STILL', 'still extras')
    pp = Part('STILL.people', 'people', 'STILL', bevel=0)
    Wk.worker(pp, 1.0, -D / 2 - 0.9, face=0.0, look='jacket', sex='m', hair='brown', height=1.78, hands=((-0.2, 0.35, 1.3), (0.2, 0.38, 1.35)))
    Wk.worker(pp, -0.7, 4.2 - D / 2 - 1.6, face=0.4, look='leader', sex='f', hair='blonde', height=1.66, hands=((-0.2, 0.1, 1.0), (0.2, 0.25, 1.15)))
    Wk.worker(pp, 12.6, 4.0 - 1.5 - 0.9, face=0.0, look='jacket', sex='m', hair='black', height=1.8, hands=((-0.15, 0.3, 1.3), (0.15, 0.3, 1.3)))
    pp.build()
    stage.hall(x0=-14, x1=26, y0=-10, y1=32, lanes=(-3.0,), lamp_rows=(0.0, 4.0, 8.0, 12.0, 16.0, 20.0))
    shots = {'inj': ((-6.5, -6.0, 2.6), (4.0, 9.0, 1.2), 20), 'press': ((6.0, -4.5, 2.2), (12.5, 5.5, 2.4), 20),
             'close': ((-2.5, -3.6, 1.7), (0.0, 0.0, 1.5), 24)}
    p, t, lens = shots[A.shot]
    stage.cam(p, t, lens)
    L.render(os.path.abspath(A.out), samples=A.samples, res=A.res, gpu=A.gpu, look='AgX - Base Contrast')
