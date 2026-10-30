"""Workers for Digital Factory scenes: real human proportions, after the Samsung Kaluga line photos (docs/REFERENCES-TV-PLANT.md §2c).

A body is a skeleton of joints turned into one smooth skin (Blender's Skin modifier, then subdivision), so arms, legs and the
torso join like a person instead of capsules. Each face takes its clothing from the nearest bone: jacket or vest, sleeves,
gloves, trousers, shoes. Head, hair, ears and collar are shaped primitives on top. Arms reach their hand targets through a
two-bone solve, so an operator's hands land on the work or on a screwdriver.

    import people as W
    W.materials()
    W.worker(part, x, y, face=0.0, look='jacket', sex='f', hair='blonde', hands=((-0.14, 0.40, 1.0), (0.16, 0.42, 1.02)))

face 0 looks along +Y (the convention of cells_kit.py); hand targets are in the worker's own frame (x right, y forward, z up),
in metres from the feet. Illustrative figures: generic people, no likeness of anyone in the reference photos.
"""
import math
import bpy, bmesh
from mathutils import Vector, Matrix
import dflib as L
from dflib import principled

LOOKS = {   # clothing per body region: torso, upper arm, forearm (sleeve), legs
    'jacket': ('wk_blue', 'wk_blue', 'wk_blue', 'wk_navy'),          # royal-blue work jacket, dark trousers
    'vest':   ('wk_vest', 'wk_knit', 'wk_knit', 'wk_black'),         # quilted blue vest over a light knit top
    'polo':   ('wk_blue', 'wk_blue', 'skin', 'wk_jeans'),            # short-sleeved blue polo, jeans
    'leader': ('wk_beige', 'wk_blue', 'wk_blue', 'wk_navy'),         # line leader: beige vest over the blue jacket
}
HAIR = {'blonde': '#C9A46A', 'brown': '#4B3222', 'black': '#1D1A18', 'red': '#8C3A1C', 'grey': '#8E8A84'}


def materials():
    principled('skin', '#C79A7E', rough=0.5)
    principled('wk_blue', '#1638A6', rough=0.82, noise_bump=0.4)
    principled('wk_vest', '#1A3FB0', rough=0.55, coat=0.2, noise_bump=0.5)
    principled('wk_knit', '#C9CBCC', rough=0.9, noise_bump=0.6)
    principled('wk_beige', '#D8CDB4', rough=0.85, noise_bump=0.4)
    principled('wk_navy', '#22262E', rough=0.85, noise_bump=0.4)
    principled('wk_black', '#18191C', rough=0.8, noise_bump=0.4)
    principled('wk_jeans', '#3A4A66', rough=0.85, noise_bump=0.6)
    principled('wk_glove', '#1C1D20', rough=0.7)
    principled('wk_shoe', '#141416', rough=0.5, coat=0.2)
    principled('wk_collar', '#F2F3F5', rough=0.7)
    principled('wk_eye', '#20160F', rough=0.2, coat=0.6)
    for k, c in HAIR.items(): principled('hair_' + k, c, rough=0.55, spec=0.35)


def _reach(S, T, l1, l2, pole):
    """Two-bone solve: the elbow for shoulder S reaching wrist target T, bent toward `pole`."""
    d = T - S; dist = min(max(d.length, abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3); u = d.normalized()
    T = S + u * dist
    a = math.acos(max(-1.0, min(1.0, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist))))
    p = (pole - u * pole.dot(u)).normalized()
    return S + u * (math.cos(a) * l1) + p * (math.sin(a) * l1), T


def _seg_dist(c, a, b):
    ab = b - a; t = max(0.0, min(1.0, (c - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (c - (a + ab * t)).length


def worker(part, x, y, face=0.0, look='jacket', sex='m', hair='brown', height=1.74, hands=None, glove=True, lean=0.0, sub=2):
    """Add one standing worker to `part` (a dflib.Part): one smooth body plus head, hair, ears and collar."""
    s = height / 1.74
    f = sex == 'f'
    W = Matrix.Translation((x, y, 0)) @ Matrix.Rotation(face, 4, 'Z')
    P = lambda a, b, c: Vector((a * s, b * s, c * s))
    torso, upper, fore, legs = LOOKS[look]
    puff = 0.008 if look in ('vest', 'leader') else 0.0
    if hands is None: hands = ((-0.14, 0.40, 1.0), (0.15, 0.40, 1.0))
    # ---- skeleton (feet on the floor, facing +Y); `lean` tips the upper body toward the work
    lz = lambda v: Vector((v.x, v.y + (v.z - 0.95 * s) * lean, v.z)) if v.z > 0.95 * s else v
    J = {'pelvis': P(0, 0, 0.97), 'belly': P(0, 0.012, 1.06), 'waist': P(0, 0.008, 1.15), 'chest': P(0, 0.014, 1.29),
         'upchest': P(0, 0.0, 1.39), 'neck': P(0, -0.004, 1.49)}
    sh = 0.17 if f else 0.19
    for sd, k in ((-1, 'l'), (1, 'r')):
        J['clav' + k] = P(sd * 0.1, -0.004, 1.415); J['sho' + k] = P(sd * sh, -0.008, 1.395)
        J['hip' + k] = P(sd * (0.098 if f else 0.092), 0.005, 0.9); J['thigh' + k] = P(sd * 0.098, 0.018, 0.72)
        J['knee' + k] = P(sd * 0.1, 0.03, 0.5); J['calf' + k] = P(sd * 0.1, 0.0, 0.36)
        J['ank' + k] = P(sd * 0.1, -0.012, 0.085); J['toe' + k] = P(sd * 0.112, 0.15, 0.035)
    J = {k: lz(v) for k, v in J.items()}
    for sd, k, tgt in ((-1, 'l', hands[0]), (1, 'r', hands[1])):
        S = J['sho' + k]; T = Vector(tgt)
        e, wv = _reach(S, T, 0.29 * s, 0.26 * s, Vector((sd * 0.7, -0.25, -1.0)))
        J['upa' + k] = S.lerp(e, 0.45); J['elb' + k] = e; J['frm' + k] = e.lerp(wv, 0.4); J['wri' + k] = wv
        J['hnd' + k] = wv + ((wv - e).normalized() + Vector((0, 0, -0.35))).normalized() * 0.085 * s
    R = {   # skin radii (x, y): a loose work jacket over the torso, trousers with some ease
        'pelvis': (0.168 if f else 0.158, 0.112), 'belly': (0.15 if f else 0.152, 0.11), 'waist': (0.138 if f else 0.15, 0.105),
        'chest': (0.152 if f else 0.168, 0.118), 'upchest': (0.15 if f else 0.172, 0.105), 'neck': (0.05, 0.05)}
    for k in 'lr':
        R.update({'clav' + k: (0.06, 0.06), 'sho' + k: (0.062, 0.062), 'upa' + k: (0.052, 0.052), 'elb' + k: (0.044, 0.044),
                  'frm' + k: (0.043, 0.04), 'wri' + k: (0.032, 0.027), 'hnd' + k: (0.037, 0.019), 'hip' + k: (0.098, 0.098),
                  'thigh' + k: (0.083, 0.083), 'knee' + k: (0.06, 0.06), 'calf' + k: (0.058, 0.058), 'ank' + k: (0.044, 0.044),
                  'toe' + k: (0.044, 0.034)})
    for k in ('belly', 'waist', 'chest', 'upchest', 'clavl', 'clavr'): R[k] = (R[k][0] + puff, R[k][1] + puff)
    names = list(J.keys()); idx = {n: i for i, n in enumerate(names)}
    E = [('pelvis', 'belly'), ('belly', 'waist'), ('waist', 'chest'), ('chest', 'upchest'), ('upchest', 'neck')]
    for k in 'lr':
        E += [('upchest', 'clav' + k), ('clav' + k, 'sho' + k), ('sho' + k, 'upa' + k), ('upa' + k, 'elb' + k), ('elb' + k, 'frm' + k),
              ('frm' + k, 'wri' + k), ('wri' + k, 'hnd' + k), ('pelvis', 'hip' + k), ('hip' + k, 'thigh' + k), ('thigh' + k, 'knee' + k),
              ('knee' + k, 'calf' + k), ('calf' + k, 'ank' + k), ('ank' + k, 'toe' + k)]
    me = bpy.data.meshes.new('tmp_body'); me.from_pydata([tuple(J[n]) for n in names], [(idx[a], idx[b]) for a, b in E], [])
    ob = bpy.data.objects.new('tmp_body', me); L.COL().objects.link(ob)
    sk = ob.modifiers.new('skin', 'SKIN'); sk.branch_smoothing = 0.6; sk.use_smooth_shade = True
    if not me.skin_vertices: me.skin_vertices.new()
    for i, n in enumerate(names):   # subdivision pulls the skin hull in by about a third: author radii as the hull
        me.skin_vertices[0].data[i].radius = (R[n][0] * 1.5 * s, R[n][1] * 1.5 * s)
    me.skin_vertices[0].data[idx['pelvis']].use_root = True
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    body = bpy.data.meshes.new_from_object(ev)
    bpy.data.objects.remove(ob); bpy.data.meshes.remove(me)
    # ---- clothing from the nearest bone, on the coarse skin (its rings follow the limbs, so hems and cuffs come out straight)
    hem = 1.0 * s
    region = {}
    for a, b in E:
        k = a + '-' + b
        if 'hnd' in b: region[k] = ('wk_glove' if glove else 'skin')
        elif 'wri' in b or 'frm' in b: region[k] = fore
        elif 'elb' in b or 'upa' in b: region[k] = upper
        elif 'toe' in b: region[k] = 'wk_shoe'
        elif any(t in b for t in ('hip', 'thigh', 'knee', 'calf', 'ank')): region[k] = legs
        else: region[k] = torso
    segs = [(J[a], J[b], region[a + '-' + b]) for a, b in E]
    local = []
    for poly in body.polygons:
        c = Vector(poly.center)
        mat = min(segs, key=lambda sg: _seg_dist(c, sg[0], sg[1]))[2]
        if mat == torso and c.z < hem: mat = legs
        if mat == legs and c.z >= hem: mat = torso       # the jacket hangs over the hips
        if mat == legs and c.z < 0.11 * s: mat = 'wk_shoe'
        if mat not in local: local.append(mat)
        poly.material_index = local.index(mat)
    for m in local: body.materials.append(L.MATS[m])
    if L.CFG.lod in ('far', 'plant'): sub = min(sub, 1)
    ob = bpy.data.objects.new('tmp_body', body); L.COL().objects.link(ob)
    ss = ob.modifiers.new('sub', 'SUBSURF'); ss.levels = sub; ss.render_levels = sub
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    smooth = bpy.data.meshes.new_from_object(ev)
    bpy.data.objects.remove(ob); bpy.data.meshes.remove(body); body = smooth
    bm = bmesh.new(); bm.from_mesh(body)
    for fc in bm.faces:
        fc.material_index = part._mi(local[fc.material_index]); fc.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    zmin = min(v.co.z for v in bm.verts)   # soles on the floor, never through it
    if zmin < 0: bmesh.ops.translate(bm, vec=Vector((0, 0, -zmin)), verts=bm.verts)
    bmesh.ops.transform(bm, matrix=W, verts=bm.verts)
    bm.to_mesh(body); bm.free()
    part.bm.from_mesh(body)
    bpy.data.meshes.remove(body)
    # ---- head, ears, nose, hair, collar (shaped primitives in the worker's frame)
    nk = J['neck']; hc = nk + Vector((0, 0.012, 0.135 * s))
    seg = 10 if L.CFG.lod in ('far', 'plant') else 28
    def sph(c, r, sc, mat, rings=None):
        M = W @ Matrix.Translation(c) @ Matrix.Diagonal(Vector((sc[0], sc[1], sc[2], 1.0)))
        res = bmesh.ops.create_uvsphere(part.bm, u_segments=seg, v_segments=rings or max(6, seg // 2), radius=r, matrix=M)
        part._tag(res['verts'], mat)
    def cyl(a, b, r, mat):
        a, b = Vector(a), Vector(b); d = b - a
        M = W @ Matrix.Translation((a + b) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        res = bmesh.ops.create_cone(part.bm, cap_ends=True, segments=max(8, seg // 2), radius1=r, radius2=r, depth=d.length, matrix=M)
        part._tag(res['verts'], mat)
    hm = 'hair_' + hair
    cyl(nk - Vector((0, 0, 0.03 * s)), hc - Vector((0, 0.01, 0.06 * s)), 0.05 * s, 'skin')
    sph(hc, 0.1 * s, (0.78, 0.93, 1.13), 'skin')                                     # skull and face
    sph(hc + Vector((0, 0.022 * s, -0.062 * s)), 0.058 * s, (1.0, 0.95, 0.72), 'skin')  # jaw and chin
    sph(hc + Vector((0, 0.09 * s, -0.012 * s)), 0.015 * s, (0.75, 1.0, 1.35), 'skin')  # nose
    for sd in (-1, 1):
        sph(hc + Vector((sd * 0.03 * s, 0.083 * s, 0.012 * s)), 0.009 * s, (1.2, 0.6, 0.8), 'wk_eye')      # eyes
        sph(hc + Vector((sd * 0.031 * s, 0.084 * s, 0.03 * s)), 0.014 * s, (1.5, 0.35, 0.3), hm)           # brows
    for sd in (-1, 1): sph(hc + Vector((sd * 0.077 * s, -0.005, -0.005)), 0.024 * s, (0.4, 0.8, 1.15), 'skin')
    if f:
        sph(hc + Vector((0, -0.012 * s, 0.022 * s)), 0.104 * s, (0.84, 0.95, 1.0), hm)          # crown, fringe swept back
        sph(hc + Vector((0, -0.045 * s, -0.04 * s)), 0.1 * s, (0.88, 0.75, 1.05), hm)           # back of the head
        if hair in ('blonde', 'red'): sph(hc + Vector((0, -0.035 * s, -0.075 * s)), 0.08 * s, (1.0, 0.8, 0.62), hm)  # a bob
        else: sph(hc + Vector((0, -0.13 * s, -0.01 * s)), 0.045 * s, (1.0, 1.0, 1.0), hm)        # a bun
    else:
        sph(hc + Vector((0, -0.016 * s, 0.03 * s)), 0.103 * s, (0.81, 0.93, 0.92), hm)          # short hair
    if look != 'vest':   # a turned-down collar on jackets and polos
        res = bmesh.ops.create_cone(part.bm, cap_ends=False, segments=max(8, seg // 2), radius1=0.07 * s, radius2=0.058 * s, depth=0.05 * s,
                                    matrix=W @ Matrix.Translation(nk + Vector((0, 0.0, -0.005 * s))))
        part._tag(res['verts'], 'wk_collar' if look == 'polo' else torso)
    return {k: W @ v for k, v in J.items()}
