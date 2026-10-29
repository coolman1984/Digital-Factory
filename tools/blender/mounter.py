"""SMD placement machine (Plant EG-01, line SMD-4, "Mounter B") built in Blender from code.

One authored asset, several delivery paths (VISION_3D_AND_MOTION.md): every component is a named object with a stable
part id, a role, an exploded offset and a source note, so the same file drives stills, a film and a browser GLB.
The machine is an illustrative educational reconstruction of a generic gantry pick-and-place machine. It is not a model
of any real vendor's machine and its internals are not approved for maintenance or safety work.

Run (Blender as a Python module, `pip install bpy==5.2.3`, or `blender -b -P mounter.py -- ...`):
    python mounter.py --state assembled|exploded|ghost|cut [--out render.png] [--samples 96] [--res 1600x1000]
                      [--blend out.blend] [--glb out.glb] [--manifest parts.json] [--shot hero|wide|head]
Units: metres, Z up in Blender (the glTF exporter writes Y up). Origin: floor, centre of the machine.
Axes: X is the board's travel along the line, -Y is the operator's front, Z is up.
"""
import sys, math, json, argparse
import bpy, bmesh
from mathutils import Matrix, Vector, Euler

# ---------------------------------------------------------------- arguments
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--state', default='assembled', choices=['assembled', 'exploded', 'ghost', 'cut'])
ap.add_argument('--shot', default='hero', help='a pose from assets/models/machines/mounter/shots.json (hero, front, side, top, head, apart, inside); the studio uses the same poses')
ap.add_argument('--cut-pos', type=float, default=0.45, help='section depth as in the studio slider: 0 front, 1 back')
ap.add_argument('--out', default='')
ap.add_argument('--samples', type=int, default=96)
ap.add_argument('--res', default='1600x1000')
ap.add_argument('--blend', default='')
ap.add_argument('--glb', default='')
ap.add_argument('--manifest', default='')
ap.add_argument('--anchors', default='', help='write each part\'s on-screen anchor (pixels) for 2D labels')
ap.add_argument('--explode', type=float, default=1.0, help='0 = assembled, 1 = fully exploded')
ap.add_argument('--lod', default='full', choices=['full', 'web', 'far', 'plant'], help='full: stills and film; web: the studio model (2-segment bevels); far: a light model (no bevels, coarse cylinders, no board parts); plant: far without the internals, labels, text and signal tower, for 18 copies on the plant floor')
ap.add_argument('--gpu', action='store_true', help='render on the graphics card (OptiX, CUDA, HIP, oneAPI or Metal, whichever works)')
A = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
ROOT_COL = scene.collection

# ---------------------------------------------------------------- deterministic randomness (same build, same scene)
_seed = [0x9E3779B9]
def rnd():
    _seed[0] = (_seed[0] * 1103515245 + 12345) & 0x7FFFFFFF
    return _seed[0] / 0x7FFFFFFF

# ---------------------------------------------------------------- materials
def srgb(h):
    """Hex to linear RGB: material colours are written as the brand's sRGB hex and converted once."""
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (1.0,)

MATS = {}
def principled(name, color, metal=0.0, rough=0.5, coat=0.0, coat_rough=0.1, aniso=0.0, transmission=0.0, ior=1.5,
               emission=None, strength=0.0, alpha=1.0, noise_bump=0.0, spec=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree; p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = srgb(color) if isinstance(color, str) else color
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    p.inputs['Coat Weight'].default_value = coat
    p.inputs['Coat Roughness'].default_value = coat_rough
    p.inputs['Anisotropic'].default_value = aniso
    p.inputs['Transmission Weight'].default_value = transmission
    p.inputs['IOR'].default_value = ior
    p.inputs['Specular IOR Level'].default_value = spec
    p.inputs['Alpha'].default_value = alpha
    if emission:
        p.inputs['Emission Color'].default_value = srgb(emission)
        p.inputs['Emission Strength'].default_value = strength
    if noise_bump:
        # micro surface: powder coat orange peel / cast texture, so large panels do not read as CG plastic
        tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise'); bump = nt.nodes.new('ShaderNodeBump')
        nz.inputs['Scale'].default_value = 900.0; nz.inputs['Detail'].default_value = 4.0
        bump.inputs['Strength'].default_value = noise_bump; bump.inputs['Distance'].default_value = 0.0004
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector']); nt.links.new(nz.outputs['Fac'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], p.inputs['Normal'])
        # a faint roughness variation reads as handled, real metal
        rmap = nt.nodes.new('ShaderNodeMapRange')
        rmap.inputs['To Min'].default_value = rough * 0.85; rmap.inputs['To Max'].default_value = min(1.0, rough * 1.15)
        nz2 = nt.nodes.new('ShaderNodeTexNoise'); nz2.inputs['Scale'].default_value = 6.0
        nt.links.new(tc.outputs['Object'], nz2.inputs['Vector']); nt.links.new(nz2.outputs['Fac'], rmap.inputs['Value'])
        nt.links.new(rmap.outputs['Result'], p.inputs['Roughness'])
    MATS[name] = m
    return m

def ghost_material():
    """X-ray shell: transparent body with a fresnel edge glow, so internals stay readable (no refraction, no sorting)."""
    m = bpy.data.materials.new('ghost'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); mix = nt.nodes.new('ShaderNodeMixShader')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); em = nt.nodes.new('ShaderNodeEmission')
    lw = nt.nodes.new('ShaderNodeLayerWeight'); ramp = nt.nodes.new('ShaderNodeValToRGB')
    lw.inputs['Blend'].default_value = 0.35
    ramp.color_ramp.elements[0].position = 0.05; ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = 0.9; ramp.color_ramp.elements[1].color = (0.55, 0.55, 0.55, 1)
    em.inputs['Color'].default_value = srgb('#2189FF'); em.inputs['Strength'].default_value = 2.2
    nt.links.new(lw.outputs['Facing'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], mix.inputs['Fac'])
    nt.links.new(tr.outputs['BSDF'], mix.inputs[1]); nt.links.new(em.outputs['Emission'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    MATS['ghost'] = m
    return m

principled('paint_white', '#E1E4E8', rough=0.42, coat=0.25, coat_rough=0.25, noise_bump=0.25)   # powder-coated sheet steel
principled('paint_grey', '#5B6370', rough=0.5, coat=0.15, noise_bump=0.25)                      # lower cabinet band
principled('paint_blue', '#1428A0', rough=0.4, coat=0.35, coat_rough=0.2, noise_bump=0.2)        # brand blue trim
principled('anodised_dark', '#26292E', metal=1.0, rough=0.38, aniso=0.3)                         # black anodised aluminium
principled('alu_brushed', '#C9CDD2', metal=1.0, rough=0.24, aniso=0.6)                           # extrusions, rails
principled('steel_polished', '#D8DADC', metal=1.0, rough=0.12)                                   # guide rails, shafts
principled('steel_dark', '#6F737A', metal=1.0, rough=0.35)                                       # bolts, castings
principled('carbon', '#141518', rough=0.32, coat=0.8, coat_rough=0.05)                           # gantry beam
principled('cast_bed', '#3A3F46', rough=0.7, noise_bump=0.6)                                     # mineral-cast machine bed
principled('rubber', '#121314', rough=0.85)
principled('plastic_black', '#18191B', rough=0.45)
principled('plastic_grey', '#8D939B', rough=0.5)
principled('cable_orange', '#E36B1D', rough=0.55)
principled('glass', '#F2F6F8', rough=0.02, transmission=1.0, ior=1.49)                           # polycarbonate hood panes
principled('pcb_green', '#1E5B3A', rough=0.28, coat=0.6, coat_rough=0.12)
principled('pad_gold', '#D9A74A', metal=1.0, rough=0.22)
principled('comp_black', '#1A1A1A', rough=0.55)
principled('comp_beige', '#C9B48A', rough=0.5)
principled('tape_brown', '#4A3424', rough=0.4)
principled('reel_blue', srgb('#2E6FD8')[:3] + (1,), rough=0.2, transmission=0.6, ior=1.45)
principled('reel_white', '#E8E8E4', rough=0.35)
principled('reel_black', '#1B1C1F', rough=0.3)
principled('label_white', '#F4F4F0', rough=0.6)
principled('led_green', '#22C55E', rough=0.3, emission='#22C55E', strength=8.0)
principled('lens_amber', '#F59E0B', rough=0.15, transmission=0.5)
principled('lens_red', '#DC2626', rough=0.15, transmission=0.5)
principled('led_white', '#FFFFFF', emission='#F3F7FF', strength=12.0)
principled('led_ring', '#FFFFFF', emission='#CFE3FF', strength=6.0)
principled('estop_red', '#C81E1E', rough=0.3, coat=0.5)
principled('estop_yellow', '#F2C500', rough=0.4)
principled('section', '#E0512B', rough=0.55)          # section caps of the cutaway (classic red-orange hatch colour)
principled('studio_floor', '#9DA3AB', rough=0.55)
ghost_material()

def screen_material():
    """HMI screen: a small dashboard drawn into an image, so the screen carries believable UI, not a flat glow."""
    W, H = 480, 300
    img = bpy.data.images.new('hmi_ui', W, H)
    px = [0.0] * (W * H * 4)
    def rect(x0, y0, x1, y1, c):
        for y in range(max(0, y0), min(H, y1)):
            for x in range(max(0, x0), min(W, x1)):
                i = (y * W + x) * 4; px[i:i + 4] = c
    bg, panel = (0.012, 0.016, 0.028, 1), (0.03, 0.04, 0.07, 1)
    blue, green, amber, white = (0.02, 0.25, 1.0, 1), (0.05, 0.75, 0.2, 1), (1.0, 0.45, 0.02, 1), (0.8, 0.82, 0.85, 1)
    rect(0, 0, W, H, bg); rect(0, H - 34, W, H, (0.008, 0.022, 0.12, 1))
    rect(14, H - 24, 140, H - 12, white)
    for k, (x0, c, val) in enumerate([(14, green, 0.86), (170, blue, 0.72), (326, amber, 0.41)]):
        rect(x0, 150, x0 + 140, 250, panel); rect(x0 + 10, 160, x0 + 10 + int(120 * val), 172, c); rect(x0 + 10, 200, x0 + 90, 230, white)
    rect(14, 14, W - 14, 136, panel)
    for i in range(46):
        h = int(20 + 80 * (0.5 + 0.5 * math.sin(i * 0.45) * math.cos(i * 0.13)))
        rect(24 + i * 9, 24, 30 + i * 9, 24 + h, blue if i < 40 else amber)
    img.pixels = px
    m = bpy.data.materials.new('hmi_screen'); m.use_nodes = True
    nt = m.node_tree; p = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
    p.inputs['Base Color'].default_value = (0.0, 0.0, 0.0, 1); p.inputs['Roughness'].default_value = 0.08
    nt.links.new(tex.outputs['Color'], p.inputs['Emission Color']); p.inputs['Emission Strength'].default_value = 3.0
    MATS['hmi_screen'] = m
screen_material()

# ---------------------------------------------------------------- parts: one object per named component
PARTS = []          # manifest records, in build order (deterministic)
ASSEMBLIES = {}     # assembly id -> empty

def assembly(aid, role, explode=(0, 0, 0), parent=None):
    """An assembly is an empty; exploding moves the empty, so children keep their authored assembled transforms."""
    e = bpy.data.objects.new(aid, None)
    e.empty_display_size = 0.1
    ROOT_COL.objects.link(e)
    if parent: e.parent = ASSEMBLIES[parent]
    e['part_id'] = aid; e['role'] = role; e['explode'] = list(explode)
    ASSEMBLIES[aid] = e
    PARTS.append({'id': aid, 'kind': 'assembly', 'role': role, 'parent': parent, 'explode': list(explode)})
    return e

class Part:
    """Accumulates boxes and cylinders (with a material per face) into one mesh object."""
    def __init__(self, pid, role, asm, bevel=0.003, segments=3, shell=False, explode=(0, 0, 0), source='illustrative'):
        self.pid, self.role, self.asm, self.bevel, self.segments, self.shell = pid, role, asm, bevel, segments, shell
        self.explode, self.source = explode, source
        self.bm = bmesh.new(); self.mats = []
        self.anchor = None   # where a label points: the centre of the first primitive (the part's main body)

    def _mi(self, mat):
        if mat not in self.mats: self.mats.append(mat)
        return self.mats.index(mat)

    def _tag(self, verts, mat):
        mi = self._mi(mat)
        for f in {f for v in verts for f in v.link_faces}: f.material_index = mi

    def box(self, size, loc, mat, rot=(0, 0, 0)):
        M = Matrix.LocRotScale(Vector(loc), Euler(rot), Vector(size))
        if self.anchor is None: self.anchor = tuple(loc)
        r = bmesh.ops.create_cube(self.bm, size=1.0, matrix=M); self._tag(r['verts'], mat); return self

    def cyl(self, r, depth, loc, mat, rot=(0, 0, 0), seg=32, r2=None):
        if A.lod in ('far', 'plant'): seg = max(8, seg // 3)
        elif A.lod == 'web' and seg > 32: seg = 32
        M = Matrix.LocRotScale(Vector(loc), Euler(rot), Vector((1, 1, 1)))
        if self.anchor is None: self.anchor = tuple(loc)
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r,
                                    radius2=r if r2 is None else r2, depth=depth, matrix=M)
        self._tag(res['verts'], mat); return self

    def tube(self, r_out, r_in, depth, loc, mat, rot=(0, 0, 0), seg=40):
        """A ring (reel hub, bearing): outer and inner wall joined by flat annular caps."""
        M = Matrix.LocRotScale(Vector(loc), Euler(rot), Vector((1, 1, 1)))
        bm = self.bm; vs = []
        rings = []
        for z in (-depth / 2, depth / 2):
            for rr in (r_out, r_in):
                rings.append([bm.verts.new(M @ Vector((rr * math.cos(2 * math.pi * i / seg), rr * math.sin(2 * math.pi * i / seg), z))) for i in range(seg)])
        bo, bi, to, ti = rings
        def quad(a, b, flip=False):
            for i in range(seg):
                j = (i + 1) % seg
                q = [a[i], a[j], b[j], b[i]]
                vs.append(bm.faces.new(q[::-1] if flip else q))
        quad(bo, to); quad(bi, ti, True); quad(to, ti); quad(bo, bi, True)
        mi = self._mi(mat)
        for f in vs: f.material_index = mi
        return self

    def sweep(self, pts, r, mat, seg=10, steps=8):
        """A cable: a round tube swept along a Catmull-Rom curve through pts, with capped ends."""
        if A.lod in ('far', 'plant'): seg, steps = 6, 3
        P = [Vector(p) for p in pts]; P = [P[0]] + P + [P[-1]]
        path = []
        for i in range(1, len(P) - 2):
            p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
            for k in range(steps):
                t = k / steps
                path.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
        path.append(P[-2])
        if self.anchor is None: self.anchor = tuple(path[len(path) // 2])
        bm = self.bm; rings = []; ref = Vector((1, 0, 0))
        for i, c in enumerate(path):
            t = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
            u = (ref - t * ref.dot(t)); u = u.normalized() if u.length > 1e-6 else Vector((0, 1, 0)); v = t.cross(u)
            rings.append([bm.verts.new(c + (u * math.cos(2 * math.pi * j / seg) + v * math.sin(2 * math.pi * j / seg)) * r) for j in range(seg)])
        faces = []
        for a, b in zip(rings, rings[1:]):
            for j in range(seg):
                faces.append(bm.faces.new((a[j], a[(j + 1) % seg], b[(j + 1) % seg], b[j])))
        faces.append(bm.faces.new(rings[0][::-1])); faces.append(bm.faces.new(rings[-1]))
        mi = self._mi(mat)
        for f in faces: f.material_index = mi
        return self

    def build(self):
        bm = self.bm
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        for f in bm.faces: f.smooth = True
        for e in bm.edges:   # sharp by angle: flat panels stay crisp, cylinders shade round
            e.smooth = not (len(e.link_faces) != 2 or e.calc_face_angle(0) > math.radians(32))
        me = bpy.data.meshes.new(self.pid); bm.to_mesh(me); bm.free()
        for m in self.mats: me.materials.append(MATS[m])
        ob = bpy.data.objects.new(self.pid, me); ROOT_COL.objects.link(ob)
        ob.parent = ASSEMBLIES[self.asm]
        # the browser model drops bevels where they cannot be seen at studio distance: reel flanges and board chips
        web_flat = A.lod == 'web' and self.pid.endswith(('.reels', '.pcb', '.labels'))
        if self.bevel > 0 and A.lod not in ('far', 'plant') and not web_flat:
            bv = ob.modifiers.new('bevel', 'BEVEL')
            bv.width = self.bevel; bv.segments = min(self.segments, 2) if A.lod == 'web' else self.segments; bv.limit_method = 'ANGLE'
            bv.angle_limit = math.radians(32); bv.harden_normals = True; bv.miter_outer = 'MITER_ARC'
            wn = ob.modifiers.new('weighted_normal', 'WEIGHTED_NORMAL'); wn.keep_sharp = True
        ob['part_id'] = self.pid; ob['role'] = self.role; ob['explode'] = list(self.explode); ob['source'] = self.source
        ob['shell'] = self.shell
        ob['anchor'] = list(self.anchor or (0, 0, 0))
        PARTS.append({'id': self.pid, 'kind': 'part', 'role': self.role, 'parent': self.asm, 'explode': list(self.explode),
                      'shell': self.shell, 'source': self.source, 'materials': list(self.mats)})
        return ob

# ---------------------------------------------------------------- dimensions (metres)
L, D = 1.50, 1.70          # body length along the line (X) and depth (Y), without feeder trolleys
Z_CAB = 0.86               # top of the lower cabinet
Z_BED = 0.90               # top of the machine bed (the precision surface)
Z_PCB = 0.95               # board transport height (the SMEMA standard band is about 0.9-0.95 m)
Z_HOOD = 1.62              # top of the hood
Y_FEED = D / 2             # feeder banks dock on the front and rear edges of the bed
GANTRY_Y = 0.12            # gantry over the board: the nozzles sit just in front of the beam
HEAD_X = -0.12             # head over the board

# ---------------------------------------------------------------- base and cabinet
assembly('MNT', 'SMD placement machine (Mounter B, line SMD-4, Plant EG-01). Illustrative reconstruction.')
assembly('MNT.base', 'Welded steel base frame on levelling feet: carries the bed and isolates the floor.', parent='MNT')
p = Part('MNT.base.frame', 'Welded box-section base frame', 'MNT.base', bevel=0.004)
for sx in (-1, 1):
    p.box((0.08, D - 0.06, 0.08), (sx * (L / 2 - 0.07), 0, 0.14), 'paint_grey')
for sy in (-1, 1):
    p.box((L - 0.06, 0.08, 0.08), (0, sy * (D / 2 - 0.07), 0.14), 'paint_grey')
p.box((L - 0.2, 0.08, 0.08), (0, 0, 0.14), 'paint_grey')
p.build()
p = Part('MNT.base.feet', 'Levelling feet with anti-vibration pads', 'MNT.base', bevel=0.002)
for sx in (-1, 1):
    for sy in (-1, 0, 1):
        x, y = sx * (L / 2 - 0.07), sy * (D / 2 - 0.07)
        p.cyl(0.045, 0.025, (x, y, 0.0125), 'rubber', seg=28)
        p.cyl(0.035, 0.02, (x, y, 0.035), 'steel_dark', seg=6)       # hex nut
        p.cyl(0.012, 0.07, (x, y, 0.075), 'steel_polished', seg=20)  # threaded stud
p.build()

assembly('MNT.cabinet', 'Lower cabinet: sheet-steel doors and panels around the drives, controls and vacuum system.',
         parent='MNT', explode=(0, 0, 0))
GAP = 0.004
pf = Part('MNT.cabinet.front', 'Front service doors (hinged, keyed)', 'MNT.cabinet', bevel=0.006, shell=True, explode=(0, -0.42, 0))
pb = Part('MNT.cabinet.rear', 'Rear service doors', 'MNT.cabinet', bevel=0.006, shell=True, explode=(0, 0.42, 0))
for part, sy in ((pf, -1), (pb, 1)):
    y = sy * (D / 2 - 0.012)
    w = (L - 0.04) / 2 - GAP
    for dx in (-1, 1):
        cx = dx * (w / 2 + GAP / 2)
        part.box((w, 0.02, 0.56), (cx, y, 0.18 + 0.28 + 0.04), 'paint_white')                      # door leaf
        part.box((w, 0.022, 0.1), (cx, y, 0.13), 'paint_grey')                                    # kick band
        for k in range(9):   # louvre vents, pressed into the door
            part.box((w * 0.5, 0.006, 0.008), (cx, y + sy * 0.011, 0.31 + k * 0.022), 'plastic_black')
        part.box((0.016, 0.03, 0.12), (cx - dx * (w / 2 - 0.05), y + sy * 0.018, 0.56), 'anodised_dark')   # handle
        part.cyl(0.011, 0.012, (cx - dx * (w / 2 - 0.05), y + sy * 0.016, 0.66), 'steel_polished', rot=(math.pi / 2, 0, 0), seg=20)  # lock
    part.box((L - 0.02, 0.022, 0.03), (0, y, Z_CAB - 0.03), 'paint_blue')                       # brand trim under the bed
pf.build(); pb.build()
for sx in (-1, 1):
    p = Part(f'MNT.cabinet.side_{"left" if sx < 0 else "right"}', 'Side panel with the SMEMA board pass-through',
             'MNT.cabinet', bevel=0.006, shell=True, explode=(sx * 0.6, 0, 0))
    x = sx * (L / 2 - 0.012)
    p.box((0.02, D - 0.04, 0.62), (x, 0, 0.18 + 0.31), 'paint_white')
    p.box((0.022, D - 0.04, 0.1), (x, 0, 0.13), 'paint_grey')
    p.box((0.022, D - 0.02, 0.03), (x, 0, Z_CAB - 0.03), 'paint_blue')
    for k in range(6):
        p.box((0.006, 0.42, 0.008), (x + sx * 0.011, -0.45, 0.36 + k * 0.024), 'plastic_black')
    p.build()

# cabinet internals: what a cutaway or the ghost view should reveal (illustrative layout)
assembly('MNT.controls', 'Control and drive bay inside the cabinet (illustrative layout).', parent='MNT', explode=(0, 0, 0))
p = Part('MNT.controls.servo_rack', 'Servo amplifiers for the X, Y, Z and theta axes', 'MNT.controls', bevel=0.002, explode=(0, -0.2, 0))
for i in range(6):
    x = -0.55 + i * 0.075
    p.box((0.065, 0.2, 0.26), (x, -0.45, 0.42), 'anodised_dark')
    p.box((0.05, 0.004, 0.06), (x, -0.552, 0.48), 'plastic_grey')
    p.box((0.008, 0.004, 0.008), (x - 0.015, -0.553, 0.53), 'led_green')
    for k in range(7):  # heat-sink fins
        p.box((0.06, 0.002, 0.03), (x, -0.35 + k * 0.0, 0.3 + k * 0.03), 'alu_brushed')
p.box((0.5, 0.25, 0.02), (-0.36, -0.45, 0.28), 'steel_dark')
p.build()
p = Part('MNT.controls.pc', 'Machine controller and vision computer', 'MNT.controls', bevel=0.003, explode=(0, -0.2, 0))
p.box((0.36, 0.3, 0.16), (0.32, -0.42, 0.37), 'plastic_black')
p.box((0.3, 0.004, 0.1), (0.32, -0.572, 0.38), 'anodised_dark')
for k in range(5):
    p.box((0.008, 0.004, 0.004), (0.2 + k * 0.02, -0.574, 0.43), 'led_white' if k == 0 else 'led_green')
p.build()
p = Part('MNT.controls.vacuum', 'Vacuum pump and manifold for the pick-up nozzles', 'MNT.controls', bevel=0.003, explode=(0, 0.2, 0))
p.cyl(0.09, 0.26, (0.25, 0.35, 0.38), 'paint_blue', rot=(0, math.pi / 2, 0), seg=40)
for k in range(10):
    p.cyl(0.095, 0.006, (0.15 + k * 0.022, 0.35, 0.38), 'steel_dark', rot=(0, math.pi / 2, 0), seg=40)   # cooling ribs
p.box((0.2, 0.16, 0.06), (0.25, 0.35, 0.25), 'steel_dark')
p.box((0.24, 0.06, 0.05), (-0.1, 0.35, 0.5), 'alu_brushed')
for k in range(6):
    p.cyl(0.008, 0.3, (-0.2 + k * 0.04, 0.35, 0.65), 'cable_orange', seg=12)
p.build()
p = Part('MNT.controls.cable_tray', 'Cable trays and wiring looms', 'MNT.controls', bevel=0.001)
p.box((L - 0.2, 0.08, 0.04), (0, 0.0, 0.76), 'steel_dark')
for k in range(5):
    p.cyl(0.007 + 0.002 * (k % 2), L - 0.24, (0, -0.025 + k * 0.012, 0.79), ['cable_orange', 'plastic_black', 'plastic_grey'][k % 3],
          rot=(0, math.pi / 2, 0), seg=12)
p.build()

# ---------------------------------------------------------------- the machine bed
assembly('MNT.bed', 'Mineral-cast machine bed: the stiff, vibration-damped reference surface for every axis.', parent='MNT',
         explode=(0, 0, 0))
p = Part('MNT.bed.casting', 'Machine bed casting', 'MNT.bed', bevel=0.008, shell=True)
p.box((L - 0.02, D - 0.02, Z_BED - Z_CAB), (0, 0, (Z_BED + Z_CAB) / 2), 'cast_bed')
p.build()

# ---------------------------------------------------------------- Y axis: two side beams with linear guides
assembly('MNT.yaxis', 'Y axis: two side beams with linear guides and linear motors that carry the gantry beam.', parent='MNT',
         explode=(0, 0, 0.45))
for sx in (-1, 1):
    x = sx * (L / 2 - 0.08)
    p = Part(f'MNT.yaxis.beam_{"left" if sx < 0 else "right"}', 'Y side beam with precision guide rail and magnet track',
             'MNT.yaxis', bevel=0.004)
    p.box((0.12, D - 0.12, 0.16), (x, 0, Z_BED + 0.08), 'alu_brushed')
    p.box((0.13, D - 0.1, 0.012), (x, 0, Z_BED + 0.006), 'anodised_dark')
    p.box((0.024, D - 0.16, 0.02), (x, 0, Z_BED + 0.17), 'steel_polished')                   # guide rail
    for k in range(int((D - 0.2) / 0.035)):                                                  # magnet track
        p.box((0.05, 0.026, 0.008), (x - sx * 0.04, -D / 2 + 0.12 + k * 0.035, Z_BED + 0.164), 'anodised_dark')
    for k in range(int((D - 0.2) / 0.06)):                                                   # rail bolts
        p.cyl(0.004, 0.003, (x, -D / 2 + 0.12 + k * 0.06, Z_BED + 0.181), 'steel_dark', seg=10)
    for sy in (-1, 1):                                                                       # end stops
        p.box((0.1, 0.03, 0.05), (x, sy * (D / 2 - 0.085), Z_BED + 0.185), 'rubber')
    p.build()

# energy chain feeding the gantry: a rolling loop of links from the side beam to the beam carriage
p = Part('MNT.yaxis.cable_chain', 'Energy chain carrying power, encoder and vacuum lines to the gantry', 'MNT.yaxis', bevel=0.001)
xc, r_loop, link = L / 2 - 0.2, 0.05, 0.028
y_fix, y_bend, z0 = 0.0, 0.45, Z_BED + 0.2    # fixed end mid-travel; the loop rolls as the gantry moves
pts = []
y = y_fix
while y < y_bend:                                 # lower run, lying in the tray
    pts.append((y, z0, 0.0)); y += link
for k in range(1, 8):                             # the 180 degree bend
    a = math.pi * k / 8
    pts.append((y_bend + r_loop * math.sin(a), z0 + r_loop - r_loop * math.cos(a), a))
y = y_bend
while y > GANTRY_Y:                               # upper run back to the moving end on the gantry carriage
    pts.append((y, z0 + 2 * r_loop, math.pi)); y -= link
for (yy, zz, a) in pts:
    p.box((0.06, link * 0.9, 0.022), (xc, yy, zz), 'plastic_black', rot=(-a, 0, 0))
p.box((0.07, y_bend - y_fix + 0.1, 0.004), (xc, (y_fix + y_bend) / 2, z0 - 0.014), 'steel_dark')   # chain tray
p.build()

# ---------------------------------------------------------------- the gantry (X beam) and the placement head
assembly('MNT.gantry', 'X gantry beam: a stiff carbon beam that travels in Y and carries the head in X.', parent='MNT',
         explode=(0, 0, 0.9))
ASSEMBLIES['MNT.gantry'].location = (0, GANTRY_Y, 0)    # the gantry's working position is its transform, so motion can animate it
p = Part('MNT.gantry.beam', 'Carbon-fibre gantry beam with X guide rail and magnet track', 'MNT.gantry', bevel=0.005)
zb = Z_BED + 0.26
p.box((L - 0.1, 0.12, 0.13), (0, 0, zb), 'carbon')
p.box((L - 0.16, 0.022, 0.018), (0, -0.065, zb + 0.03), 'steel_polished')      # upper X rail on the front face
p.box((L - 0.16, 0.022, 0.018), (0, -0.065, zb - 0.035), 'steel_polished')     # lower X rail
for k in range(int((L - 0.3) / 0.03)):
    p.box((0.022, 0.006, 0.04), (-L / 2 + 0.17 + k * 0.03, -0.062, zb), 'anodised_dark')   # magnet track
for sx in (-1, 1):
    p.box((0.16, 0.2, 0.08), (sx * (L / 2 - 0.08), 0, Z_BED + 0.215), 'alu_brushed')   # Y carriages
    p.box((0.1, 0.14, 0.04), (sx * (L / 2 - 0.08), 0, Z_BED + 0.18), 'anodised_dark')   # linear motor coil
p.box((0.3, 0.004, 0.05), (0.35, -0.0605, zb + 0.072), 'label_white')                   # beam nameplate
p.build()

assembly('MNT.head', 'Placement head: eight vacuum spindles, each with its own Z and theta drive, plus the board camera.',
         parent='MNT.gantry', explode=(0, -0.32, 0.22))
ASSEMBLIES['MNT.head'].location = (HEAD_X, 0, 0)
p = Part('MNT.head.carriage', 'Head carriage riding the X rails', 'MNT.head', bevel=0.004)
yh = -0.13
p.box((0.3, 0.06, 0.2), (0, yh + 0.02, zb - 0.01), 'anodised_dark')
p.box((0.32, 0.012, 0.22), (0, yh - 0.016, zb - 0.01), 'paint_white')                     # front cover
p.box((0.3, 0.004, 0.026), (0, yh - 0.0225, zb + 0.07), 'paint_blue')                     # cover trim
p.build()
p = Part('MNT.head.spindles', 'Eight spindles: Z motors on top, ball-spline shafts, theta motors, nozzle holders',
         'MNT.head', bevel=0.0015)
for i in range(8):
    x = -0.13 + i * (0.26 / 7)
    p.box((0.026, 0.04, 0.05), (x, yh - 0.05, zb + 0.06), 'anodised_dark')                # Z voice-coil motor
    p.cyl(0.011, 0.05, (x, yh - 0.05, zb + 0.005), 'plastic_black', seg=20)                # theta motor
    p.cyl(0.0045, 0.17, (x, yh - 0.05, zb - 0.09), 'steel_polished', seg=16)                # spline shaft
    p.cyl(0.008, 0.016, (x, yh - 0.05, zb - 0.18), 'steel_dark', seg=16)                    # nozzle holder
p.build()
p = Part('MNT.head.nozzles', 'Vacuum pick-up nozzles (sized per component)', 'MNT.head', bevel=0.0008)
for i in range(8):
    x = -0.13 + i * (0.26 / 7)
    p.cyl(0.0045, 0.018, (x, yh - 0.05, zb - 0.197), 'reel_white' if i % 3 else 'reel_black', seg=16, r2=0.0016)
p.build()
p = Part('MNT.head.camera', 'Downward board camera with ring light: finds the fiducial marks', 'MNT.head', bevel=0.002)
p.box((0.05, 0.05, 0.09), (0.18, yh - 0.03, zb - 0.07), 'anodised_dark')
p.cyl(0.018, 0.012, (0.18, yh - 0.03, zb - 0.121), 'led_ring', seg=28)
p.cyl(0.01, 0.014, (0.18, yh - 0.03, zb - 0.125), 'plastic_black', seg=24)
p.build()
p = Part('MNT.head.cables', 'Head cable loom: power, encoder and vacuum lines into the beam', 'MNT.head', bevel=0.0)
for k in range(4):   # a short service loop from the back of the carriage top into the beam's cable duct
    x = -0.05 + k * 0.011
    p.sweep([(x, yh + 0.035, zb + 0.09), (x, yh + 0.045, zb + 0.13), (x, yh + 0.09, zb + 0.15), (x, -0.025, zb + 0.105),
             (x, -0.01, zb + 0.066)], 0.0042, ['cable_orange', 'plastic_black'][k % 2])
p.box((0.06, 0.03, 0.012), (-0.034, -0.012, zb + 0.07), 'anodised_dark')   # cable clamp on the beam
p.build()

# ---------------------------------------------------------------- board conveyor and the board being built
assembly('MNT.conveyor', 'Dual-rail board conveyor: brings the board in, clamps it for placement, passes it on.', parent='MNT',
         explode=(0, 0, 0.2))
p = Part('MNT.conveyor.rails', 'Conveyor rails with flat belts, board clamps and stopper', 'MNT.conveyor', bevel=0.002)
W_PCB = 0.25
for sy in (-1, 1):
    y = sy * (W_PCB / 2 + 0.012)
    p.box((L + 0.16, 0.02, 0.07), (0, y, Z_PCB - 0.03), 'alu_brushed')
    p.box((L + 0.12, 0.012, 0.006), (0, y - sy * 0.012, Z_PCB - 0.004), 'rubber')          # belt
    for sx in (-1, 1):
        p.cyl(0.016, 0.014, (sx * (L / 2 + 0.06), y - sy * 0.012, Z_PCB - 0.02), 'steel_dark', rot=(math.pi / 2, 0, 0), seg=24)  # pulleys
    p.box((0.4, 0.008, 0.012), (HEAD_X, y - sy * 0.005, Z_PCB + 0.008), 'steel_dark')       # edge clamp
for sx in (-1, 1):
    p.box((0.05, W_PCB + 0.08, 0.03), (sx * (L / 2 + 0.06), 0, Z_PCB - 0.08), 'anodised_dark')   # rail ties
p.box((0.03, 0.03, 0.03), (HEAD_X + 0.2, 0, Z_PCB - 0.02), 'paint_blue')                      # board stopper
p.build()

assembly('MNT.board', 'The board being populated (illustrative layout).', parent='MNT.conveyor', explode=(0, 0, 0.12))
p = Part('MNT.board.pcb', 'Main board under placement: solder paste printed, parts being placed', 'MNT.board', bevel=0.0006, segments=2)
bx, by = 0.33, W_PCB
p.box((bx, by, 0.0016), (HEAD_X, 0, Z_PCB + 0.0008), 'pcb_green')
zt = Z_PCB + 0.0016
for i in range(3):                                   # fiducial marks
    p.cyl(0.0025, 0.0004, (HEAD_X - bx / 2 + 0.012 + i * (bx - 0.024) / 2 * (1 if i < 2 else 0), -by / 2 + 0.012 + (by - 0.024) * (i == 2), zt), 'pad_gold', seg=16)
for k in range(2):                                   # two large ICs with leads
    cx = HEAD_X - 0.06 + k * 0.11
    p.box((0.028, 0.028, 0.003), (cx, 0.03, zt + 0.0015), 'comp_black')
    for side in range(4):
        for j in range(10):
            o = -0.0126 + j * 0.0028
            dx, dy = [(o, 0.0155), (o, -0.0155), (0.0155, o), (-0.0155, o)][side]
            p.box((0.0012 if side < 2 else 0.003, 0.003 if side < 2 else 0.0012, 0.0008), (cx + dx, 0.03 + dy, zt + 0.0004), 'steel_polished')
placed = 0
for gy in range(0 if A.lod in ("far", "plant") else 9):                                # chip resistors and capacitors; the right side is still bare pads
    for gx in range(22):
        x = HEAD_X - bx / 2 + 0.016 + gx * 0.0137
        y = -by / 2 + 0.03 + gy * 0.011
        if 0.0 < y < 0.06 and abs(x - HEAD_X) < 0.09: continue
        if rnd() < 0.18: continue
        done = x < HEAD_X + 0.06
        if done:
            p.box((0.0032, 0.0016, 0.0008), (x, y, zt + 0.0004), 'comp_black' if rnd() < 0.55 else 'comp_beige')
            for s in (-1, 1): p.box((0.0006, 0.0016, 0.0009), (x + s * 0.0016, y, zt + 0.00045), 'steel_polished')
            placed += 1
        else:
            for s in (-1, 1): p.box((0.0012, 0.0016, 0.0002), (x + s * 0.0013, y, zt + 0.0001), 'steel_dark')   # paste on pads
for k in range(4):                                   # electrolytic capacitors
    p.cyl(0.004, 0.007, (HEAD_X - 0.13 + k * 0.012, -0.09, zt + 0.0035), 'steel_polished', seg=20)
p.build()

# ---------------------------------------------------------------- fixed tooling on the bed
assembly('MNT.tooling', 'Fixed tooling on the bed: the upward component camera and the nozzle changer.', parent='MNT',
         explode=(0, 0, 0.25))
p = Part('MNT.tooling.up_camera', 'Upward component camera: checks each part on the nozzle in flight', 'MNT.tooling', bevel=0.002)
p.box((0.09, 0.09, 0.05), (0.32, -0.5, Z_BED + 0.025), 'anodised_dark')
p.cyl(0.032, 0.008, (0.32, -0.5, Z_BED + 0.054), 'led_ring', seg=32)
p.cyl(0.02, 0.01, (0.32, -0.5, Z_BED + 0.056), 'glass', seg=32)
p.build()
p = Part('MNT.tooling.nozzle_changer', 'Nozzle changer: spare nozzles the head swaps automatically', 'MNT.tooling', bevel=0.002)
p.box((0.26, 0.08, 0.03), (-0.42, -0.5, Z_BED + 0.015), 'alu_brushed')
for i in range(12):
    x = -0.53 + (i % 6) * 0.042; y = -0.52 + (i // 6) * 0.04
    p.cyl(0.006, 0.02, (x, y, Z_BED + 0.04), 'reel_white' if i % 4 else 'reel_black', seg=16, r2=0.002)
p.build()

# ---------------------------------------------------------------- feeder trolleys, feeders and reels
FEED_N = 28
def feeder_bank(side):
    sy = -1 if side == 'front' else 1
    aid = f'MNT.feeders_{side}'
    assembly(aid, f'{side.title()} feeder trolley: tape feeders present parts at a fixed pick point; reels hold the tape.',
             parent='MNT', explode=(0, sy * 1.05, 0))
    y_edge = sy * Y_FEED
    t = Part(f'{aid}.trolley', 'Feeder trolley: docking frame, casters, handle and reel holders', aid, bevel=0.004)
    yt = y_edge + sy * 0.22
    t.box((L - 0.12, 0.36, 0.04), (0, yt, 0.2), 'paint_grey')                      # lower deck
    t.box((L - 0.12, 0.05, 0.62), (0, y_edge + sy * 0.04, 0.53), 'paint_grey')     # docking plate
    t.box((L - 0.1, 0.06, 0.035), (0, y_edge + sy * 0.03, Z_BED - 0.02), 'alu_brushed')   # feeder base rail
    for sx in (-1, 1):
        t.box((0.04, 0.36, 0.64), (sx * (L / 2 - 0.08), yt, 0.52), 'paint_grey')    # side frames
        t.cyl(0.04, 0.03, (sx * (L / 2 - 0.12), yt + sy * 0.12, 0.05), 'rubber', rot=(0, math.pi / 2, 0), seg=28)   # casters
        t.cyl(0.04, 0.03, (sx * (L / 2 - 0.12), yt - sy * 0.12, 0.05), 'rubber', rot=(0, math.pi / 2, 0), seg=28)
        for k in (-1, 1):
            t.box((0.03, 0.02, 0.08), (sx * (L / 2 - 0.12), yt + k * 0.12, 0.11), 'steel_dark')
        t.cyl(0.014, 0.1, (sx * (L / 2 - 0.08), yt + sy * 0.2, 0.86), 'steel_polished', rot=(math.pi / 2, 0, 0), seg=16)  # handle posts
    t.cyl(0.014, L - 0.16, (0, yt + sy * 0.25, 0.86), 'steel_polished', rot=(0, math.pi / 2, 0), seg=16)   # handle bar
    for k in range(2):  # reel holder rods
        t.cyl(0.008, L - 0.18, (0, yt + sy * (0.02 + k * 0.12), 0.39 + k * 0.2), 'steel_polished', rot=(0, math.pi / 2, 0), seg=14)
    t.build()

    f = Part(f'{aid}.feeders', f'{FEED_N} tape feeders (8 to 24 mm tape)', aid, bevel=0.0015)
    r = Part(f'{aid}.reels', 'Component reels: the tape wound with parts, in plastic flanges', aid, bevel=0.001, segments=2)
    lab = Part(f'{aid}.labels', 'Reel and feeder barcode labels', aid, bevel=0.0)
    span = L - 0.24
    pitch = span / FEED_N
    for i in range(FEED_N):
        x = -span / 2 + pitch * (i + 0.5)
        w = pitch * (0.78 if i % 5 else 0.9)
        y0 = y_edge - sy * 0.06                      # pick point end, inside the machine
        f.box((w, 0.46, 0.1), (x, y0 + sy * 0.2, Z_BED + 0.05), 'anodised_dark')
        f.box((w * 0.7, 0.3, 0.006), (x, y0 + sy * 0.12, Z_BED + 0.103), 'steel_polished')        # tape guide cover
        f.box((w * 0.5, 0.06, 0.004), (x, y0, Z_BED + 0.104), 'tape_brown')                      # tape at the pick window
        f.cyl(0.012, w * 0.6, (x, y0 + sy * 0.02, Z_BED + 0.09), 'steel_dark', rot=(0, math.pi / 2, 0), seg=16)  # sprocket
        f.box((w * 0.9, 0.05, 0.06), (x, y0 + sy * 0.44, Z_BED + 0.09), 'plastic_black')         # handle
        f.box((w * 0.5, 0.004, 0.012), (x, y0 + sy * 0.465, Z_BED + 0.1), 'led_green' if i % 9 else 'lens_amber')   # status LED
        lab.box((w * 0.8, 0.08, 0.001), (x, y0 + sy * 0.3, Z_BED + 0.1005), 'label_white')
        # reels hang on the holder rods beyond the trolley, two rows
        row = i % 2
        rr = 0.165 if (i % 7 == 3) else 0.09
        ry = yt + sy * (0.02 + row * 0.12)
        rz = (0.39 + row * 0.2) + rr - 0.01
        rz = max(rz, rr + 0.08)
        flange = ['reel_blue', 'reel_white', 'reel_black'][(i * 7) % 3]
        rot = (0, math.pi / 2, 0)
        if A.lod == 'plant':          # seen from the aisle a reel is one disc in its flange colour
            r.cyl(rr, w * 0.74, (x, ry, rz), flange, rot=rot, seg=12); rnd(); continue
        for s in (-1, 1):
            r.cyl(rr, 0.0018, (x + s * w * 0.36, ry, rz), flange, rot=rot, seg=48)
        r.cyl(rr * (0.55 + 0.4 * rnd()), w * 0.62, (x, ry, rz), 'tape_brown', rot=rot, seg=48)   # wound tape
        r.tube(0.03, 0.0065, w * 0.74, (x, ry, rz), 'reel_white', rot=rot, seg=32)               # hub
        lab.box((0.001, 0.05, 0.03), (x + w * 0.37, ry, rz + rr * 0.45), 'label_white')
    f.build(); r.build(); lab.build()

feeder_bank('front')
feeder_bank('rear')

# ---------------------------------------------------------------- the hood: frame, panes, signal tower, HMI, interior light
assembly('MNT.hood', 'Safety hood: interlocked polycarbonate panes over the moving axes, with signal tower and HMI.',
         parent='MNT', explode=(0, 0, 1.5))
p = Part('MNT.hood.frame', 'Hood frame: anodised extrusions and the top cover', 'MNT.hood', bevel=0.003, shell=True)
zh0 = Z_BED + 0.02
hh = Z_HOOD - zh0
for sx in (-1, 1):
    for sy in (-1, 1):
        p.box((0.04, 0.04, hh), (sx * (L / 2 - 0.02), sy * (D / 2 - 0.02), zh0 + hh / 2), 'anodised_dark')
for sy in (-1, 1):
    p.box((L, 0.05, 0.05), (0, sy * (D / 2 - 0.025), Z_HOOD - 0.025), 'anodised_dark')
    p.box((L, 0.04, 0.03), (0, sy * (D / 2 - 0.02), zh0 + 0.015), 'anodised_dark')
for sx in (-1, 1):
    p.box((0.05, D, 0.05), (sx * (L / 2 - 0.025), 0, Z_HOOD - 0.025), 'anodised_dark')
p.box((L - 0.04, D * 0.36, 0.02), (0, 0, Z_HOOD - 0.01), 'paint_white')                         # top cover strip (over the beam)
p.box((L - 0.04, 0.004, 0.03), (0, -D * 0.18, Z_HOOD + 0.001), 'paint_blue')
p.build()
p = Part('MNT.hood.panes', 'Polycarbonate panes (interlocked: opening one stops the axes)', 'MNT.hood', bevel=0.002, shell=True)
pane_h = hh - 0.08
for sy in (-1, 1):
    for dx in (-1, 1):
        p.box((L / 2 - 0.05, 0.006, pane_h), (dx * (L / 4), sy * (D / 2 - 0.02), zh0 + 0.03 + pane_h / 2), 'glass')
for sx in (-1, 1):
    p.box((0.006, D - 0.06, pane_h), (sx * (L / 2 - 0.02), 0, zh0 + 0.03 + pane_h / 2), 'glass')
for sy in (-1, 1):
    p.box((L - 0.06, D * 0.3, 0.006), (0, sy * D * 0.33, Z_HOOD - 0.01), 'glass')
p.build()
p = Part('MNT.hood.handles', 'Pane handles and interlock switches', 'MNT.hood', bevel=0.002)
for sy in (-1, 1):
    for dx in (-1, 1):
        p.box((0.2, 0.025, 0.02), (dx * L / 4, sy * (D / 2 - 0.0), zh0 + 0.12), 'steel_polished')
        p.box((0.03, 0.03, 0.05), (dx * (L / 2 - 0.08), sy * (D / 2 - 0.035), Z_HOOD - 0.08), 'estop_yellow')
p.build()
p = Part('MNT.hood.light', 'Interior LED light bars', 'MNT.hood', bevel=0.0)
for sy in (-1, 1):
    p.box((L - 0.2, 0.02, 0.008), (0, sy * D * 0.2, Z_HOOD - 0.03), 'led_white')
p.build()
p = Part('MNT.hood.tower', 'Signal tower: green running, amber warning, red stopped', 'MNT.hood', bevel=0.001)
tx, ty = L / 2 - 0.12, -D / 2 + 0.12
p.cyl(0.012, 0.18, (tx, ty, Z_HOOD + 0.09), 'steel_polished', seg=20)
for k, m in enumerate(['led_green', 'lens_amber', 'lens_red']):
    p.cyl(0.032, 0.06, (tx, ty, Z_HOOD + 0.21 + k * 0.062), m, seg=36)
    p.cyl(0.033, 0.004, (tx, ty, Z_HOOD + 0.18 + k * 0.062), 'plastic_grey', seg=36)
p.cyl(0.03, 0.02, (tx, ty, Z_HOOD + 0.4), 'plastic_grey', seg=36)
p.build()
p = Part('MNT.hood.hmi', 'Operator screen on a swing arm, with emergency stop', 'MNT.hood', bevel=0.003)
hx, hy, hz = -L / 2 + 0.22, -D / 2 - 0.1, Z_BED + 0.38
p.box((0.03, 0.03, 0.3), (hx, -D / 2 + 0.01, Z_BED + 0.2), 'anodised_dark')                   # arm post
p.box((0.03, 0.14, 0.03), (hx, -D / 2 - 0.05, Z_BED + 0.34), 'anodised_dark')                 # arm
p.box((0.36, 0.035, 0.24), (hx, hy, hz), 'plastic_black', rot=(math.radians(-12), 0, 0))       # screen housing
p.box((0.06, 0.04, 0.06), (hx + 0.24, hy + 0.01, hz - 0.06), 'estop_yellow', rot=(math.radians(-12), 0, 0))
p.cyl(0.018, 0.02, (hx + 0.24, hy - 0.015, hz - 0.055), 'estop_red', rot=(math.radians(78), 0, 0), seg=28)
p.build()
scr = Part('MNT.hood.hmi_screen', 'Operator screen display', 'MNT.hood', bevel=0.0)
scr.box((0.32, 0.002, 0.2), (hx, hy - 0.0185, hz), 'hmi_screen', rot=(math.radians(-12), 0, 0))
ob = scr.build()
# project the UI image onto the screen face (front-facing quad gets the full image)
me = ob.data; uv = me.uv_layers.new(name='UVMap')
for poly in me.polygons:
    for li in poly.loop_indices:
        v = me.vertices[me.loops[li].vertex_index].co
        uv.data[li].uv = ((v.x - (hx - 0.16)) / 0.32, (v.z - (hz - 0.1 + (v.y - (hy - 0.0185)) * 0)) / 0.2)

p = Part('MNT.hood.nameplate', 'Machine nameplate', 'MNT.hood', bevel=0.001)
p.box((0.3, 0.004, 0.06), (0.25, -D / 2 - 0.004, Z_CAB + 0.06 - 0.06), 'label_white')
p.build()

# nameplate text: real text objects (fictional plant; no real brand)
def text(body, size, loc, rot, mat, parent):
    cu = bpy.data.curves.new('txt_' + body[:8], 'FONT'); cu.body = body; cu.size = size; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    cu.extrude = 0.0003
    o = bpy.data.objects.new('MNT.text.' + body[:12].replace(' ', '_'), cu); ROOT_COL.objects.link(o)
    o.location = loc; o.rotation_euler = rot; o.data.materials.append(MATS[mat]); o.parent = ASSEMBLIES[parent]
    return o
text('MOUNTER B  |  SMD-4', 0.02, (0.25, -D / 2 - 0.0065, Z_CAB + 0.008), (math.pi / 2, 0, 0), 'plastic_black', 'MNT.hood')
text('PLANT EG-01', 0.014, (0.25, -D / 2 - 0.0065, Z_CAB - 0.016), (math.pi / 2, 0, 0), 'paint_blue', 'MNT.hood')

# ---------------------------------------------------------------- states
SHELLS = [o for o in bpy.data.objects if o.get('shell')]

def explode(amount):
    for o in bpy.data.objects:
        e = o.get('explode')
        if e is None or not any(e): continue
        base = Vector(o.get('_home', list(o.location)))
        o['_home'] = list(base)
        o.location = base + Vector(e) * amount

if A.state == 'exploded':
    explode(A.explode)
if A.state == 'ghost':
    for o in SHELLS:
        if o.name == 'MNT.bed.casting': continue
        o.data.materials.clear(); o.data.materials.append(MATS['ghost'])
        o.visible_shadow = False
if A.state == 'cut':
    # the studio's section: a plane across the whole machine at the slider's depth removes the front of every cover;
    # the boolean transfers the cutter's material to the new faces, so the caps read as solid section surfaces
    c3 = 0.95 - A.cut_pos * 1.9                       # the studio keeps three.js z <= c3, i.e. Blender y >= -c3
    cm = bpy.data.meshes.new('cutter'); bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.LocRotScale(Vector((0, -c3 - 2.0, 1.25)), None, Vector((6.0, 4.0, 3.5))))
    bm.to_mesh(cm); bm.free(); cm.materials.append(MATS['section'])
    cutter = bpy.data.objects.new('cutter', cm); ROOT_COL.objects.link(cutter)
    cutter.hide_render = True; cutter.display_type = 'WIRE'
    for o in SHELLS:
        b = o.modifiers.new('cutaway', 'BOOLEAN'); b.operation = 'DIFFERENCE'; b.object = cutter
        b.solver = 'EXACT'; b.material_mode = 'TRANSFER'
    for o in bpy.data.objects:                              # the front trolley is undocked and out of the picture
        if o.name.startswith('MNT.feeders_front'): o.hide_render = True
# glass never casts black shadows over the internals
for o in bpy.data.objects:
    if o.type == 'MESH' and any(m and m.name == 'glass' for m in o.data.materials):
        o.visible_shadow = False

# ---------------------------------------------------------------- studio: cyclorama, lights, camera
def cyclorama():
    """Seamless floor-to-wall sweep, so the machine sits in a photographic studio with a real contact shadow."""
    me = bpy.data.meshes.new('cyc'); bm = bmesh.new()
    W, depth, R, H, n = 24.0, 9.0, 3.0, 9.0, 24
    prof = [(-depth, 0.0)]
    for i in range(n + 1):
        a = (math.pi / 2) * i / n
        prof.append((8.0 + R * math.sin(a) - R + 0.0 if False else 5.0 + R * math.sin(a), R - R * math.cos(a)))
    prof.append((5.0 + R, H))
    rows = []
    for (y, z) in prof:
        rows.append([bm.verts.new((x, y, z)) for x in (-W / 2, W / 2)])
    for a, b in zip(rows, rows[1:]):
        bm.faces.new((a[0], a[1], b[1], b[0]))
    bm.to_mesh(me); bm.free()
    for poly in me.polygons: poly.use_smooth = True
    o = bpy.data.objects.new('studio.cyclorama', me); ROOT_COL.objects.link(o)
    o.data.materials.append(MATS['studio_floor'])
    o.rotation_euler = (0, 0, math.radians(30))
cyclorama()

def area(name, loc, target, size, power, color=(1, 1, 1), shape='RECTANGLE', size_y=None):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = power; l.shape = shape; l.size = size; l.color = color
    if size_y: l.size_y = size_y
    o = bpy.data.objects.new(name, l); ROOT_COL.objects.link(o); o.location = loc
    d = Vector(target) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return o
# key: a large softbox front-left, high; fill: dim and broad from the camera side; rims separate the silhouette;
# a top strip draws a long highlight across the hood glass and the beam
area('light.key', (-3.2, -3.6, 3.6), (0, 0, 0.9), 2.4, 1100, (1.0, 0.97, 0.93), size_y=1.6)
area('light.fill', (4.2, -3.0, 1.8), (0, 0, 0.8), 3.0, 260, (0.9, 0.95, 1.0))
area('light.rim_l', (-3.0, 3.4, 2.6), (0, 0, 1.0), 1.2, 700, (0.85, 0.92, 1.0), size_y=2.4)
area('light.rim_r', (3.2, 3.0, 2.4), (0, 0, 1.0), 1.2, 600, (1.0, 0.95, 0.9), size_y=2.4)
area('light.top', (0.9, -1.4, 4.2), (0, 0, 1.0), 3.2, 260, (1, 1, 1), size_y=0.5)

world = bpy.data.worlds.new('studio'); scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = srgb('#3A3F47'); bg.inputs['Strength'].default_value = 0.35

# camera poses come from the studio's shots.json (three.js axes), so a photo lines up with the live view
import os as _os
_shots = json.load(open(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..', 'assets', 'models', 'machines', 'mounter', 'shots.json')))['shots']
if A.shot == 'wide': A.shot = 'apart'
if A.state == 'exploded' and A.shot == 'hero': A.shot = 'apart'
_sh = _shots[A.shot]
three2bl = lambda v: (v[0], -v[2], v[1])
cpos, caim = three2bl(_sh['pos']), three2bl(_sh['look'])
cam_data = bpy.data.cameras.new('camera'); cam_data.sensor_fit = 'VERTICAL'; cam_data.sensor_height = 24
cam_data.lens_unit = 'FOV'; cam_data.angle_y = math.radians(_sh['fov'])
cam_data.dof.use_dof = True; cam_data.dof.aperture_fstop = 11 if A.shot != 'head' else 5.6
cam = bpy.data.objects.new('camera', cam_data); ROOT_COL.objects.link(cam); cam.location = cpos
cam.rotation_euler = (Vector(caim) - Vector(cpos)).to_track_quat('-Z', 'Y').to_euler()
cam_data.dof.focus_distance = (Vector(caim) - Vector(cpos)).length
scene.camera = cam

# ---------------------------------------------------------------- render settings
rx, ry = (int(v) for v in A.res.split('x'))
r = scene.render
r.engine = 'CYCLES'; r.resolution_x = rx; r.resolution_y = ry; r.resolution_percentage = 100
r.film_transparent = False
def use_gpu():
    """Pick the first GPU backend Cycles can open on this machine; fall back to the CPU and say so."""
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for kind in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL'):
        try:
            prefs.compute_device_type = kind
            prefs.refresh_devices()
            gpus = [d for d in prefs.devices if d.type == kind]
            if gpus:
                for d in prefs.devices: d.use = d.type == kind
                print('GPU', kind, ', '.join(d.name for d in gpus)); return True
        except TypeError:
            continue
    print('GPU none found, rendering on the CPU'); return False
scene.cycles.device = 'GPU' if (A.gpu and use_gpu()) else 'CPU'
scene.cycles.samples = A.samples; scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.02
scene.cycles.use_denoising = True; scene.cycles.denoiser = 'OPENIMAGEDENOISE'
scene.cycles.max_bounces = 10; scene.cycles.transmission_bounces = 10; scene.cycles.transparent_max_bounces = 24
scene.cycles.caustics_reflective = False; scene.cycles.caustics_refractive = False
scene.cycles.blur_glossy = 1.0
scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0.0
r.image_settings.file_format = 'PNG'; r.image_settings.color_depth = '8'

# ---------------------------------------------------------------- outputs
stats = {'parts': sum(1 for p_ in PARTS if p_['kind'] == 'part'), 'assemblies': sum(1 for p_ in PARTS if p_['kind'] == 'assembly'),
         'placed_chips': placed}
dg = bpy.context.evaluated_depsgraph_get()
tris = 0
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name.startswith('MNT'):
        ev = o.evaluated_get(dg); me_ = ev.to_mesh(); me_.calc_loop_triangles(); tris += len(me_.loop_triangles); ev.to_mesh_clear()
stats['triangles'] = tris
print('STATS', json.dumps(stats))
if A.manifest:
    import os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from names import NAMES
    for p_ in PARTS:
        ar_, en_, about_ = NAMES.get(p_['id'], ('', '', ''))
        if not en_: print('WARNING no display name for', p_['id'])
        p_.update({'name_ar': ar_, 'name_en': en_, 'about_ar': about_})
    with open(A.manifest, 'w') as fh:
        json.dump({'asset': 'MNT', 'title': 'SMD placement machine (Mounter B, line SMD-4, Plant EG-01)',
                   'disclosure': 'Illustrative educational reconstruction of a generic gantry pick-and-place machine; '
                                 'not a real vendor model, not for maintenance or safety use.',
                   'units': 'metres', 'up': 'Z (Blender) / Y (glTF)',
                   'vectors': 'explode and anchor are Blender axes (x, y, z); in glTF / three.js they are (x, z, -y)', 'stats': stats, 'parts': PARTS}, fh, indent=1)
if A.anchors:
    # label anchors: each part's evaluated bounding-box centre projected through the camera, so 2D callouts stay
    # attached to the real geometry in every state (assembled, exploded, ghost, cut)
    from bpy_extras.object_utils import world_to_camera_view
    dg = bpy.context.evaluated_depsgraph_get(); out = {}
    for o in bpy.data.objects:
        if o.type != 'MESH' or not o.name.startswith('MNT') or o.hide_render: continue
        ev = o.evaluated_get(dg)
        if not len(ev.data.vertices): continue
        c = ev.matrix_world @ Vector(o['anchor']) if o.get('anchor') else sum((ev.matrix_world @ Vector(b) for b in ev.bound_box), Vector()) / 8
        top = max((ev.matrix_world @ Vector(b)).z for b in ev.bound_box)
        v = world_to_camera_view(scene, cam, c)
        out[o.name] = {'x': round(v.x * rx, 1), 'y': round((1 - v.y) * ry, 1), 'depth': round(v.z, 3), 'top_z': round(top, 3)}
    with open(A.anchors, 'w') as fh: json.dump({'state': A.state, 'shot': A.shot, 'size': [rx, ry], 'anchors': out}, fh, indent=1)
if A.blend:
    bpy.ops.wm.save_as_mainfile(filepath=A.blend)
if A.glb and A.lod == 'plant':
    # on the plant floor nothing inside the cabinet can be seen, and the plant draws its own live signal tower
    drop = ('MNT.controls', 'MNT.hood.light', 'MNT.hood.tower', 'MNT.feeders_front.labels', 'MNT.feeders_rear.labels', 'MNT.text.', 'MNT.hood.nameplate', 'MNT.hood.handles')
    for o in [o for o in bpy.data.objects if o.name.startswith(drop) and o.type != 'EMPTY']: bpy.data.objects.remove(o)
if A.glb:
    # text curves become meshes so the nameplate travels in glTF; the studio set never leaves Blender
    for o in [o for o in bpy.data.objects if o.type == 'FONT']:
        me_ = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        mo = bpy.data.objects.new(o.name, me_); ROOT_COL.objects.link(mo)
        mo.parent = o.parent; mo.matrix_world = o.matrix_world.copy(); bpy.data.objects.remove(o)
    for o in bpy.data.objects:
        o.select_set(o.name.startswith('MNT') and o.type in ('MESH', 'EMPTY', 'FONT'))
    bpy.ops.export_scene.gltf(filepath=A.glb, export_format='GLB', use_selection=True, export_apply=True,
                              export_extras=True, export_yup=True)
if A.out:
    r.filepath = A.out
    bpy.ops.render.render(write_still=True)
    print('WROTE', A.out)
