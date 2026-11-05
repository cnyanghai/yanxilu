# 研习录网页版 · 拱形嵌墙书柜（蓝本：concepts/shelf-scene/B-warm-chestnut.webp）
# 在 Blender 窗口（9877）里建。模块化：底座 / 格层（可重复 N 层）/ 立柱 / 檐口 / 拱顶；以后分件渲成透明底图，书由网页代码摆进格子。
# 真木纹：Poly Haven mocha_oak_veneer（CC0），灰泥：plaster_grey_04（CC0），放在 C:\Users\cnyan\blender_mcp\yanxilu\tex
import bpy, bmesh, math, os

TEX = r"C:\Users\cnyan\blender_mcp\yanxilu\tex"
N_SHELF = 5           # 格层数（网页按实际层数拼）
WI = 2.3              # 柜内净宽
PITCH = 0.42          # 层距
SH_T = 0.035          # 搁板厚
DEPTH = 0.34          # 柜深
UP_T = 0.06           # 侧立板厚
PLINTH_H = 0.26       # 底座高
PIL_W = 0.20          # 立柱宽
PIL_D = 0.12          # 立柱凸出深度
ARCH_T = 0.12         # 拱圈宽

# ---------- 清场：只清 yx_ 开头的物体与材质 ----------
for o in list(bpy.data.objects):
    if o.name.startswith("yx_") or o.name in ("Cube", "Light", "Camera"):
        bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.materials):
    if m.name.startswith("yx_") or m.users == 0: bpy.data.materials.remove(m)
for im in list(bpy.data.images):
    if im.users == 0: bpy.data.images.remove(im)
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE_NEXT"
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"

# ---------- 材质 ----------
def pbr(name, base, scale=1.0, tint=(1, 1, 1, 1), rough_mul=1.0, proj="BOX", contrast=0.0):
    """Poly Haven 一套图：diffuse / nor_gl / rough / ao，物体坐标盒投影，不用展 UV。"""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (scale, scale, scale)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    def img(kind, cs):
        p = os.path.join(TEX, "%s_%s_1k.jpg" % (base, kind))
        if not os.path.exists(p): return None
        n = nt.nodes.new("ShaderNodeTexImage"); n.image = bpy.data.images.load(p, check_existing=True); n.image.colorspace_settings.name = cs
        n.projection = proj; n.projection_blend = 0.25; nt.links.new(mp.outputs["Vector"], n.inputs["Vector"]); return n
    d = img("diffuse", "sRGB"); ao = img("ao", "Non-Color"); r = img("rough", "Non-Color"); nn = img("nor_gl", "Non-Color")
    if d:
        bc = nt.nodes.new("ShaderNodeBrightContrast"); bc.inputs["Contrast"].default_value = contrast; nt.links.new(d.outputs["Color"], bc.inputs["Color"])
        mix = nt.nodes.new("ShaderNodeMixRGB"); mix.blend_type = "MULTIPLY"; mix.inputs["Fac"].default_value = 1.0; mix.inputs["Color2"].default_value = tint
        nt.links.new(bc.outputs["Color"], mix.inputs["Color1"])
        if ao:
            mix2 = nt.nodes.new("ShaderNodeMixRGB"); mix2.blend_type = "MULTIPLY"; mix2.inputs["Fac"].default_value = 0.6
            nt.links.new(mix.outputs["Color"], mix2.inputs["Color1"]); nt.links.new(ao.outputs["Color"], mix2.inputs["Color2"]); nt.links.new(mix2.outputs["Color"], b.inputs["Base Color"])
        else: nt.links.new(mix.outputs["Color"], b.inputs["Base Color"])
    if r:
        mm = nt.nodes.new("ShaderNodeMath"); mm.operation = "MULTIPLY"; mm.inputs[1].default_value = rough_mul
        nt.links.new(r.outputs["Color"], mm.inputs[0]); nt.links.new(mm.outputs["Value"], b.inputs["Roughness"])
    if nn:
        nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 0.8
        nt.links.new(nn.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    return m
def plain(name, color, rough=0.5, metal=0.0, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    if emit: b.inputs["Emission Color"].default_value = (*emit[0], 1); b.inputs["Emission Strength"].default_value = emit[1]
    return m
OAK = pbr("yx_oak", "mocha_oak_veneer", scale=1.0, tint=(0.52, 0.36, 0.21, 1), rough_mul=0.8, contrast=0.35)      # 暖栗色
OAK_D = pbr("yx_oak_dark", "mocha_oak_veneer", scale=1.0, tint=(0.26, 0.18, 0.11, 1), rough_mul=0.9, contrast=0.3)  # 柜内背板更深
PLASTER = pbr("yx_plaster", "plaster_grey_04", scale=0.8, tint=(0.82, 0.70, 0.52, 1), rough_mul=1.0)   # 赭黄灰泥
BRASS = plain("yx_brass", (0.85, 0.66, 0.30), 0.32, 1.0)
WAX = plain("yx_wax", (0.80, 0.74, 0.62), 0.6)
FLAME = plain("yx_flame", (1.0, 0.75, 0.35), 0.5, emit=((1.0, 0.62, 0.22), 8.0))
FLOOR = pbr("yx_floor", "mocha_oak_veneer", scale=0.7, tint=(0.30, 0.21, 0.14, 1), rough_mul=0.7)

# ---------- 造型工具 ----------
def box(name, size, loc, m, rot=(0, 0, 0), bevel=0.004):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = size; o.data.materials.append(m)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)  # 缩放烘进网格，贴图按米铺
    if bevel: md = o.modifiers.new("bevel", "BEVEL"); md.width = bevel; md.segments = 2; md.limit_method = "ANGLE"
    return o
def arch_ring(name, r_in, r_out, depth, loc, m, segs=48):
    """半圆拱圈：内径 r_in、外径 r_out、沿 Y 厚 depth，开口朝下，圆心在 loc。"""
    bm = bmesh.new(); vs_in = []; vs_out = []
    for i in range(segs + 1):
        a = math.pi * i / segs
        vs_in.append(bm.verts.new((r_in * math.cos(a), 0, r_in * math.sin(a)))); vs_out.append(bm.verts.new((r_out * math.cos(a), 0, r_out * math.sin(a))))
    for i in range(segs): bm.faces.new((vs_in[i], vs_out[i], vs_out[i + 1], vs_in[i + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    r = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:]); verts = [g for g in r["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=verts, vec=(0, depth, 0))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.location = loc; o.data.materials.append(m)
    md = o.modifiers.new("bevel", "BEVEL"); md.width = 0.004; md.segments = 2; md.limit_method = "ANGLE"
    return o
def half_disc(name, r, depth, loc, m, segs=48):
    bm = bmesh.new(); c = bm.verts.new((0, 0, 0)); ring = [bm.verts.new((r * math.cos(math.pi * i / segs), 0, r * math.sin(math.pi * i / segs))) for i in range(segs + 1)]
    for i in range(segs): bm.faces.new((c, ring[i], ring[i + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    rr = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:]); bmesh.ops.translate(bm, verts=[g for g in rr["geom"] if isinstance(g, bmesh.types.BMVert)], vec=(0, depth, 0))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.location = loc; o.data.materials.append(m); return o

# ---------- 尺寸推算 ----------
Y0 = 0.0                                  # 柜正面所在 y（书柜嵌在墙里，墙面在 y = 0，柜体往 +y 退进去）
z_plinth = PLINTH_H
z_spring = z_plinth + N_SHELF * PITCH     # 最上一层顶 = 拱起脚线
R_IN = WI / 2; R_OUT = R_IN + ARCH_T
total_w = WI + 2 * UP_T + 2 * PIL_W

# 墙与地：墙面在 y=0，柜体嵌入墙内；墙上开洞由"拱洞内的深色背板"表达
box("yx_wall", (7.0, 0.02, 4.0), (0, DEPTH + 0.011, 2.0), PLASTER, bevel=0)  # 墙在柜体背后，柜子立在墙前
box("yx_floor", (7.0, 6.0, 0.02), (0, DEPTH - 3.0, -0.01), FLOOR, bevel=0)
box("yx_skirting", (7.0, 0.03, 0.10), (0, DEPTH - 0.015, 0.05), OAK_D, bevel=0.003)

# 底座：整宽，两级线脚
box("yx_plinth", (total_w, DEPTH + PIL_D, PLINTH_H - 0.05), (0, (DEPTH - PIL_D) / 2, (PLINTH_H - 0.05) / 2), OAK)
box("yx_plinth_cap", (total_w + 0.04, DEPTH + PIL_D + 0.04, 0.05), (0, (DEPTH - PIL_D) / 2, PLINTH_H - 0.025), OAK)
# 柜内背板：竖向木板，略退进去；上面接半圆
nb = 8; bw = WI / nb
for i in range(nb):
    box("yx_back_%d" % i, (bw - 0.004, 0.02, N_SHELF * PITCH), (-WI / 2 + bw * (i + 0.5), DEPTH - 0.01, z_plinth + N_SHELF * PITCH / 2), OAK_D, bevel=0.002)
half_disc("yx_back_arch", R_IN, 0.02, (0, DEPTH - 0.02, z_spring), OAK_D)
# 两侧立板（柜体）
for sx in (-1, 1):
    box("yx_upright_%d" % (sx > 0), (UP_T, DEPTH, N_SHELF * PITCH), (sx * (WI / 2 + UP_T / 2), DEPTH / 2, z_plinth + N_SHELF * PITCH / 2), OAK)
# 格层：搁板 + 前沿黄铜牌（第 0 层是底座顶，不另放板）
for k in range(1, N_SHELF):
    z = z_plinth + k * PITCH
    box("yx_shelf_%d" % k, (WI, DEPTH - 0.02, SH_T), (0, DEPTH / 2, z - SH_T / 2), OAK)
    box("yx_plate_%d" % k, (0.07, 0.004, 0.016), (0, 0.012, z - SH_T / 2), BRASS, bevel=0.001)
box("yx_plate_0", (0.07, 0.004, 0.016), (0, -PIL_D / 2 - 0.004, PLINTH_H - 0.025), BRASS, bevel=0.001)
# 立柱（带凹槽）、柱础、柱头
for sx in (-1, 1):
    x = sx * (WI / 2 + UP_T + PIL_W / 2); h = z_spring - z_plinth - 0.30
    box("yx_pil_base_%d" % (sx > 0), (PIL_W + 0.04, PIL_D + 0.04, 0.10), (x, -PIL_D / 2, z_plinth + 0.05), OAK)
    box("yx_pil_%d" % (sx > 0), (PIL_W, PIL_D, h), (x, -PIL_D / 2, z_plinth + 0.10 + h / 2), OAK)
    for f in range(5):  # 五道凹槽：细长深色条嵌在柱面
        box("yx_flute_%d_%d" % (sx > 0, f), (0.018, 0.01, h - 0.16), (x - PIL_W / 2 + PIL_W * (f + 1) / 6, -PIL_D - 0.002, z_plinth + 0.10 + h / 2), OAK_D, bevel=0.002)
    box("yx_cap_%d" % (sx > 0), (PIL_W + 0.06, PIL_D + 0.06, 0.08), (x, -PIL_D / 2, z_plinth + 0.10 + h + 0.04), OAK)
    box("yx_cap2_%d" % (sx > 0), (PIL_W + 0.10, PIL_D + 0.10, 0.06), (x, -PIL_D / 2, z_plinth + 0.10 + h + 0.08 + 0.03), OAK)
    # 烛台 + 蜡烛 + 火苗 + 点光
    cz = z_plinth + 0.10 + h + 0.14
    bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.02, location=(x, -PIL_D / 2, cz + 0.01)); cs = bpy.context.object; cs.name = "yx_cstick_%d" % (sx > 0); cs.data.materials.append(BRASS)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.014, depth=0.18, location=(x, -PIL_D / 2, cz + 0.11)); cw = bpy.context.object; cw.name = "yx_candle_%d" % (sx > 0); cw.data.materials.append(WAX)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.012, location=(x, -PIL_D / 2, cz + 0.215)); fl = bpy.context.object; fl.name = "yx_flame_%d" % (sx > 0); fl.scale = (0.6, 0.6, 1.3); fl.data.materials.append(FLAME)
    bpy.ops.object.light_add(type="POINT", location=(x, -PIL_D / 2 - 0.05, cz + 0.24)); pl = bpy.context.object; pl.name = "yx_candlelight_%d" % (sx > 0)
    pl.data.energy = 45; pl.data.color = (1.0, 0.62, 0.28); pl.data.shadow_soft_size = 0.05
# 檐口：拱起脚线处一道横向线脚，压在立柱柱头之间（拱从它上面起）
box("yx_cornice", (WI + 2 * UP_T + 0.02, 0.06, 0.07), (0, -0.03, z_spring + 0.035), OAK)
# 拱圈 + 拱心石
arch_ring("yx_arch", R_IN, R_OUT, 0.18, (0, -PIL_D, z_spring), OAK)
box("yx_keystone", (0.18, 0.20, 0.24), (0, -PIL_D - 0.01, z_spring + R_OUT - 0.04), OAK)

# ---------- 光与机位 ----------
bpy.ops.object.light_add(type="AREA", location=(-2.4, -2.6, 3.6)); k = bpy.context.object; k.name = "yx_key"
k.data.energy = 420; k.data.size = 2.0; k.data.color = (1.0, 0.86, 0.62); k.rotation_euler = (math.radians(48), 0, math.radians(-40))
bpy.ops.object.light_add(type="AREA", location=(2.6, -3.0, 1.6)); f = bpy.context.object; f.name = "yx_fill"
f.data.energy = 70; f.data.size = 3.0; f.data.color = (0.92, 0.92, 1.0); f.rotation_euler = (math.radians(72), 0, math.radians(42))
if sc.world is None: sc.world = bpy.data.worlds.new("yx_world")
sc.world.use_nodes = True; bg = sc.world.node_tree.nodes.get("Background")
if bg: bg.inputs["Color"].default_value = (0.55, 0.48, 0.38, 1); bg.inputs["Strength"].default_value = 0.15
H_TOTAL = z_spring + R_OUT + 0.2
bpy.ops.object.camera_add(location=(0, -6.4, H_TOTAL * 0.5)); cam = bpy.context.object; cam.name = "yx_cam"
cam.data.type = "PERSP"; cam.data.lens = 50; cam.rotation_euler = (math.radians(90), 0, 0); cam.data.shift_y = 0.0; sc.camera = cam
sc.render.resolution_x = 1300; sc.render.resolution_y = 1600; sc.render.film_transparent = False
for area in bpy.context.screen.areas:
    if area.type == "VIEW_3D":
        sp = area.spaces[0]; sp.shading.type = "RENDERED"; sp.region_3d.view_perspective = "CAMERA"; sp.overlay.show_overlays = False
print("bookcase built: shelves", N_SHELF, "total height", round(H_TOTAL, 2), "width", round(total_w, 2))

# ---------- 渲一张静帧看效果（EEVEE，几秒） ----------
sc.eevee.taa_render_samples = 64
sc.render.filepath = r"C:\Users\cnyan\blender_mcp\yanxilu\shots\case_render.png"
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\cnyan\blender_mcp\yanxilu\yanxilu_props.blend")
print("rendered + saved")
