"""研习录版本 2 · 书房场景的搭建（bpy 共用模块）。
被 study_frames.py（渲静帧）和 bake_study.py（烘焙导出）共用。只负责把东西搭出来、分好组、设好光和机位。

分组（决定谁被烘焙导出、谁留给 three.js 程序化生成）：
- shell：楼板、台基、墙、窗框、踢脚、看板、地毯、院子的地基与小径 —— 烘焙，导出
- furn：书墙、档案架、桌、桌椅、读书椅、灯的五金、花盆、砚、笔、牌座 —— 烘焙，导出
- items：书块、档案盒、袋、牌、文竹 —— 数据驱动，three.js 里程序化；烘焙时隐藏，不导出
- bakeonly：玻璃、灯泡、窗外的月光板、地面 —— 只参与烘焙（发光 / 遮挡），不导出
坐标：Blender 的 Z 朝上，Y 朝房间后方（后墙在 y = +D/2），X 朝右。单位米。
three.js 里：x = x，y = z，z = -y。
"""
import bpy, math, random
from mathutils import Vector

W, D, H, T = 5.2, 4.2, 3.0, 0.24
WIN = dict(y0=0.0, y1=1.2, z0=1.0, z1=2.3)
WALL = dict(cx=-1.3, w=2.2, depth=0.32, shelves=4, shelf_h=0.56, y0=0.18)
ARCH = dict(cx=1.55, w=1.8, depth=0.30, shelves=3, shelf_h=0.62, y0=0.18)
DESK = dict(x=0.1, y=0.75, w=1.6, d=0.70, h=0.76)
PLANT = dict(x=DESK["x"] - 0.52, y=DESK["y"] - 0.02)
LAMP = dict(x=DESK["x"] + 0.58, y=DESK["y"] - 0.12)
CARD = dict(x=DESK["x"] + 0.1, y=DESK["y"] + 0.0)
PLOTS = {"flower": (-7.5, -0.8), "pet": (7.5, -0.8), "collect": (0, -8.0)}
SHOTS = {
    "yard": dict(target=(0.0, 0.3, 0.4), frame_h=13.0, az=35, el=32, fov=5.0),
    "room": dict(target=(-0.1, 0.3, 1.15), frame_h=3.9, az=35, el=24, fov=8.0),
    "wall": dict(target=(WALL["cx"], D / 2 - 0.3, 1.3), frame_h=3.0, az=25, el=14, fov=10.0),
    "archive": dict(target=(ARCH["cx"], D / 2 - 0.3, 1.15), frame_h=2.6, az=35, el=14, fov=10.0),
    "desk": dict(target=(DESK["x"], DESK["y"], 0.95), frame_h=1.6, az=35, el=20, fov=12.0),
    "plant": dict(target=(PLANT["x"], PLANT["y"], 1.15), frame_h=0.9, az=30, el=14, fov=12.0),
    "card": dict(target=(CARD["x"], CARD["y"], 0.88), frame_h=0.42, az=20, el=18, fov=12.0),
    "lamp": dict(target=(LAMP["x"] - 0.15, LAMP["y"], 1.2), frame_h=0.8, az=40, el=16, fov=12.0),
}
# 光：能量都按"烘焙不过曝"调低了一档（three.js 那边用曝光补回来）；渲静帧时乘 bake_scale 的倒数
LIGHTS = {
    "day":   dict(sun=3.2, sun_col=(1.0, 0.95, 0.86), sun_angle=1.8, world=(0.93, 0.90, 0.84), world_s=0.7, fill=600, fill_col=(0.95, 0.97, 1.0), lamp=0, bulb=0, moon=0, exposure=0.0),
    "night": dict(sun=0.0, sun_col=(1, 1, 1), sun_angle=1.8, world=(0.05, 0.045, 0.04), world_s=0.4, fill=40, fill_col=(0.6, 0.7, 1.0), lamp=22, bulb=12, moon=0.6, exposure=0.3),
    "rain":  dict(sun=0.5, sun_col=(0.78, 0.84, 0.92), sun_angle=9.0, world=(0.56, 0.60, 0.65), world_s=0.6, fill=250, fill_col=(0.85, 0.9, 1.0), lamp=12, bulb=6, moon=1.2, exposure=0.0),
}

G = {"shell": [], "furn": [], "items": [], "bakeonly": []}
M = {}

def mat(name, rgb, rough=0.85, metal=0.0, emit=None, emit_strength=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    if emit is not None: b.inputs["Emission Color"].default_value = (*emit, 1); b.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1: b.inputs["Alpha"].default_value = alpha; m.blend_method = "BLEND"
    return m

def finish(ob, m, bevel, group, smooth=True):
    ob.data.materials.append(m)
    if bevel:
        bv = ob.modifiers.new("bevel", "BEVEL"); bv.width = bevel; bv.segments = 3; bv.limit_method = "ANGLE"; bv.angle_limit = math.radians(40)
    if smooth:
        for p in ob.data.polygons: p.use_smooth = True
        try: ob.data.use_auto_smooth = True; ob.data.auto_smooth_angle = math.radians(35)   # 4.1 起没有这个属性
        except AttributeError: pass
    G[group].append(ob); return ob
def box(name, dims, loc, m, group, bevel=0.015, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.object; ob.name = name; ob.scale = dims; bpy.ops.object.transform_apply(scale=True)
    return finish(ob, m, bevel, group)
def cyl(name, r, h, loc, m, group, rot=(0, 0, 0), r2=None, verts=32, bevel=0.004):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, rotation=rot, vertices=verts)
    else: bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=h, location=loc, rotation=rot, vertices=verts)
    ob = bpy.context.object; ob.name = name; return finish(ob, m, bevel, group)
def ball(name, r, loc, m, group, scale=(1, 1, 1), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, rotation=rot, segments=24, ring_count=12)
    ob = bpy.context.object; ob.name = name; ob.scale = scale; bpy.ops.object.transform_apply(scale=True)
    return finish(ob, m, 0, group)

def build(with_items=True):
    """搭整个场景。返回分组字典。"""
    random.seed(7)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for k in G: G[k].clear()
    M.update({
        "paper": mat("paper", (0.92, 0.89, 0.83)), "paper2": mat("paper2", (0.86, 0.81, 0.70)), "paper3": mat("paper3", (0.80, 0.74, 0.64)),
        "floor": mat("floor", (0.72, 0.58, 0.42)), "wood": mat("wood", (0.55, 0.40, 0.27)), "wood2": mat("wood2", (0.30, 0.20, 0.13)),
        "ink": mat("ink", (0.09, 0.07, 0.06), 0.55), "brass": mat("brass", (0.78, 0.62, 0.36), 0.35, 0.9), "shade": mat("shade", (0.17, 0.33, 0.28), 0.6),
        "clay": mat("clay", (0.62, 0.38, 0.25)), "leaf": mat("leaf", (0.40, 0.58, 0.34)), "stem": mat("stem", (0.30, 0.45, 0.25)), "card": mat("card", (0.36, 0.18, 0.42)),
        "kraft": mat("kraft", (0.73, 0.60, 0.40)), "stone": mat("stone", (0.62, 0.60, 0.55)), "stone2": mat("stone2", (0.55, 0.53, 0.49)), "ground": mat("ground", (0.47, 0.45, 0.41)),
        "glass": mat("glass", (0.96, 0.95, 0.90), 0.2, alpha=0.12), "bulb": mat("bulb", (1.0, 0.9, 0.7), 0.5, emit=(1.0, 0.82, 0.55)), "moon": mat("moon", (0.9, 0.93, 1.0), 0.5, emit=(0.75, 0.82, 1.0)),
    })
    DOMAIN = [mat("d_geo", (0.45, 0.18, 0.17)), mat("d_cfa", (0.17, 0.24, 0.40)), mat("d_firm", (0.12, 0.40, 0.39)), mat("d_cycle", (0.74, 0.38, 0.12)), mat("d_comm", (0.34, 0.28, 0.46))]

    # 建筑层
    box("floor_slab", (W + T, D + T, 0.30), (-T / 2, T / 2, -0.15), M["floor"], "shell", 0.02)
    box("plinth", (W + 1.0, D + 1.0, 0.12), (0, 0, -0.36), M["stone"], "shell", 0.02)
    box("wall_back", (W + T, T, H), (-T / 2, D / 2 + T / 2, H / 2), M["paper"], "shell", 0.02)
    wy0, wy1, wz0, wz1 = WIN["y0"], WIN["y1"], WIN["z0"], WIN["z1"]; lx = -W / 2 - T / 2
    box("wall_left_a", (T, wy0 + D / 2, H), (lx, (-D / 2 + wy0) / 2, H / 2), M["paper"], "shell", 0.02)
    box("wall_left_b", (T, D / 2 - wy1, H), (lx, (wy1 + D / 2) / 2, H / 2), M["paper"], "shell", 0.02)
    box("wall_left_sill", (T, wy1 - wy0, wz0), (lx, (wy0 + wy1) / 2, wz0 / 2), M["paper"], "shell", 0.02)
    box("wall_left_head", (T, wy1 - wy0, H - wz1), (lx, (wy0 + wy1) / 2, (wz1 + H) / 2), M["paper"], "shell", 0.02)
    for nm, dims, loc in [("fr_t", (0.08, wy1 - wy0 + 0.12, 0.06), (lx, (wy0 + wy1) / 2, wz1 + 0.03)), ("fr_b", (0.10, wy1 - wy0 + 0.16, 0.05), (lx, (wy0 + wy1) / 2, wz0 - 0.025)),
                         ("fr_l", (0.08, 0.06, wz1 - wz0), (lx, wy0 - 0.03, (wz0 + wz1) / 2)), ("fr_r", (0.08, 0.06, wz1 - wz0), (lx, wy1 + 0.03, (wz0 + wz1) / 2)),
                         ("mull_v", (0.06, 0.03, wz1 - wz0), (lx, (wy0 + wy1) / 2, (wz0 + wz1) / 2)), ("mull_h", (0.06, wy1 - wy0, 0.03), (lx, (wy0 + wy1) / 2, (wz0 + wz1) / 2))]:
        box(nm, dims, loc, M["wood2"], "shell", 0.006)
    box("glass", (0.01, wy1 - wy0, wz1 - wz0), (lx, (wy0 + wy1) / 2, (wz0 + wz1) / 2), M["glass"], "bakeonly", 0)
    box("moon_pane", (0.02, wy1 - wy0 + 0.6, wz1 - wz0 + 0.6), (lx - 0.6, (wy0 + wy1) / 2, (wz0 + wz1) / 2), M["moon"], "bakeonly", 0)
    box("skirt_back", (W, 0.03, 0.10), (0, D / 2 - 0.015, 0.05), M["wood2"], "shell", 0.004)
    box("skirt_left", (0.03, D, 0.10), (-W / 2 + 0.015, 0, 0.05), M["wood2"], "shell", 0.004)
    box("board", (1.4, 0.04, 0.32), (0.1, D / 2 - 0.03, 2.2), M["wood2"], "shell", 0.006)
    box("rug", (3.4, 2.6, 0.012), (-0.3, 0.0, 0.006), M["paper2"], "shell", 0.004)
    box("rug_border", (3.4, 2.6, 0.008), (-0.3, 0.0, 0.004), M["wood2"], "shell", 0.0)

    # 书墙与档案架
    def shelf_unit(name, S):
        cx, width, depth, shelves, shelf_h, y0 = S["cx"], S["w"], S["depth"], S["shelves"], S["shelf_h"], S["y0"]
        Hh = y0 + shelves * shelf_h + 0.04; yb = D / 2 - depth / 2
        box(f"{name}_back", (width, 0.02, Hh), (cx, D / 2 - 0.01, Hh / 2), M["wood2"], "furn", 0.004)
        box(f"{name}_l", (0.03, depth, Hh), (cx - width / 2 + 0.015, yb, Hh / 2), M["wood"], "furn", 0.006)
        box(f"{name}_r", (0.03, depth, Hh), (cx + width / 2 - 0.015, yb, Hh / 2), M["wood"], "furn", 0.006)
        box(f"{name}_top", (width, depth, 0.04), (cx, yb, Hh - 0.02), M["wood"], "furn", 0.006)
        for i in range(shelves + 1): box(f"{name}_s{i}", (width - 0.06, depth, 0.03), (cx, yb, y0 + i * shelf_h - 0.015), M["wood"], "furn", 0.004)
    shelf_unit("wall", WALL); shelf_unit("arch", ARCH)
    if with_items:
        for i in range(WALL["shelves"]):
            zb = WALL["y0"] + i * WALL["shelf_h"]; L = 1.0 + random.random() * 0.6; x0 = WALL["cx"] - WALL["w"] / 2 + 0.06
            box(f"books_{i}", (L, 0.20, 0.24 + random.random() * 0.04), (x0 + L / 2, D / 2 - 0.19, zb + 0.13), M["paper3"], "items", 0.006)
            for k in range(int(L / 0.075)):
                box(f"gap_{i}_{k}", (0.004, 0.21, 0.19 + random.random() * 0.04), (x0 + 0.04 + k * 0.075 + random.random() * 0.02, D / 2 - 0.19, zb + 0.11), M["ink"], "items", 0)
            box(f"flat_{i}", (0.17, 0.22, 0.07), (WALL["cx"] + WALL["w"] / 2 - 0.30, D / 2 - 0.20, zb + 0.035), M["paper3"], "items", 0.006)
        x = ARCH["cx"] - ARCH["w"] / 2 + 0.08; zb = ARCH["y0"] + 2 * ARCH["shelf_h"]
        for i in range(7):
            box(f"abox_{i}", (0.085, 0.24, 0.30), (x + 0.0425, D / 2 - 0.16, zb + 0.15), DOMAIN[i % 5], "items", 0.005)
            box(f"alab_{i}", (0.06, 0.004, 0.17), (x + 0.0425, D / 2 - 0.283, zb + 0.19), M["paper"], "items", 0.0); x += 0.105
        for i in range(2): box(f"bag_{i}", (0.045, 0.20, 0.30), (x + 0.0225, D / 2 - 0.16, zb + 0.15), M["kraft"], "items", 0.005); x += 0.065
        zb = ARCH["y0"] + ARCH["shelf_h"]; x = ARCH["cx"] - ARCH["w"] / 2 + 0.08
        for i in range(3):
            box(f"abox2_{i}", (0.085, 0.24, 0.30), (x + 0.0425, D / 2 - 0.16, zb + 0.15), DOMAIN[(i + 2) % 5], "items", 0.005)
            box(f"alab2_{i}", (0.06, 0.004, 0.17), (x + 0.0425, D / 2 - 0.283, zb + 0.19), M["paper"], "items", 0.0); x += 0.105

    # 桌、桌椅、读书椅
    DX, DY, DW, DD, DH = DESK["x"], DESK["y"], DESK["w"], DESK["d"], DESK["h"]
    box("desk_top", (DW, DD, 0.05), (DX, DY, DH - 0.025), M["wood"], "furn", 0.01)
    box("desk_apron", (DW, 0.03, 0.12), (DX, DY - DD / 2 + 0.015, DH - 0.11), M["wood2"], "furn", 0.004)
    for sx in (-1, 1):
        for sy in (-1, 1): box(f"leg_{sx}_{sy}", (0.06, 0.06, DH - 0.05), (DX + sx * (DW / 2 - 0.08), DY + sy * (DD / 2 - 0.08), (DH - 0.05) / 2), M["wood2"], "furn", 0.004)
    CY = DY + DD / 2 + 0.35
    box("chair_seat", (0.46, 0.46, 0.05), (DX, CY, 0.45), M["paper2"], "furn", 0.01)
    box("chair_back", (0.46, 0.04, 0.5), (DX, CY + 0.21, 0.72), M["wood2"], "furn", 0.008)
    for sx in (-1, 1):
        for sy in (-1, 1): box(f"cleg_{sx}_{sy}", (0.04, 0.04, 0.43), (DX + sx * 0.2, CY + sy * 0.2, 0.215), M["wood2"], "furn", 0.003)
    AX, AY, AR = -1.55, -0.85, math.radians(40)
    def rot_xy(x_, y_, cx, cy, a): dx, dy = x_ - cx, y_ - cy; return (cx + dx * math.cos(a) - dy * math.sin(a), cy + dx * math.sin(a) + dy * math.cos(a))
    for nm, dims, off, z, m in [("arm_seat", (0.62, 0.62, 0.14), (0, 0), 0.36, M["paper2"]), ("arm_back", (0.62, 0.12, 0.42), (0, 0.25), 0.64, M["paper2"]),
                                ("arm_l", (0.10, 0.62, 0.22), (-0.26, 0), 0.54, M["wood2"]), ("arm_r", (0.10, 0.62, 0.22), (0.26, 0), 0.54, M["wood2"]), ("arm_base", (0.58, 0.58, 0.28), (0, 0), 0.15, M["wood2"])]:
        px_, py_ = rot_xy(AX + off[0], AY + off[1], AX, AY, AR); box(nm, dims, (px_, py_, z), m, "furn", 0.02, rot=(0, 0, AR))

    # 桌上
    px, py = PLANT["x"], PLANT["y"]
    cyl("pot", 0.075, 0.15, (px, py, DH + 0.075), M["clay"], "furn", r2=0.10, verts=32)
    cyl("pot_rim", 0.108, 0.03, (px, py, DH + 0.15), M["clay"], "furn")
    if with_items:
        for k in range(5):
            a = k / 5 * math.pi * 2 + 0.4; hgt = 0.55 + random.random() * 0.15
            cyl(f"stem_{k}", 0.0035, hgt, (px + math.cos(a) * 0.05, py + math.sin(a) * 0.05, DH + 0.16 + hgt / 2), M["stem"], "items", rot=(math.sin(a) * 0.22, -math.cos(a) * 0.22, 0), verts=8, bevel=0)
            for t in range(4):
                u = 0.4 + 0.2 * t; z = DH + 0.16 + hgt * u; rr = 0.05 + 0.1 * u
                for j in range(3):
                    ang = a + (j - 1) * 0.7 + random.random() * 0.3
                    ball(f"frond_{k}_{t}_{j}", 0.07 - t * 0.008, (px + math.cos(a) * rr + math.cos(ang) * 0.06, py + math.sin(a) * rr + math.sin(ang) * 0.06, z), M["leaf"], "items", scale=(1.6, 0.55, 0.12), rot=(0, 0.12, ang))
    lx_, ly_ = LAMP["x"], LAMP["y"]
    cyl("lamp_base", 0.09, 0.02, (lx_, ly_, DH + 0.01), M["brass"], "furn")
    cyl("lamp_stem", 0.008, 0.46, (lx_, ly_, DH + 0.25), M["brass"], "furn", verts=12, bevel=0)
    cyl("lamp_arm", 0.007, 0.34, (lx_ - 0.14, ly_, DH + 0.51), M["brass"], "furn", rot=(0, -1.0, 0), verts=12, bevel=0)
    cyl("lamp_shade", 0.15, 0.13, (lx_ - 0.28, ly_, DH + 0.56), M["shade"], "furn", rot=(0, -0.25, 0), r2=0.02, verts=36, bevel=0)
    ball("bulb", 0.03, (lx_ - 0.28, ly_, DH + 0.53), M["bulb"], "bakeonly")
    box("card_stand", (0.10, 0.05, 0.03), (CARD["x"], CARD["y"] - 0.05, DH + 0.015), M["wood2"], "furn", 0.004)
    if with_items:
        box("card", (0.16, 0.004, 0.225), (CARD["x"], CARD["y"], DH + 0.11), M["card"], "items", 0.002, rot=(0.28, 0, 0))
        box("card_label", (0.05, 0.003, 0.17), (CARD["x"] - 0.045, CARD["y"] - 0.0045, DH + 0.125), M["paper"], "items", 0.0, rot=(0.28, 0, 0))
    box("inkstone", (0.2, 0.13, 0.025), (DX - 0.52, DY + 0.2, DH + 0.0125), M["ink"], "furn", 0.004)
    cyl("brush", 0.005, 0.24, (DX - 0.47, DY + 0.12, DH + 0.03), M["wood2"], "furn", rot=(0, math.pi / 2, 0.5), verts=8, bevel=0)

    # 院子
    bpy.ops.mesh.primitive_plane_add(size=160, location=(0, 0, -0.42)); g = bpy.context.object; g.name = "ground"; g.data.materials.append(M["ground"]); G["bakeonly"].append(g)
    for nm, (x_, y_) in PLOTS.items(): box(f"plot_{nm}", (4.0, 3.4, 0.10), (x_, y_, -0.37), M["stone2"], "shell", 0.02)
    for i in range(6): box(f"path_{i}", (0.9, 0.6, 0.04), ((0.25 if i % 2 else -0.25), -D / 2 - 0.9 - i * 0.9, -0.40), M["stone"], "shell", 0.01)

    # 光
    scene = bpy.context.scene
    bpy.ops.object.light_add(type="SUN", location=(-8, -2, 7)); sun = bpy.context.object; sun.name = "sun"
    sun.rotation_euler = Vector((1.0, 0.35, -0.95)).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.light_add(type="AREA", location=(5, -8, 6)); fill = bpy.context.object; fill.name = "fill"; fill.data.size = 6
    fill.rotation_euler = (Vector((0, 0.6, 1.0)) - Vector((5, -8, 6))).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.light_add(type="POINT", location=(lx_ - 0.28, ly_, DH + 0.50)); lamp = bpy.context.object; lamp.name = "lamp_light"; lamp.data.shadow_soft_size = 0.04
    world = bpy.data.worlds.new("world"); scene.world = world; world.use_nodes = True
    G["_lights"] = dict(sun=sun, fill=fill, lamp=lamp, bg=world.node_tree.nodes["Background"])
    return G

def set_light(name, scale=1.0):
    """三种光之一。scale 用来整体压低能量（烘焙到 8 位贴图不许过曝）。"""
    L_ = LIGHTS[name]; l = G["_lights"]; scene = bpy.context.scene
    l["sun"].data.energy = L_["sun"] * scale; l["sun"].data.color = L_["sun_col"]; l["sun"].data.angle = math.radians(L_["sun_angle"])
    l["bg"].inputs[0].default_value = (*L_["world"], 1); l["bg"].inputs[1].default_value = L_["world_s"] * scale
    l["fill"].data.energy = L_["fill"] * scale; l["fill"].data.color = L_["fill_col"]
    l["lamp"].data.energy = L_["lamp"] * scale; l["lamp"].data.color = (1.0, 0.84, 0.58)
    M["bulb"].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = L_["bulb"] * scale
    M["moon"].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = L_["moon"] * scale
    scene.view_settings.exposure = L_["exposure"]

def cycles(samples, gpu=False):
    """Cycles 设置。gpu=True 时找 OptiX / CUDA 设备（Windows 侧的 Blender 4.5 能看到显卡；WSL 里的 4.0 看不到）。"""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"; scene.cycles.samples = samples
    if gpu:
        try:
            p = bpy.context.preferences.addons["cycles"].preferences
            for kind in ("OPTIX", "CUDA"):
                try: p.compute_device_type = kind
                except Exception: continue
                p.refresh_devices()
                found = False
                for d in p.devices:
                    d.use = d.type == kind or d.type == "CPU"; found = found or d.type == kind
                if found: scene.cycles.device = "GPU"; print(f"用显卡烘焙：{kind}", flush=True); break
        except Exception as e: print("显卡不可用，用 CPU：", e, flush=True)
    scene.cycles.use_denoising = False; scene.cycles.use_adaptive_sampling = True; scene.cycles.adaptive_threshold = 0.02; scene.cycles.max_bounces = 5
    scene.cycles.diffuse_bounces = 3; scene.cycles.glossy_bounces = 2; scene.cycles.caustics_reflective = False; scene.cycles.caustics_refractive = False
    scene.cycles.blur_glossy = 1.0; scene.cycles.sample_clamp_indirect = 4.0
    scene.view_settings.view_transform = "AgX"; scene.view_settings.look = "AgX - Base Contrast"

def camera():
    scene = bpy.context.scene
    cd = bpy.data.cameras.new("cam"); cd.sensor_fit = "VERTICAL"
    cam = bpy.data.objects.new("cam", cd); scene.collection.objects.link(cam); scene.camera = cam
    return cam

def shot_pose(shot, fov=None):
    """机位：位置、看向、视场角、距离。距离按视场角反算，让画面里的东西一样大。"""
    s = SHOTS[shot]; fov = fov or s["fov"]; T_ = Vector(s["target"]); d = (s["frame_h"] / 2) / math.tan(math.radians(fov) / 2)
    az, el = math.radians(s["az"]), math.radians(s["el"])
    pos = T_ + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * d
    return pos, T_, fov, d

def place(cam, shot, fov=None):
    pos, T_, fov, d = shot_pose(shot, fov); s = SHOTS[shot]
    cam.location = pos; cam.rotation_euler = (T_ - pos).to_track_quat("-Z", "Y").to_euler()
    cam.data.angle_y = math.radians(fov); cam.data.clip_start = max(0.1, d - s["frame_h"] * 6); cam.data.clip_end = d + s["frame_h"] * 12
    return d

def to_three(v):
    """Blender (x, y, z) → three.js (x, z, -y)"""
    return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]

def config():
    """给 world.js 的配置：机位、槽位、尺寸。全部 three.js 坐标。"""
    shots = {}
    for k in SHOTS:
        pos, T_, fov, d = shot_pose(k)
        shots[k] = dict(pos=to_three(pos), at=to_three(T_), fov=fov, dist=round(d, 3), frame_h=SHOTS[k]["frame_h"])
    return dict(
        room=dict(w=W, d=D, h=H, t=T, back_z=round(-D / 2, 3), left_x=round(-W / 2, 3)),
        window=dict(x=round(-W / 2, 3), z0=round(-WIN["y1"], 3), z1=round(-WIN["y0"], 3), y0=WIN["z0"], y1=WIN["z1"]),
        wall=dict(cx=WALL["cx"], w=WALL["w"], depth=WALL["depth"], shelves=WALL["shelves"], shelf_h=WALL["shelf_h"], y0=WALL["y0"], back_z=round(-D / 2, 3)),
        archive=dict(cx=ARCH["cx"], w=ARCH["w"], depth=ARCH["depth"], shelves=ARCH["shelves"], shelf_h=ARCH["shelf_h"], y0=ARCH["y0"], back_z=round(-D / 2, 3)),
        desk=dict(x=DESK["x"], z=round(-DESK["y"], 3), w=DESK["w"], d=DESK["d"], h=DESK["h"]),
        plant=dict(x=PLANT["x"], z=round(-PLANT["y"], 3), y=DESK["h"] + 0.16),
        lamp=dict(x=LAMP["x"], z=round(-LAMP["y"], 3), bulb=to_three((LAMP["x"] - 0.28, LAMP["y"], DESK["h"] + 0.53))),
        card=dict(x=CARD["x"], z=round(-CARD["y"], 3), y=DESK["h"] + 0.11),
        plots={k: to_three((v[0], v[1], -0.32)) for k, v in PLOTS.items()},
        shots=shots, lights=list(LIGHTS.keys()),
    )
