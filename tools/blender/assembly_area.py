"""Main assembly area of Plant EG-01, built in Blender from code, after real TV plants (docs/REFERENCES-TV-PLANT.md).

What it shows, as seen in the LG Gumi photos and factory-tour frames: a long straight pallet conveyor with TVs lying face
down on green padded pallets, each pallet one step further on (backlight chassis, boards, speakers and cables, back cover);
aluminium-profile station frames over the line with LED task lights, work-instruction screens and electric screwdrivers on
spring balancers; part flow racks with blue bins beside each operator; U-shaped sub-assembly cells beside the line where
operators stand one behind another and send kits to the line on a roller conveyor; green ESD mats and yellow lane lines;
and at the end, sets turned upright on the test conveyor showing test patterns.
Illustrative reconstruction: no real plant's layout or brand.

    python assembly_area.py --out area.png [--shot hero|line|cell|test] [--samples 96] [--res 1600x1000]
                            [--manifest parts.json] [--glb area.glb] [--lod full|plant] [--gpu]
Units metres, Z up. X runs along the line (material flows +X), the operators' main side is -Y.
"""
import sys, os, math, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix, Euler
import dflib as L
from dflib import Part, assembly, principled, srgb, rnd

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--out', default=''); ap.add_argument('--shot', default='hero', choices=['hero', 'line', 'cell', 'test', 'top', 'qa', 'robot', 'wide'])
ap.add_argument('--samples', type=int, default=96); ap.add_argument('--res', default='1600x1000')
ap.add_argument('--manifest', default=''); ap.add_argument('--glb', default=''); ap.add_argument('--anchors', default='')
ap.add_argument('--lod', default='full', choices=['full', 'plant']); ap.add_argument('--gpu', action='store_true')
A = ap.parse_args(argv)
L.init(lod=A.lod)
H = math.pi / 2

# ---------------------------------------------------------------- materials this area adds
principled('felt_green', '#2F6B4A', rough=0.95)                 # pallet pads
principled('esd_mat', '#3E7A5A', rough=0.8)                     # green ESD floor mats
principled('epoxy', '#A9B0B8', rough=0.35, coat=0.3, coat_rough=0.3, noise_bump=0.4)
principled('lane_yellow', '#E8B90C', rough=0.5)
principled('panel_black', '#08090B', rough=0.08, coat=1.0, coat_rough=0.02)   # TV front glass (face down)
principled('chassis', '#B8BEC6', metal=1.0, rough=0.3, aniso=0.4)             # galvanised back chassis
principled('cover_black', '#151619', rough=0.55, noise_bump=0.5)              # textured back cover
principled('bin_blue', '#1D5FB8', rough=0.45)
principled('bin_red', '#C23B2E', rough=0.45)
principled('skin', '#B98F70', rough=0.55)
principled('shirt', '#DCDFE3', rough=0.8)
principled('shirt_navy', '#26324A', rough=0.8)
principled('shirt_black', '#1E2024', rough=0.8)
principled('shirt_red', '#9E2B2B', rough=0.8)
principled('shirt_grey', '#7C838D', rough=0.8)
SHIRTS = ['shirt', 'shirt_navy', 'shirt_black', 'shirt_grey', 'shirt_red', 'shirt_navy']
_who = [0]
principled('apron', '#3F86C8', rough=0.75)
principled('cap', '#F2F4F6', rough=0.7)
principled('trousers', '#2B2F38', rough=0.85)
principled('shoe', '#15161A', rough=0.6)
principled('cardboard', '#B98D5B', rough=0.85)
principled('wood', '#9C7A52', rough=0.8)
principled('speaker', '#1C1D20', rough=0.7)
principled('robot_white', '#E9EAEC', rough=0.35, coat=0.4, coat_rough=0.15, noise_bump=0.15)
principled('robot_orange', '#E8641E', rough=0.4, coat=0.3)
principled('wall_panel', '#E4E7EA', rough=0.6, metal=0.2, noise_bump=0.2)
principled('steel_beam', '#7E8792', rough=0.5, metal=0.6)
principled('ceiling_light', '#FFFFFF', emission='#F6F8FF', strength=9.0)
principled('window_sky', '#FFFFFF', emission='#DCE8F5', strength=2.5)

def screen(name, kind, W=320, Hh=200):
    """An emissive picture drawn in code: work instructions, colour bars, white field, green field."""
    img = bpy.data.images.new(name, W, Hh); px = [0.0] * (W * Hh * 4)
    def rect(x0, y0, x1, y1, c):
        for y in range(max(0, y0), min(Hh, y1)):
            for x in range(max(0, x0), min(W, x1)): i = (y * W + x) * 4; px[i:i + 4] = c
    if kind == 'bars':
        cols = [(.75, .75, .75, 1), (.75, .75, 0, 1), (0, .75, .75, 1), (0, .75, 0, 1), (.75, 0, .75, 1), (.75, 0, 0, 1), (0, 0, .75, 1)]
        for k, c in enumerate(cols): rect(k * W // 7, Hh // 3, (k + 1) * W // 7, Hh, c)
        for k in range(8): v = k / 7; rect(k * W // 8, 0, (k + 1) * W // 8, Hh // 3, (v, v, v, 1))
    elif kind == 'white': rect(0, 0, W, Hh, (0.92, 0.93, 0.95, 1)); rect(W - 90, Hh - 34, W - 8, Hh - 8, (0.1, 0.1, 0.12, 1))
    elif kind == 'green': rect(0, 0, W, Hh, (0.05, 0.75, 0.15, 1))
    else:   # work instruction: dark page, a drawing of the step, three lines of text, a step counter
        rect(0, 0, W, Hh, (0.92, 0.93, 0.95, 1)); rect(0, Hh - 26, W, Hh, (0.04, 0.12, 0.45, 1))
        rect(16, 40, 170, 150, (0.75, 0.78, 0.82, 1)); rect(30, 60, 150, 130, (0.2, 0.45, 0.25, 1))
        for k in range(4): rect(186, 140 - k * 22, 300 - (k % 2) * 40, 150 - k * 22, (0.2, 0.22, 0.26, 1))
        rect(186, 40, 250, 64, (0.05, 0.6, 0.2, 1))
    img.pixels = px
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; p = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
    p.inputs['Base Color'].default_value = (0, 0, 0, 1); p.inputs['Roughness'].default_value = 0.08
    nt.links.new(t.outputs['Color'], p.inputs['Emission Color']); p.inputs['Emission Strength'].default_value = 2.2
    L.MATS[name] = m
for k in ('wi', 'bars', 'white', 'green'): screen('scr_' + k, k)

def uv_plane(ob, axis_u, axis_v, u0, v0, du, dv):
    """Map the image onto a screen quad: u, v from two world axes."""
    me = ob.data; uv = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = ((co[axis_u] - u0) / du, (co[axis_v] - v0) / dv)

def screen_quad(pid, role, asm, x, y, z, w, h, mat, tilt=0.0):
    """A lit screen face as its own object, with UVs spanning its picture (tilt: lean back about X, radians)."""
    q = Part(pid, role, asm, bevel=0); q.box((w, 0.003, h), (x, y, z), mat, rot=(tilt, 0, 0)); ob = q.build()
    me = ob.data; uv = me.uv_layers.new(name='UVMap'); c, sn = math.cos(tilt), math.sin(tilt)
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            dz = (co.z - z) * c - (co.y - y) * sn          # undo the lean to find the height on the screen
            uv.data[li].uv = ((co.x - (x - w / 2)) / w, dz / h + 0.5)
    return ob

# ---------------------------------------------------------------- dimensions
LINE_X0, LINE_X1 = -7.0, 7.0          # main conveyor length 14 m
Z_TOP = 0.82                          # conveyor top: pallets ride at hip height for standing work
PITCH = 2.0                           # one station every 2 m
STATIONS = [-5.0, -3.0, -1.0, 1.0, 3.0]
TEST_X = [4.6, 6.3]                   # the upright test section at the end, one set per fixture
TVW, TVD = 1.45, 0.84                 # a 65-inch set
PAL_W, PAL_D = 1.62, 1.0

assembly('AREA', 'Main assembly area, line ML-3 (illustrative reconstruction after real TV plants).')

# ---------------------------------------------------------------- floor: epoxy, ESD mats, lanes
assembly('AREA.floor', 'Epoxy floor with green ESD mats at the workstations and yellow lane lines.', parent='AREA')
p = Part('AREA.floor.slab', 'Epoxy floor', 'AREA.floor', bevel=0)
p.box((26, 16.2, 0.02), (0, -1.4, -0.008), 'epoxy'); p.build()
p = Part('AREA.floor.marks', 'ESD mats and lane lines', 'AREA.floor', bevel=0.002)
for sy in (-1, 1):
    p.box((LINE_X1 - LINE_X0 - 0.4, 0.9, 0.008), (0, sy * 1.15, 0.004), 'esd_mat')
    p.box((22, 0.08, 0.004), (0, sy * 1.75, 0.002), 'lane_yellow')
p.box((22, 0.08, 0.004), (0, -6.4, 0.002), 'lane_yellow')
for cx in (-4.2, 0.8):
    p.box((3.4, 3.0, 0.008), (cx, -4.15, 0.004), 'esd_mat')
p.build()

# ---------------------------------------------------------------- the main conveyor (twin-strand pallet conveyor)
assembly('AREA.conveyor', 'Twin-strand pallet conveyor with stoppers at every station and a return run below.', parent='AREA')
p = Part('AREA.conveyor.frame', 'Aluminium conveyor frame, legs and the lower return run', 'AREA.conveyor', bevel=0.003)
LL = LINE_X1 - LINE_X0
for sy in (-1, 1):
    y = sy * (PAL_D / 2 - 0.06)
    p.box((LL, 0.08, 0.12), (0, y, Z_TOP - 0.1), 'alu_brushed')               # side profile
    p.box((LL, 0.05, 0.012), (0, y, Z_TOP - 0.034), 'plastic_black')          # chain strand
    p.box((LL, 0.06, 0.08), (0, y, 0.32), 'alu_brushed')                       # return run
    for x in [LINE_X0 + 0.3 + k * 1.5 for k in range(int(LL / 1.5) + 1)]:
        p.box((0.06, 0.06, Z_TOP - 0.16), (x, y, (Z_TOP - 0.16) / 2), 'alu_brushed')
        p.cyl(0.035, 0.02, (x, y, 0.01), 'rubber', seg=16)
for x in [LINE_X0 + 0.3 + k * 1.5 for k in range(int(LL / 1.5) + 1)]:
    p.box((0.05, PAL_D - 0.1, 0.05), (x, 0, 0.5), 'alu_brushed')
p.build()
p = Part('AREA.conveyor.stoppers', 'Pneumatic pallet stoppers and position sensors', 'AREA.conveyor', bevel=0.002)
for x in STATIONS:
    p.box((0.06, 0.08, 0.1), (x + PAL_W / 2 + 0.05, 0, Z_TOP - 0.08), 'steel_dark')
    p.cyl(0.015, 0.06, (x + PAL_W / 2 + 0.05, -PAL_D / 2 + 0.02, Z_TOP - 0.02), 'led_green', seg=12)
p.build()

# ---------------------------------------------------------------- pallets and the TVs on them, one step further each time
def tv(part, x, y, z, step, upright=False, screen_mat='scr_bars'):
    """A 65-inch set. step 0 backlight chassis, 1 + boards, 2 + speakers and cables, 3 back cover on."""
    if upright:   # standing on the test conveyor, screen facing -Y (the camera side)
        part.box((TVW, 0.06, TVD), (x, y, z + TVD / 2 + 0.05), 'cover_black')
        screen_quad(f'AREA.test.screen_{int(x * 10)}', 'Test pattern', 'AREA.test', x, y - 0.032, z + TVD / 2 + 0.05, TVW - 0.03, TVD - 0.03, screen_mat)
        for k in range(3): part.sweep([(x + 0.3 + k * 0.04, y + 0.04, z + 0.2), (x + 0.32 + k * 0.04, y + 0.2, z + 0.05), (x + 0.5 + k * 0.1, y + 0.3, z - 0.1)], 0.005, ['plastic_black', 'reel_blue', 'cable_orange'][k])
        part.box((0.4, 0.25, 0.05), (x, y + 0.05, z + 0.025), 'steel_dark')           # test fixture
        return
    part.box((TVW, TVD, 0.012), (x, y, z + 0.006), 'panel_black')
    part.box((TVW - 0.03, TVD - 0.03, 0.03), (x, y, z + 0.027), 'chassis')
    for k in range(5):                                                                  # stiffening ribs in the chassis
        part.box((TVW - 0.2, 0.025, 0.006), (x, y - TVD / 2 + 0.12 + k * 0.15, z + 0.045), 'chassis')
    if step >= 1:
        part.box((0.36, 0.22, 0.012), (x + 0.12, y + 0.05, z + 0.05), 'pcb_green')      # main board
        part.box((0.32, 0.26, 0.012), (x - 0.3, y + 0.03, z + 0.05), 'pcb_green')       # power board
        for k in range(6): part.cyl(0.008, 0.03, (x - 0.38 + k * 0.03, y + 0.1, z + 0.07), 'plastic_black', seg=10)
        part.box((0.06, 0.05, 0.03), (x + 0.2, y + 0.08, z + 0.07), 'steel_polished')   # heat sink
    if step >= 2:
        for sx in (-1, 1): part.box((0.22, 0.06, 0.05), (x + sx * 0.5, y - TVD / 2 + 0.07, z + 0.07), 'speaker')
        for k in range(3): part.box((0.5, 0.012, 0.004), (x - 0.05, y - 0.08 - k * 0.02, z + 0.058), ['plastic_black', 'cable_orange', 'reel_white'][k])
    if step >= 3:
        part.box((TVW - 0.12, TVD - 0.12, 0.05), (x, y, z + 0.075), 'cover_black')       # back cover
        part.box((0.3, 0.2, 0.02), (x, y + 0.06, z + 0.11), 'steel_dark')               # VESA plate
        part.box((0.25, 0.03, 0.006), (x - 0.45, y - 0.28, z + 0.101), 'label_white')   # rating label

assembly('AREA.units', 'TVs on padded pallets, each a step further on.', parent='AREA')
pal = Part('AREA.units.pallets', 'Padded pallets (green felt on an aluminium frame)', 'AREA.units', bevel=0.004)
units = Part('AREA.units.tvs', 'TV sets on the line (backlight chassis, boards, speakers, back cover)', 'AREA.units', bevel=0.002)
for i, x in enumerate(STATIONS):
    pal.box((PAL_W, PAL_D, 0.03), (x, 0, Z_TOP + 0.015), 'alu_brushed'); pal.box((PAL_W - 0.06, PAL_D - 0.06, 0.02), (x, 0, Z_TOP + 0.04), 'felt_green')
    tv(units, x, 0, Z_TOP + 0.05, min(3, i * 3 // (len(STATIONS) - 1) if i else 0))
for x in (LINE_X0 + 1.0, -1.9, 2.1):                                          # empty pallets on the return run
    pal.box((PAL_W, PAL_D, 0.03), (x, 0, 0.38), 'alu_brushed'); pal.box((PAL_W - 0.06, PAL_D - 0.06, 0.02), (x, 0, 0.405), 'felt_green')
pal.build(); units.build()

# ---------------------------------------------------------------- station frames: lights, screens, screwdrivers
assembly('AREA.stations', 'Station frames over the line: LED task light, work-instruction screen, screwdrivers on balancers.', parent='AREA')
fr = Part('AREA.stations.frames', 'Aluminium-profile station frames', 'AREA.stations', bevel=0.002)
li = Part('AREA.stations.lights', 'LED task lights', 'AREA.stations', bevel=0)
sc = Part('AREA.stations.screens', 'Work-instruction screens', 'AREA.stations', bevel=0.002)
tools = Part('AREA.stations.tools', 'Electric screwdrivers on spring balancers and torque controllers', 'AREA.stations', bevel=0.0015)
for i, x in enumerate(STATIONS):
    for sy in (-1, 1):
        fr.box((0.045, 0.045, 2.15), (x - PITCH / 2 + 0.1, sy * 0.78, 1.075), 'alu_brushed')
    fr.box((0.045, 1.6, 0.045), (x - PITCH / 2 + 0.1, 0, 2.15), 'alu_brushed')
    fr.box((PITCH, 0.045, 0.045), (x, -0.45, 2.1), 'alu_brushed'); fr.box((PITCH, 0.045, 0.045), (x, 0.45, 2.1), 'alu_brushed')
    li.box((1.2, 0.08, 0.025), (x, -0.25, 1.95), 'led_white'); li.box((1.2, 0.1, 0.02), (x, -0.25, 1.975), 'alu_brushed')
    # screen on an arm, facing the operator on the -Y side
    fr.box((0.03, 0.3, 0.03), (x - 0.55, -0.62, 1.75), 'alu_brushed')
    sc.box((0.56, 0.035, 0.34), (x - 0.55, -0.78, 1.62), 'plastic_black', rot=(math.radians(10), 0, 0))
    screen_quad(f'AREA.stations.wi{i + 1}', 'Work-instruction picture', 'AREA.stations', x - 0.55, -0.8, 1.62, 0.52, 0.3, 'scr_wi', math.radians(10))
    sc.box((0.18, 0.1, 0.12), (x + 0.6, -0.55, 1.92), 'anodised_dark')                   # torque controller
    sc.cyl(0.03, 0.03, (x + 0.6, -0.61, 1.98), 'led_green', rot=(H, 0, 0), seg=16)
    for k, dx in enumerate((-0.15, 0.25)):
        bx = x + dx; tools.cyl(0.035, 0.07, (bx, -0.2, 2.04), 'paint_blue', seg=20)        # spring balancer
        tools.sweep([(bx, -0.2, 2.0), (bx + 0.02, -0.2, 1.75), (bx - 0.01, -0.2, 1.55), (bx, -0.2, 1.4)], 0.003, 'steel_dark')
        tools.cyl(0.022, 0.24, (bx, -0.2, 1.28), 'plastic_black', seg=20)                   # driver body
        tools.cyl(0.005, 0.06, (bx, -0.2, 1.13), 'steel_polished', seg=10)                  # bit
        tools.sweep([(bx, -0.2, 1.4), (bx + 0.1, -0.22, 1.5), (x + 0.6, -0.5, 1.86)], 0.004, 'cable_orange')
fr.build(); li.build(); sc.build(); tools.build()

# ---------------------------------------------------------------- flow racks with bins beside each operator
assembly('AREA.racks', 'Gravity flow racks with blue bins: parts slide to the operator, empties go back on the top shelf.', parent='AREA')
rk = Part('AREA.racks.frames', 'Flow rack frames and roller shelves', 'AREA.racks', bevel=0.002)
bins = Part('AREA.racks.bins', 'Part bins (blue for parts, red for rejects)', 'AREA.racks', bevel=0.004)
for i, x in enumerate(STATIONS):
    # a small two-tier flow rack behind every operator on the main side, every other station on the far side
    for side, y0 in ((-1, -1.95), (1, 1.95)):
        if side == 1 and i % 2: continue
        for sx in (-0.38, 0.38):
            rk.box((0.03, 0.03, 1.15), (x + sx, y0 - side * 0.2, 0.575), 'alu_brushed'); rk.box((0.03, 0.03, 0.95), (x + sx, y0 + side * 0.2, 0.475), 'alu_brushed')
        for k, (z, tilt) in enumerate(((0.62, -0.2), (0.98, 0.15))):
            rk.box((0.78, 0.45, 0.015), (x, y0, z), 'steel_dark', rot=(side * tilt, 0, 0))
            for b in range(3):
                c = 'bin_red' if (k == 1 and b == 2) else 'bin_blue'
                bins.box((0.22, 0.32, 0.12), (x - 0.25 + b * 0.25, y0, z + 0.075), c, rot=(side * tilt, 0, 0))
rk.build(); bins.build()

# ---------------------------------------------------------------- people: simple standing operators in aprons and caps
assembly('AREA.people', 'Operators in blue aprons, caps and gloves (stylised figures).', parent='AREA')
ppl = Part('AREA.people.operators', 'Operators', 'AREA.people', bevel=0)
def person(x, y, face=0.0, reach=0.34):
    """A stylised standing operator facing angle `face` (0 = +Y): rounded head and cap, shirt, apron, gloved hands at work height."""
    R = Matrix.Rotation(face, 4, 'Z')
    P = lambda dx, dy, dz: tuple(Vector((x, y, 0)) + (R @ Vector((dx, dy, dz))))
    shirt = SHIRTS[_who[0] % len(SHIRTS)]; _who[0] += 1          # people wear their own clothes under the apron
    for sx in (-1, 1):
        ppl.cyl(0.065, 0.8, P(sx * 0.09, 0, 0.44), 'trousers', seg=16, r2=0.055)
        ppl.sphere(0.06, P(sx * 0.09, 0.05, 0.04), 'shoe', scale=(0.8, 1.9, 0.6))
    ppl.sphere(0.2, P(0, 0, 0.9), 'trousers', scale=(1.0, 0.65, 0.55))                  # hips
    ppl.sphere(0.21, P(0, 0, 1.18), shirt, scale=(1.0, 0.62, 1.45))                   # torso
    ppl.box((0.34, 0.02, 0.66), P(0, 0.125, 1.02), 'apron', rot=(0, 0, face))
    ppl.sweep([P(-0.16, 0.12, 1.36), P(0, 0.135, 1.42), P(0.16, 0.12, 1.36)], 0.008, 'apron')   # apron strap
    ppl.cyl(0.05, 0.12, P(0, 0, 1.48), 'skin', seg=14)
    ppl.sphere(0.105, P(0, 0.01, 1.63), 'skin', scale=(0.92, 1.0, 1.12))
    ppl.sphere(0.112, P(0, -0.005, 1.69), 'cap', scale=(1.0, 1.05, 0.62))
    for sx in (-1, 1):
        ppl.sweep([P(sx * 0.22, 0, 1.38), P(sx * 0.25, 0.04, 1.16), P(sx * 0.16, reach * 0.7, 1.03), P(sx * 0.1, reach, 1.0)], 0.042, shirt)
        ppl.sphere(0.045, P(sx * 0.1, reach + 0.03, 1.0), 'cap', scale=(0.8, 1.2, 0.6))     # gloved hand
for i, x in enumerate(STATIONS):
    person(x - 0.1, -1.18, face=0.0)
    if i % 2 == 0 and i != 2: person(x + 0.15, 1.18, face=math.pi)

# ---------------------------------------------------------------- U-shaped sub-assembly cells beside the line
assembly('AREA.cells', 'U-shaped sub-assembly cells: operators stand one behind another; kits leave on a roller conveyor to the line.', parent='AREA')
cb = Part('AREA.cells.benches', 'Cell workbenches with ESD tops and overhead frames', 'AREA.cells', bevel=0.003)
ck = Part('AREA.cells.kits', 'Sub-assemblies in progress: board brackets and stand kits', 'AREA.cells', bevel=0.0015)
cv = Part('AREA.cells.feed', 'Roller conveyors from the cells to the line, and the cell flow racks', 'AREA.cells', bevel=0.002)
cbins = Part('AREA.cells.bins', 'Cell part bins, fed from the aisle', 'AREA.cells', bevel=0.004)
for cx in (-4.2, 0.8):
    cy = -4.15
    benches = [((cx - 1.2, cy), (0.7, 2.4), 0.0), ((cx, cy - 1.15), (1.7, 0.7), H), ((cx + 1.2, cy), (0.7, 2.4), math.pi)]
    for (bx, by), (bw, bd), face in benches:
        cb.box((bw, bd, 0.04), (bx, by, 0.86), 'esd_mat'); cb.box((bw + 0.02, bd + 0.02, 0.03), (bx, by, 0.83), 'alu_brushed')
        for sx in (-1, 1):
            for sy in (-1, 1): cb.box((0.04, 0.04, 0.82), (bx + sx * (bw / 2 - 0.04), by + sy * (bd / 2 - 0.04), 0.41), 'alu_brushed')
        # an overhead frame along the bench: two posts at the far edge, a top rail, a light bar and a balancer
        long_x = bw > bd; L_ = max(bw, bd)
        back = (-1 if face == 0.0 else 1) if not long_x else 1     # the side away from the operator
        for e in (-1, 1):
            px_ = bx + (e * (L_ / 2 - 0.04) if long_x else back * (bw / 2 - 0.04))
            py_ = by + (back * (bd / 2 - 0.04) if long_x else e * (L_ / 2 - 0.04))
            cb.box((0.04, 0.04, 1.2), (px_, py_, 1.48), 'alu_brushed')
        rx_ = bx if long_x else bx + back * (bw / 2 - 0.04); ry_ = by + back * (bd / 2 - 0.04) if long_x else by
        cb.box((L_ if long_x else 0.05, 0.05 if long_x else L_, 0.05), (rx_, ry_, 2.08), 'alu_brushed')
        cb.box((L_ * 0.8 if long_x else 0.08, 0.08 if long_x else L_ * 0.8, 0.02), (rx_, ry_, 2.04), 'led_white')
        # kits on the bench: a bracket with a board, a stand kit
        n = 2 if bd > bw else 1
        for k in range(n):
            ky = by - bd / 4 + k * bd / 2 if bd > bw else by; kx = bx if bd > bw else bx - 0.4 + k * 0.8
            ck.box((0.34, 0.24, 0.01), (kx, ky, 0.885), 'chassis'); ck.box((0.24, 0.16, 0.01), (kx, ky, 0.895), 'pcb_green')
            ck.cyl(0.02, 0.15, (kx + 0.2, ky + 0.1, 0.89), 'plastic_black', rot=(0, H, 0), seg=12)    # screwdriver laid down
    # operators stand inside the U, one behind another along each side
    for k in range(2):
        person(cx - 0.62, cy - 0.5 + k * 1.0, face=-H)
        person(cx + 0.62, cy - 0.5 + k * 1.0, face=H)
    person(cx, cy - 0.55, face=math.pi)
    # flow racks on the outside of the U, fed from the aisle by the water spider
    for sx in (-1, 1):
        rx = cx + sx * 1.85
        for z in (0.6, 1.0, 1.4):
            cv.box((0.5, 2.2, 0.02), (rx, cy, z), 'steel_dark', rot=(0, sx * 0.15, 0))
            for b in range(4): cbins.box((0.3, 0.42, 0.14), (rx, cy - 0.8 + b * 0.53, z + 0.09), 'bin_blue', rot=(0, sx * 0.15, 0))
        for sy in (-1, 1): cv.box((0.035, 0.035, 1.6), (rx, cy + sy * 1.05, 0.8), 'alu_brushed')
    # roller conveyor from the open end of the U to the line side
    for k in range(int(2.0 / 0.08)):
        cv.cyl(0.025, 0.5, (cx, cy + 1.25 + k * 0.08, 0.84), 'steel_polished', rot=(0, H, 0), seg=14)
    for sx in (-1, 1): cv.box((0.04, 2.0, 0.08), (cx + sx * 0.27, cy + 2.25, 0.82), 'alu_brushed')
    for k in range(2): ck.box((0.34, 0.24, 0.04), (cx, cy + 1.6 + k * 0.9, 0.89), 'chassis')
cb.build(); ck.build(); cv.build(); cbins.build()

# ---------------------------------------------------------------- the upright test section at the end of the line
assembly('AREA.test', 'Test conveyor: sets stand upright and show test patterns (power, white balance, function).', parent='AREA')
tc = Part('AREA.test.conveyor', 'Upright test conveyor and fixtures', 'AREA.test', bevel=0.003)
ts = Part('AREA.test.sets', 'Sets under test showing patterns', 'AREA.test', bevel=0.002)
tc.box((3.6, 0.5, 0.1), (5.45, 0, 0.62), 'alu_brushed')
for x in (3.8, 5.45, 7.1):
    for sy in (-1, 1): tc.box((0.05, 0.05, 0.6), (x, sy * 0.2, 0.3), 'alu_brushed')
for x, m in zip(TEST_X + [7.2], ['scr_bars', 'scr_white', 'scr_green']):
    if x > 7.0: continue
    tv(ts, x, 0, 0.67, 3, upright=True, screen_mat=m)
tc.build(); ts.build()
person(5.0, -0.9, face=0.0)
ppl.build()

# ---------------------------------------------------------------- a robot that fixes the boards (the LG Gumi line: people place, robots fasten)
assembly('AREA.robot', 'Six-axis robot with a screwdriver tool: operators place the boards, the robot drives the screws.', parent='AREA')
rb = Part('AREA.robot.arm', 'Six-axis robot arm on its pedestal, with screwdriver tool and cable dress', 'AREA.robot', bevel=0.004)
rx, ry = -1.0, 0.95                                         # station 3, far side of the line
rb.box((0.5, 0.5, 0.55), (rx, ry, 0.275), 'steel_dark')                                    # pedestal
rb.cyl(0.2, 0.18, (rx, ry, 0.64), 'robot_white', seg=32)                                    # base
rb.cyl(0.16, 0.22, (rx, ry, 0.84), 'robot_white', seg=32)                                   # turret
rb.cyl(0.13, 0.22, (rx, ry - 0.0, 0.98), 'robot_orange', rot=(0, H, 0), seg=28)              # shoulder joint
sh, el, wr = Vector((rx, ry, 0.98)), Vector((rx + 0.05, ry - 0.25, 1.62)), Vector((rx + 0.08, ry - 0.82, 1.42))
def link(a, b, r, mat):
    d = b - a; m = (a + b) / 2; q = d.to_track_quat('Z', 'Y').to_euler()
    rb.cyl(r, d.length, tuple(m), mat, rot=tuple(q), seg=24)
link(sh, el, 0.085, 'robot_white'); rb.cyl(0.1, 0.2, tuple(el), 'robot_orange', rot=(0, H, 0), seg=24)
link(el, wr, 0.065, 'robot_white'); rb.sphere(0.075, tuple(wr), 'robot_orange')
tool_top = wr + Vector((0, 0, -0.05))
rb.cyl(0.035, 0.26, tuple(tool_top + Vector((0, 0, -0.13))), 'anodised_dark', seg=20)       # screwdriver spindle
rb.cyl(0.006, 0.08, tuple(tool_top + Vector((0, 0, -0.3))), 'steel_polished', seg=10)
rb.sweep([tuple(sh + Vector((0.12, 0.05, 0.05))), tuple(el + Vector((0.08, 0.06, 0.08))), tuple(wr + Vector((0.06, 0.06, 0.1)))], 0.018, 'plastic_black')
rb.build()
# light curtain posts around the robot's reach
lc = Part('AREA.robot.guard', 'Light-curtain posts and a mesh guard behind the robot', 'AREA.robot', bevel=0.002)
for dx in (-0.75, 0.75):
    lc.box((0.05, 0.05, 1.7), (rx + dx, 0.62, 0.85), 'estop_yellow'); lc.box((0.02, 0.03, 1.5), (rx + dx, 0.6, 0.9), 'led_white')
lc.box((1.6, 0.02, 1.4), (rx, 1.55, 0.9), 'steel_dark'); lc.build()

# a screw feeder: sorts screws and rolls them one at a time down a chute (as described at Gumi)
sf = Part('AREA.stations.screwfeeder', 'Screw feeder with chute and pick point', 'AREA.stations', bevel=0.003)
sx_ = -3.0 + 0.55
sf.box((0.22, 0.18, 0.16), (sx_, -0.62, 0.9), 'paint_blue'); sf.cyl(0.07, 0.04, (sx_, -0.62, 1.0), 'steel_polished', seg=24)
sf.box((0.18, 0.02, 0.01), (sx_ + 0.1, -0.58, 0.95), 'steel_polished', rot=(0, -0.3, 0)); sf.build()

# ---------------------------------------------------------------- the QA aging room beside the line: sets left running for hours
assembly('AREA.qa', 'QA aging room behind glass: finished sets stand in rows on the floor, switched on for hours of tests.', parent='AREA')
qw = Part('AREA.qa.walls', 'Glass partition with aluminium frame', 'AREA.qa', bevel=0.002)
qx0, qx1, qy0, qy1 = 8.4, 12.6, -1.6, 5.4
for (ax, ay, bx, by) in ((qx0, qy0, qx0, qy1), (qx0, qy0, qx1, qy0)):
    n = int(max(abs(bx - ax), abs(by - ay)) / 1.2)
    for k in range(n + 1):
        px_, py_ = ax + (bx - ax) * k / n, ay + (by - ay) * k / n
        qw.box((0.05, 0.05, 2.6), (px_, py_, 1.3), 'alu_brushed')
    qw.box((abs(bx - ax) + 0.05, abs(by - ay) + 0.05, 0.06), ((ax + bx) / 2, (ay + by) / 2, 2.6), 'alu_brushed')
    qw.box((max(abs(bx - ax), 0.012), max(abs(by - ay), 0.012), 2.5), ((ax + bx) / 2, (ay + by) / 2, 1.3), 'glass')
qw.build()
qs = Part('AREA.qa.sets', 'Sets on stands under test', 'AREA.qa', bevel=0.002)
pats = ['scr_bars', 'scr_white', 'scr_green', 'scr_white', 'scr_bars']
k = 0
for row in range(4):
    for col in range(4):
        x = qx0 + 0.55 + col * 1.0; y = qy0 + 0.9 + row * 1.6
        qs.box((0.36, 0.22, 0.02), (x, y, 0.01), 'steel_dark'); qs.box((0.06, 0.04, 0.32), (x, y + 0.04, 0.17), 'steel_dark')
        qs.box((0.95, 0.05, 0.56), (x, y + 0.05, 0.62), 'cover_black')
        screen_quad(f'AREA.qa.screen{k}', 'Test pattern', 'AREA.qa', x, y + 0.022, 0.62, 0.93, 0.54, pats[k % len(pats)]); k += 1
qs.build()

# ---------------------------------------------------------------- the building: wall panels, columns, roof steel and high-bay lights
assembly('AREA.building', 'Insulated wall panels with a clerestory band, steel columns, roof beams and LED high-bay lights.', parent='AREA')
bw = Part('AREA.building.walls', 'Wall panels and clerestory', 'AREA.building', bevel=0)
for k in range(int(26 / 1.0)):
    bw.box((0.98, 0.12, 6.4), (-13 + 0.5 + k * 1.0, 6.6, 3.2), 'wall_panel')
bw.box((26, 0.1, 1.1), (0, 6.58, 7.1), 'window_sky'); bw.box((26, 0.14, 1.9), (0, 6.62, 8.65), 'wall_panel')
for k in range(int(16 / 1.0)):
    bw.box((0.12, 0.98, 6.4), (-13.0, -9.5 + 0.5 + k * 1.0, 3.2), 'wall_panel')
bw.box((0.1, 16, 1.1), (-12.98, -1.5, 7.1), 'window_sky'); bw.box((0.14, 16, 1.9), (-13.02, -1.5, 8.65), 'wall_panel')
bw.build()
bs = Part('AREA.building.steel', 'Columns and roof beams', 'AREA.building', bevel=0.004)
for cx in range(-12, 13, 6):
    bs.box((0.3, 0.3, 9.6), (cx, 6.3, 4.8), 'steel_beam'); bs.box((0.6, 0.6, 0.3), (cx, 6.3, 0.15), 'epoxy')
    bs.box((0.25, 16, 0.6), (cx, -1.5, 9.3), 'steel_beam')
for cy in (-6.5, -0.5, 5.5): bs.box((26, 0.18, 0.4), (0, cy, 9.0), 'steel_beam')
bs.build()
bl = Part('AREA.building.lights', 'LED high-bay light fittings', 'AREA.building', bevel=0)
for gx in range(-9, 10, 3):
    for gy in (-6.5, -3.5, -0.5, 2.5):
        bl.box((1.2, 0.6, 0.04), (gx, gy, 6.62), 'ceiling_light'); bl.box((1.25, 0.65, 0.08), (gx, gy, 6.7), 'steel_dark')
        bl.box((0.02, 0.02, 2.2), (gx, gy, 7.8), 'steel_dark')
bl.build()

# ---------------------------------------------------------------- station numbers
def label(body, size, loc):
    cu = bpy.data.curves.new('lbl', 'FONT'); cu.body = body; cu.size = size; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    o = bpy.data.objects.new('AREA.text.' + body, cu); L.COL().objects.link(o); o.location = loc; o.rotation_euler = (H, 0, 0)
    o.data.materials.append(L.MATS['plastic_black']); o.parent = L.ASSEMBLIES['AREA.stations']
for i, x in enumerate(STATIONS):
    p = Part(f'AREA.stations.sign{i + 1}', 'Station sign', 'AREA.stations', bevel=0.001); p.box((0.32, 0.01, 0.16), (x - PITCH / 2 + 0.1, -0.8, 2.0), 'label_white'); p.build()
    label(f'ST {i + 1:02d}', 0.07, (x - PITCH / 2 + 0.1, -0.806, 2.0))

# ---------------------------------------------------------------- studio and outputs
SHOTS = {   # three.js poses (x, y up, z toward the viewer = -Blender Y)
    'hero': ((8.2, 3.9, 9.2), (-0.6, 0.8, 1.4), 36),
    'line': ((-9.5, 2.6, 3.4), (1.0, 1.0, 0.0), 34),
    'cell': ((-1.4, 3.4, 8.2), (-1.8, 0.8, 3.9), 40),
    'test': ((8.2, 1.7, 3.2), (5.4, 1.1, 0.0), 34),
    'top': ((0.01, 22.0, 2.6), (0.0, 0.0, 2.0), 40),
    'qa': ((13.6, 2.6, 5.4), (8.6, 1.0, -1.6), 40),
    'robot': ((1.5, 1.85, 1.55), (-1.0, 1.05, -0.55), 42),
    'wide': ((12.5, 5.0, 10.5), (1.0, 0.8, -0.5), 38),
}
if A.manifest:
    L.manifest(A.manifest, 'AREA', 'Main assembly area, line ML-3, Plant EG-01',
               'Illustrative reconstruction after real TV plants (docs/REFERENCES-TV-PLANT.md); not any real plant.')
if A.glb: L.export_glb(A.glb, 'AREA')
if A.out:
    # a bright factory: a grid of high-bay LED panels over the floor, a soft key for modelling, a pale grey world
    L.world('#C9CED6', 0.65)
    for gx in range(-9, 10, 3):
        for gy in (-6.5, -3.5, -0.5, 2.5):
            L.area(f'light.bay{gx}_{gy}', (gx, gy, 6.5), (gx, gy, 0), 1.2, 260, (1.0, 0.98, 0.95), size_y=0.6)
    L.area('light.key', (-8, -12, 9), (0, -1.5, 0.9), 6.0, 2400, (1.0, 0.97, 0.93))
    pos, look, fov = SHOTS[A.shot]; cam = L.camera(pos, look, fov, fstop=0)
    if A.anchors: L.anchors(A.anchors, cam, A.res)
    L.render(A.out, samples=A.samples, res=A.res, gpu=A.gpu)
