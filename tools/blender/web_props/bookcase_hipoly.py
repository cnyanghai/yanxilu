# 书柜 · 阶段 2 高模（专业流程）：线脚用真实截面沿路径扫掠，凹槽用带缺口的截面拉伸，齿与珠按弧阵列，全部倒角。
# 尺寸沿用阶段 1 定稿（docs/bookcase-production.md）。雕花（柱头嵌板、涡卷）先放占位块，走图生三维另做。
# 灰模材质，便于看形；材质在阶段 3。渲：正视全图 + 三处近景 + 线框视口截图。
import bpy, bmesh, math
from mathutils import Vector

WI = 2.30; UP_T = 0.05; PIL_W = 0.315; PIL_D = 0.12; DEPTH = 0.34; PLINTH_H = 0.52
BAY0 = 0.57; PITCH = 0.483; N_SHELF = 4; SH_T = 0.054; SPRING_UP = 0.124
R_IN = 1.321; ARCH_BAND = 0.28; CAP_H = 0.50; ENT_H = 0.14
PX_PER_M = 295.2; IMG_W, IMG_H = 1536, 1024; BASE_TOP_PX = 930
SHOTS = r"C:\Users\cnyan\blender_mcp\yanxilu\shots"

for o in list(bpy.data.objects):
    if o.name.startswith("yx_") or o.name in ("Cube", "Light", "Camera"): bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.materials):
    if m.name.startswith("yx_") or m.users == 0: bpy.data.materials.remove(m)
sc = bpy.context.scene; sc.render.engine = "BLENDER_EEVEE_NEXT"; sc.use_nodes = False
sc.view_settings.view_transform = "Standard"; sc.view_settings.look = "None"; sc.view_settings.exposure = 0
for attr, val in (("use_gtao", True), ("use_fast_gi", True)):
    try: setattr(sc.eevee, attr, val)
    except Exception: pass

def plain(name, color, rough=0.85):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough; return m
CLAY = plain("yx_clay", (0.66, 0.62, 0.56)); CLAY_D = plain("yx_clay_dark", (0.33, 0.30, 0.27)); WALL = plain("yx_wallclay", (0.82, 0.78, 0.72)); BR = plain("yx_brassclay", (0.9, 0.75, 0.35), 0.4); HOLD = plain("yx_placeholder", (0.75, 0.55, 0.55))

def finish(o, m, bevel=0.003, smooth=False):
    o.data.materials.append(m)
    if bevel:
        md = o.modifiers.new("bevel", "BEVEL"); md.width = bevel; md.segments = 2; md.limit_method = "ANGLE"; md.angle_limit = math.radians(40)
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
        try: o.data.use_auto_smooth = True; o.data.auto_smooth_angle = math.radians(40)
        except Exception: pass
    return o
def box(name, size, loc, m, rot=(0, 0, 0), bevel=0.003):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True); return finish(o, m, bevel)
def mesh_from_bm(name, bm, m, loc=(0, 0, 0), bevel=0.0, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.location = loc; return finish(o, m, bevel, smooth)

def sweep_arc(name, profile, R, zc, a0, a1, m, steps=96):
    """profile: [(r 径向偏移, y 深度)] 闭合多边形；绕 Y 轴过 (0,·,zc) 从 a0 扫到 a1。"""
    bm = bmesh.new()
    verts = [bm.verts.new(((R + r) * math.cos(a0), y, zc + (R + r) * math.sin(a0))) for r, y in profile]
    edges = [bm.edges.new((verts[i], verts[(i + 1) % len(verts)])) for i in range(len(verts))]
    bmesh.ops.spin(bm, geom=edges, cent=(0, 0, zc), axis=(0, -1, 0), angle=(a1 - a0), steps=steps, use_duplicate=False)
    return mesh_from_bm(name, bm, m)
def sweep_line(name, profile, x0, x1, m, z0=0.0, y0=0.0):
    """profile: [(y 深度, z 高)] 闭合多边形，沿 X 从 x0 拉到 x1。"""
    bm = bmesh.new()
    verts = [bm.verts.new((x0, y0 + y, z0 + z)) for y, z in profile]
    edges = [bm.edges.new((verts[i], verts[(i + 1) % len(verts)])) for i in range(len(verts))]
    r = bmesh.ops.extrude_edge_only(bm, edges=edges); bmesh.ops.translate(bm, verts=[g for g in r["geom"] if isinstance(g, bmesh.types.BMVert)], vec=(x1 - x0, 0, 0))
    return mesh_from_bm(name, bm, m)
def extrude_poly(name, poly_xy, z0, z1, m, y=0.0, bevel=0.002):
    """poly_xy: [(x, y)] 截面（水平面），从 z0 拉到 z1（例如带凹槽的柱身）。"""
    bm = bmesh.new()
    vs = [bm.verts.new((x, yy, z0)) for x, yy in poly_xy]; f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f]); bmesh.ops.translate(bm, verts=[g for g in r["geom"] if isinstance(g, bmesh.types.BMVert)], vec=(0, 0, z1 - z0))
    return mesh_from_bm(name, bm, m, bevel=bevel, smooth=False)
def arc_fill(name, R, a0, a1, chord_z, depth, loc, m, segs=96):
    bm = bmesh.new(); ring = [bm.verts.new((R * math.cos(a0 + (a1 - a0) * i / segs), 0, R * math.sin(a0 + (a1 - a0) * i / segs))) for i in range(segs + 1)]
    l = bm.verts.new((R * math.cos(a0), 0, chord_z)); rgt = bm.verts.new((R * math.cos(a1), 0, chord_z))
    bm.faces.new([l] + ring + [rgt]); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    r = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:]); bmesh.ops.translate(bm, verts=[g for g in r["geom"] if isinstance(g, bmesh.types.BMVert)], vec=(0, depth, 0))
    return mesh_from_bm(name, bm, m, loc=loc, smooth=False)
def dentils_arc(prefix, R, a0, a1, y, zc, m, size=0.042, gap=0.032, depth=0.045):
    n = max(1, int(R * (a1 - a0) / (size + gap)))
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        box("%s_%d" % (prefix, i), (size, depth, size * 1.15), (R * math.cos(a), y, zc + R * math.sin(a)), m, rot=(0, -(a - math.pi / 2), 0), bevel=0.002)
def dentils_line(prefix, x0, x1, y, z, m, size=0.042, gap=0.032, depth=0.045):
    n = max(1, int((x1 - x0) / (size + gap)))
    for i in range(n + 1): box("%s_%d" % (prefix, i), (size, depth, size * 1.15), (x0 + (x1 - x0) * i / n, y, z), m, bevel=0.002)
def beads_line(prefix, x0, x1, y, z, m, r=0.009):
    n = max(1, int((x1 - x0) / (r * 2.2)))
    for i in range(n + 1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=16, ring_count=8, location=(x0 + (x1 - x0) * i / n, y, z)); o = bpy.context.object; o.name = "%s_%d" % (prefix, i); finish(o, m, 0, True)
def torus(name, R, r, loc, rot, m, seg=48):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg, minor_segments=12, location=loc, rotation=rot); o = bpy.context.object; o.name = name; return finish(o, m, 0, True)

# ---------- 推算 ----------
z_base = PLINTH_H; shelves = [z_base + BAY0 + k * PITCH for k in range(N_SHELF)]
z_spring = shelves[-1] + SPRING_UP; C = WI / 2; R = R_IN
zc = z_spring - math.sqrt(R * R - C * C); a0 = math.asin((z_spring - zc) / R); a1 = math.pi - a0
YF = -PIL_D; total_w = WI + 2 * UP_T + 2 * PIL_W
z_capb = shelves[-1] + 0.115; z_cap_top = z_capb + CAP_H; z_ent_top = z_cap_top + ENT_H
cam_z = z_base + (BASE_TOP_PX - IMG_H / 2) / PX_PER_M

# ---------- 截面库（专业流程的"型材"） ----------
# 拱带：径向 r 从内沿 0 到 0.28，y 深度（负朝观众；后面 +0.02 埋进柜体）
ARCH_PROFILE = [(0, 0.02), (0, -0.098), (0.004, -0.112), (0.011, -0.12), (0.019, -0.114), (0.023, -0.104),   # 内沿珠
    (0.034, -0.104), (0.034, -0.118), (0.138, -0.118),                                                       # 平带（楣）
    (0.138, -0.078), (0.212, -0.078),                                                                        # 齿底（齿另放）
    (0.212, -0.128), (0.226, -0.128), (0.236, -0.134), (0.25, -0.152), (0.262, -0.168), (0.272, -0.178),     # 冠线：凹弧
    (0.28, -0.19), (0.28, 0.02)]
# 檐口（立柱上方、横向）：z 从 0 到 ENT_H，y 深度
ENT_PROFILE = [(0.02, 0), (-0.19, 0), (-0.19, 0.012), (-0.168, 0.018), (-0.152, 0.03), (-0.134, 0.046), (-0.128, 0.056), (-0.128, 0.07),
    (-0.078, 0.07), (-0.078, 0.12), (-0.118, 0.12), (-0.118, 0.14), (0.02, 0.14)]
# 搁板前沿：y 深度，z 自搁板上沿向下
NOSE_PROFILE = [(0.012, 0), (-0.006, 0), (-0.013, -0.003), (-0.021, -0.01), (-0.027, -0.02), (-0.028, -0.032), (-0.02, -0.038),
    (-0.016, -0.044), (-0.023, -0.052), (-0.016, -0.06), (-0.006, -0.062), (0.012, -0.062)]
# 柱础（横向绕柱一圈：先按前脸直线做，侧面用同样截面）：y 深度，z 高
BASE_PROFILE = [(y * 1.4, z * 1.4) for y, z in [(0.0, 0), (-0.05, 0), (-0.05, 0.06), (-0.042, 0.066), (-0.034, 0.08), (-0.028, 0.096), (-0.034, 0.108), (-0.024, 0.118), (-0.016, 0.126), (0.0, 0.126)]]
# 柱头顶板（两级冠）：y 深度，z 高
ABACUS_PROFILE = [(0.0, 0), (-0.02, 0), (-0.03, 0.01), (-0.04, 0.026), (-0.05, 0.038), (-0.058, 0.046), (-0.058, 0.06), (0.0, 0.06)]

# ---------- 墙、地、底座 ----------
box("yx_wall", (8.0, 0.02, 5.0), (0, DEPTH + 0.011, 2.5), WALL, bevel=0)
box("yx_floor", (8.0, 6.0, 0.02), (0, DEPTH - 3.0, -0.01), CLAY_D, bevel=0)
box("yx_plinth", (total_w, DEPTH + PIL_D, PLINTH_H - 0.06), (0, (DEPTH - PIL_D) / 2, (PLINTH_H - 0.06) / 2), CLAY)
sweep_line("yx_plinth_cap", [(0.02, 0), (-0.045, 0), (-0.045, 0.012), (-0.03, 0.02), (-0.02, 0.034), (-0.026, 0.046), (-0.016, 0.054), (-0.004, 0.06), (0.02, 0.06)], -total_w / 2 - 0.02, total_w / 2 + 0.02, CLAY, z0=PLINTH_H - 0.06, y0=YF)
box("yx_plinth_foot", (total_w + 0.02, DEPTH + PIL_D + 0.02, 0.09), (0, (DEPTH - PIL_D) / 2, 0.045), CLAY_D)
for k in range(3):   # 三块起线门板
    px = -WI / 3 + WI / 3 * k; pw = WI / 3 - 0.10; ph = PLINTH_H - 0.22
    box("yx_door_frame_%d" % k, (pw, 0.014, ph), (px, YF - 0.007, 0.09 + ph / 2 + 0.03), CLAY)
    box("yx_door_field_%d" % k, (pw - 0.12, 0.012, ph - 0.12), (px, YF - 0.018, 0.09 + ph / 2 + 0.03), CLAY, bevel=0.006)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.014, location=(px + pw / 2 - 0.07, YF - 0.03, 0.09 + ph / 2 + 0.03)); kn = bpy.context.object; kn.name = "yx_knob_%d" % k; finish(kn, BR, 0, True)
# ---------- 背板（16 块竖板，板缝有倒角）、拱洞填充、侧板 ----------
DARK = plain("yx_gapdark", (0.10, 0.09, 0.08))
box("yx_back_board", (WI, 0.006, z_spring - z_base), (0, DEPTH - 0.003, (z_spring + z_base) / 2), DARK, bevel=0)  # 只到起脚，拱洞由 back_arch 封
nb = 16; bw = WI / nb
for i in range(nb): box("yx_back_%d" % i, (bw - 0.004, 0.02, z_spring - z_base), (-WI / 2 + bw * (i + 0.5), DEPTH - 0.012, (z_spring + z_base) / 2), CLAY_D, bevel=0.0015)
arc_fill("yx_back_arch", R - 0.001, a0, a1, z_spring - zc, 0.02, (0, DEPTH - 0.02, zc), CLAY_D)
for sx in (-1, 1): box("yx_upright_%d" % (sx > 0), (UP_T, DEPTH, z_spring - z_base), (sx * (WI / 2 + UP_T / 2), DEPTH / 2, (z_spring + z_base) / 2), CLAY)
# ---------- 搁板：板身 + 扫掠前沿 + 黄铜牌 ----------
for k, z in enumerate(shelves):
    box("yx_shelf_%d" % k, (WI, DEPTH - 0.02, 0.03), (0, DEPTH / 2, z - 0.015), CLAY, bevel=0.002)
    sweep_line("yx_nose_%d" % k, NOSE_PROFILE, -WI / 2, WI / 2, CLAY, z0=z, y0=0.0)
    pl_ = box("yx_plate_%d" % k, (0.16, 0.003, 0.026), (0, -0.03, z - 0.03), BR, bevel=0); md_ = pl_.modifiers.new("round", "BEVEL"); md_.width = 0.009; md_.segments = 5; md_.limit_method = "ANGLE"
pl_ = box("yx_plate_base", (0.16, 0.003, 0.026), (0, YF - 0.004, PLINTH_H - 0.032), BR, bevel=0); md_ = pl_.modifiers.new("round", "BEVEL"); md_.width = 0.009; md_.segments = 5; md_.limit_method = "ANGLE"
# ---------- 立柱 ----------
SHAFT_W = PIL_W - 0.04; FL_N = 7; FL_R = 0.011
for sx in (-1, 1):
    x = sx * (WI / 2 + UP_T + PIL_W / 2); z0 = z_base
    # 柱础：方墩 + 扫掠线脚（前脸）+ 两侧同截面
    box("yx_pil_plinth_%d" % (sx > 0), (PIL_W + 0.05, PIL_D + 0.05, 0.06), (x, YF / 2, z0 + 0.03), CLAY)
    sweep_line("yx_pil_base_%d" % (sx > 0), BASE_PROFILE, x - PIL_W / 2 - 0.01, x + PIL_W / 2 + 0.01, CLAY, z0=z0 + 0.06, y0=YF - 0.005)
    box("yx_pil_base_fill_%d" % (sx > 0), (PIL_W + 0.02, PIL_D, 0.176), (x, YF / 2 + 0.005, z0 + 0.06 + 0.088), CLAY, bevel=0.002)
    # 柱身：带 7 道半圆凹槽的截面拉伸
    zs0 = z0 + 0.06 + 0.176; zs1 = z_capb - 0.06
    poly = [(x - SHAFT_W / 2, YF + PIL_D), (x - SHAFT_W / 2, YF)]
    for f_ in range(FL_N):
        cx_ = x - SHAFT_W / 2 + SHAFT_W * (f_ + 1) / (FL_N + 1)
        poly.append((cx_ - FL_R, YF))
        for j in range(1, 8):
            t = math.pi * j / 8; poly.append((cx_ - FL_R * math.cos(t), YF + FL_R * math.sin(t)))
        poly.append((cx_ + FL_R, YF))
    poly += [(x + SHAFT_W / 2, YF), (x + SHAFT_W / 2, YF + PIL_D)]
    extrude_poly("yx_shaft_%d" % (sx > 0), poly, zs0 + 0.05, zs1 - 0.05, CLAY, bevel=0.0015)
    box("yx_shaft_lo_%d" % (sx > 0), (SHAFT_W, PIL_D, 0.05), (x, YF / 2, zs0 + 0.025), CLAY, bevel=0.002)   # 槽下留平段
    box("yx_shaft_hi_%d" % (sx > 0), (SHAFT_W, PIL_D, 0.05), (x, YF / 2, zs1 - 0.025), CLAY, bevel=0.002)
    # 柱头：颈珠 + 嵌板块（雕花占位）+ 涡卷占位 + 两级顶板
    torus("yx_astragal_%d" % (sx > 0), SHAFT_W / 2 + 0.02, 0.009, (x, YF / 2, zs1 + 0.009), (0, 0, 0), CLAY)
    beads_line("yx_neckbead_%d" % (sx > 0), x - SHAFT_W / 2 + 0.01, x + SHAFT_W / 2 - 0.01, YF - 0.012, zs1 + 0.03, CLAY)
    box("yx_capblk_%d" % (sx > 0), (PIL_W - 0.01, PIL_D + 0.01, CAP_H - 0.06 - 0.09), (x, YF / 2, z_capb + 0.045 + (CAP_H - 0.15) / 2), CLAY)
    box("yx_capfield_%d" % (sx > 0), (PIL_W - 0.07, 0.012, CAP_H - 0.23), (x, YF - 0.011, z_capb + 0.045 + (CAP_H - 0.15) / 2 + 0.03), CLAY_D, bevel=0.002)
    box("yx_HOLD_rosette_%d" % (sx > 0), (PIL_W - 0.11, 0.03, CAP_H - 0.29), (x, YF - 0.02, z_capb + 0.045 + (CAP_H - 0.15) / 2 + 0.03), HOLD, bevel=0.004)      # 雕花占位：图生三维替换
    torus("yx_HOLD_volute_%d_0" % (sx > 0), 0.028, 0.012, (x - PIL_W / 2 + 0.03, YF - 0.012, z_capb + 0.07), (0, math.pi / 2, 0), HOLD)                           # 涡卷占位
    torus("yx_HOLD_volute_%d_1" % (sx > 0), 0.028, 0.012, (x + PIL_W / 2 - 0.03, YF - 0.012, z_capb + 0.07), (0, math.pi / 2, 0), HOLD)
    sweep_line("yx_abacus_%d" % (sx > 0), ABACUS_PROFILE, x - PIL_W / 2 - 0.03, x + PIL_W / 2 + 0.03, CLAY, z0=z_cap_top - 0.06, y0=YF - 0.01)
    box("yx_abacus_fill_%d" % (sx > 0), (PIL_W + 0.06, PIL_D + 0.02, 0.06), (x, YF / 2 + 0.005, z_cap_top - 0.03), CLAY, bevel=0.002)
    # 檐口块（蜡烛平台）：扫掠截面 + 齿 + 填块
    sweep_line("yx_ent_%d" % (sx > 0), ENT_PROFILE, x - PIL_W / 2 - 0.06, x + PIL_W / 2 + 0.06, CLAY, z0=z_cap_top, y0=YF)
    box("yx_ent_fill_%d" % (sx > 0), (PIL_W + 0.12, PIL_D + 0.02, ENT_H), (x, YF / 2 + 0.01, z_cap_top + ENT_H / 2), CLAY, bevel=0.002)
    dentils_line("yx_dent_%d" % (sx > 0), x - PIL_W / 2 - 0.04, x + PIL_W / 2 + 0.04, YF - 0.095, z_cap_top + 0.095, CLAY, size=0.034, gap=0.026, depth=0.04)
    # 烛台三节 + 蜡烛
    for i, (rr, hh) in enumerate(((0.07, 0.02), (0.026, 0.07), (0.045, 0.014))):
        zz = z_ent_top + sum(h for _, h in ((0.07, 0.02), (0.026, 0.07), (0.045, 0.014))[:i]) + hh / 2
        bpy.ops.mesh.primitive_cylinder_add(radius=rr, depth=hh, vertices=48, location=(x, YF / 2, zz)); c = bpy.context.object; c.name = "yx_cstick_%d_%d" % (sx > 0, i); finish(c, BR, 0.002, True)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.022, depth=0.17, vertices=32, location=(x, YF / 2, z_ent_top + 0.104 + 0.085)); c = bpy.context.object; c.name = "yx_candle_%d" % (sx > 0); finish(c, CLAY, 0, True)
# ---------- 拱：扫掠拱带 + 齿 + 拱肩 ----------
ARCH_Y = 0.08   # 拱带整体后退：蓝本里柱头与檐口压在拱带前面
ab = sweep_arc("yx_archband", ARCH_PROFILE, R, zc, a0, a1, CLAY); ab.location.y += ARCH_Y
dentils_arc("yx_adent", R + 0.175, a0, a1, -0.10 + ARCH_Y, zc, CLAY, size=0.034, gap=0.026, depth=0.04)
sp = box("yx_spandrel", (WI + 2 * UP_T + 2 * PIL_W - 0.02, PIL_D - 0.01, z_ent_top - z_spring), (0, YF / 2 + 0.005, (z_ent_top + z_spring) / 2), CLAY, bevel=0)
bpy.ops.mesh.primitive_cylinder_add(radius=R + ARCH_BAND - 0.002, depth=1.0, vertices=128, location=(0, YF / 2, zc), rotation=(math.pi / 2, 0, 0)); cut = bpy.context.object; cut.name = "yx_cut"; cut.display_type = "WIRE"; cut.hide_render = True
bo = sp.modifiers.new("cut", "BOOLEAN"); bo.operation = "DIFFERENCE"; bo.object = cut; bo.solver = "EXACT"
# 拱肩与檐口齐平的顶部横冠线（从左檐口到右檐口）
sweep_line("yx_top_crown", [(0.02, 0), (-0.128, 0), (-0.134, 0.006), (-0.152, 0.018), (-0.168, 0.034), (-0.19, 0.046), (-0.19, 0.058), (0.02, 0.058)], -(WI / 2 + UP_T + PIL_W), (WI / 2 + UP_T + PIL_W), CLAY, z0=z_ent_top - 0.058, y0=YF)

# ---------- 光与机位 ----------
bpy.ops.object.light_add(type="SUN", location=(0, -3, 5)); sun = bpy.context.object; sun.name = "yx_sun"; sun.data.energy = 2.5; sun.data.angle = math.radians(8); sun.rotation_euler = (math.radians(52), 0, math.radians(-38))
if sc.world is None: sc.world = bpy.data.worlds.new("yx_world")
sc.world.use_nodes = True; bg = sc.world.node_tree.nodes.get("Background"); bg.inputs["Color"].default_value = (1, 1, 1, 1); bg.inputs["Strength"].default_value = 0.55
bpy.ops.object.camera_add(location=(0.040, -8.0, cam_z)); cam = bpy.context.object; cam.name = "yx_cam"
cam.data.type = "ORTHO"; cam.data.ortho_scale = IMG_W / PX_PER_M; cam.rotation_euler = (math.radians(90), 0, 0); sc.camera = cam
sc.render.film_transparent = False; sc.eevee.taa_render_samples = 32
def shoot(path, w, h, scale=None, center=None):
    sc.render.resolution_x = w; sc.render.resolution_y = h
    if scale: cam.data.ortho_scale = scale
    if center: cam.location = (center[0], -8.0, center[1])
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)
xL = -(WI / 2 + UP_T + PIL_W / 2)
shoot(SHOTS + r"\hipoly_full.png", IMG_W, IMG_H)
shoot(SHOTS + r"\hipoly_cap.png", 1200, 1200, 1.05, (xL + 0.25, z_capb + 0.30))
shoot(SHOTS + r"\hipoly_nose.png", 1200, 600, 0.5, (0.0, shelves[1] - 0.03))
shoot(SHOTS + r"\hipoly_base.png", 1200, 900, 0.9, (xL + 0.3, 0.42))
cam.location = (0.040, -8.0, cam_z); cam.data.ortho_scale = IMG_W / PX_PER_M; sc.render.resolution_x = IMG_W; sc.render.resolution_y = IMG_H
for area in bpy.context.screen.areas:
    if area.type == "VIEW_3D":
        s_ = area.spaces[0]; s_.shading.type = "WIREFRAME"; s_.overlay.show_overlays = True
        with bpy.context.temp_override(area=area, region=[r for r in area.regions if r.type == "WINDOW"][0]): bpy.ops.view3d.view_camera(); bpy.ops.view3d.view_center_camera()
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\cnyan\blender_mcp\yanxilu\yanxilu_hipoly.blend")
print("hipoly done; objects", len([o for o in bpy.data.objects if o.name.startswith("yx_")]), "faces", sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH" and o.name.startswith("yx_")))
