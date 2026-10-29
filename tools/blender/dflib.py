"""Shared Blender building blocks for Digital Factory assets (machines, cells, lines, the building).

Every asset script builds named parts with stable ids through Part and assembly(), gets the same physical materials, the
same studio (cyclorama, soft boxes, AgX) and the same outputs (still, part manifest, label anchors, .blend, GLB), so all
assets look like one family and travel the same pipeline (docs/BLENDER.md). mounter.py predates this module and keeps its
own copy of these pieces; new assets import this one.

    import dflib as L
    L.init(lod='full')            # 'full' stills/film · 'web' studio model · 'far'/'plant' light floor copies
    L.assembly('CELL', 'A sub-assembly cell'); p = L.Part('CELL.bench', 'Workbench', 'CELL'); p.box(...); p.build()
    L.studio(); L.camera(pos, look, fov); L.render('out.png', samples=96, res='1600x1000')
"""
import sys, os, math, json
import bpy, bmesh
from mathutils import Matrix, Vector, Euler

class _Cfg: lod = 'full'
CFG = _Cfg()
MATS = {}
PARTS = []
ASSEMBLIES = {}
COL = lambda: bpy.context.scene.collection

def init(lod='full'):
    """Start an empty scene. Call before building anything."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    CFG.lod = lod; MATS.clear(); PARTS.clear(); ASSEMBLIES.clear(); _seed[0] = 0x9E3779B9
    standard_materials()

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

def standard_materials():
    """The shared material library (physical values; colours as the brand's sRGB hex)."""
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

# ---------------------------------------------------------------- parts: one object per named component

def assembly(aid, role, explode=(0, 0, 0), parent=None):
    """An assembly is an empty; exploding moves the empty, so children keep their authored assembled transforms."""
    e = bpy.data.objects.new(aid, None)
    e.empty_display_size = 0.1
    COL().objects.link(e)
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
        if CFG.lod in ('far', 'plant'): seg = max(8, seg // 3)
        elif CFG.lod == 'web' and seg > 32: seg = 32
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

    def sphere(self, r, loc, mat, scale=(1, 1, 1), seg=20, rings=12):
        """A sphere or an ellipsoid (heads, hands, rounded caps)."""
        if CFG.lod in ('far', 'plant'): seg, rings = 10, 6
        M = Matrix.LocRotScale(Vector(loc), None, Vector(scale))
        if self.anchor is None: self.anchor = tuple(loc)
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=rings, radius=r, matrix=M)
        self._tag(res['verts'], mat); return self

    def sweep(self, pts, r, mat, seg=10, steps=8):
        """A cable: a round tube swept along a Catmull-Rom curve through pts, with capped ends."""
        if CFG.lod in ('far', 'plant'): seg, steps = 6, 3
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
        ob = bpy.data.objects.new(self.pid, me); COL().objects.link(ob)
        ob.parent = ASSEMBLIES[self.asm]
        # the browser model drops bevels where they cannot be seen at studio distance: reel flanges and board chips
        web_flat = CFG.lod == 'web' and self.pid.endswith(('.reels', '.pcb', '.labels'))
        if self.bevel > 0 and CFG.lod not in ('far', 'plant') and not web_flat:
            bv = ob.modifiers.new('bevel', 'BEVEL')
            bv.width = self.bevel; bv.segments = min(self.segments, 2) if CFG.lod == 'web' else self.segments; bv.limit_method = 'ANGLE'
            bv.angle_limit = math.radians(32); bv.harden_normals = True; bv.miter_outer = 'MITER_ARC'
            wn = ob.modifiers.new('weighted_normal', 'WEIGHTED_NORMAL'); wn.keep_sharp = True
        ob['part_id'] = self.pid; ob['role'] = self.role; ob['explode'] = list(self.explode); ob['source'] = self.source
        ob['shell'] = self.shell
        ob['anchor'] = list(self.anchor or (0, 0, 0))
        PARTS.append({'id': self.pid, 'kind': 'part', 'role': self.role, 'parent': self.asm, 'explode': list(self.explode),
                      'shell': self.shell, 'source': self.source, 'materials': list(self.mats)})
        return ob


# ---------------------------------------------------------------- studio: cyclorama, lights, camera
def cyclorama(scale=1.0, rot_deg=30):
    """Seamless floor-to-wall sweep, so the machine sits in a photographic studio with a real contact shadow."""
    me = bpy.data.meshes.new('cyc'); bm = bmesh.new()
    W, depth, R, H, n = 24.0 * scale, 9.0 * scale, 3.0 * scale, 9.0 * scale, 24
    prof = [(-depth, 0.0)]
    for i in range(n + 1):
        a = (math.pi / 2) * i / n
        prof.append((5.0 * scale + R * math.sin(a), R - R * math.cos(a)))
    prof.append((5.0 * scale + R, H))
    rows = []
    for (y, z) in prof:
        rows.append([bm.verts.new((x, y, z)) for x in (-W / 2, W / 2)])
    for a, b in zip(rows, rows[1:]):
        bm.faces.new((a[0], a[1], b[1], b[0]))
    bm.to_mesh(me); bm.free()
    for poly in me.polygons: poly.use_smooth = True
    o = bpy.data.objects.new('studio.cyclorama', me); COL().objects.link(o)
    o.data.materials.append(MATS['studio_floor'])
    o.rotation_euler = (0, 0, math.radians(rot_deg))

def area(name, loc, target, size, power, color=(1, 1, 1), shape='RECTANGLE', size_y=None):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = power; l.shape = shape; l.size = size; l.color = color
    if size_y: l.size_y = size_y
    o = bpy.data.objects.new(name, l); COL().objects.link(o); o.location = loc
    d = Vector(target) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return o
def lights(scale=1.0, center=(0, 0, 0.9)):
    """The studio rig: a large key softbox front-left, a broad dim fill, two rims behind, a top strip. scale stretches the
    rig for bigger subjects (a cell or a line section) and raises the power with the square of the distance."""
    cx, cy, cz = center; k = scale * scale
    P = lambda x, y, z: (cx + x * scale, cy + y * scale, z * scale if scale > 1 else z)
    area('light.key', P(-3.2, -3.6, 3.6), center, 2.4 * scale, 1100 * k, (1.0, 0.97, 0.93), size_y=1.6 * scale)
    area('light.fill', P(4.2, -3.0, 1.8), center, 3.0 * scale, 260 * k, (0.9, 0.95, 1.0))
    area('light.rim_l', P(-3.0, 3.4, 2.6), center, 1.2 * scale, 700 * k, (0.85, 0.92, 1.0), size_y=2.4 * scale)
    area('light.rim_r', P(3.2, 3.0, 2.4), center, 1.2 * scale, 600 * k, (1.0, 0.95, 0.9), size_y=2.4 * scale)
    area('light.top', P(0.9, -1.4, 4.2), center, 3.2 * scale, 260 * k, (1, 1, 1), size_y=0.5 * scale)

def world(color='#3A3F47', strength=0.35):
    w = bpy.data.worlds.new('studio'); bpy.context.scene.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = srgb(color); bg.inputs['Strength'].default_value = strength

def gradient_world(top='#C4C9D0', bottom='#2A2E34', strength=1.0):
    """A studio sky that metal can reflect: dark below the horizon, light above, like a lit stage over a dark floor."""
    w = bpy.data.worlds.new('studio_gradient'); bpy.context.scene.world = w; w.use_nodes = True; nt = w.node_tree
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); ramp = nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
    ramp.color_ramp.elements[0].position = 0.42; ramp.color_ramp.elements[0].color = srgb(bottom)
    ramp.color_ramp.elements[1].position = 0.72; ramp.color_ramp.elements[1].color = srgb(top)
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = -1.0; mr.inputs['From Max'].default_value = 1.0
    nt.links.new(sep.outputs['Z'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
    bg = nt.nodes['Background']; nt.links.new(ramp.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = strength

def strips(scale=1.0, center=(0, 0, 0.9), power=420):
    """Two tall strip softboxes beside the subject, hidden from the camera: long clean highlights on metal edges."""
    cx, cy, cz = center
    for name, x, y in (('light.strip_l', -2.4, 0.9), ('light.strip_r', 2.6, -0.6)):
        o = area(name, (cx + x * scale, cy + y * scale, cz + 0.6 * scale), (cx, cy, cz), 0.35 * scale, power * scale * scale, (1, 1, 1), size_y=3.0 * scale)
        o.visible_camera = False

def studio(scale=1.0, center=(0, 0, 0.9), rot_deg=30, rig='v1'):
    """Cyclorama, light rig and world in one call. rig 'v1' is the rig the first stills used; 'v2' adds what metal needs:
    a gradient world to reflect and two strip softboxes (docs/RENDER_QUALITY_AUDIT.md)."""
    cyclorama(scale, rot_deg); lights(scale, center)
    if rig == 'v2': gradient_world(); strips(scale, center)
    else: world()

def camera(pos3, look3, fov=30, fstop=11):
    """A camera from a three.js pose (Y up, front +z) so stills line up with the browser studio; vertical fov in degrees."""
    t2b = lambda v: (v[0], -v[2], v[1])
    cpos, caim = Vector(t2b(pos3)), Vector(t2b(look3))
    cd = bpy.data.cameras.new('camera'); cd.sensor_fit = 'VERTICAL'; cd.sensor_height = 24; cd.lens_unit = 'FOV'; cd.angle_y = math.radians(fov)
    cd.dof.use_dof = fstop > 0; cd.dof.aperture_fstop = fstop or 11; cd.dof.focus_distance = (caim - cpos).length
    cam = bpy.data.objects.new('camera', cd); COL().objects.link(cam); cam.location = cpos
    cam.rotation_euler = (caim - cpos).to_track_quat('-Z', 'Y').to_euler(); bpy.context.scene.camera = cam
    return cam

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

def render(out, samples=96, res='1600x1000', gpu=False, look='AgX - Medium High Contrast', view='AgX', threshold=0.02,
           clamp=0.0, denoise=True, depth='8', exposure=0.0, noisy=''):
    """Cycles with OpenImageDenoise (albedo + normal guides) and one view transform; writes a PNG.

    The quality knobs are explicit so look-dev can change one variable at a time (docs/RENDER_QUALITY_AUDIT.md):
    view 'AgX' (with look) or 'Khronos PBR Neutral', adaptive threshold, indirect clamp, 8/16-bit output, exposure, and
    noisy='path.png' to also save the same frame without the denoiser."""
    sc = bpy.context.scene; r = sc.render; rx, ry = (int(v) for v in res.split('x'))
    r.engine = 'CYCLES'; r.resolution_x = rx; r.resolution_y = ry; r.resolution_percentage = 100
    sc.cycles.device = 'GPU' if (gpu and use_gpu()) else 'CPU'
    sc.cycles.samples = samples; sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = threshold
    sc.cycles.use_denoising = denoise; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'; sc.cycles.denoising_prefilter = 'ACCURATE'
    sc.cycles.max_bounces = 10; sc.cycles.transmission_bounces = 10; sc.cycles.transparent_max_bounces = 24
    sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False; sc.cycles.blur_glossy = 1.0
    sc.cycles.sample_clamp_indirect = clamp; sc.cycles.use_light_tree = True
    sc.view_settings.view_transform = view; sc.view_settings.exposure = exposure
    if view == 'AgX': sc.view_settings.look = look
    r.image_settings.file_format = 'PNG'; r.image_settings.color_depth = depth
    for o in bpy.data.objects:      # glass never casts black shadows over what is behind it
        if o.type == 'MESH' and any(m and m.name == 'glass' for m in o.data.materials): o.visible_shadow = False
    if noisy and denoise:
        sc.cycles.use_denoising = False; r.filepath = noisy; bpy.ops.render.render(write_still=True); print('WROTE', noisy)
        sc.cycles.use_denoising = True
    r.filepath = out; bpy.ops.render.render(write_still=True); print('WROTE', out)

def manifest(path, asset, title, disclosure, names=None):
    """The part manifest: ids, roles, explode offsets, shells and (optionally) display names per part."""
    for p in PARTS:
        if names and p['id'] in names:
            ar, en, about = names[p['id']]; p.update({'name_ar': ar, 'name_en': en, 'about_ar': about})
    with open(path, 'w') as fh:
        json.dump({'asset': asset, 'title': title, 'disclosure': disclosure, 'units': 'metres',
                   'vectors': 'explode and anchor are Blender axes (x, y, z); in glTF / three.js they are (x, z, -y)',
                   'parts': PARTS}, fh, indent=1)

def export_glb(path, prefix):
    for o in [o for o in bpy.data.objects if o.type == 'FONT']:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        mo = bpy.data.objects.new(o.name, me); COL().objects.link(mo); mo.parent = o.parent; mo.matrix_world = o.matrix_world.copy(); bpy.data.objects.remove(o)
    for o in bpy.data.objects: o.select_set(o.name.startswith(prefix) and o.type in ('MESH', 'EMPTY'))
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_extras=True, export_yup=True)

def anchors(path, cam, res):
    """Each part's label point projected through the camera, in pixels, for 2D callouts (label.py)."""
    from bpy_extras.object_utils import world_to_camera_view
    rx, ry = (int(v) for v in res.split('x')); dg = bpy.context.evaluated_depsgraph_get(); out = {}
    for o in bpy.data.objects:
        if o.type != 'MESH' or o.hide_render: continue
        ev = o.evaluated_get(dg)
        c = ev.matrix_world @ Vector(o['anchor']) if o.get('anchor') else sum((ev.matrix_world @ Vector(b) for b in ev.bound_box), Vector()) / 8
        v = world_to_camera_view(bpy.context.scene, cam, c)
        out[o.name] = {'x': round(v.x * rx, 1), 'y': round((1 - v.y) * ry, 1), 'depth': round(v.z, 3)}
    with open(path, 'w') as fh: json.dump({'size': [rx, ry], 'anchors': out}, fh, indent=1)
