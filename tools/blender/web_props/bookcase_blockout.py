# 书柜 · 阶段 1 粗模（专业流程）：只管尺寸与布局，灰模、正交机位，渲出来和蓝本叠图量偏差。
# 尺寸来自 docs/bookcase-production.md 阶段 0 量尺表（蓝本 1536×1024，295.2 像素/米，柜内净宽 2.30）。
import bpy, bmesh, math

# ---- 量尺表（米） ----
WI = 2.30            # 柜内净宽
UP_T = 0.05          # 侧立板厚
PIL_W = 0.315        # 立柱宽；连侧板 0.05 与柱础凸出 0.025 共 0.39（叠图量得 115px）
PIL_D = 0.12
DEPTH = 0.34
PLINTH_H = 0.52      # 底座顶高（蓝本底座被裁，沿用）
BAY0 = 0.57          # 最下层（底座顶到第一块搁板上沿）
PITCH = 0.483        # 其余层距
N_SHELF = 4          # 搁板数（蓝本 4 块 + 底座顶）
SH_T = 0.054         # 搁板前沿厚
SPRING_UP = 0.124    # 起脚（弦）相对顶层搁板上沿，按蓝本内沿拟合圆
RISE = 0.671         # 拱矢高（内沿），拟合圆半径 1.321
ARCH_T = 0.14        # 拱圈（内沿细线 + 平带），蓝本拱带全厚约 0.28
DENT_B = 0.075       # 齿带
CROWN = 0.065        # 冠线（两级）
CAP_H = 0.50         # 柱头（起脚线往上，到檐口底）
ENT_H = 0.14         # 檐口块（蜡烛平台）
PX_PER_M = 295.2; IMG_W, IMG_H = 1536, 1024
BASE_TOP_PX = 930    # 蓝本里底座顶的 y

# ---- 清场 ----
for o in list(bpy.data.objects):
    if o.name.startswith("yx_") or o.name in ("Cube", "Light", "Camera"): bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.materials):
    if m.name.startswith("yx_") or m.users == 0: bpy.data.materials.remove(m)
sc = bpy.context.scene; sc.render.engine = "BLENDER_EEVEE_NEXT"; sc.use_nodes = False
sc.view_settings.view_transform = "Standard"; sc.view_settings.look = "None"; sc.view_settings.exposure = 0

def plain(name, color, rough=0.8):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough; return m
CLAY = plain("yx_clay", (0.62, 0.58, 0.52)); CLAY_D = plain("yx_clay_dark", (0.30, 0.27, 0.24)); WALL = plain("yx_wallclay", (0.80, 0.76, 0.70)); BR = plain("yx_brassclay", (0.9, 0.75, 0.35), 0.4)

def box(name, size, loc, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = size; o.data.materials.append(m)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True); return o
def mesh_obj(name, bm, loc, m):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.location = loc; o.data.materials.append(m); return o
def arc_ring(name, R, a0, a1, w, depth, loc, m, segs=72):
    bm = bmesh.new(); vi = []; vo = []
    for i in range(segs + 1):
        a = a0 + (a1 - a0) * i / segs
        vi.append(bm.verts.new((R * math.cos(a), 0, R * math.sin(a)))); vo.append(bm.verts.new(((R + w) * math.cos(a), 0, (R + w) * math.sin(a))))
    for i in range(segs): bm.faces.new((vi[i], vo[i], vo[i + 1], vi[i + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    r = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:]); bmesh.ops.translate(bm, verts=[g for g in r["geom"] if isinstance(g, bmesh.types.BMVert)], vec=(0, depth, 0))
    return mesh_obj(name, bm, loc, m)
def arc_fill(name, R, a0, a1, chord_z, depth, loc, m, segs=72):
    bm = bmesh.new(); ring = [bm.verts.new((R * math.cos(a0 + (a1 - a0) * i / segs), 0, R * math.sin(a0 + (a1 - a0) * i / segs))) for i in range(segs + 1)]
    l = bm.verts.new((R * math.cos(a0), 0, chord_z)); rgt = bm.verts.new((R * math.cos(a1), 0, chord_z))
    bm.faces.new([l] + ring + [rgt]); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    r = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:]); bmesh.ops.translate(bm, verts=[g for g in r["geom"] if isinstance(g, bmesh.types.BMVert)], vec=(0, depth, 0))
    return mesh_obj(name, bm, loc, m)

# ---- 推算 ----
z_base = PLINTH_H
shelves = [z_base + BAY0 + k * PITCH for k in range(N_SHELF)]      # 搁板上沿
z_spring = shelves[-1] + SPRING_UP
C = WI / 2; R = (C * C + RISE * RISE) / (2 * RISE); zc = z_spring - (R - RISE)
a0 = math.asin((R - RISE) / R); a1 = math.pi - a0
YF = -PIL_D
total_w = WI + 2 * UP_T + 2 * PIL_W
z_capb = shelves[-1] + 0.115     # 柱头底在顶层搁板上 0.115（蓝本 y300）
z_cap_top = z_capb + CAP_H; z_ent_top = z_cap_top + ENT_H
z_arch_top = zc + R + ARCH_T + DENT_B + CROWN

box("yx_wall", (8.0, 0.02, 5.0), (0, DEPTH + 0.011, 2.5), WALL)
box("yx_floor", (8.0, 6.0, 0.02), (0, DEPTH - 3.0, -0.01), CLAY_D)
# 底座（带三块门板示意）
box("yx_plinth", (total_w, DEPTH + PIL_D, PLINTH_H - 0.05), (0, (DEPTH - PIL_D) / 2, (PLINTH_H - 0.05) / 2), CLAY)
box("yx_plinth_cap", (total_w + 0.05, DEPTH + PIL_D + 0.05, 0.05), (0, (DEPTH - PIL_D) / 2, PLINTH_H - 0.025), CLAY)
# 背板与侧板
box("yx_back", (WI, 0.02, z_spring - z_base), (0, DEPTH - 0.01, (z_spring + z_base) / 2), CLAY_D)
arc_fill("yx_back_arch", R - 0.001, a0, a1, z_spring - zc, 0.02, (0, DEPTH - 0.02, zc), CLAY_D)
for sx in (-1, 1):
    box("yx_upright_%d" % (sx > 0), (UP_T, DEPTH, z_spring - z_base), (sx * (WI / 2 + UP_T / 2), DEPTH / 2, (z_spring + z_base) / 2), CLAY)
# 搁板（前沿厚 SH_T）
for k, z in enumerate(shelves):
    box("yx_shelf_%d" % k, (WI, DEPTH - 0.02, 0.03), (0, DEPTH / 2, z - 0.015), CLAY)
    box("yx_lip_%d" % k, (WI, 0.02, SH_T), (0, -0.001, z - SH_T / 2), CLAY)
    box("yx_plate_%d" % k, (0.19, 0.004, 0.04), (0, -0.013, z - SH_T / 2), BR)
box("yx_plate_base", (0.19, 0.004, 0.04), (0, YF - 0.004, PLINTH_H - 0.025), BR)
# 立柱：柱础、柱身、柱头块、檐口块（蜡烛平台）
for sx in (-1, 1):
    x = sx * (WI / 2 + UP_T + PIL_W / 2)
    box("yx_pil_base_%d" % (sx > 0), (PIL_W + 0.05, PIL_D + 0.05, 0.14), (x, YF / 2, z_base + 0.07), CLAY)
    box("yx_pil_%d" % (sx > 0), (PIL_W - 0.04, PIL_D, z_capb - z_base - 0.14), (x, YF / 2, z_base + 0.14 + (z_capb - z_base - 0.14) / 2), CLAY)
    box("yx_cap_%d" % (sx > 0), (PIL_W, PIL_D + 0.02, CAP_H), (x, YF / 2, z_capb + CAP_H / 2), CLAY)
    box("yx_ent_%d" % (sx > 0), (PIL_W + 0.08, PIL_D + 0.08, ENT_H), (x, YF / 2, z_cap_top + ENT_H / 2), CLAY)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.16, location=(x, YF / 2, z_ent_top + 0.08)); c = bpy.context.object; c.name = "yx_candle_%d" % (sx > 0); c.data.materials.append(CLAY)
# 拱：拱圈 + 齿带 + 冠线（一圈薄边），拱肩填实到檐口顶
arc_ring("yx_arch", R, a0, a1, ARCH_T, PIL_D + 0.02, (0, YF, zc), CLAY)
arc_ring("yx_dent", R + ARCH_T, a0, a1, DENT_B, PIL_D - 0.02, (0, YF + 0.01, zc), CLAY_D)
arc_ring("yx_crown", R + ARCH_T + DENT_B, a0, a1, CROWN, PIL_D + 0.06, (0, YF - 0.04, zc), CLAY)
sp = box("yx_spandrel", (WI + 2 * UP_T, PIL_D - 0.02, z_ent_top - z_spring), (0, YF / 2 + 0.01, (z_ent_top + z_spring) / 2), CLAY)
bpy.ops.mesh.primitive_cylinder_add(radius=R + ARCH_T + DENT_B + CROWN, depth=1.0, location=(0, YF / 2, zc), rotation=(math.pi / 2, 0, 0)); cut = bpy.context.object; cut.name = "yx_cut"; cut.display_type = "WIRE"; cut.hide_render = True
bo = sp.modifiers.new("cut", "BOOLEAN"); bo.operation = "DIFFERENCE"; bo.object = cut; bo.solver = "EXACT"

# ---- 光与正交机位：和蓝本一样的像素比例 ----
bpy.ops.object.light_add(type="SUN", location=(0, -3, 5)); sun = bpy.context.object; sun.name = "yx_sun"; sun.data.energy = 3.0; sun.data.use_shadow = False; sun.rotation_euler = (math.radians(55), 0, math.radians(-30))
if sc.world is None: sc.world = bpy.data.worlds.new("yx_world")
sc.world.use_nodes = True; bg = sc.world.node_tree.nodes.get("Background"); bg.inputs["Color"].default_value = (1, 1, 1, 1); bg.inputs["Strength"].default_value = 0.6
cam_z = z_base + (BASE_TOP_PX - IMG_H / 2) / PX_PER_M     # 图心对应的高度
# 蓝本柜子中线偏左 10px
bpy.ops.object.camera_add(location=(0.040, -8.0, cam_z)); cam = bpy.context.object; cam.name = "yx_cam"
cam.data.type = "ORTHO"; cam.data.ortho_scale = IMG_W / PX_PER_M; cam.rotation_euler = (math.radians(90), 0, 0); sc.camera = cam
sc.render.resolution_x = IMG_W; sc.render.resolution_y = IMG_H; sc.render.film_transparent = False; sc.eevee.taa_render_samples = 16
for area in bpy.context.screen.areas:
    if area.type == "VIEW_3D":
        s_ = area.spaces[0]; s_.shading.type = "SOLID"; s_.region_3d.view_perspective = "CAMERA"; s_.overlay.show_overlays = False
sc.render.filepath = r"C:\Users\cnyan\blender_mcp\yanxilu\shots\blockout.png"
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\cnyan\blender_mcp\yanxilu\yanxilu_blockout.blend")
print("blockout: shelves", [round(z, 3) for z in shelves], "spring", round(z_spring, 3), "arch top", round(z_arch_top, 3), "R", round(R, 3), "cam_z", round(cam_z, 3))
