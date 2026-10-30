"""Bake Cycles lighting into the model, so a game engine shows Blender's light at game-engine speed.

Opens a scene saved by an asset script (e.g. `mounter.py --lod web --blend mounter.blend`), which already holds the
Blender studio (cyclorama, area-light rig, world). For every static, untextured, opaque part and for the cyclorama:
apply modifiers, give the part its own lightmap UV, bake Cycles' full diffuse lighting (direct + indirect, times the
surface colour) into its own image, and wire that image into the part's emission. Exports one GLB.

In the engine (tools/godot/mounter-reel): baked dielectric surfaces take their diffuse light from the bake only (albedo
to black, ambient off), while the engine adds what a bake cannot hold: view-dependent reflections and highlights,
transparency, and motion. Metals have no diffuse term and are not baked. Moving parts (gantry, head) are hidden while
baking, so no shadow of their rest pose is frozen into the bed, and stay dynamically lit.

    python bake_lighting.py --blend mounter.blend --glb mounter-baked.glb [--samples 256] [--density 220] [--floor 1024]
"""
import sys, os, math, argparse
import bpy, bmesh

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--blend', required=True); ap.add_argument('--glb', required=True)
ap.add_argument('--samples', type=int, default=256); ap.add_argument('--density', type=float, default=220, help='lightmap pixels per metre')
ap.add_argument('--floor', type=int, default=1024, help='cyclorama lightmap size'); ap.add_argument('--maxres', type=int, default=2048)
ap.add_argument('--moving', default='MNT.gantry,MNT.head', help='assemblies that move in the engine (not baked, hidden while baking)')
ap.add_argument('--images', default='', help='folder for the baked PNGs (kept for inspection)')
ap.add_argument('--reuse', action='store_true', help='use the PNGs already in --images instead of baking (same unwrap, deterministic)')
ap.add_argument('--scale', type=float, default=2 ** -1.9, help='exposure folded into the bake before 8-bit storage: the stills use -1.9 EV (docs/RENDER_QUALITY_AUDIT.md E1), so emission 1.0 in the engine equals what Blender shows')
A = ap.parse_args(argv)

bpy.ops.wm.open_mainfile(filepath=os.path.abspath(A.blend))
sc = bpy.context.scene
moving_roots = [bpy.data.objects[n] for n in A.moving.split(',') if n in bpy.data.objects]

def under(o, roots):
    while o:
        if o in roots: return True
        o = o.parent
    return False

def mat_kind(m):
    """'texture' (has an image: screens, labels), 'glass' (transmission/alpha), 'metal', or 'diffuse'."""
    if not m or not m.use_nodes: return 'diffuse'
    nodes = m.node_tree.nodes
    if any(n.type == 'TEX_IMAGE' and n.name != 'BAKE' for n in nodes): return 'texture'     # our own bake target does not count
    p = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not p: return 'diffuse'
    if p.inputs['Transmission Weight'].default_value > 0.2 or p.inputs['Alpha'].default_value < 0.99: return 'glass'
    if p.inputs['Metallic'].default_value > 0.5: return 'metal'
    return 'diffuse'

# 1. what gets baked: static meshes with at least one diffuse material and no image textures (their UVs stay theirs)
targets = []
for o in bpy.data.objects:
    if o.type != 'MESH' or not (o.name.startswith('MNT') or o.name == 'studio.cyclorama'): continue
    kinds = [mat_kind(s.material) for s in o.material_slots]
    if under(o, moving_roots) or 'texture' in kinds or 'diffuse' not in kinds: continue
    targets.append(o)
for o in bpy.data.objects:
    if o.type == 'MESH' and under(o, moving_roots): o.hide_render = True        # no frozen shadows of the moving parts
print('BAKE targets', len(targets))

# 2. apply modifiers (bevels) so the lightmap UVs belong to the exported mesh, then a lightmap UV of its own
for o in targets:
    dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear(); old = o.data; o.data = me
    if old.users == 0: bpy.data.meshes.remove(old)
    while me.uv_layers: me.uv_layers.remove(me.uv_layers[0])        # untextured: the lightmap UV becomes TEXCOORD_0
    me.uv_layers.new(name='bake')
    bm = bmesh.new(); bm.from_mesh(me); bm.to_mesh(me); bm.free()
# one part at a time: unwrapping several objects together packs them into one shared square, leaving each part's own
# image mostly empty
for o in targets:
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.01, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')

# 3. an image per part, sized by its surface area; per-part copies of its materials hold the bake target node
imgdir = os.path.abspath(A.images) if A.images else None
if imgdir: os.makedirs(imgdir, exist_ok=True)

for o in targets:
    area = sum(p.area for p in o.data.polygons) * max(o.matrix_world.to_scale()) ** 2
    if o.name == 'studio.cyclorama': res = A.floor
    else: res = int(min(A.maxres, max(64, 2 ** round(math.log2(max(1.0, math.sqrt(area) * A.density))))))
    img = bpy.data.images.new('LM_' + o.name, res, res, alpha=False, float_buffer=True); img.colorspace_settings.name = 'Linear Rec.709'
    o['lightmap'] = img.name
    for s in o.material_slots:
        if not s.material: continue
        m = s.material.copy(); m.name = s.material.name + '@' + o.name; s.material = m; s.link = 'OBJECT' if False else s.link
        nt = m.node_tree; t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.name = 'BAKE'; nt.nodes.active = t
        uv = nt.nodes.new('ShaderNodeUVMap'); uv.uv_map = 'bake'; nt.links.new(uv.outputs['UV'], t.inputs['Vector'])

# 4. bake Cycles' diffuse lighting: direct + indirect, times colour (what the surface reflects diffusely)
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = A.samples
sc.cycles.max_bounces = 8; sc.cycles.diffuse_bounces = 4; sc.cycles.sample_clamp_indirect = 10; sc.cycles.use_light_tree = True
b = sc.render.bake; b.use_pass_direct = True; b.use_pass_indirect = True; b.use_pass_color = True; b.margin = 8; b.margin_type = 'EXTEND'
bpy.ops.object.select_all(action='DESELECT')
for o in targets: o.select_set(True)
bpy.context.view_layer.objects.active = targets[0]
import time; t0 = time.time()
if not A.reuse: bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT', 'COLOR'}, margin=8, use_clear=True)
print('BAKE seconds', round(time.time() - t0))

# 5. the bake becomes the emission of each part's diffuse materials (the engine turns their albedo and ambient off);
#    metal and glass slots keep their own shading. Images are packed as 8-bit PNG for the GLB.
import numpy as np, tempfile
imgdir = imgdir or tempfile.mkdtemp(prefix='lightmaps_')
for o in targets:
    img = bpy.data.images[o['lightmap']]
    path = os.path.join(imgdir, img.name + '.png')
    if not A.reuse:
        px = np.empty(len(img.pixels), dtype=np.float32); img.pixels.foreach_get(px)
        px = px.reshape(-1, 4); px[:, :3] *= A.scale; img.pixels.foreach_set(px.ravel())       # no clipping in 8 bits
        # an 8-bit sRGB PNG file, which the GLB embeds
        img.filepath_raw = path; img.file_format = 'PNG'; img.save()
    lm = bpy.data.images.load(path, check_existing=False); lm.colorspace_settings.name = 'sRGB'; lm.name = img.name + '_png'
    for s in o.material_slots:
        m = s.material
        if not m: continue
        nt = m.node_tree; t = nt.nodes.get('BAKE'); p = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if mat_kind(m) == 'diffuse' and p and t:
            t.image = lm
            nt.links.new(t.outputs['Color'], p.inputs['Emission Color']); p.inputs['Emission Strength'].default_value = 1.0
            m['baked'] = True
        elif t: nt.nodes.remove(t)

# 6. export: the machine and the cyclorama, modifiers applied, extras (part ids, 'baked' flags) kept
for o in bpy.data.objects: o.hide_render = False
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if (o.name.startswith('MNT') or o.name == 'studio.cyclorama') and o.type in ('MESH', 'EMPTY'): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(A.glb), export_format='GLB', use_selection=True, export_apply=True,
                          export_extras=True, export_yup=True, export_image_format='AUTO')
print('WROTE', A.glb)
