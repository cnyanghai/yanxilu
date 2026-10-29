"""研习录版本 2 · 书房剖面的静帧（第 1 步构图稿 → 第 2 步色彩与材质板）。

在 Blender 里无头跑：
    blender -b --python tools/blender/study_frames.py -- --out tools/out/frames --samples 64 --res 1280 800 \
        --shots yard,room,desk --lights day,night,rain --fov yard=5,room=8,desk=12

做什么：
- 用简单几何搭一间有厚度、有倒角的书房剖面（后墙 + 左墙带窗，30 厘米厚的楼板，没有前墙、右墙和屋顶）；
  书墙（书块加竖缝，不逐本）、档案架（盒与袋）、桌、桌椅、读书椅、地毯、灯、文竹、牌、砚、看板；
- 院子：台基、三块待建地基、石板小径；
- 材质只有纸、木、墨、铜（石头只在院子里）；
- 三种光：晴窗（太阳从左窗进来）、夜读（桌灯是唯一光源，窗外一点月光）、雨天（青灰天光，灯开着）；
- 三个机位各自固定视场角（院子 5、整间 8、案头 12，2026-10-28 定），距离按视场角反算。
坐标：Blender 的 Z 朝上，Y 朝房间后方（后墙在 y = +D/2），X 朝右。单位米。
"""
import bpy, math, sys, os, random
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default, n=1, cast=str):
    if name in argv:
        i = argv.index(name); vals = [cast(v) for v in argv[i + 1:i + 1 + n]]
        return vals if n > 1 else vals[0]
    return default
OUT = arg("--out", "tools/out/frames")
SAMPLES = arg("--samples", 64, cast=int)
RES = arg("--res", [1280, 800], n=2, cast=int)
SHOTS_WANTED = arg("--shots", "yard,room,desk").split(",")
LIGHTS_WANTED = arg("--lights", "day,night,rain").split(",")
FOV = {"yard": 5.0, "room": 8.0, "desk": 12.0}
for kv in arg("--fov", "").split(","):
    if "=" in kv: k, v = kv.split("="); FOV[k] = float(v)
os.makedirs(OUT, exist_ok=True)
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- 材质：纸、木、墨、铜；石只在院子 ----------
def mat(name, rgb, rough=0.85, metal=0.0, emit=None, emit_strength=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    if emit is not None:
        b.inputs["Emission Color"].default_value = (*emit, 1); b.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1: b.inputs["Alpha"].default_value = alpha; m.blend_method = "BLEND"
    return m
M = {
    "paper":  mat("paper",  (0.92, 0.89, 0.83)),          # 墙面：纸白
    "paper2": mat("paper2", (0.86, 0.81, 0.70)),          # 地毯、椅面：麻纸
    "paper3": mat("paper3", (0.80, 0.74, 0.64)),          # 书块（书口是纸）
    "floor":  mat("floor",  (0.72, 0.58, 0.42)),          # 浅木地板
    "wood":   mat("wood",   (0.55, 0.40, 0.27)),          # 家具木
    "wood2":  mat("wood2",  (0.30, 0.20, 0.13)),          # 深木：踢脚、看板、桌沿、椅架
    "ink":    mat("ink",    (0.09, 0.07, 0.06), 0.55),    # 墨：砚、书缝
    "brass":  mat("brass",  (0.78, 0.62, 0.36), 0.35, 0.9),
    "shade":  mat("shade",  (0.17, 0.33, 0.28), 0.6),
    "clay":   mat("clay",   (0.62, 0.38, 0.25)),
    "leaf":   mat("leaf",   (0.40, 0.58, 0.34)),
    "stem":   mat("stem",   (0.30, 0.45, 0.25)),
    "card":   mat("card",   (0.36, 0.18, 0.42)),
    "kraft":  mat("kraft",  (0.73, 0.60, 0.40)),
    "stone":  mat("stone",  (0.62, 0.60, 0.55)),
    "stone2": mat("stone2", (0.55, 0.53, 0.49)),
    "ground": mat("ground", (0.47, 0.45, 0.41)),
    "glass":  mat("glass",  (0.96, 0.95, 0.90), 0.2, alpha=0.12),
    "bulb":   mat("bulb",   (1.0, 0.9, 0.7), 0.5, emit=(1.0, 0.82, 0.55), emit_strength=0.0),
    "moon":   mat("moon",   (0.9, 0.93, 1.0), 0.5, emit=(0.75, 0.82, 1.0), emit_strength=0.0),
}
# 领域底色（名色，调暗）给档案盒
DOMAIN = [mat("d_geo", (0.45, 0.18, 0.17)), mat("d_cfa", (0.17, 0.24, 0.40)), mat("d_firm", (0.12, 0.40, 0.39)), mat("d_cycle", (0.74, 0.38, 0.12)), mat("d_comm", (0.34, 0.28, 0.46))]

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
    ob = bpy.context.object; ob.name = name; ob.scale = dims; bpy.ops.object.transform_apply(scale=True)
    return finish(ob, m, bevel)
def cyl(name, r, h, loc, m, rot=(0, 0, 0), r2=None, verts=32, bevel=0.004):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, rotation=rot, vertices=verts)
    else: bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=h, location=loc, rotation=rot, vertices=verts)
    ob = bpy.context.object; ob.name = name; return finish(ob, m, bevel)
def ball(name, r, loc, m, scale=(1, 1, 1), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, rotation=rot, segments=24, ring_count=12)
    ob = bpy.context.object; ob.name = name; ob.scale = scale; bpy.ops.object.transform_apply(scale=True)
    return finish(ob, m, 0)

# ---------- 建筑层 ----------
W, D, H, T = 5.2, 4.2, 3.0, 0.24
box("floor_slab", (W + T, D + T, 0.30), (-T / 2, T / 2, -0.15), M["floor"], 0.02)
box("plinth", (W + 1.0, D + 1.0, 0.12), (0, 0, -0.36), M["stone"], 0.02)
box("wall_back", (W + T, T, H), (-T / 2, D / 2 + T / 2, H / 2), M["paper"], 0.02)
wy0, wy1, wz0, wz1 = 0.0, 1.2, 1.0, 2.3          # 窗洞：左墙中后段
lx = -W / 2 - T / 2
box("wall_left_a", (T, wy0 + D / 2, H), (lx, (-D / 2 + wy0) / 2, H / 2), M["paper"], 0.02)
box("wall_left_b", (T, D / 2 - wy1, H), (lx, (wy1 + D / 2) / 2, H / 2), M["paper"], 0.02)
box("wall_left_sill", (T, wy1 - wy0, wz0), (lx, (wy0 + wy1) / 2, wz0 / 2), M["paper"], 0.02)
box("wall_left_head", (T, wy1 - wy0, H - wz1), (lx, (wy0 + wy1) / 2, (wz1 + H) / 2), M["paper"], 0.02)
for nm, dims, loc in [("fr_t", (0.08, wy1 - wy0 + 0.12, 0.06), (lx, (wy0 + wy1) / 2, wz1 + 0.03)), ("fr_b", (0.10, wy1 - wy0 + 0.16, 0.05), (lx, (wy0 + wy1) / 2, wz0 - 0.025)),
                     ("fr_l", (0.08, 0.06, wz1 - wz0), (lx, wy0 - 0.03, (wz0 + wz1) / 2)), ("fr_r", (0.08, 0.06, wz1 - wz0), (lx, wy1 + 0.03, (wz0 + wz1) / 2)),
                     ("mull_v", (0.06, 0.03, wz1 - wz0), (lx, (wy0 + wy1) / 2, (wz0 + wz1) / 2)), ("mull_h", (0.06, wy1 - wy0, 0.03), (lx, (wy0 + wy1) / 2, (wz0 + wz1) / 2))]:
    box(nm, dims, loc, M["wood2"], 0.006)
box("glass", (0.01, wy1 - wy0, wz1 - wz0), (lx, (wy0 + wy1) / 2, (wz0 + wz1) / 2), M["glass"], 0)
# 窗外一块发光板：夜里当月光、雨天当天光（晴窗时关掉）
box("moon_pane", (0.02, wy1 - wy0 + 0.6, wz1 - wz0 + 0.6), (lx - 0.6, (wy0 + wy1) / 2, (wz0 + wz1) / 2), M["moon"], 0)
box("skirt_back", (W, 0.03, 0.10), (0, D / 2 - 0.015, 0.05), M["wood2"], 0.004)
box("skirt_left", (0.03, D, 0.10), (-W / 2 + 0.015, 0, 0.05), M["wood2"], 0.004)

# ---------- 书墙与档案架 ----------
def shelf_unit(name, cx, width, depth, shelves, shelf_h, y0=0.18, m=M["wood"]):
    Hh = y0 + shelves * shelf_h + 0.04; yb = D / 2 - depth / 2
    box(f"{name}_back", (width, 0.02, Hh), (cx, D / 2 - 0.01, Hh / 2), M["wood2"], 0.004)
    box(f"{name}_l", (0.03, depth, Hh), (cx - width / 2 + 0.015, yb, Hh / 2), m, 0.006)
    box(f"{name}_r", (0.03, depth, Hh), (cx + width / 2 - 0.015, yb, Hh / 2), m, 0.006)
    box(f"{name}_top", (width, depth, 0.04), (cx, yb, Hh - 0.02), m, 0.006)
    for i in range(shelves + 1): box(f"{name}_s{i}", (width - 0.06, depth, 0.03), (cx, yb, y0 + i * shelf_h - 0.015), m, 0.004)
WALL = dict(cx=-1.3, w=2.2, depth=0.32, shelves=4, shelf_h=0.56)
shelf_unit("wall", **{k: v for k, v in zip(["cx", "width", "depth", "shelves", "shelf_h"], [WALL["cx"], WALL["w"], WALL["depth"], WALL["shelves"], WALL["shelf_h"]])})
for i in range(WALL["shelves"]):
    zb = 0.18 + i * WALL["shelf_h"]; L = 1.0 + random.random() * 0.6; x0 = WALL["cx"] - WALL["w"] / 2 + 0.06
    box(f"books_{i}", (L, 0.20, 0.24 + random.random() * 0.04), (x0 + L / 2, D / 2 - 0.19, zb + 0.13), M["paper3"], 0.006)
    for k in range(int(L / 0.075)):
        box(f"gap_{i}_{k}", (0.004, 0.21, 0.19 + random.random() * 0.04), (x0 + 0.04 + k * 0.075 + random.random() * 0.02, D / 2 - 0.19, zb + 0.11), M["ink"], 0)
    box(f"flat_{i}", (0.17, 0.22, 0.07), (WALL["cx"] + WALL["w"] / 2 - 0.30, D / 2 - 0.20, zb + 0.035), M["paper3"], 0.006)
ARCH = dict(cx=1.55, w=1.8, depth=0.30, shelves=3, shelf_h=0.62)
shelf_unit("arch", ARCH["cx"], ARCH["w"], ARCH["depth"], ARCH["shelves"], ARCH["shelf_h"])
x = ARCH["cx"] - ARCH["w"] / 2 + 0.08; zb = 0.18 + 2 * ARCH["shelf_h"]
for i in range(7):
    box(f"abox_{i}", (0.085, 0.24, 0.30), (x + 0.0425, D / 2 - 0.16, zb + 0.15), DOMAIN[i % 5], 0.005)
    box(f"alab_{i}", (0.06, 0.004, 0.17), (x + 0.0425, D / 2 - 0.283, zb + 0.19), M["paper"], 0.0); x += 0.105
for i in range(2): box(f"bag_{i}", (0.045, 0.20, 0.30), (x + 0.0225, D / 2 - 0.16, zb + 0.15), M["kraft"], 0.005); x += 0.065
zb = 0.18 + ARCH["shelf_h"]; x = ARCH["cx"] - ARCH["w"] / 2 + 0.08
for i in range(3):
    box(f"abox2_{i}", (0.085, 0.24, 0.30), (x + 0.0425, D / 2 - 0.16, zb + 0.15), DOMAIN[(i + 2) % 5], 0.005)
    box(f"alab2_{i}", (0.06, 0.004, 0.17), (x + 0.0425, D / 2 - 0.283, zb + 0.19), M["paper"], 0.0); x += 0.105

# ---------- 看板、桌、桌椅、读书椅、地毯 ----------
box("board", (1.4, 0.04, 0.32), (0.1, D / 2 - 0.03, 2.2), M["wood2"], 0.006)
DX, DY, DW, DD, DH = 0.1, 0.75, 1.6, 0.70, 0.76
box("rug", (3.4, 2.6, 0.012), (-0.3, 0.0, 0.006), M["paper2"], 0.004)
box("rug_border", (3.4, 2.6, 0.008), (-0.3, 0.0, 0.004), M["wood2"], 0.0)
box("desk_top", (DW, DD, 0.05), (DX, DY, DH - 0.025), M["wood"], 0.01)
box("desk_apron", (DW, 0.03, 0.12), (DX, DY - DD / 2 + 0.015, DH - 0.11), M["wood2"], 0.004)
for sx in (-1, 1):
    for sy in (-1, 1): box(f"leg_{sx}_{sy}", (0.06, 0.06, DH - 0.05), (DX + sx * (DW / 2 - 0.08), DY + sy * (DD / 2 - 0.08), (DH - 0.05) / 2), M["wood2"], 0.004)
# 桌椅：在桌后，面朝前
CY = DY + DD / 2 + 0.35
box("chair_seat", (0.46, 0.46, 0.05), (DX, CY, 0.45), M["paper2"], 0.01)
box("chair_back", (0.46, 0.04, 0.5), (DX, CY + 0.21, 0.72), M["wood2"], 0.008)
for sx in (-1, 1):
    for sy in (-1, 1): box(f"cleg_{sx}_{sy}", (0.04, 0.04, 0.43), (DX + sx * 0.2, CY + sy * 0.2, 0.215), M["wood2"], 0.003)
# 读书椅：窗边一把矮扶手椅，斜对着窗
AX, AY, AR = -1.55, -0.85, math.radians(40)
def rot_xy(x_, y_, cx, cy, a): dx, dy = x_ - cx, y_ - cy; return (cx + dx * math.cos(a) - dy * math.sin(a), cy + dx * math.sin(a) + dy * math.cos(a))
for nm, dims, off, z, m in [("arm_seat", (0.62, 0.62, 0.14), (0, 0), 0.36, M["paper2"]), ("arm_back", (0.62, 0.12, 0.42), (0, 0.25), 0.64, M["paper2"]),
                            ("arm_l", (0.10, 0.62, 0.22), (-0.26, 0), 0.54, M["wood2"]), ("arm_r", (0.10, 0.62, 0.22), (0.26, 0), 0.54, M["wood2"]), ("arm_base", (0.58, 0.58, 0.28), (0, 0), 0.15, M["wood2"])]:
    px_, py_ = rot_xy(AX + off[0], AY + off[1], AX, AY, AR); box(nm, dims, (px_, py_, z), m, 0.02, rot=(0, 0, AR))

# ---------- 桌上：文竹、灯、牌、砚、笔 ----------
px, py = DX - 0.52, DY - 0.02
cyl("pot", 0.075, 0.15, (px, py, DH + 0.075), M["clay"], r2=0.10, verts=32)
cyl("pot_rim", 0.108, 0.03, (px, py, DH + 0.15), M["clay"])
for k in range(5):
    a = k / 5 * math.pi * 2 + 0.4; hgt = 0.55 + random.random() * 0.15
    cyl(f"stem_{k}", 0.0035, hgt, (px + math.cos(a) * 0.05, py + math.sin(a) * 0.05, DH + 0.16 + hgt / 2), M["stem"], rot=(math.sin(a) * 0.22, -math.cos(a) * 0.22, 0), verts=8, bevel=0)
    for t in range(4):
        u = 0.4 + 0.2 * t; z = DH + 0.16 + hgt * u; rr = 0.05 + 0.1 * u
        # 每节一簇扁平的羽叶：三片窄长的薄片，像文竹的层
        for j in range(3):
            ang = a + (j - 1) * 0.7 + random.random() * 0.3
            ball(f"frond_{k}_{t}_{j}", 0.07 - t * 0.008, (px + math.cos(a) * rr + math.cos(ang) * 0.06, py + math.sin(a) * rr + math.sin(ang) * 0.06, z), M["leaf"], scale=(1.6, 0.55, 0.12), rot=(0, 0.12, ang))
lx_, ly_ = DX + 0.58, DY - 0.12
cyl("lamp_base", 0.09, 0.02, (lx_, ly_, DH + 0.01), M["brass"])
cyl("lamp_stem", 0.008, 0.46, (lx_, ly_, DH + 0.25), M["brass"], verts=12, bevel=0)
cyl("lamp_arm", 0.007, 0.34, (lx_ - 0.14, ly_, DH + 0.51), M["brass"], rot=(0, -1.0, 0), verts=12, bevel=0)
cyl("lamp_shade", 0.15, 0.13, (lx_ - 0.28, ly_, DH + 0.56), M["shade"], rot=(0, -0.25, 0), r2=0.02, verts=36, bevel=0)
ball("bulb", 0.03, (lx_ - 0.28, ly_, DH + 0.53), M["bulb"])
box("card_stand", (0.10, 0.05, 0.03), (DX + 0.1, DY - 0.05, DH + 0.015), M["wood2"], 0.004)
box("card", (0.16, 0.004, 0.225), (DX + 0.1, DY + 0.0, DH + 0.11), M["card"], 0.002, rot=(0.28, 0, 0))
box("card_label", (0.05, 0.003, 0.17), (DX + 0.055, DY - 0.0045, DH + 0.125), M["paper"], 0.0, rot=(0.28, 0, 0))
box("inkstone", (0.2, 0.13, 0.025), (DX - 0.52, DY + 0.2, DH + 0.0125), M["ink"], 0.004)
cyl("brush", 0.005, 0.24, (DX - 0.47, DY + 0.12, DH + 0.03), M["wood2"], rot=(0, math.pi / 2, 0.5), verts=8, bevel=0)

# ---------- 院子 ----------
bpy.ops.mesh.primitive_plane_add(size=160, location=(0, 0, -0.42)); g = bpy.context.object; g.name = "ground"; g.data.materials.append(M["ground"])
for nm, (x_, y_) in {"plot_flower": (-7.5, -0.8), "plot_pet": (7.5, -0.8), "plot_collect": (0, -8.0)}.items(): box(nm, (4.0, 3.4, 0.10), (x_, y_, -0.37), M["stone2"], 0.02)
for i in range(6): box(f"path_{i}", (0.9, 0.6, 0.04), ((0.25 if i % 2 else -0.25), -D / 2 - 0.9 - i * 0.9, -0.40), M["stone"], 0.01)

# ---------- 光 ----------
bpy.ops.object.light_add(type="SUN", location=(-8, -2, 7)); sun = bpy.context.object; sun.name = "sun"
sun.rotation_euler = Vector((1.0, 0.35, -0.95)).to_track_quat("-Z", "Y").to_euler()
bpy.ops.object.light_add(type="AREA", location=(5, -8, 6)); fill = bpy.context.object; fill.name = "fill"; fill.data.size = 6
fill.rotation_euler = (Vector((0, 0.6, 1.0)) - Vector((5, -8, 6))).to_track_quat("-Z", "Y").to_euler()
bpy.ops.object.light_add(type="POINT", location=(lx_ - 0.28, ly_, DH + 0.50)); lamp = bpy.context.object; lamp.name = "lamp_light"; lamp.data.shadow_soft_size = 0.04
world = bpy.data.worlds.new("world"); scene.world = world; world.use_nodes = True; bg = world.node_tree.nodes["Background"]

LIGHTS = {
    "day":   dict(sun=3.2, sun_col=(1.0, 0.95, 0.86), sun_angle=1.8, world=(0.93, 0.90, 0.84), world_s=0.7, fill=600, fill_col=(0.95, 0.97, 1.0), lamp=0, bulb=0, moon=0, exposure=0.0),
    "night": dict(sun=0.0, sun_col=(1, 1, 1), sun_angle=1.8, world=(0.05, 0.045, 0.04), world_s=0.4, fill=40, fill_col=(0.6, 0.7, 1.0), lamp=22, bulb=12, moon=0.6, exposure=0.3),
    "rain":  dict(sun=0.5, sun_col=(0.78, 0.84, 0.92), sun_angle=9.0, world=(0.56, 0.60, 0.65), world_s=0.6, fill=250, fill_col=(0.85, 0.9, 1.0), lamp=12, bulb=6, moon=1.2, exposure=0.0),
}
def set_light(name):
    L_ = LIGHTS[name]
    sun.data.energy = L_["sun"]; sun.data.color = L_["sun_col"]; sun.data.angle = math.radians(L_["sun_angle"])
    bg.inputs[0].default_value = (*L_["world"], 1); bg.inputs[1].default_value = L_["world_s"]
    fill.data.energy = L_["fill"]; fill.data.color = L_["fill_col"]
    lamp.data.energy = L_["lamp"]; lamp.data.color = (1.0, 0.84, 0.58)
    M["bulb"].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = L_["bulb"]
    M["moon"].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = L_["moon"]
    scene.view_settings.exposure = L_["exposure"]

# ---------- 渲染设置 ----------
scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"; scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = False   # 系统包的 Blender 没有降噪器；靠采样数
scene.cycles.use_adaptive_sampling = True; scene.cycles.adaptive_threshold = 0.02; scene.cycles.max_bounces = 5
scene.cycles.diffuse_bounces = 3; scene.cycles.glossy_bounces = 2; scene.cycles.caustics_reflective = False; scene.cycles.caustics_refractive = False
scene.cycles.blur_glossy = 1.0; scene.cycles.sample_clamp_indirect = 4.0
scene.render.resolution_x, scene.render.resolution_y = RES; scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"; scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"; scene.view_settings.look = "AgX - Base Contrast"

# ---------- 机位 ----------
SHOTS = {
    "yard": dict(target=(0.0, 0.3, 0.4), frame_h=13.0, az=35, el=32),
    "room": dict(target=(-0.1, 0.3, 1.15), frame_h=3.9, az=35, el=24),
    "desk": dict(target=(DX, DY, 0.95), frame_h=1.6, az=35, el=20),
}
cam_data = bpy.data.cameras.new("cam"); cam_data.sensor_fit = "VERTICAL"
cam = bpy.data.objects.new("cam", cam_data); scene.collection.objects.link(cam); scene.camera = cam
def place(shot, fov):
    s = SHOTS[shot]; T_ = Vector(s["target"]); d = (s["frame_h"] / 2) / math.tan(math.radians(fov) / 2)
    az, el = math.radians(s["az"]), math.radians(s["el"])
    cam.location = T_ + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * d
    cam.rotation_euler = (T_ - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.angle_y = math.radians(fov); cam_data.clip_start = max(0.1, d - s["frame_h"] * 6); cam_data.clip_end = d + s["frame_h"] * 12
    return d

for light in LIGHTS_WANTED:
    set_light(light)
    for shot in SHOTS_WANTED:
        d = place(shot, FOV[shot])
        fn = os.path.join(OUT, f"{shot}_{light}.png"); scene.render.filepath = fn
        bpy.ops.render.render(write_still=True)
        print(f"已渲染 {fn}  视场角 {FOV[shot]}° 距离 {d:.1f} m", flush=True)
print("全部完成", flush=True)
