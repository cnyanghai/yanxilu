"""研习录版本 2 · 第 1 步：书房剖面的灰模静帧（构图稿）。

在 Blender 里无头跑：
    blender -b --python tools/blender/study_frames.py -- --out tools/out/frames --samples 48 --res 1280 800 --fovs 5 8 12

做什么：
- 用简单几何搭一间有厚度、有倒角的书房剖面（后墙 + 左墙带窗，地面是 30 厘米厚的楼板，没有前墙、右墙和屋顶），
  书墙、档案架、桌、灯、文竹、牌、砚、看板都是占位的灰模（书是"书块"，不逐本）；
- 院子：台基、三块待建的地基、石板小径；
- 光：晴窗，一盏太阳从左窗进来，加一点天光；Cycles 烘不烘都先这样看构图；
- 三个机位（院子 / 整间 / 案头）各按几档长焦渲染，机位离目标的距离按视场角反算，让画面里的东西一样大，只有透视收敛不同。
坐标：Blender 的 Z 朝上，Y 朝房间后方（后墙在 y = +2.5），X 朝右。单位米。
"""
import bpy, math, sys, os, random
from mathutils import Vector

# ---------- 参数 ----------
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default, n=1, cast=str):
    if name in argv:
        i = argv.index(name)
        vals = [cast(v) for v in argv[i + 1:i + 1 + n]]
        return vals if n > 1 else vals[0]
    return default
OUT = arg("--out", "tools/out/frames")
SAMPLES = arg("--samples", 48, cast=int)
RES = arg("--res", [1280, 800], n=2, cast=int)
FOVS = arg("--fovs", [5, 8, 12], n=3, cast=float)
SHOTS_WANTED = arg("--shots", "yard,room,desk").split(",")
os.makedirs(OUT, exist_ok=True)
random.seed(7)

# ---------- 清场 ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"

# ---------- 材质：灰模，只分几个明度；纸、木、墨、铜、石各一个 ----------
def mat(name, rgb, rough=0.85, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    return m
M = {
    "paper": mat("paper", (0.92, 0.89, 0.83)),        # 墙
    "floor": mat("floor", (0.70, 0.56, 0.41)),        # 浅木地板
    "wood":  mat("wood",  (0.52, 0.38, 0.26)),        # 家具木
    "wood2": mat("wood2", (0.36, 0.25, 0.16)),        # 深木（看板、桌沿）
    "book":  mat("book",  (0.55, 0.47, 0.42)),        # 书块
    "box":   mat("box",   (0.62, 0.52, 0.42)),        # 档案盒
    "kraft": mat("kraft", (0.75, 0.62, 0.42)),        # 档案袋
    "ink":   mat("ink",   (0.10, 0.08, 0.06), 0.5),   # 砚
    "brass": mat("brass", (0.78, 0.62, 0.36), 0.35, 0.9),
    "shade": mat("shade", (0.20, 0.36, 0.30), 0.6),
    "clay":  mat("clay",  (0.66, 0.40, 0.26)),
    "leaf":  mat("leaf",  (0.45, 0.62, 0.38)),
    "stem":  mat("stem",  (0.32, 0.48, 0.26)),
    "card":  mat("card",  (0.38, 0.20, 0.44)),
    "stone": mat("stone", (0.62, 0.60, 0.55)),
    "stone2":mat("stone2",(0.55, 0.53, 0.49)),
    "ground":mat("ground",(0.47, 0.45, 0.41)),
    "glass": mat("glass", (0.96, 0.95, 0.90), 0.2),
}

def finish(ob, m, bevel=0.015, smooth=True):
    ob.data.materials.append(m)
    if bevel:
        bv = ob.modifiers.new("bevel", "BEVEL"); bv.width = bevel; bv.segments = 3; bv.limit_method = "ANGLE"; bv.angle_limit = math.radians(40)
    if smooth:
        for p in ob.data.polygons: p.use_smooth = True
        ob.data.use_auto_smooth = True; ob.data.auto_smooth_angle = math.radians(35)
    return ob

def box(name, dims, loc, m, bevel=0.015, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.object; ob.name = name; ob.scale = dims
    bpy.ops.object.transform_apply(scale=True)
    return finish(ob, m, bevel)

def cyl(name, r, h, loc, m, rot=(0, 0, 0), r2=None, verts=32, bevel=0.004):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, rotation=rot, vertices=verts)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=h, location=loc, rotation=rot, vertices=verts)
    ob = bpy.context.object; ob.name = name
    return finish(ob, m, bevel)

def ball(name, r, loc, m, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=24, ring_count=12)
    ob = bpy.context.object; ob.name = name; ob.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(ob, m, 0)

# ---------- 建筑层：有厚度的剖面房 ----------
W, D, H, T = 6.4, 5.0, 3.1, 0.24
box("floor_slab", (W + T, D + T, 0.30), (-T / 2, T / 2, -0.15), M["floor"], 0.02)
box("plinth", (W + 1.0, D + 1.0, 0.12), (0, 0, -0.36), M["stone"], 0.02)
box("wall_back", (W + T, T, H), (-T / 2, D / 2 + T / 2, H / 2), M["paper"], 0.02)
# 左墙，留出窗洞（y 从 -0.2 到 1.0，z 从 1.1 到 2.4）
wy0, wy1, wz0, wz1 = -0.2, 1.0, 1.1, 2.4
lx = -W / 2 - T / 2
box("wall_left_a", (T, wy0 + D / 2, H), (lx, (-D / 2 + wy0) / 2, H / 2), M["paper"], 0.02)
box("wall_left_b", (T, D / 2 - wy1, H), (lx, (wy1 + D / 2) / 2, H / 2), M["paper"], 0.02)
box("wall_left_sill", (T, wy1 - wy0, wz0), (lx, (wy0 + wy1) / 2, wz0 / 2), M["paper"], 0.02)
box("wall_left_head", (T, wy1 - wy0, H - wz1), (lx, (wy0 + wy1) / 2, (wz1 + H) / 2), M["paper"], 0.02)
# 窗框与窗棂（木），玻璃一片
fx = lx
for nm, dims, loc in [("fr_t", (0.08, wy1 - wy0 + 0.12, 0.06), (fx, (wy0 + wy1) / 2, wz1 + 0.03)), ("fr_b", (0.08, wy1 - wy0 + 0.12, 0.06), (fx, (wy0 + wy1) / 2, wz0 - 0.03)),
                     ("fr_l", (0.08, 0.06, wz1 - wz0), (fx, wy0 - 0.03, (wz0 + wz1) / 2)), ("fr_r", (0.08, 0.06, wz1 - wz0), (fx, wy1 + 0.03, (wz0 + wz1) / 2)),
                     ("mull_v", (0.06, 0.03, wz1 - wz0), (fx, (wy0 + wy1) / 2, (wz0 + wz1) / 2)), ("mull_h", (0.06, wy1 - wy0, 0.03), (fx, (wy0 + wy1) / 2, (wz0 + wz1) / 2))]:
    box(nm, dims, loc, M["wood2"], 0.006)
box("glass", (0.01, wy1 - wy0, wz1 - wz0), (fx, (wy0 + wy1) / 2, (wz0 + wz1) / 2), M["glass"], 0)
bpy.context.object.data.materials[0].blend_method = "BLEND"
bpy.context.object.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = 0.15

# 踢脚线
box("skirt_back", (W, 0.03, 0.10), (0, D / 2 - 0.015, 0.05), M["wood2"], 0.004)
box("skirt_left", (0.03, D, 0.10), (-W / 2 + 0.015, 0, 0.05), M["wood2"], 0.004)

# ---------- 书墙 ----------
def shelf_unit(name, cx, width, depth, shelves, shelf_h, y0=0.18, m=M["wood"]):
    Hh = y0 + shelves * shelf_h + 0.04; yb = D / 2 - depth / 2
    box(f"{name}_back", (width, 0.02, Hh), (cx, D / 2 - 0.01, Hh / 2), M["wood2"], 0.004)
    box(f"{name}_l", (0.03, depth, Hh), (cx - width / 2 + 0.015, yb, Hh / 2), m, 0.006)
    box(f"{name}_r", (0.03, depth, Hh), (cx + width / 2 - 0.015, yb, Hh / 2), m, 0.006)
    box(f"{name}_top", (width, depth, 0.04), (cx, yb, Hh - 0.02), m, 0.006)
    for i in range(shelves + 1):
        box(f"{name}_s{i}", (width - 0.06, depth, 0.03), (cx, yb, y0 + i * shelf_h - 0.015), m, 0.004)
    return Hh
WALL = dict(cx=-1.75, w=2.5, depth=0.32, shelves=4, shelf_h=0.56)
shelf_unit("wall", WALL["cx"], WALL["w"], WALL["depth"], WALL["shelves"], WALL["shelf_h"])
# 书块：远景的书墙是一整条带厚度的块，近景才逐本。这里每层一条长短不一的块，加一摞平放的
for i in range(WALL["shelves"]):
    zb = 0.18 + i * WALL["shelf_h"]
    L = 1.1 + random.random() * 0.6
    x0 = WALL["cx"] - WALL["w"] / 2 + 0.06
    box(f"books_{i}", (L, 0.20, 0.24 + random.random() * 0.04), (x0 + L / 2, D / 2 - 0.19, zb + 0.13), M["book"], 0.006)
    # 书块上几道竖缝，让它像一排书：薄片
    for k in range(int(L / 0.09)):
        box(f"gap_{i}_{k}", (0.004, 0.21, 0.20 + random.random() * 0.03), (x0 + 0.05 + k * 0.09 + random.random() * 0.02, D / 2 - 0.19, zb + 0.11), M["wood2"], 0)
    box(f"flat_{i}", (0.17, 0.22, 0.07), (WALL["cx"] + WALL["w"] / 2 - 0.32, D / 2 - 0.20, zb + 0.035), M["book"], 0.006)

# ---------- 档案架：盒与袋 ----------
ARCH = dict(cx=1.95, w=2.1, depth=0.30, shelves=3, shelf_h=0.62)
shelf_unit("arch", ARCH["cx"], ARCH["w"], ARCH["depth"], ARCH["shelves"], ARCH["shelf_h"])
x = ARCH["cx"] - ARCH["w"] / 2 + 0.08; zb = 0.18 + 2 * ARCH["shelf_h"]
for i in range(7):
    box(f"abox_{i}", (0.085, 0.24, 0.30), (x + 0.0425, D / 2 - 0.16, zb + 0.15), M["box"], 0.005); x += 0.105
for i in range(2):
    box(f"bag_{i}", (0.045, 0.20, 0.30), (x + 0.0225, D / 2 - 0.16, zb + 0.15), M["kraft"], 0.005); x += 0.065
zb = 0.18 + 1 * ARCH["shelf_h"]; x = ARCH["cx"] - ARCH["w"] / 2 + 0.08
for i in range(3):
    box(f"abox2_{i}", (0.085, 0.24, 0.30), (x + 0.0425, D / 2 - 0.16, zb + 0.15), M["box"], 0.005); x += 0.105

# ---------- 看板 ----------
box("board", (1.6, 0.04, 0.34), (0.15, D / 2 - 0.03, 2.25), M["wood2"], 0.006)

# ---------- 桌 ----------
DX, DY, DW, DD, DH = 0.15, 1.45, 1.7, 0.72, 0.76
box("desk_top", (DW, DD, 0.05), (DX, DY, DH - 0.025), M["wood"], 0.01)
box("desk_apron", (DW, 0.03, 0.12), (DX, DY - DD / 2 + 0.015, DH - 0.11), M["wood2"], 0.004)
for sx in (-1, 1):
    for sy in (-1, 1):
        box(f"leg_{sx}_{sy}", (0.06, 0.06, DH - 0.05), (DX + sx * (DW / 2 - 0.08), DY + sy * (DD / 2 - 0.08), (DH - 0.05) / 2), M["wood2"], 0.004)

# ---------- 桌上：文竹（占位）、灯、牌、砚 ----------
px, py = DX - 0.55, DY - 0.05
cyl("pot", 0.1, 0.15, (px, py, DH + 0.075), M["clay"], r2=0.075 * 0 + 0.1, verts=32)  # 上宽下窄：用锥
bpy.data.objects["pot"].scale = (1, 1, 1)
cyl("pot_rim", 0.108, 0.03, (px, py, DH + 0.15), M["clay"])
for k in range(5):
    a = k / 5 * math.pi * 2 + 0.4
    hgt = 0.55 + random.random() * 0.15
    cyl(f"stem_{k}", 0.004, hgt, (px + math.cos(a) * 0.05, py + math.sin(a) * 0.05, DH + 0.16 + hgt / 2), M["stem"], rot=(math.sin(a) * 0.18, -math.cos(a) * 0.18, 0), verts=8, bevel=0)
    for t in range(3):
        z = DH + 0.16 + hgt * (0.45 + 0.25 * t)
        ball(f"leaf_{k}_{t}", 0.14 - t * 0.02, (px + math.cos(a) * (0.05 + 0.08 * (t + 1) * 0.5), py + math.sin(a) * (0.05 + 0.08 * (t + 1) * 0.5), z), M["leaf"], scale=(1.1, 1.1, 0.22))
lx_, ly_ = DX + 0.62, DY - 0.15
cyl("lamp_base", 0.09, 0.02, (lx_, ly_, DH + 0.01), M["brass"])
cyl("lamp_stem", 0.008, 0.46, (lx_, ly_, DH + 0.25), M["brass"], verts=12, bevel=0)
cyl("lamp_arm", 0.007, 0.34, (lx_ - 0.14, ly_, DH + 0.51), M["brass"], rot=(0, -1.0, 0), verts=12, bevel=0)
cyl("lamp_shade", 0.15, 0.13, (lx_ - 0.28, ly_, DH + 0.56), M["shade"], rot=(0, -0.25, 0), r2=0.02, verts=36, bevel=0)
box("card_stand", (0.10, 0.05, 0.03), (DX + 0.12, DY - 0.05, DH + 0.015), M["wood2"], 0.004)
box("card", (0.16, 0.004, 0.225), (DX + 0.12, DY + 0.0, DH + 0.11), M["card"], 0.002, rot=(0.28, 0, 0))
box("inkstone", (0.2, 0.13, 0.025), (DX - 0.55, DY + 0.18, DH + 0.0125), M["ink"], 0.004)
cyl("brush", 0.005, 0.24, (DX - 0.5, DY + 0.1, DH + 0.03), M["wood2"], rot=(0, math.pi / 2, 0.5), verts=8, bevel=0)

# ---------- 院子 ----------
bpy.ops.mesh.primitive_plane_add(size=160, location=(0, 0, -0.42)); g = bpy.context.object; g.name = "ground"; g.data.materials.append(M["ground"])
for nm, (x_, y_) in {"plot_flower": (-8.5, -1.0), "plot_pet": (8.5, -1.0), "plot_collect": (0, -9.0)}.items():
    box(nm, (4.2, 3.6, 0.10), (x_, y_, -0.37), M["stone2"], 0.02)
for i in range(6):
    box(f"path_{i}", (0.9, 0.6, 0.04), ((0.25 if i % 2 else -0.25), -D / 2 - 1.0 - i * 0.9, -0.40), M["stone"], 0.01)

# ---------- 光：晴窗 ----------
bpy.ops.object.light_add(type="SUN", location=(-8, -2, 7)); sun = bpy.context.object; sun.name = "sun"
sun.data.energy = 3.2; sun.data.angle = math.radians(1.8); sun.data.color = (1.0, 0.95, 0.86)
sun.rotation_euler = Vector((1.0, 0.45, -0.95)).to_track_quat("-Z", "Y").to_euler()  # 光从左前上方来，穿过左窗
world = bpy.data.worlds.new("world"); scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.93, 0.90, 0.84, 1); bg.inputs[1].default_value = 0.7
# 一盏柔和的补光，从前面右上方，压低墙角的死黑（院子里看进来要能看清里面）
bpy.ops.object.light_add(type="AREA", location=(5, -8, 6)); fill = bpy.context.object; fill.name = "fill"
fill.data.energy = 600; fill.data.size = 6; fill.data.color = (0.95, 0.97, 1.0)
fill.rotation_euler = (Vector((0, 0.6, 1.0)) - Vector((5, -8, 6))).to_track_quat("-Z", "Y").to_euler()

# ---------- 渲染设置 ----------
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"; scene.cycles.samples = SAMPLES
# 系统包的 Blender 没编进 OpenImageDenoise，也没有显卡；不降噪，靠采样数和自适应阈值
scene.cycles.use_denoising = False
scene.cycles.use_adaptive_sampling = True; scene.cycles.adaptive_threshold = 0.02; scene.cycles.max_bounces = 5
scene.cycles.diffuse_bounces = 3; scene.cycles.glossy_bounces = 2; scene.cycles.caustics_reflective = False; scene.cycles.caustics_refractive = False
scene.cycles.blur_glossy = 1.0; scene.cycles.sample_clamp_indirect = 4.0
scene.render.resolution_x, scene.render.resolution_y = RES; scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"; scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"; scene.view_settings.look = "AgX - Base Contrast"
scene.view_settings.exposure = 0.0

# ---------- 机位：目标点、画面高度、方位角、俯角；距离由视场角反算 ----------
SHOTS = {
    "yard": dict(target=(0.0, 0.4, 0.5), frame_h=15.0, az=35, el=32),
    "room": dict(target=(0.0, 0.5, 1.2), frame_h=4.3, az=35, el=24),
    "desk": dict(target=(0.15, 1.45, 0.95), frame_h=1.6, az=35, el=20),
}
cam_data = bpy.data.cameras.new("cam"); cam_data.sensor_fit = "VERTICAL"; cam_data.clip_start = 0.1; cam_data.clip_end = 2000
cam = bpy.data.objects.new("cam", cam_data); scene.collection.objects.link(cam); scene.camera = cam

def place(shot, fov):
    s = SHOTS[shot]; T_ = Vector(s["target"])
    d = (s["frame_h"] / 2) / math.tan(math.radians(fov) / 2)
    az, el = math.radians(s["az"]), math.radians(s["el"])
    dirv = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    cam.location = T_ + dirv * d
    cam.rotation_euler = (T_ - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.angle_y = math.radians(fov)
    cam_data.clip_start = max(0.1, d - s["frame_h"] * 6); cam_data.clip_end = d + s["frame_h"] * 12
    return d

for shot in SHOTS_WANTED:
    for fov in FOVS:
        d = place(shot, fov)
        fn = os.path.join(OUT, f"{shot}_fov{int(fov):02d}.png")
        scene.render.filepath = fn
        bpy.ops.render.render(write_still=True)
        print(f"已渲染 {fn}  视场角 {fov}° 距离 {d:.1f} m", flush=True)
print("全部完成", flush=True)
