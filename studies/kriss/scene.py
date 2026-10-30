"""练习二 · 临摹 kriss.ai 的咨询室（design/STUDIES.md）。
只临摹做法：厚墙大圆角、弧形隔断、厚楼板的切边、上一层楼板压在画面顶部、长焦 3/4 机位、摄影棚式柔光、哑光黏土材质、一间一个色相。
资产全部自己做：这一版是灰盒壳加色块，家具是占位；之后家具换成 AI 出的模型。
    blender -b --python studies/kriss/scene.py -- --out tools/out/kriss_study --samples 64 --res 1280 800 [--gpu]
坐标：Blender Z 朝上，Y 朝房间后方（后墙 y = +D/2），X 朝右。单位米。
"""
import bpy, math, sys, os
from mathutils import Vector
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(n, d, cast=str): return cast(argv[argv.index(n) + 1]) if n in argv else d
OUT = arg("--out", "tools/out/kriss_study"); SAMPLES = arg("--samples", 64, int); GPU = "--gpu" in argv
RES = (arg("--w", 1280, int), arg("--h", 800, int)); TAG = arg("--tag", "01")
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); scene = bpy.context.scene

def mat(name, rgb, rough=0.9, metal=0.0, emit=None, es=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    if emit: b.inputs["Emission Color"].default_value = (*emit, 1); b.inputs["Emission Strength"].default_value = es
    return m
# kriss 咨询室的色相：薄荷绿地与墙，深绿家具，米白楼板，木色切边，粉色小点缀
M = dict(
    slab=mat("slab", (0.90, 0.88, 0.85)), slab_edge=mat("slab_edge", (0.82, 0.70, 0.56)),
    wall=mat("wall", (0.80, 0.88, 0.76)), floor=mat("floor", (0.64, 0.82, 0.62)),
    green=mat("green", (0.33, 0.62, 0.44)), green2=mat("green2", (0.11, 0.36, 0.27)), cream=mat("cream", (0.93, 0.90, 0.84)),
    white=mat("white", (0.95, 0.95, 0.93)), wood=mat("wood", (0.80, 0.66, 0.50)), pink=mat("pink", (0.90, 0.55, 0.62)),
    glass=mat("glass", (0.92, 0.95, 0.94), 0.3), lamp=mat("lamp", (0.95, 0.90, 0.60), 0.6, emit=(1.0, 0.9, 0.6), es=2.0),
    plant=mat("plant", (0.33, 0.52, 0.30)), pot=mat("pot", (0.85, 0.55, 0.45)), skin=mat("skin", (0.92, 0.78, 0.68)), cloth=mat("cloth", (0.78, 0.86, 0.92)),
)
def finish(ob, m, bevel, segs=4):
    ob.data.materials.append(m)
    if bevel: bv = ob.modifiers.new("bevel", "BEVEL"); bv.width = bevel; bv.segments = segs; bv.limit_method = "ANGLE"; bv.angle_limit = math.radians(40)
    for p in ob.data.polygons: p.use_smooth = True
    try: ob.data.use_auto_smooth = True; ob.data.auto_smooth_angle = math.radians(35)
    except AttributeError: pass
    return ob
def box(name, dims, loc, m, bevel=0.02, rot=(0, 0, 0), segs=4):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot); ob = bpy.context.object; ob.name = name; ob.scale = dims
    bpy.ops.object.transform_apply(scale=True); return finish(ob, m, bevel, segs)
def cyl(name, r, h, loc, m, rot=(0, 0, 0), r2=None, verts=48, bevel=0.01):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, rotation=rot, vertices=verts)
    else: bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=h, location=loc, rotation=rot, vertices=verts)
    ob = bpy.context.object; ob.name = name; return finish(ob, m, bevel)
def ball(name, r, loc, m, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=32, ring_count=16); ob = bpy.context.object; ob.name = name; ob.scale = scale
    bpy.ops.object.transform_apply(scale=True); return finish(ob, m, 0)

# ---------- 建筑：厚楼板、后墙、左侧弧形隔断、右侧楼梯、上一层楼板压顶 ----------
W, D, H = 4.6, 3.6, 2.7
box("floor_slab", (W + 0.6, D + 0.6, 0.35), (0, 0, -0.175), M["slab"], 0.12, segs=6)        # 厚楼板，大圆边
box("floor", (W, D, 0.02), (0, 0, 0.01), M["floor"], 0.0)                                  # 薄荷绿地面
box("wall_back", (W + 0.3, 0.3, H), (0, D / 2 + 0.15, H / 2), M["wall"], 0.08, segs=6)
box("ceiling_slab", (W + 1.4, D + 1.2, 0.4), (0.3, 0.0, H + 0.45), M["slab"], 0.14, segs=6)  # 上一层的楼板，厚、圆、压在画面顶上
box("ceiling_edge", (W + 1.4, 0.06, 0.4), (0.3, -D / 2 - 0.6 + 0.03, H + 0.45), M["slab_edge"], 0.0)  # 切边露木色
# 左侧弧形隔断：半个圆柱，白绿相间
cyl("partition", 0.9, H, (-W / 2 + 0.3, -0.2, H / 2), M["white"], verts=64, bevel=0.0)
for i, z in enumerate([0.5, 1.25, 2.0]): cyl(f"part_band{i}", 0.905, 0.42, (-W / 2 + 0.3, -0.2, z), M["green"], verts=64, bevel=0.0)
# 右侧：一段上楼的台阶（米白）
for i in range(7): box(f"stair{i}", (1.1, 0.3, 0.17 * (i + 1)), (W / 2 + 0.4, -D / 2 + 1.0 + i * 0.3, 0.085 * (i + 1)), M["cream"], 0.01)
box("stair_wall", (0.1, 2.3, 1.4), (W / 2 - 0.15, -D / 2 + 1.9, 0.7), M["cream"], 0.03)
# 墙上的灯箱（X 光片）
box("lightbox", (1.3, 0.08, 0.7), (0.3, D / 2 - 0.05, 1.9), M["white"], 0.04)
box("lightbox_glass", (1.18, 0.02, 0.58), (0.3, D / 2 - 0.1, 1.9), M["lamp"], 0.0)
# 顶部走廊的一截栏杆暗示上一层（画面顶部露一点）

# ---------- 家具占位：圆角桌、两把 U 形椅、弧形落地灯、隔断顶上的植物 ----------
box("desk", (1.6, 0.8, 0.12), (0.2, 0.2, 0.72), M["green"], 0.05, segs=6)
for sx in (-1, 1):
    cyl(f"desk_leg{sx}", 0.035, 0.70, (0.2 + sx * 0.7, 0.2, 0.35), M["white"], verts=24)
    cyl(f"desk_legb{sx}", 0.035, 0.6, (0.2 + sx * 0.7, 0.2, 0.05), M["white"], rot=(math.pi / 2, 0, 0), verts=24)
# 椅子：座 + 弯成 U 的靠背（用环的一半近似）
def chair(name, x, y, rot, m):
    cyl(f"{name}_seat", 0.26, 0.08, (x, y, 0.46), m, verts=48, bevel=0.03)
    bpy.ops.mesh.primitive_torus_add(location=(x, y, 0.66), major_radius=0.27, minor_radius=0.05, major_segments=64, minor_segments=16, rotation=(0, 0, rot))
    t = bpy.context.object; t.name = f"{name}_back"; finish(t, m, 0)
    # 把环的前半截削掉：用一个盒子做布尔差（留后半个 U）
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x + math.sin(rot) * 0.0 - math.sin(rot) * 0.2, y - math.cos(rot) * 0.2, 0.66), rotation=(0, 0, rot)); c = bpy.context.object; c.scale = (0.8, 0.4, 0.5); c.display_type = "WIRE"; c.hide_render = True
    bo = t.modifiers.new("cut", "BOOLEAN"); bo.operation = "DIFFERENCE"; bo.object = c
    # 靠背上立起来的环：再加一个竖环当椅背的弧
    bpy.ops.mesh.primitive_torus_add(location=(x - math.sin(rot) * 0.0 + math.sin(rot) * 0.22, y + math.cos(rot) * 0.22, 0.80), major_radius=0.26, minor_radius=0.05, major_segments=64, minor_segments=16, rotation=(math.pi / 2, 0, rot))
    t2 = bpy.context.object; t2.name = f"{name}_back2"; finish(t2, m, 0)
    cyl(f"{name}_post", 0.03, 0.42, (x, y, 0.21), M["white"], verts=24)
chair("chairA", -0.75, 0.55, 0.0, M["green2"]); chair("chairB", 1.15, -0.25, 0.6, M["green2"])
# 弧形落地灯：立杆 + 弯臂 + 圆灯罩
cyl("lamp_post", 0.025, 2.0, (1.45, 1.0, 1.0), M["wood"], verts=16)
bpy.ops.mesh.primitive_torus_add(location=(1.0, 1.0, 2.0), major_radius=0.45, minor_radius=0.025, major_segments=64, minor_segments=12, rotation=(math.pi / 2, 0, 0)); a = bpy.context.object; a.name = "lamp_arc"; finish(a, M["wood"], 0)
ball("lamp_head", 0.16, (0.55, 1.0, 1.85), M["lamp"], scale=(1, 1, 0.7))
# 植物：隔断顶上一盆
cyl("pot", 0.12, 0.2, (-W / 2 + 0.3, -0.2, H + 0.1 - 0.4 + 0.1), M["pot"], r2=0.15)
for k in range(9):
    ang = k / 9 * math.pi * 2; ball(f"leaf{k}", 0.16, (-W / 2 + 0.3 + math.cos(ang) * 0.18, -0.2 + math.sin(ang) * 0.18, H - 0.2 + (k % 3) * 0.06), M["plant"], scale=(1.2, 0.7, 0.25))
# 人物占位：两个坐姿剪影（圆头 + 胶囊身），让画面有"人"
def person(name, x, y, rot, cloth):
    ball(f"{name}_head", 0.11, (x, y, 1.22), M["skin"])
    bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=0.56, location=(x, y, 0.80), rotation=(0, 0, rot), vertices=32); b = bpy.context.object; b.name = f"{name}_body"; finish(b, cloth, 0.08, 6)
    for sx in (-1, 1):   # 手臂搭在桌上
        cyl(f"{name}_arm{sx}", 0.04, 0.42, (x + sx * 0.17 * math.cos(rot) - 0.2 * math.sin(rot), y + sx * 0.17 * math.sin(rot) + 0.2 * math.cos(rot), 0.86), cloth, rot=(math.pi / 2 - 0.15, 0, rot), verts=16)
        cyl(f"{name}_leg{sx}", 0.06, 0.45, (x + sx * 0.09 * math.cos(rot) - 0.25 * math.sin(rot), y + sx * 0.09 * math.sin(rot) + 0.25 * math.cos(rot), 0.5), M["cloth"] if name == "doctor" else M["skin"], rot=(math.pi / 2, 0, rot), verts=16)
person("doctor", -0.75, 0.55, 0, M["cloth"]); person("patient", 1.15, -0.25, 0.6, M["pink"])
M["skin"].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.93, 0.80, 0.70, 1)
# 桌上几件小东西
box("laptop", (0.3, 0.22, 0.015), (0.5, 0.25, 0.79), M["white"], 0.005); box("laptop_lid", (0.3, 0.01, 0.2), (0.5, 0.36, 0.89), M["white"], 0.005, rot=(-0.2, 0, 0))
cyl("cup", 0.04, 0.09, (0.95, 0.1, 0.83), M["lamp"]); box("note", (0.12, 0.08, 0.005), (-0.1, 0.05, 0.78), M["pink"], 0.0)

# ---------- 光：摄影棚式。一盏大面积柔光从前上方，天光偏暖，一盏弱逆光勾边；没有太阳 ----------
world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.90, 0.86, 0.86, 1); bg.inputs[1].default_value = 0.7   # 粉灰色的天，和 kriss 的背景同色相
def area(name, loc, target, size, energy, color=(1, 1, 1)):
    bpy.ops.object.light_add(type="AREA", location=loc); L = bpy.context.object; L.name = name; L.data.size = size; L.data.energy = energy; L.data.color = color
    L.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler(); return L
area("key", (-5, -9, 7), (0, 0, 1.2), 6, 3400, (1.0, 0.97, 0.94))
area("fill", (6, -7, 4), (0, 0, 1.0), 6, 900, (0.95, 0.97, 1.0))
area("rim", (2, 7, 4.5), (0, 0, 1.2), 4, 600, (1.0, 1.0, 1.0))

# ---------- 渲染与机位（按 kriss：长焦、三四分之一、略俯） ----------
scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"; scene.cycles.samples = SAMPLES; scene.cycles.use_adaptive_sampling = True
if GPU:
    try:
        p = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("OPTIX", "CUDA"):
            try: p.compute_device_type = kind
            except Exception: continue
            p.refresh_devices(); ok = False
            for d in p.devices: d.use = d.type in (kind, "CPU"); ok = ok or d.type == kind
            if ok: scene.cycles.device = "GPU"; print("GPU:", kind, flush=True); break
    except Exception as e: print("no gpu", e)
try: scene.cycles.use_denoising = True; scene.cycles.denoiser = "OPENIMAGEDENOISE"
except Exception: scene.cycles.use_denoising = False
scene.render.resolution_x, scene.render.resolution_y = RES; scene.render.resolution_percentage = 100; scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "AgX"; scene.view_settings.look = "AgX - Base Contrast"
cd = bpy.data.cameras.new("cam"); cd.sensor_fit = "VERTICAL"; cam = bpy.data.objects.new("cam", cd); scene.collection.objects.link(cam); scene.camera = cam
FOV = arg("--fov", 4.1, float); AZ = arg("--az", 24.0, float); EL = arg("--el", 12.0, float); FRAME_H = arg("--frame", 2.7, float)
T = Vector((0.2, 0.3, 1.05)); d = (FRAME_H / 2) / math.tan(math.radians(FOV) / 2)
az, el = math.radians(AZ), math.radians(EL)
cam.location = T + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * d
cam.rotation_euler = (T - cam.location).to_track_quat("-Z", "Y").to_euler(); cd.angle_y = math.radians(FOV); cd.clip_start = max(0.1, d - 20); cd.clip_end = d + 40
fn = os.path.join(OUT, f"consult_{TAG}.png"); scene.render.filepath = fn; bpy.ops.render.render(write_still=True)
print(f"已渲染 {fn} 视场角 {FOV} 距离 {d:.1f} m", flush=True)
