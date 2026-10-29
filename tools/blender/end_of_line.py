"""End of line of Plant EG-01, built in Blender from code, after real TV plants (docs/REFERENCES-TV-PLANT.md).

Packing: the finished set is lifted by a vacuum lift assist into its carton with EPS cushions; the carton is taped and
strapped. Palletizing: cartons stand on edge on a pallet with corner boards; a turntable stretch wrapper wraps the pallet.
Finished-goods warehouse: selective pallet racks, a counterbalance forklift. Shipping: a dock door with a leveller and a
40 ft high-cube container being loaded. Illustrative reconstruction: no real plant's layout or brand.

    python end_of_line.py --out eol.png [--shot hero|pack|wrap|dock] [--samples 96] [--res 1600x1000] [--glb eol.glb]
Units metres, Z up. X runs with the flow (+X toward the docks), the visitor's side is -Y.
"""
import sys, os, math, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, Matrix
import dflib as L
from dflib import Part, assembly, principled

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--out', default=''); ap.add_argument('--shot', default='hero', choices=['hero', 'pack', 'wrap', 'dock', 'rack'])
ap.add_argument('--samples', type=int, default=96); ap.add_argument('--res', default='1600x1000')
ap.add_argument('--manifest', default=''); ap.add_argument('--glb', default=''); ap.add_argument('--lod', default='full', choices=['full', 'plant'])
ap.add_argument('--gpu', action='store_true')
A = ap.parse_args(argv)
L.init(lod=A.lod)
H = math.pi / 2

principled('epoxy', '#A9B0B8', rough=0.35, coat=0.3, coat_rough=0.3, noise_bump=0.4)
principled('lane_yellow', '#E8B90C', rough=0.5)
principled('lane_green', '#2E9A5B', rough=0.5)
principled('cardboard', '#B98D5B', rough=0.85, noise_bump=0.6)
principled('carton_print', '#1E2A44', rough=0.7)
principled('eps', '#F3F3EF', rough=0.9, noise_bump=0.8)
principled('pallet_wood', '#A07D52', rough=0.85, noise_bump=0.7)
principled('film', '#E9F1F6', rough=0.15, transmission=0.85, ior=1.4)
principled('rack_orange', '#E0661F', rough=0.45, coat=0.3)
principled('rack_blue', '#25579C', rough=0.45, coat=0.3)
principled('fork_yellow', '#F0B414', rough=0.4, coat=0.4)
principled('container_red', '#9A3326', rough=0.55, noise_bump=0.5)
principled('container_inner', '#B9A988', rough=0.8)
principled('plywood', '#B89366', rough=0.8)
principled('wall_panel', '#E4E7EA', rough=0.6, metal=0.2, noise_bump=0.2)
principled('steel_beam', '#7E8792', rough=0.5, metal=0.6)
principled('ceiling_light', '#FFFFFF', emission='#F6F8FF', strength=9.0)
principled('daylight', '#FFFFFF', emission='#EAF2FF', strength=3.0)
principled('strap', '#1C1C1C', rough=0.5)
principled('tape', '#C9A86A', rough=0.3, coat=0.5)
principled('skin', '#B98F70', rough=0.55)
principled('apron', '#3F86C8', rough=0.75)
principled('cap', '#F2F4F6', rough=0.7)
principled('trousers', '#2B2F38', rough=0.85)
principled('shoe', '#15161A', rough=0.6)
principled('vest', '#E8F21B', rough=0.7)
SHIRTS = ['shirt_navy', 'shirt_grey', 'shirt_black']
for n, c in (('shirt_navy', '#26324A'), ('shirt_grey', '#7C838D'), ('shirt_black', '#1E2024')): principled(n, c, rough=0.8)
_who = [0]

CW, CT, CH = 1.63, 0.19, 1.0          # a 65-inch carton: width, thickness, height (standing on edge)

assembly('EOL', 'End of line, line ML-3: packing, palletizing, stretch wrapping, warehouse and shipping (illustrative).')

# ---------------------------------------------------------------- floor and building
assembly('EOL.building', 'Floor, wall panels, dock wall, roof steel and high-bay lights.', parent='EOL')
fl = Part('EOL.building.floor', 'Epoxy floor with lane and walkway markings', 'EOL.building', bevel=0)
fl.box((34, 18, 0.02), (4, 0, -0.008), 'epoxy')
for y in (-2.6, 2.6): fl.box((26, 0.1, 0.004), (2, y, 0.002), 'lane_yellow')
fl.box((26, 0.9, 0.004), (2, -3.4, 0.002), 'lane_green')
fl.build()
bw = Part('EOL.building.walls', 'Back wall and the dock wall', 'EOL.building', bevel=0)
for k in range(34): bw.box((0.98, 0.12, 7.0), (-13 + 0.5 + k * 1.0, 8.9, 3.5), 'wall_panel')
for k in range(18):
    yk = -9 + 0.5 + k
    if -1.6 < yk < 1.6: continue                    # the dock door opening
    bw.box((0.12, 0.98, 7.0), (21.0, yk, 3.5), 'wall_panel')
bw.box((0.12, 3.2, 3.6), (21.0, 0, 5.2), 'wall_panel')
bw.build()
bl = Part('EOL.building.lights', 'High-bay lights and roof beams', 'EOL.building', bevel=0)
for gx in range(-9, 20, 4):
    for gy in (-5, -1, 3, 7):
        bl.box((1.2, 0.6, 0.04), (gx, gy, 7.2), 'ceiling_light'); bl.box((1.25, 0.65, 0.08), (gx, gy, 7.28), 'steel_dark')
for gx in range(-12, 21, 6): bl.box((0.25, 18, 0.6), (gx, 0, 8.4), 'steel_beam')
bl.build()

# ---------------------------------------------------------------- people
assembly('EOL.people', 'Packers and a forklift driver (stylised figures).', parent='EOL')
ppl = Part('EOL.people.figures', 'People', 'EOL.people', bevel=0)
def person(x, y, face=0.0, reach=0.34, vest=False, arms_up=False):
    R = Matrix.Rotation(face, 4, 'Z'); P = lambda dx, dy, dz: tuple(Vector((x, y, 0)) + (R @ Vector((dx, dy, dz))))
    shirt = SHIRTS[_who[0] % len(SHIRTS)]; _who[0] += 1
    for sx in (-1, 1):
        ppl.cyl(0.065, 0.8, P(sx * 0.09, 0, 0.44), 'trousers', seg=16, r2=0.055); ppl.sphere(0.06, P(sx * 0.09, 0.05, 0.04), 'shoe', scale=(0.8, 1.9, 0.6))
    ppl.sphere(0.2, P(0, 0, 0.9), 'trousers', scale=(1.0, 0.65, 0.55)); ppl.sphere(0.21, P(0, 0, 1.18), shirt, scale=(1.0, 0.62, 1.45))
    if vest: ppl.sphere(0.215, P(0, 0, 1.2), 'vest', scale=(1.0, 0.64, 1.2))
    else: ppl.box((0.34, 0.02, 0.66), P(0, 0.125, 1.02), 'apron', rot=(0, 0, face))
    ppl.cyl(0.05, 0.12, P(0, 0, 1.48), 'skin', seg=14); ppl.sphere(0.105, P(0, 0.01, 1.63), 'skin', scale=(0.92, 1.0, 1.12))
    ppl.sphere(0.112, P(0, -0.005, 1.69), 'cap', scale=(1.0, 1.05, 0.62))
    for sx in (-1, 1):
        hz = 1.55 if arms_up else 1.0
        ppl.sweep([P(sx * 0.22, 0, 1.38), P(sx * 0.25, 0.04, 1.16 if not arms_up else 1.4), P(sx * 0.16, reach * 0.7, hz + 0.03), P(sx * 0.1, reach, hz)], 0.042, shirt)
        ppl.sphere(0.045, P(sx * 0.1, reach + 0.03, hz), 'cap', scale=(0.8, 1.2, 0.6))

# ---------------------------------------------------------------- packing: lift assist, cartons, cushions, taping, strapping
assembly('EOL.pack', 'Packing: a vacuum lift assist lowers the set into its carton with EPS cushions; the carton is taped and strapped.', parent='EOL')
pk = Part('EOL.pack.conveyor', 'Roller conveyors through packing', 'EOL.pack', bevel=0.002)
for x0, x1 in ((-11, -1.2), (-0.2, 7.0)):
    for sy in (-1, 1): pk.box((x1 - x0, 0.06, 0.1), ((x0 + x1) / 2, sy * 0.58, 0.72), 'alu_brushed')
    n = int((x1 - x0) / 0.12)
    for k in range(n): pk.cyl(0.03, 1.1, (x0 + 0.06 + k * 0.12, 0, 0.74), 'steel_polished', rot=(H, 0, 0), seg=12)
    for k in range(int((x1 - x0) / 1.5) + 1):
        for sy in (-1, 1): pk.box((0.05, 0.05, 0.7), (x0 + 0.1 + k * 1.5, sy * 0.58, 0.35), 'alu_brushed')
pk.build()
ct = Part('EOL.pack.cartons', 'TV cartons (printed, taped, strapped) and EPS cushions', 'EOL.pack', bevel=0.008)
def carton(x, y, z=0.0, flat=True, open_top=False, rotz=0.0):
    """A 65-inch carton. flat: lying on the conveyor (as packed); otherwise standing on edge (as palletized)."""
    if flat:
        ct.box((CW, CH, CT), (x, y, z + CT / 2), 'cardboard', rot=(0, 0, rotz))
        if not open_top:
            ct.box((CW * 0.6, 0.004 + CH * 0.0 + 0.06, 0.003), (x, y, z + CT + 0.001), 'tape', rot=(0, 0, rotz))
            ct.box((CW + 0.004, 0.025, CT + 0.004), (x - 0.4, y, z + CT / 2), 'strap'); ct.box((CW + 0.004, 0.025, CT + 0.004), (x + 0.4, y, z + CT / 2), 'strap')
            ct.box((0.9, 0.5, 0.002), (x + 0.1, y - 0.05, z + CT + 0.002), 'carton_print')
    else:
        R = Matrix.Rotation(rotz, 4, 'Z')
        ct.box((CW, CT, CH), (x, y, z + CH / 2), 'cardboard', rot=(0, 0, rotz))
        off = R @ Vector((0, -CT / 2 - 0.001, 0))
        ct.box((0.8, 0.002, 0.42), (x + off.x, y + off.y, z + CH * 0.55), 'carton_print', rot=(0, 0, rotz))
for x in (-9.5, -7.4):                                         # cartons coming from the erector, open, with cushions
    carton(x, 0, 0.79, flat=True, open_top=True)
    for sx in (-1, 1):
        for sy in (-1, 1): ct.box((0.22, 0.22, 0.16), (x + sx * (CW / 2 - 0.13), sy * (CH / 2 - 0.13), 0.79 + CT + 0.02), 'eps')
for x in (1.2, 3.0, 4.8):                                      # taped and strapped, on their way to the palletizer
    carton(x, 0, 0.79)
la = Part('EOL.pack.lift', 'Vacuum lift assist on a jib, lowering a set into the open carton', 'EOL.pack', bevel=0.003)
jx = -5.3
la.cyl(0.09, 3.2, (jx, -1.4, 1.6), 'paint_white', seg=24); la.box((0.6, 0.6, 0.06), (jx, -1.4, 0.03), 'steel_dark')
la.box((0.12, 2.0, 0.14), (jx, -0.45, 3.1), 'paint_white')                                    # jib arm
la.cyl(0.05, 1.3, (jx, 0.0, 2.4), 'alu_brushed', seg=16)                                      # vacuum tube
la.box((0.9, 0.5, 0.06), (jx, 0.0, 1.72), 'anodised_dark')                                    # suction frame
for sx in (-1, 1):
    for sy in (-1, 1): la.cyl(0.05, 0.04, (jx + sx * 0.35, sy * 0.18, 1.67), 'rubber', seg=16)
la.box((1.45, 0.06, 0.84), (jx, 0.0, 1.22), 'cover_black' if 'cover_black' in L.MATS else 'plastic_black', rot=(H, 0, 0))   # the set, face down
la.build()
carton(jx, 0, 0.79, flat=True, open_top=True)
ct.build()
ct2 = Part('EOL.pack.cushions', 'EPS cushions in the carton under the lift', 'EOL.pack', bevel=0.008)
for sx in (-1, 1):
    for sy in (-1, 1): ct2.box((0.22, 0.22, 0.16), (jx + sx * (CW / 2 - 0.13), sy * (CH / 2 - 0.13), 0.79 + CT + 0.02), 'eps')
ct2.build()
person(jx - 0.9, -0.9, face=0.3, arms_up=True); person(jx + 0.9, -0.9, face=-0.3)
mc = Part('EOL.pack.machines', 'Carton taping and strapping machines', 'EOL.pack', bevel=0.004)
tx = -0.7
mc.box((1.0, 1.6, 0.12), (tx, 0, 1.6), 'paint_blue'); [mc.box((0.1, 0.1, 1.0), (tx + sx * 0.45, sy * 0.75, 1.05), 'paint_blue') for sx in (-1, 1) for sy in (-1, 1)]
mc.box((0.25, 0.3, 0.3), (tx, 0, 1.4), 'anodised_dark'); mc.cyl(0.12, 0.08, (tx, 0.25, 1.45), 'tape', rot=(H, 0, 0), seg=24)
sx_ = 0.4                                                                                         # strapping arch
mc.box((0.12, 1.9, 0.14), (sx_, 0, 1.15), 'paint_white'); [mc.box((0.14, 0.14, 1.15), (sx_, sy * 0.9, 0.575), 'paint_white') for sy in (-1, 1)]
mc.box((0.5, 0.5, 0.7), (sx_, -1.25, 0.35), 'paint_white'); mc.cyl(0.18, 0.08, (sx_, -1.25, 0.82), 'strap', rot=(H, 0, 0), seg=24)
mc.build()

# ---------------------------------------------------------------- palletizing and stretch wrapping
assembly('EOL.pallet', 'Palletizing: cartons on edge with corner boards; a turntable stretch wrapper wraps each pallet.', parent='EOL')
pl = Part('EOL.pallet.pallets', 'Wooden pallets', 'EOL.pallet', bevel=0.004)
pc = Part('EOL.pallet.loads', 'Cartons on pallets with corner boards and top caps', 'EOL.pallet', bevel=0.006)
def pallet(x, y, n=5, wrapped=False, z=0.0, part=None):
    """A 1.8 x 1.1 m pallet with n cartons standing on edge, corner boards and a top cap."""
    for k in range(3): pl.box((1.8, 0.1, 0.1), (x, y - 0.5 + k * 0.5, z + 0.05), 'pallet_wood')
    for k in range(7): pl.box((0.12, 1.1, 0.02), (x - 0.84 + k * 0.28, y, z + 0.11), 'pallet_wood')
    for k in range(n):
        yy = y - (n - 1) * CT / 2 + k * CT
        pc.box((CW, CT - 0.004, CH), (x, yy, z + 0.12 + CH / 2), 'cardboard')
        pc.box((0.8, 0.002, 0.42), (x, yy - CT / 2 + 0.001, z + 0.12 + CH * 0.55), 'carton_print') if k == 0 else None
    span = n * CT
    for sx in (-1, 1):
        for sy in (-1, 1): pc.box((0.06, 0.06, CH), (x + sx * (CW / 2 + 0.01), y + sy * (span / 2 + 0.01), z + 0.12 + CH / 2), 'cardboard')
    pc.box((CW + 0.06, span + 0.06, 0.03), (x, y, z + 0.12 + CH + 0.015), 'cardboard')
    if wrapped:
        film.box((CW + 0.1, span + 0.1, CH * 0.92), (x, y, z + 0.12 + CH * 0.46), 'film')
film = Part('EOL.pallet.film', 'Stretch film', 'EOL.pallet', bevel=0.03)
# the palletizing station: an operator builds a pallet at the end of the conveyor
pallet(8.4, -0.2, n=3)
person(8.2, -1.25, face=0.0)
# the stretch wrapper: turntable, mast, film carriage, a pallet half wrapped
sw = Part('EOL.pallet.wrapper', 'Turntable stretch wrapper with mast and film carriage', 'EOL.pallet', bevel=0.004)
wx, wy = 11.6, 0.0
sw.cyl(1.25, 0.08, (wx, wy, 0.04), 'steel_dark', seg=48); sw.cyl(1.2, 0.02, (wx, wy, 0.09), 'paint_grey', seg=48)
sw.box((0.25, 0.25, 2.6), (wx + 1.6, wy - 0.4, 1.3), 'paint_blue'); sw.box((0.5, 0.5, 0.6), (wx + 1.6, wy - 0.4, 0.3), 'paint_blue')
sw.box((0.3, 0.35, 0.4), (wx + 1.38, wy - 0.4, 1.15), 'anodised_dark'); sw.cyl(0.07, 0.5, (wx + 1.25, wy - 0.4, 1.15), 'film', seg=24)
sw.box((0.6, 0.12, 0.9), (wx + 1.6, wy - 0.8, 1.2), 'paint_white')                                    # control panel
sw.build()
pallet(wx, wy, n=5, wrapped=True, z=0.1)
# wrapped pallets waiting for the forklift
for k, (x, y) in enumerate(((14.8, -0.6), (14.8, 1.0), (16.9, -0.6))): pallet(x, y, n=5, wrapped=True)
pl.build(); pc.build(); film.build()

# ---------------------------------------------------------------- finished-goods racks
assembly('EOL.racks', 'Selective pallet racks for finished goods, three beam levels.', parent='EOL')
rk = Part('EOL.racks.steel', 'Rack uprights, beams and wire decks', 'EOL.racks', bevel=0.003)
rx0, ry0 = 0.0, 6.6
for bay in range(6):
    x = rx0 + bay * 2.0
    for dy in (-0.55, 0.55):
        rk.box((0.09, 0.07, 6.2), (x - 1.0, ry0 + dy, 3.1), 'rack_blue'); rk.box((0.09, 0.07, 6.2), (x + 1.0, ry0 + dy, 3.1), 'rack_blue')
    for lvl in (1.7, 3.4, 5.1):
        for dy in (-0.55, 0.55): rk.box((2.0, 0.06, 0.12), (x, ry0 + dy, lvl), 'rack_orange')
rk.build()
pl = Part('EOL.racks.pallets', 'Wooden pallets in the racks', 'EOL.racks', bevel=0.004); pc = Part('EOL.racks.loads', 'Stored loads', 'EOL.racks', bevel=0.006)
film = Part('EOL.racks.film', 'Stretch film on stored loads', 'EOL.racks', bevel=0.03)
for bay in range(6):
    for lvl in (0.0, 1.76, 3.46):
        if (bay * 3 + int(lvl)) % 5 == 2: continue
        pallet(rx0 + bay * 2.0, ry0, n=5, wrapped=True, z=lvl)
pl.build(); pc.build(); film.build()

# ---------------------------------------------------------------- forklift
assembly('EOL.forklift', 'Counterbalance forklift carrying a wrapped pallet to the dock.', parent='EOL')
fk = Part('EOL.forklift.truck', 'Forklift: body, counterweight, overhead guard, mast, forks, wheels', 'EOL.forklift', bevel=0.02)
fx, fy = 17.0, 2.6
fk.box((1.9, 1.1, 0.7), (fx, fy, 0.6), 'fork_yellow'); fk.box((0.5, 1.12, 0.8), (fx - 0.75, fy, 0.75), 'steel_dark')
fk.box((0.6, 0.5, 0.12), (fx - 0.1, fy, 1.0), 'plastic_black')                                    # seat
for dx in (-0.6, 0.55):
    for sy in (-1, 1): fk.cyl(0.3 if dx > 0 else 0.25, 0.22, (fx + dx, fy + sy * 0.5, 0.3 if dx > 0 else 0.25), 'rubber', rot=(H, 0, 0), seg=28)
for sx, sy in ((-0.5, -0.5), (-0.5, 0.5), (0.4, -0.5), (0.4, 0.5)): fk.box((0.06, 0.06, 1.3), (fx + sx, fy + sy, 1.6), 'steel_dark')
fk.box((1.0, 1.1, 0.05), (fx - 0.05, fy, 2.25), 'steel_dark')
for sy in (-0.35, 0.35): fk.box((0.1, 0.12, 2.6), (fx + 1.05, fy + sy, 1.3), 'steel_dark')
fk.box((0.08, 0.95, 0.5), (fx + 1.15, fy, 0.55), 'steel_dark')
for sy in (-0.3, 0.3): fk.box((1.2, 0.12, 0.05), (fx + 1.75, fy + sy, 0.35), 'steel_dark')
fk.build()
pl = Part('EOL.forklift.pallet', 'Pallet on the forks', 'EOL.forklift', bevel=0.004); pc = Part('EOL.forklift.load', 'Load on the forks', 'EOL.forklift', bevel=0.006)
film = Part('EOL.forklift.film', 'Film on the load', 'EOL.forklift', bevel=0.03)
pallet(fx + 1.75, fy, n=5, wrapped=True, z=0.28); pl.build(); pc.build(); film.build()
person(fx - 0.15, fy, face=-H, vest=True)

# ---------------------------------------------------------------- the dock and the container
assembly('EOL.dock', 'Dock door with leveller and a 40 ft high-cube container being loaded.', parent='EOL')
dk = Part('EOL.dock.door', 'Dock door frame, rolled-up door, leveller and bumpers', 'EOL.dock', bevel=0.004)
dk.box((0.3, 3.3, 0.3), (21.0, 0, 3.6), 'steel_dark'); dk.box((0.6, 3.1, 0.5), (20.9, 0, 3.95), 'paint_grey')    # roll-up door drum
dk.box((2.0, 2.8, 0.06), (20.0, 0, 0.03), 'steel_dark')                                                       # leveller plate
for sy in (-1.5, 1.5): dk.box((0.15, 0.25, 0.35), (21.1, sy, 1.0), 'rubber'); dk.box((0.14, 0.14, 3.4), (21.05, sy * 1.12, 1.7), 'estop_yellow')
dk.build()
cn = Part('EOL.dock.container', 'A 40 ft high-cube container, doors open, half loaded', 'EOL.dock', bevel=0.01)
cx0, cl, cw_, chh = 21.3, 12.03, 2.44, 2.9
cn.box((cl, 0.06, chh), (cx0 + cl / 2, -cw_ / 2, 1.2 + chh / 2), 'container_red'); cn.box((cl, 0.06, chh), (cx0 + cl / 2, cw_ / 2, 1.2 + chh / 2), 'container_red')
for k in range(int(cl / 0.3)):                                     # corrugation ribs
    for sy in (-1, 1): cn.box((0.12, 0.05, chh - 0.1), (cx0 + 0.15 + k * 0.3, sy * (cw_ / 2 + 0.03), 1.2 + chh / 2), 'container_red')
cn.box((cl, cw_, 0.08), (cx0 + cl / 2, 0, 1.2 + chh), 'container_red'); cn.box((cl, cw_, 0.1), (cx0 + cl / 2, 0, 1.2), 'container_inner')
cn.box((cl, cw_ - 0.1, 0.02), (cx0 + cl / 2, 0, 1.26), 'plywood')
for sy in (-1, 1): cn.box((0.06, 1.2, chh), (cx0 - 0.05, sy * (cw_ / 2 + 0.6), 1.2 + chh / 2), 'container_red', rot=(0, 0, sy * 0.25))   # open doors
for dx in (2.0, 9.0):
    for sy in (-1, 1): cn.cyl(0.5, 0.3, (cx0 + dx, sy * 0.9, 0.5), 'rubber', rot=(H, 0, 0), seg=24)
cn.box((cl, 1.0, 0.25), (cx0 + cl / 2, 0, 0.95), 'steel_dark')                                                # chassis
cn.build()
pl = Part('EOL.dock.pallets', 'Pallets loaded in the container', 'EOL.dock', bevel=0.004); pc = Part('EOL.dock.loads', 'Loads in the container', 'EOL.dock', bevel=0.006)
film = Part('EOL.dock.film', 'Film on the loads', 'EOL.dock', bevel=0.03)
for k in range(4):
    for sy in (-0.6, 0.6): pallet(cx0 + cl - 1.0 - k * 1.85, sy, n=5, wrapped=True, z=1.26)
pl.build(); pc.build(); film.build()
ppl.build()

# ---------------------------------------------------------------- studio and outputs
SHOTS = {
    'hero': ((-2.0, 6.5, 13.0), (7.0, 0.8, 0.5), 40),
    'pack': ((-2.4, 2.6, 4.6), (-5.6, 1.0, 0.0), 44),
    'wrap': ((9.0, 2.4, 5.0), (12.6, 1.0, 0.0), 44),
    'dock': ((15.0, 3.2, 6.5), (21.5, 1.3, 0.0), 42),
    'rack': ((4.0, 3.0, 2.6), (5.0, 2.5, -6.6), 48),
}
if A.manifest: L.manifest(A.manifest, 'EOL', 'End of line, line ML-3, Plant EG-01', 'Illustrative reconstruction after real TV plants; not any real plant.')
if A.glb: L.export_glb(A.glb, 'EOL')
if A.out:
    L.world('#C9CED6', 0.65)
    for gx in range(-9, 20, 4):
        for gy in (-5, -1, 3, 7): L.area(f'light.bay{gx}_{gy}', (gx, gy, 7.1), (gx, gy, 0), 1.2, 300, (1.0, 0.98, 0.95), size_y=0.6)
    L.area('light.key', (-6, -14, 10), (6, 0, 0.9), 7.0, 2600, (1.0, 0.97, 0.93))
    L.area('light.dock', (26, 0, 4), (20, 0, 1), 3.0, 900, (0.92, 0.96, 1.0))              # daylight from the open dock
    pos, look, fov = SHOTS[A.shot]; cam = L.camera(pos, look, fov, fstop=0)
    L.render(A.out, samples=A.samples, res=A.res, gpu=A.gpu)
