"""The hall for Blender stills of plant kits: the building of the Kaluga photos (docs/REFERENCES-TV-PLANT.md §2d).

Light epoxy floor with yellow and blue lane tape, a white roof on dark brown trusses, silver ducts, rows of linear lights and
white walls, plus a pale world. Stills only: never exported to the browser.

    import stage
    stage.hall(x0=-30, x1=44)        # after the kit is built
    stage.cam((x, y, z), (tx, ty, tz), lens=22)
"""
import math
import bpy
from mathutils import Vector
import dflib as L
from dflib import Part, assembly, principled

H = math.pi / 2


def hall(x0=-30, x1=44, y0=-25, y1=25, lanes=(-2.25, 2.25, 6.75, -6.75), lamp_rows=(-6.75, -4.5, -2.25, 0.0, 2.25, 4.5, 6.75, 9.0)):
    principled('floor_epoxy', '#C4C7CA', rough=0.28, noise_bump=0.15)
    principled('tape_yellow', '#E8C21A', rough=0.5)
    principled('tape_blue', '#2457C8', rough=0.5)
    principled('roof_white', '#E6E8EA', rough=0.7)
    principled('truss_brown', '#4E2C26', metal=0.3, rough=0.5)
    principled('duct_silver', '#B4B9BF', metal=1.0, rough=0.35)
    principled('lamp', '#FFFFFF', emission='#F4F7FF', strength=14.0)
    principled('wall_white', '#E4E6E8', rough=0.8)
    cx, w, cy, d = (x0 + x1) / 2, x1 - x0, (y0 + y1) / 2, y1 - y0
    assembly('HALL', 'building for stills')
    fl = Part('HALL.floor', 'floor', 'HALL', bevel=0)
    fl.box((w, d, 0.02), (cx, cy, -0.01), 'floor_epoxy')
    for y in lanes:
        fl.box((w, 0.08, 0.004), (cx, y, 0.002), 'tape_yellow'); fl.box((w, 0.05, 0.004), (cx, y + (0.25 if y > 0 else -0.25), 0.002), 'tape_blue')
    fl.build()
    rf = Part('HALL.roof', 'roof and trusses', 'HALL', bevel=0)
    rf.box((w, d, 0.1), (cx, cy, 8.2), 'roof_white')
    for x in range(int(x0), int(x1) + 1, 6):
        rf.box((0.25, d, 0.5), (x, cy, 7.6), 'truss_brown')
        for y in range(int(y0) + 1, int(y1), 2):
            rf.box((0.06, 0.06, 0.9), (x, y, 7.7), 'truss_brown', rot=(0.0, 0.6 if (y // 2) % 2 else -0.6, 0))
    for y in range(int(y0) + 1, int(y1), 3): rf.box((w, 0.12, 0.2), (cx, y, 8.0), 'truss_brown')
    for y in (-3.4, 1.2, 5.6): rf.cyl(0.3, w, (cx, y, 6.9), 'duct_silver', rot=(0, H, 0), seg=24)
    rf.build()
    lp = Part('HALL.lamps', 'linear lights', 'HALL', bevel=0)
    for y in lamp_rows:
        for x in range(int(x0) + 4, int(x1) - 3, 4):
            lp.box((3.4, 0.12, 0.04), (x, y, 6.2), 'lamp'); lp.box((3.4, 0.16, 0.06), (x, y, 6.25), 'duct_silver')
    lp.build()
    wl = Part('HALL.walls', 'walls', 'HALL', bevel=0)
    wl.box((0.3, d, 8.2), (x1, cy, 4.1), 'wall_white'); wl.box((w, 0.3, 8.2), (cx, y1, 4.1), 'wall_white')
    wl.build()
    wd = bpy.data.worlds.new('hall'); bpy.context.scene.world = wd; wd.use_nodes = True
    bg = wd.node_tree.nodes['Background']; bg.inputs['Color'].default_value = L.srgb('#D9DDE2'); bg.inputs['Strength'].default_value = 0.6


def cam(pos, look, lens=24, fstop=0):
    cd = bpy.data.cameras.new('camera'); cd.lens = lens; cd.sensor_width = 36
    if fstop: cd.dof.use_dof = True; cd.dof.aperture_fstop = fstop; cd.dof.focus_distance = (Vector(look) - Vector(pos)).length
    c = bpy.data.objects.new('camera', cd); L.COL().objects.link(c); c.location = pos
    c.rotation_euler = (Vector(look) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler(); bpy.context.scene.camera = c
    return c
