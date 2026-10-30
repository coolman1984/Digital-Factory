"""Main-line end for the live plant: function test, aging, white balance, final QA and packing, after real TV lines.

Built from the photo study (docs/REFERENCES-TV-PLANT.md §2d): the LG Gumi tour for the test zone (sets standing upright on
green belt conveyors in silver aluminium-profile fixtures, colour bars and test pictures, long rows of lit sets in aging,
signal harnesses, stack lights) and the Kaluga packing photos (white EPS cushions, flat cartons, roller conveyors, a lift
assist, a carton sealer).

  ML.fct     function test: green-belt conveyor, profile back rest and fixture, signal harness and connector head, pattern
             generator rack, barcode scanner, test monitor, stack light, LED canopy
  ML.aging   aging rack: a double-sided profile rack with ten bays and two tiers a side, roller shelves, power and signal
             strips down the spine, a cable to every slot, lit canopy, lift towers at both ends, floor guard
  ML.wb      white balance: a black booth on a profile frame, strip curtain, colour analyser on a swing arm, alignment PC
  ML.qa      final QA: a white inspection booth with LED panels, checklist screen, reject rack
  ML.packer  packing: roller conveyor, lift-assist gantry with a vacuum frame, carton table and flat cartons, EPS stacks,
             carton sealer at the outfeed, label printer, accessory bins

Same footprints and anchors as main_line_kit.py (the engine's KIND sizes): centred on the station, X along the flow,
the operator side -Y, conveyor top 0.74 m. The plant keeps drawing its own moving sets and people; `--still` adds sets,
workers and the hall for Blender stills only.
Illustrative reconstruction: no real plant's or vendor's design.

    blender -b --factory-startup -P line_end_kit.py -- --glb lineend-raw.glb --manifest parts.json
    blender -b --factory-startup -P line_end_kit.py -- --lod full --still --out still.png --shot test --samples 128 --gpu
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
ap.add_argument('--still', action='store_true'); ap.add_argument('--shot', default='test'); ap.add_argument('--gpu', action='store_true')
A = ap.parse_args(argv)
L.init(lod=A.lod)
H = math.pi / 2
LOW = A.lod in ('far', 'plant')
ZC = 0.74
SEG = 8 if LOW else 16
KIND = {'fct': (3.0, 2.4), 'aging': (16.0, 4.0), 'wb': (3.2, 2.6), 'qa': (3.4, 2.8), 'packer': (4.0, 2.8)}
TILT = math.radians(12)

principled('profile', '#C9CDD1', metal=0.85, rough=0.32)             # 40 mm anodised aluminium profile
principled('profile_cap', '#2A2D31', rough=0.5)                        # black end caps and corner brackets
principled('belt_green', '#2F8A55', rough=0.55)                        # PVC conveyor belt
principled('panel_white', '#EEF0F2', rough=0.5)
principled('panel_black', '#141518', rough=0.85)
principled('rack_19', '#1E2024', metal=0.4, rough=0.45)
principled('esd_green', '#2F7A55', rough=0.55)
principled('cable_black', '#121315', rough=0.5)
principled('cable_grey', '#8C9096', rough=0.5)
principled('roller_grey', '#9AA0A7', metal=0.8, rough=0.3)
principled('roller_beige', '#DCCDA6', rough=0.42)
principled('cardboard', '#BA9162', rough=0.85)
principled('eps', '#F4F4F0', rough=0.92)
principled('tape_brown', '#A57B48', rough=0.35)
principled('label', '#FAFAF7', rough=0.6)
principled('ui_page', '#E9EEF5', emission='#E9EEF5', strength=1.6)
principled('ui_blue', '#2140C8', emission='#2A50E0', strength=1.6)
principled('ui_green', '#3FBF5A', emission='#3FBF5A', strength=1.6)
principled('bezel_black', '#16171A', rough=0.35)
principled('stack_green', '#2EE06A', emission='#2EE06A', strength=6.0, rough=0.2)
principled('stack_amber', '#F5A000', rough=0.2)
principled('stack_red', '#E0262A', rough=0.2)
principled('stack_white', '#ECEDEE', rough=0.4)
principled('safety_yellow', '#F2C500', rough=0.45, coat=0.2)
principled('bin_blue', '#2F6FD0', rough=0.45)
principled('bin_red', '#C23B2E', rough=0.45)
principled('led_panel', '#FFFFFF', emission='#F4F7FF', strength=6.0)
principled('tv_black', '#0E0F12', rough=0.3, coat=0.4)
BARS = [('bar_w', '#C8C8C8'), ('bar_y', '#C8C800'), ('bar_c', '#00C8C8'), ('bar_g', '#00C800'), ('bar_m', '#C800C8'), ('bar_r', '#C80000'), ('bar_b', '#0000C8')]
for n, c in BARS: principled(n, c, emission=c, strength=2.2)
principled('scr_white', '#F2F4F8', emission='#F2F4F8', strength=2.0)
principled('scr_grey', '#7F848C', emission='#7F848C', strength=1.6)


# ---------------------------------------------------------------- shared pieces
def prof(p, a, b, s=0.04):
    """A straight run of 40 mm aluminium profile between two points on one axis."""
    a = list(a); b = list(b); size = [abs(b[i] - a[i]) or s for i in range(3)]
    p.box(tuple(size), tuple((a[i] + b[i]) / 2 for i in range(3)), 'profile')


def foot(p, x, y):
    p.cyl(0.035, 0.02, (x, y, 0.01), 'profile_cap', seg=SEG); p.box((0.06, 0.06, 0.04), (x, y, 0.04), 'profile_cap')


def belt_conveyor(p, W, w=1.1, z=ZC, belt='belt_green'):
    """A flat-belt conveyor: profile side frames, the belt on top, end drums, legs on levelling feet."""
    for s in (-1, 1): p.box((W, 0.05, 0.1), (0, s * w / 2, z - 0.05), 'profile')
    p.box((W - 0.04, w - 0.06, 0.012), (0, 0, z - 0.006), belt)
    for x in (-W / 2 + 0.03, W / 2 - 0.03): p.cyl(0.045, w - 0.06, (x, 0, z - 0.045), 'roller_grey', rot=(H, 0, 0), seg=SEG)
    for x in (-W / 2 + 0.12, W / 2 - 0.12):
        for s in (-1, 1): prof(p, (x, s * (w / 2 - 0.03), 0.04), (x, s * (w / 2 - 0.03), z - 0.1)); foot(p, x, s * (w / 2 - 0.03))
        prof(p, (x, -w / 2 + 0.03, 0.3), (x, w / 2 - 0.03, 0.3))
    p.box((0.4, 0.2, 0.18), (W / 2 - 0.25, w / 2 + 0.12, z - 0.18), 'paint_grey')            # drive motor


def roller_conveyor(p, W, w=1.1, z=ZC, pitch=0.1):
    for s in (-1, 1): p.box((W, 0.05, 0.1), (0, s * w / 2, z - 0.05), 'profile')
    n = int(W / (pitch if not LOW else pitch * 1.6))
    for i in range(n): p.cyl(0.028, w - 0.08, (-W / 2 + W / n * (i + 0.5), 0, z - 0.03), 'roller_grey', rot=(H, 0, 0), seg=SEG)
    for x in (-W / 2 + 0.12, W / 2 - 0.12):
        for s in (-1, 1): prof(p, (x, s * (w / 2 - 0.03), 0.04), (x, s * (w / 2 - 0.03), z - 0.1)); foot(p, x, s * (w / 2 - 0.03))


def monitor(p, x, y, z, face=-1, w=0.46, h=0.32):
    p.box((w, 0.035, h), (x, y, z), 'bezel_black')
    p.box((w - 0.04, 0.004, h - 0.05), (x, y + face * 0.019, z - 0.005), 'ui_page')
    p.box((w - 0.04, 0.004, 0.035), (x, y + face * 0.0205, z + h / 2 - 0.04), 'ui_blue')
    p.box((0.12, 0.004, 0.07), (x - w / 4, y + face * 0.0205, z - 0.04), 'ui_green')
    p.box((0.05, 0.05, 0.14), (x, y - face * 0.04, z - h / 2 - 0.05), 'profile_cap')


def stack_light(p, x, y, z0, green=True):
    p.cyl(0.012, 0.3, (x, y, z0 + 0.15), 'stack_white', seg=SEG)
    for k, m in enumerate(('stack_green' if green else 'stack_white', 'stack_amber', 'stack_red')):
        p.cyl(0.03, 0.065, (x, y, z0 + 0.34 + k * 0.067), m, seg=SEG)
    p.cyl(0.031, 0.02, (x, y, z0 + 0.55), 'stack_white', seg=SEG)


def canopy(p, W, y0, y1, z=2.2, lights=True):
    """A profile canopy over a station: four posts, a rectangle at z and an LED bar along it."""
    for x in (-W / 2 + 0.05, W / 2 - 0.05):
        for y in (y0, y1): prof(p, (x, y, 0.04), (x, y, z)); foot(p, x, y)
        prof(p, (x, y0, z), (x, y1, z))
    for y in (y0, y1): prof(p, (-W / 2 + 0.05, y, z), (W / 2 - 0.05, y, z))
    if lights:
        p.box((W - 0.4, 0.1, 0.03), (0, (y0 + y1) / 2, z - 0.02), 'panel_white'); p.box((W - 0.44, 0.07, 0.005), (0, (y0 + y1) / 2, z - 0.037), 'led_panel')
        prof(p, (-W / 2 + 0.05, (y0 + y1) / 2, z), (W / 2 - 0.05, (y0 + y1) / 2, z))


def screen(p, x, y, z, w, h, pic, rot=(0, 0, 0), face=-1):
    """A test picture on a plane facing `face` (-1: toward -Y): colour bars, white, grey or a test card."""
    import mathutils
    M = mathutils.Matrix.Translation((x, y, z)) @ mathutils.Euler(rot).to_matrix().to_4x4()
    put = lambda size, off, m: p.box(size, tuple(M @ mathutils.Vector(off)), m, rot=rot)
    if pic == 'bars':
        bw = w / 7
        for k, (n, _) in enumerate(BARS): put((bw, 0.004, h * 0.68), (-w / 2 + (k + 0.5) * bw, 0, h * 0.16), n)
        for k in range(7): put((bw, 0.004, h * 0.12), (-w / 2 + (k + 0.5) * bw, 0, -h * 0.24), BARS[6 - k][0])
        put((w, 0.004, h * 0.2), (0, 0, -h * 0.4), 'scr_grey')
    else:
        put((w, 0.004, h), (0, 0, 0), {'white': 'scr_white', 'grey': 'scr_grey'}.get(pic, pic))


def stand_set(p, x, w=1.23, h=0.72, pic='bars', y=0.0, z0=ZC):
    """A TV standing on its fixture, leaning back by TILT (top toward +Y), screen to the operator."""
    zc = z0 + 0.05 + h / 2 * math.cos(TILT); yc = y + h / 2 * math.sin(TILT)
    p.box((w, 0.05, h), (x, yc, zc), 'tv_black', rot=(-TILT, 0, 0))
    screen(p, x, yc - 0.027 * math.cos(TILT), zc + 0.027 * math.sin(TILT) * 0, w - 0.03, h - 0.03, pic, rot=(-TILT, 0, 0))


# ---------------------------------------------------------------- ML.fct: function test
def fct():
    W, D = KIND['fct']; assembly('ML.fct', 'Function test: green-belt conveyor, profile fixture, signal harness, pattern generator rack, scanner, stack light')
    c = Part('ML.fct.conveyor', 'Green-belt test conveyor with the profile fixture and back rest', 'ML.fct', bevel=0)
    belt_conveyor(c, W)
    for x in (-W / 2 + 0.15, W / 2 - 0.15):                                       # fixture: two uprights leaning with the set
        c.box((0.04, 0.04, 1.0), (x, 0.32, ZC + 0.5), 'profile', rot=(-TILT, 0, 0))
    c.box((W - 0.3, 0.04, 0.04), (0, 0.38, ZC + 0.9), 'profile'); c.box((W - 0.3, 0.04, 0.04), (0, 0.22, ZC + 0.12), 'profile')
    for x in (-0.6, 0.6): c.box((0.08, 0.2, 0.06), (x, 0.06, ZC + 0.03), 'profile_cap')   # bottom clamps
    canopy(c, W, -0.95, 0.95)
    c.box((W, 0.9, 0.006), (0, -1.5, 0.003), 'esd_green')
    c.build()
    e = Part('ML.fct.equipment', 'Pattern generator rack, test PC, barcode scanner, monitor, signal harness and stack light', 'ML.fct', bevel=0)
    rx = 0.8; e.box((0.6, 0.6, 1.6), (rx, 0.95 + 0.1, 0.8), 'rack_19')                # 19-inch rack on the far side
    for k in range(6):
        e.box((0.52, 0.02, 0.12), (rx, 0.74, 0.35 + k * 0.2), 'panel_white' if k % 2 else 'rack_19')
        e.box((0.08, 0.005, 0.025), (rx - 0.15, 0.73, 0.35 + k * 0.2), 'ui_green')
    monitor(e, -0.7, -1.0, 1.42, face=-1); prof(e, (-0.7, -0.95, 0.04), (-0.7, -0.95, 1.25))
    e.box((0.06, 0.1, 0.16), (0.3, -0.85, 1.3), 'profile_cap'); e.box((0.05, 0.02, 0.05), (0.3, -0.9, 1.22), 'stack_red')   # scanner
    stack_light(e, W / 2 - 0.05, 0.95, 2.2)
    e.box((0.5, 0.12, 0.08), (-0.2, 0.42, ZC + 1.0), 'profile_cap')                  # connector head on the back rest
    if not LOW:
        for k in range(6):
            e.sweep([(rx - 0.2 + k * 0.05, 0.75, 1.2), (0.3 - k * 0.04, 0.6, 1.9), (-0.2 + k * 0.03, 0.45, ZC + 1.05)], 0.006, 'cable_black', seg=6, steps=6)
    else:
        e.sweep([(rx - 0.1, 0.75, 1.2), (0.2, 0.6, 1.9), (-0.2, 0.45, ZC + 1.05)], 0.02, 'cable_black', seg=6, steps=4)
    e.build()


# ---------------------------------------------------------------- ML.aging: double-sided aging rack
def aging():
    W, D = KIND['aging']; assembly('ML.aging', 'Aging rack: ten bays, two tiers a side, roller shelves, power strips and a cable to every slot, lit canopy, lift towers')
    f = Part('ML.aging.frame', 'Profile rack: spine, bay posts, roller shelves, canopy and floor guard', 'ML.aging', bevel=0)
    bays = 10; bw = W / bays
    for i in range(bays + 1):
        x = -W / 2 + i * bw
        for y in (-0.08, 0.08): prof(f, (x, y, 0.04), (x, y, 2.45)); foot(f, x, y)
        for s in (-1, 1): prof(f, (x, s * 1.45, 0.04), (x, s * 1.45, 2.2)); foot(f, x, s * 1.45); prof(f, (x, s * 0.08, 2.2), (x, s * 1.45, 2.2))
    for z in (0.3, 1.25):                                                         # tier shelves (the plant's sets stand at 0.36 and 1.31)
        for s in (-1, 1):
            for y in (s * 0.55, s * 1.45): prof(f, (-W / 2, y, z), (W / 2, y, z))
            n = int(W / (0.25 if not LOW else 0.5))
            for k in range(n): f.cyl(0.02, 0.86, (-W / 2 + W / n * (k + 0.5), s * 1.0, z + 0.03), 'roller_grey', rot=(H, 0, 0), seg=6 if LOW else 10)
    for s in (-1, 1): prof(f, (-W / 2, s * 1.45, 2.2), (W / 2, s * 1.45, 2.2))
    prof(f, (-W / 2, 0, 2.45), (W / 2, 0, 2.45))
    f.box((W, 0.1, 2.3), (0, 0, 1.2), 'panel_black')                              # the back panel down the spine
    for s in (-1, 1):
        f.box((W, 0.02, 0.06), (s * 1.0 * 0 + 0, s * 0.07, 2.42), 'panel_white')
        f.box((W - 0.2, 0.9, 0.03), (0, s * 1.0, 2.35), 'panel_white'); f.box((W - 0.3, 0.06, 0.005), (0, s * 1.0, 2.333), 'led_panel')
        f.box((W, 0.05, 0.05), (0, s * 1.75, 0.15), 'safety_yellow')              # floor guard rail on the aisle
        for i in range(0, bays + 1, 2): f.box((0.05, 0.05, 0.3), (-W / 2 + i * bw, s * 1.75, 0.15), 'safety_yellow')
    f.build()
    pw = Part('ML.aging.power', 'Power and signal strips on the spine, a cable to every slot', 'ML.aging', bevel=0)
    for z in (0.75, 1.7):
        for s in (-1, 1):
            pw.box((W - 0.1, 0.03, 0.08), (0, s * 0.11, z), 'panel_white')
            for i in range(bays):
                x = -W / 2 + (i + 0.5) * bw
                pw.box((0.04, 0.012, 0.03), (x, s * 0.128, z), 'stack_green')
                if not LOW: pw.sweep([(x, s * 0.13, z - 0.02), (x + 0.05, s * 0.3, z - 0.3), (x + 0.1, s * 0.55, z - 0.35)], 0.006, 'cable_black', seg=6, steps=4)
    pw.build()
    lt = Part('ML.aging.lifts', 'Lift towers at both ends: sets ride up to the top tier and down again', 'ML.aging', bevel=0)
    for e in (-1, 1):
        x = e * (W / 2 + 0.45)
        for y in (-1.3, -0.1, 0.1, 1.3): prof(lt, (x - 0.35, y, 0.04), (x - 0.35, y, 2.6)); prof(lt, (x + 0.35, y, 0.04), (x + 0.35, y, 2.6))
        lt.box((0.74, 2.8, 0.06), (x, 0, 2.6), 'panel_white'); lt.box((0.7, 2.6, 0.04), (x, 0, 1.0), 'profile')
        lt.box((0.5, 0.4, 0.5), (x, 0, 2.35), 'paint_grey')
        stack_light(lt, x, 1.3, 2.63)
        for y in (-1.3, 1.3): lt.box((0.02, 0.02, 2.1), (x - 0.36, y, 1.15), 'stack_red')   # light curtain at the lift opening
    lt.build()


# ---------------------------------------------------------------- ML.wb: white balance booth
def wb():
    W, D = KIND['wb']; assembly('ML.wb', 'White balance: black booth on a profile frame, strip curtain, colour analyser on a swing arm, alignment PC')
    b = Part('ML.wb.booth', 'Black booth on a profile frame, with the belt conveyor through it', 'ML.wb', bevel=0)
    belt_conveyor(b, W)
    y0, y1, z = -D / 2 + 0.25, D / 2, 2.3
    for x in (-W / 2, W / 2):
        for y in (y0, y1): prof(b, (x, y, 0.04), (x, y, z)); foot(b, x, y)
        prof(b, (x, y0, z), (x, y1, z))
        for ya, yb in ((y0, -0.62), (0.62, y1)): b.box((0.02, yb - ya, z - 0.05), (x, (ya + yb) / 2, z / 2), 'panel_black')
        b.box((0.02, 1.24, z - ZC - 0.9), (x, 0, ZC + 0.9 + (z - ZC - 0.9) / 2), 'panel_black')
    for y in (y0, y1): prof(b, (-W / 2, y, z), (W / 2, y, z))
    b.box((W, D - 0.25, 0.02), (0, (y0 + y1) / 2, z), 'panel_black'); b.box((W, 0.02, z), (0, y1, z / 2), 'panel_black')
    b.box((W, 0.02, 0.85), (0, y0, 0.43), 'panel_black'); b.box((W * 0.45, 0.02, z - 0.85), (W * 0.27, y0, 0.85 + (z - 0.85) / 2), 'panel_black')
    for i in range(8 if not LOW else 4):                                          # strip curtain over the operator window
        n = 8 if not LOW else 4; sw = W * 0.55 / n
        b.box((sw * 0.92, 0.008, 1.35), (-W / 2 + (i + 0.5) * sw, y0 - 0.01, 0.85 + 0.7), 'panel_black')
    stack_light(b, W / 2, y1, z)
    b.build()
    a = Part('ML.wb.analyser', 'Colour analyser probe on a swing arm and the alignment PC', 'ML.wb', bevel=0)
    prof(a, (0.4, 0.95, 0.04), (0.4, 0.95, 1.7)); a.box((0.04, 0.95, 0.04), (0.4, 0.48, 1.68), 'profile')
    a.cyl(0.05, 0.16, (0.4, 0.02, 1.45), 'profile_cap', rot=(H, 0, 0), seg=SEG); a.cyl(0.035, 0.02, (0.4, -0.07, 1.45), 'stack_amber', rot=(H, 0, 0), seg=SEG)
    a.box((0.04, 0.04, 0.24), (0.4, 0.02, 1.57), 'profile')
    a.box((0.6, 0.5, 0.78), (-1.05, -D / 2 - 0.3, 0.39), 'panel_white'); monitor(a, -1.05, -D / 2 - 0.4, 1.08, face=-1)
    a.build()


# ---------------------------------------------------------------- ML.qa: final inspection booth
def qa():
    W, D = KIND['qa']; assembly('ML.qa', 'Final QA: white inspection booth with LED panels, checklist screen, reject rack')
    b = Part('ML.qa.booth', 'White inspection booth on a profile frame, LED ceiling panels, belt conveyor', 'ML.qa', bevel=0)
    belt_conveyor(b, W)
    y0, y1, z = -0.7, D / 2, 2.3
    for x in (-W / 2, W / 2):
        for y in (y0, y1): prof(b, (x, y, 0.04), (x, y, z)); foot(b, x, y)
        prof(b, (x, y0, z), (x, y1, z)); b.box((0.02, y1 - y0, z - ZC - 0.9), (x, (y0 + y1) / 2, ZC + 0.9 + (z - ZC - 0.9) / 2), 'panel_white')
    for y in (y0, y1): prof(b, (-W / 2, y, z), (W / 2, y, z))
    b.box((W, 0.02, z), (0, y1, z / 2), 'panel_white'); b.box((W, y1 - y0, 0.02), (0, (y0 + y1) / 2, z), 'panel_white')
    for k in range(3): b.box((W / 3 - 0.15, (y1 - y0) * 0.7, 0.01), (-W / 3 + k * W / 3, (y0 + y1) / 2, z - 0.015), 'led_panel')
    b.box((W, 0.9, 0.006), (0, -1.55, 0.003), 'esd_green')
    b.build()
    s = Part('ML.qa.station', 'Checklist screen, inspection lamp, reject rack', 'ML.qa', bevel=0)
    monitor(s, 1.2, -1.0, 1.4, face=-1); prof(s, (1.2, -0.95, 0.04), (1.2, -0.95, 1.22))
    for k in range(3): s.box((0.9, 0.5, 0.03), (W / 2 + 0.55, 0.6, 0.35 + k * 0.55), 'profile')
    for x in (W / 2 + 0.12, W / 2 + 0.98):
        for y in (0.37, 0.83): prof(s, (x, y, 0.04), (x, y, 1.5)); foot(s, x, y)
    s.box((0.85, 0.45, 0.25), (W / 2 + 0.55, 0.6, 1.0), 'bin_red')
    s.build()


# ---------------------------------------------------------------- ML.packer: packing station
def packer():
    W, D = KIND['packer']; assembly('ML.packer', 'Packing: rollers, lift assist, carton table, EPS stacks, carton sealer, label printer, accessory bins')
    c = Part('ML.packer.conveyor', 'Roller conveyor and the carton table', 'ML.packer', bevel=0)
    roller_conveyor(c, W)
    c.box((1.4, 1.0, 0.04), (-0.9, -1.45, 0.8), 'profile')
    for x in (-1.55, -0.25):
        for y in (-1.9, -1.0): prof(c, (x, y, 0.04), (x, y, 0.78)); foot(c, x, y)
    c.build()
    l = Part('ML.packer.lift', 'Lift assist: a gantry over the conveyor and a vacuum frame that lowers the set into its carton', 'ML.packer', bevel=0)
    for x in (-1.1, 0.5):
        for y in (-1.25, 1.25): l.box((0.1, 0.1, 2.6), (x, y, 1.3), 'safety_yellow'); l.box((0.2, 0.2, 0.02), (x, y, 0.01), 'safety_yellow')
        l.box((0.1, 2.6, 0.12), (x, 0, 2.6), 'safety_yellow')
    l.box((1.7, 0.12, 0.12), (-0.3, 0, 2.6), 'safety_yellow'); l.box((0.3, 0.3, 0.25), (-0.3, 0, 2.45), 'paint_grey')
    l.cyl(0.02, 0.9, (-0.3, 0, 1.9), 'steel_polished', seg=SEG); l.box((1.1, 0.7, 0.05), (-0.3, 0, 1.43), 'profile')
    for x, y in ((-0.75, -0.28), (0.15, -0.28), (-0.75, 0.28), (0.15, 0.28)): l.cyl(0.05, 0.05, (x, y, 1.39), 'rubber', seg=SEG)
    l.build()
    m = Part('ML.packer.materials', 'Flat cartons, EPS cushion stacks, accessory bins, carton sealer and label printer', 'ML.packer', bevel=0)
    for k in range(6): m.box((1.3, 0.85, 0.012), (-0.9, -1.45, 0.83 + k * 0.014), 'cardboard')
    for x in (0.55, 1.05, 1.55):
        for k in range(7): m.box((0.42, 0.55, 0.11), (x, -1.55, 0.06 + k * 0.115), 'eps')
    m.box((1.4, 0.5, 0.04), (-1.1, 1.5, 0.92), 'profile')
    for k in range(4): m.box((0.3, 0.4, 0.14), (-1.6 + k * 0.34, 1.5, 1.01), 'bin_blue')
    for x in (-1.75, -0.45):
        for y in (1.3, 1.7): prof(m, (x, y, 0.04), (x, y, 0.9)); foot(m, x, y)
    # carton sealer over the outfeed: a white frame with the taping heads and side drive belts
    m.box((0.6, 1.5, 0.35), (1.6, 0, ZC + 0.95), 'panel_white')
    for y in (-0.72, 0.72): m.box((0.6, 0.08, 0.95), (1.6, y, ZC + 0.47), 'panel_white'); m.box((0.5, 0.04, 0.2), (1.6, y * 0.82, ZC + 0.25), 'rubber')
    m.cyl(0.08, 0.06, (1.6, 0, ZC + 0.74), 'tape_brown', rot=(H, 0, 0), seg=SEG)
    m.box((0.3, 0.3, 0.3), (1.2, -1.0, 1.05), 'panel_white'); m.box((0.15, 0.005, 0.06), (1.2, -1.15, 1.12), 'ui_green')   # label printer
    prof(m, (1.2, -1.0, 0.04), (1.2, -1.0, 0.9))
    stack_light(m, W / 2, -0.75, ZC + 1.12)
    m.build()


for f in (fct, aging, wb, qa, packer): f()

if A.manifest:
    L.manifest(A.manifest, 'lineend', 'Main-line end kit (plant level of detail)',
               'Illustrative reconstruction after public photos of real TV lines (LG Gumi test and aging, Samsung Kaluga packing); not a real plant or vendor design.')
if A.glb:
    L.export_glb(os.path.abspath(A.glb), 'ML.')
    print('WROTE', A.glb)

if A.out:
    import stage, people as Wk
    Wk.materials()
    # the line end in flow order along X, as the plant runs it: test, aging, white balance, QA, packing
    order = ('fct', 'aging', 'wb', 'qa', 'packer'); xs = 0.0; X = {}
    for k in order:
        X[k] = xs + KIND[k][0] / 2; L.ASSEMBLIES['ML.' + k].location.x = X[k]; xs += KIND[k][0] + 1.2
    if A.still:
        st = assembly('STILL', 'sets and people for the still')
        s = Part('STILL.sets', 'sets', 'STILL', bevel=0)
        stand_set(s, X['fct'], pic='bars'); stand_set(s, X['wb'] + 0.2, pic='white'); stand_set(s, X['qa'] - 0.3, pic='grey')
        bw = 1.6
        for side in (-1, 1):
            for tier, z0 in enumerate((0.33, 1.28)):
                for i in range(10):
                    x = X['aging'] - 8 + (i + 0.5) * bw; pic = ('bars', 'white', 'bars', 'grey')[(i + tier + (side > 0)) % 4]
                    h = 0.82; zc = z0 + 0.03 + h / 2
                    s.box((1.42, 0.05, h), (x, side * 1.0, zc), 'tv_black')
                    screen(s, x, side * 1.0 + side * 0.028, zc, 1.38, h - 0.04, pic, face=side)
        for x in (X['packer'] - 0.3,):
            s.box((1.25, 0.25, 0.8), (x, 0, ZC + 0.4), 'cardboard'); s.box((1.25, 0.02, 0.06), (x, 0, ZC + 0.81), 'tape_brown')
        for k in range(4): s.box((1.3, 0.3, 0.85), (X['packer'] + KIND['packer'][0] / 2 + 1.2, -0.6 + k * 0.32, 0.12 + 0.43), 'cardboard')
        s.box((1.4, 1.3, 0.12), (X['packer'] + KIND['packer'][0] / 2 + 1.2, -0.12, 0.06), 'cardboard')
        s.build()
        pp = Part('STILL.people', 'people', 'STILL', bevel=0)
        Wk.worker(pp, X['fct'] - 0.2, -1.4, face=0.0, look='jacket', sex='f', hair='brown', height=1.65, hands=((-0.15, 0.42, 1.25), (0.2, 0.3, 1.0)), lean=0.08)
        Wk.worker(pp, X['aging'] - 3.0, -2.3, face=0.0, look='leader', sex='m', hair='grey', height=1.78, hands=((-0.2, 0.15, 1.05), (0.2, 0.25, 1.2)))
        Wk.worker(pp, X['qa'] + 0.3, -1.45, face=0.0, look='vest', sex='f', hair='blonde', height=1.68, hands=((-0.15, 0.35, 1.15), (0.15, 0.35, 1.15)), lean=0.06)
        Wk.worker(pp, X['packer'] + 0.15, -0.95, face=0.0, look='jacket', sex='m', hair='black', height=1.8, hands=((-0.35, 0.45, 1.0), (0.35, 0.45, 1.0)), lean=0.2)
        Wk.worker(pp, X['packer'] + 0.6, 1.1, face=math.pi, look='polo', sex='m', hair='brown', height=1.75, hands=((-0.2, 0.45, 1.0), (0.2, 0.45, 1.0)), lean=0.15)
        pp.build()
        stage.hall(x0=-14, x1=xs + 14, y0=-14, y1=14, lanes=(-2.6, 2.6), lamp_rows=(-4.5, -2.25, 0.0, 2.25, 4.5))
    else:
        L.studio(scale=4.0, center=(xs / 2, 0, 1.0), rot_deg=0)
    shots = {'test': ((X['fct'] - 2.6, -4.2, 1.7), (X['aging'] - 2, 0.3, 1.0), 22),
             'aging': ((X['aging'] - 9.5, -4.0, 1.9), (X['aging'] + 3, -0.6, 1.0), 22),
             'pack': ((X['packer'] - 2.0, -4.6, 2.2), (X['packer'] + 0.6, 0.0, 0.9), 22),
             'over': ((xs / 2 - 4, -11.5, 6.0), (xs / 2, 0.5, 0.6), 20)}
    p, t, lens = shots[A.shot]
    stage.cam(p, t, lens)
    L.render(os.path.abspath(A.out), samples=A.samples, res=A.res, gpu=A.gpu, look='AgX - Base Contrast')
