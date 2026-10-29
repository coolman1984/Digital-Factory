# Mounter B, a 6-second product move rendered by Godot 4 (Forward+): studio sky for reflections, soft key shadows,
# SDFGI + SSIL bounce light, SSAO contact shadows, screen-space reflections, a little fog for depth.
# The model is the Blender export (tools/blender/mounter.py --lod web --glb), loaded at run time (no import step).
extends Node3D

const FRAMES := 180          # 6 s at 30 fps (Movie Maker runs on a fixed clock)
const PRE := 30              # 1 s warm-up on the first pose so GI and TAA settle; encode from frame PRE
var frame := 0
var cam: Camera3D
var gantry: Node3D
var head: Node3D
var spindles: Node3D
var nozzles: Node3D
var g0 := Vector3.ZERO
var h0 := Vector3.ZERO
var s0 := Vector3.ZERO
var n0 := Vector3.ZERO
# the machine studio's pick-and-place cycle (assets/js/inspect/inspect.js CYCLE): [t, gantry z, head x, nozzle dip].
# The head is a child of the gantry in the model, so it gets only its own x travel on top of the gantry's move.
const CYCLE := [[0, 0, 0, 0], [0.25, 0, 0, 1], [0.45, 0, 0, 0], [1.25, 0.73, -0.32, 0], [1.45, 0.73, -0.32, 1], [1.65, 0.73, -0.32, 0], [2.15, 0.52, 0.44, 0], [2.35, 0.52, 0.44, 0], [2.95, 0, 0.06, 0], [3.15, 0, 0.06, 1], [3.35, 0, 0.06, 0], [3.9, 0, 0, 0]]
var only := -1               # --frame N in the user args renders one frame (look tests)
var exposure := 1.0
var card := false
var fill_energy := 0.6
var rng := Vector2i(-1, -1)  # --range=a,b renders reel frames a..b-1 only (after its own warm-up), for parallel slices

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	for a in args:
		if a.begins_with("--frame="): only = int(a.split("=")[1])
		if a.begins_with("--range="): rng = Vector2i(int(a.split("=")[1].split(",")[0]), int(a.split("=")[1].split(",")[1]))
	# speed knobs (docs/RENDER_QUALITY_AUDIT.md E5): internal resolution with FSR 2 temporal upscaling, MSAA on/off
	var vp := get_viewport()
	for a in args:
		if a.begins_with("--fsr="): vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR2; vp.scaling_3d_scale = float(a.split("=")[1]); vp.use_taa = false
		if a == "--no-msaa": vp.msaa_3d = Viewport.MSAA_DISABLED
		if a.begins_with("--exposure="): exposure = float(a.split("=")[1])
		if a == "--card": card = true
		if a.begins_with("--fill="): fill_energy = float(a.split("=")[1])
	_environment()
	_studio()
	_model()
	if card:
		var c := MeshInstance3D.new(); var cm := QuadMesh.new(); cm.size = Vector2(0.25, 0.25); c.mesh = cm
		var mm := StandardMaterial3D.new(); mm.albedo_color = Color(0.18, 0.18, 0.18); mm.roughness = 1.0; mm.metallic_specular = 0.2
		c.material_override = mm; add_child(c); c.look_at_from_position(Vector3(0.75, 1.15, 0.9), Vector3(1.6, 1.4, 2.6), Vector3.UP); c.rotate_object_local(Vector3.UP, PI)
	cam = Camera3D.new(); cam.fov = 30.0; cam.near = 0.05; cam.far = 80.0; add_child(cam)
	_pose(0.0 if only < 0 else float(only) / FRAMES)

func _environment() -> void:
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.85, 0.87, 0.90); sky_mat.sky_horizon_color = Color(0.36, 0.38, 0.41)
	sky_mat.ground_horizon_color = Color(0.16, 0.17, 0.18); sky_mat.ground_bottom_color = Color(0.05, 0.05, 0.06)
	sky_mat.sky_curve = 0.25
	sky_mat.sun_angle_max = 0.0; sky_mat.energy_multiplier = 1.0
	var sky := Sky.new(); sky.sky_material = sky_mat
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR; env.background_color = Color(0.40, 0.42, 0.45)
	env.sky = sky; env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY; env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_AGX; env.tonemap_exposure = exposure
	env.ssao_enabled = true; env.ssao_radius = 0.6; env.ssao_intensity = 1.6; env.ssao_detail = 0.8
	env.ssil_enabled = true; env.ssil_radius = 1.5; env.ssil_intensity = 0.8
	env.sdfgi_enabled = OS.get_cmdline_user_args().has("--sdfgi"); env.sdfgi_use_occlusion = true; env.sdfgi_min_cell_size = 0.05; env.sdfgi_energy = 0.9
	env.ssr_enabled = true; env.ssr_max_steps = 96; env.ssr_fade_in = 0.1; env.ssr_fade_out = 2.0
	env.glow_enabled = true; env.glow_intensity = 0.25; env.glow_bloom = 0.0; env.glow_hdr_threshold = 1.6
	env.volumetric_fog_enabled = false; env.volumetric_fog_density = 0.0; env.volumetric_fog_albedo = Color(0.9, 0.92, 0.95)
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)

func _panel(size: Vector2, pos: Vector3, look: Vector3, energy: float, tint := Color(1, 1, 1)) -> void:
	# an emissive softbox: it lights the scene through SDFGI and, above all, gives metal something to reflect
	var q := MeshInstance3D.new(); var qm := QuadMesh.new(); qm.size = size; q.mesh = qm
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = tint * energy; m.emission_enabled = true; m.emission = tint; m.emission_energy_multiplier = energy
	m.cull_mode = BaseMaterial3D.CULL_DISABLED; q.material_override = m; q.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(q); q.look_at_from_position(pos, look, Vector3.UP)

func _studio() -> void:
	# a seamless floor that bends up into a back wall (the cyclorama of the Blender studio)
	var floor := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(40, 40); floor.mesh = pm
	var fm := StandardMaterial3D.new(); fm.albedo_color = Color(0.42, 0.44, 0.47); fm.roughness = 0.38; fm.metallic = 0.0
	floor.material_override = fm; add_child(floor)
	var wall := MeshInstance3D.new(); var wm := PlaneMesh.new(); wm.size = Vector2(40, 14); wall.mesh = wm
	wall.material_override = fm; wall.rotation_degrees = Vector3(90, 0, 0); wall.position = Vector3(0, 7, -9); add_child(wall)
	# key: a soft sun from front-left above, the shaping light; rim and fill as in the Blender rig
	var key := DirectionalLight3D.new(); key.light_energy = 2.2; key.light_color = Color(1.0, 0.97, 0.93)
	key.shadow_enabled = true; key.light_angular_distance = 3.0; key.directional_shadow_max_distance = 14.0
	add_child(key); key.look_at_from_position(Vector3(-3.2, 3.6, 3.6), Vector3(0, 0.9, 0), Vector3.UP)
	var rim := SpotLight3D.new(); rim.light_energy = 18.0; rim.spot_range = 12.0; rim.spot_angle = 38.0; rim.light_color = Color(0.85, 0.92, 1.0)
	rim.shadow_enabled = true; add_child(rim); rim.look_at_from_position(Vector3(-2.8, 3.0, -3.4), Vector3(0, 1.0, 0), Vector3.UP)
	var fill := OmniLight3D.new(); fill.light_energy = fill_energy; fill.omni_range = 9.0; fill.light_color = Color(0.9, 0.95, 1.0); fill.light_specular = 0.0   # a fill without glare: it lifts the shadow side but makes no reflection on the hood glass
	fill.position = Vector3(4.2, 1.8, 3.0); add_child(fill)
	_panel(Vector2(3.2, 1.2), Vector3(0.6, 4.4, 1.2), Vector3(0, 0.9, 0), 3.0)

func _model() -> void:
	var doc := GLTFDocument.new(); var st := GLTFState.new()
	var err := doc.append_from_file(ProjectSettings.globalize_path("res://mounter.glb"), st)
	if err != OK: push_error("glTF load failed: %s" % err); return
	var root: Node3D = doc.generate_scene(st); add_child(root)
	gantry = root.find_child("*gantry*", true, false) as Node3D
	head = root.find_child("*head*", true, false) as Node3D
	spindles = root.find_child("*spindles*", true, false) as Node3D
	nozzles = root.find_child("*nozzles*", true, false) as Node3D
	if gantry: g0 = gantry.position
	if head: h0 = head.position
	if spindles: s0 = spindles.position
	if nozzles: n0 = nozzles.position
	print("moving parts: ", gantry.name if gantry else "-", " ", head.name if head else "-", " ", spindles.name if spindles else "-", " ", nozzles.name if nozzles else "-")
	_fix_materials(root)
	var probe := ReflectionProbe.new(); probe.size = Vector3(7, 4, 7); probe.position = Vector3(0, 1.4, 0)
	probe.box_projection = true; probe.interior = false; probe.update_mode = ReflectionProbe.UPDATE_ONCE; probe.intensity = 1.0
	add_child(probe)

func _fix_materials(n: Node) -> void:
	# Godot does not read KHR_materials_transmission: the hood panes come in opaque, so make them clear sheets
	if n is MeshInstance3D:
		var mi := n as MeshInstance3D
		for i in mi.mesh.get_surface_count():
			var m := mi.get_active_material(i)
			if m is StandardMaterial3D and m.resource_name.begins_with("glass"):
				var g := (m as StandardMaterial3D).duplicate() as StandardMaterial3D
				g.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; g.albedo_color = Color(0.92, 0.95, 0.97, 0.03)
				g.roughness = 0.02; g.metallic = 0.0; g.metallic_specular = 0.05
				mi.set_surface_override_material(i, g); mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	for c in n.get_children(): _fix_materials(c)

func _pose(u: float) -> void:
	# camera: from the three-quarter hero view to the placement head, an eased push with a slight orbit
	var e := u * u * (3.0 - 2.0 * u)
	var p0 := Vector3(3.45, 2.45, 4.35); var p1 := Vector3(1.35, 1.62, 2.05)
	var l0 := Vector3(0.0, 0.95, 0.05); var l1 := Vector3(-0.08, 1.06, 0.0)
	var a := deg_to_rad(8.0) * e
	var p := p0.lerp(p1, e).rotated(Vector3.UP, -a)
	cam.look_at_from_position(p, l0.lerp(l1, e), Vector3.UP)
	var c := _cycle(u * 6.0)
	if gantry: gantry.position = g0 + Vector3(0, 0, c.x)
	if head: head.position = h0 + Vector3(c.y, 0, 0)
	if spindles: spindles.position = s0 - Vector3(0, 0.012 * c.z, 0)
	if nozzles: nozzles.position = n0 - Vector3(0, 0.012 * c.z, 0)

func _cycle(t: float) -> Vector3:
	t = fmod(t, CYCLE[CYCLE.size() - 1][0])
	for i in CYCLE.size() - 1:
		var a: Array = CYCLE[i]; var b: Array = CYCLE[i + 1]
		if t <= b[0]:
			var k := clampf((t - a[0]) / (b[0] - a[0]), 0.0, 1.0); k = k * k * (3.0 - 2.0 * k)
			return Vector3(lerpf(a[1], b[1], k), lerpf(a[2], b[2], k), lerpf(a[3], b[3], k))
	return Vector3.ZERO

func _process(_delta: float) -> void:
	if only >= 0:
		frame += 1
		if frame > 40: get_tree().quit()      # let SDFGI and TAA settle on the still frame
		return
	var f := frame - PRE
	if rng.x >= 0: f = rng.x + max(0, frame - PRE)          # a slice warms up on its own first pose
	_pose(max(0.0, float(f) / FRAMES))
	frame += 1
	if (rng.x >= 0 and frame > PRE + (rng.y - rng.x)) or frame > PRE + FRAMES: get_tree().quit()
