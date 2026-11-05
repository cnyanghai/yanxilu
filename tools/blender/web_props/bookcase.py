# 研习录网页版 · 拱形嵌墙书柜（蓝本：concepts/shelf-scene/B-warm-chestnut.webp）
# 在 Blender 窗口（9877）里建。模块化：底座 / 格层（可重复 N 层）/ 立柱 / 檐口 / 拱顶；以后分件渲成透明底图，书由网页代码摆进格子。
# 真木纹：Poly Haven mocha_oak_veneer（CC0），灰泥：plaster_grey_04（CC0），放在 C:\Users\cnyan\blender_mcp\yanxilu\tex
import bpy, bmesh, math, os

TEX = r"C:\Users\cnyan\blender_mcp\yanxilu\tex"
N_SHELF = 5           # 格层数（网页按实际层数拼）
WI = 2.3              # 柜内净宽
PITCH = 0.44          # 层距
SH_T = 0.045          # 搁板厚
DEPTH = 0.34          # 柜深
UP_T = 0.06           # 侧立板厚
PLINTH_H = 0.52       # 底座高（带门板的矮柜）
PIL_W = 0.21          # 立柱宽
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
sc.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences; prefs.compute_device_type = "OPTIX"; prefs.get_devices()
    for d in prefs.devices: d.use = (d.type == "OPTIX")
    sc.cycles.device = "GPU"
except Exception as e: print("GPU 设置失败", e)
sc.cycles.samples = 160; sc.cycles.use_denoising = True
try: sc.cycles.denoiser = "OPTIX"
except Exception: pass
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - High Contrast"; sc.view_settings.exposure = -0.5

# ---------- 材质 ----------
def pbr(name, base, scale=1.0, tint=(1, 1, 1, 1), rough_mul=1.0, proj="BOX", contrast=0.0, coat=0.0, sat=1.0):
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
        hs = nt.nodes.new("ShaderNodeHueSaturation"); hs.inputs["Saturation"].default_value = sat; nt.links.new(d.outputs["Color"], hs.inputs["Color"])
        bc = nt.nodes.new("ShaderNodeBrightContrast"); bc.inputs["Contrast"].default_value = contrast; nt.links.new(hs.outputs["Color"], bc.inputs["Color"])
        mix = nt.nodes.new("ShaderNodeMixRGB"); mix.blend_type = "MULTIPLY"; mix.inputs["Fac"].default_value = 1.0; mix.inputs["Color2"].default_value = tint
        nt.links.new(bc.outputs["Color"], mix.inputs["Color1"])
        if ao:
            mix2 = nt.nodes.new("ShaderNodeMixRGB"); mix2.blend_type = "MULTIPLY"; mix2.inputs["Fac"].default_value = 0.6
            nt.links.new(mix.outputs["Color"], mix2.inputs["Color1"]); nt.links.new(ao.outputs["Color"], mix2.inputs["Color2"]); nt.links.new(mix2.outputs["Color"], b.inputs["Base Color"])
        else: nt.links.new(mix.outputs["Color"], b.inputs["Base Color"])
    if r:
        mm = nt.nodes.new("ShaderNodeMath"); mm.operation = "MULTIPLY"; mm.inputs[1].default_value = rough_mul
        nt.links.new(r.outputs["Color"], mm.inputs[0]); nt.links.new(mm.outputs["Value"], b.inputs["Roughness"])
    if "Coat Weight" in b.inputs and coat: b.inputs["Coat Weight"].default_value = coat; b.inputs["Coat Roughness"].default_value = 0.25
    if nn:
        nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 1.4
        nt.links.new(nn.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    return m
def plain(name, color, rough=0.5, metal=0.0, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    if emit: b.inputs["Emission Color"].default_value = (*emit[0], 1); b.inputs["Emission Strength"].default_value = emit[1]
    return m
OAK = pbr("yx_oak", "mocha_oak_veneer", scale=1.1, tint=(0.17, 0.095, 0.048, 1), rough_mul=0.7, contrast=0.5, coat=0.2, sat=1.05)      # 暖栗色
OAK_D = pbr("yx_oak_dark", "mocha_oak_veneer", scale=1.1, tint=(0.15, 0.085, 0.042, 1), rough_mul=0.95, contrast=0.45, sat=1.05)  # 柜内背板更深
PLASTER = pbr("yx_plaster", "grey_plaster", scale=0.32, tint=(0.95, 0.63, 0.28, 1), rough_mul=1.0, contrast=-0.45, sat=0.45)   # 赭黄灰泥
BRASS = plain("yx_brass", (0.85, 0.66, 0.30), 0.32, 1.0)
WAX = plain("yx_wax", (0.80, 0.74, 0.62), 0.6)
FLAME = plain("yx_flame", (1.0, 0.75, 0.35), 0.5, emit=((1.0, 0.62, 0.22), 8.0))
FLOOR = pbr("yx_floor", "mocha_oak_veneer", scale=0.6, tint=(0.16, 0.10, 0.055, 1), rough_mul=0.6, sat=0.9)

# ---------- 造型工具 ----------
def box(name, size, loc, m, rot=(0, 0, 0), bevel=0.004):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = size; o.data.materials.append(m)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel: md = o.modifiers.new("bevel", "BEVEL"); md.width = bevel; md.segments = 2; md.limit_method = "ANGLE"
    return o
def mesh_obj(name, bm, loc, m, bevel=0.004):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.location = loc; o.data.materials.append(m)
    if bevel: md = o.modifiers.new("bevel", "BEVEL"); md.width = bevel; md.segments = 2; md.limit_method = "ANGLE"
    return o
def arc_ring(name, R, a0, a1, w, depth, loc, m, segs=64):
    """圆弧环带：半径 R 到 R+w，角度 a0..a1（弧度，0 在右侧），沿 +Y 厚 depth；圆心在 loc。"""
    bm = bmesh.new(); vi = []; vo = []
    for i in range(segs + 1):
        a = a0 + (a1 - a0) * i / segs
        vi.append(bm.verts.new((R * math.cos(a), 0, R * math.sin(a)))); vo.append(bm.verts.new(((R + w) * math.cos(a), 0, (R + w) * math.sin(a))))
    for i in range(segs): bm.faces.new((vi[i], vo[i], vo[i + 1], vi[i + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    r = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:]); bmesh.ops.translate(bm, verts=[g for g in r["geom"] if isinstance(g, bmesh.types.BMVert)], vec=(0, depth, 0))
    return mesh_obj(name, bm, loc, m)
def arc_fill(name, R, a0, a1, chord_z, depth, loc, m, segs=64):
    """弧与弦之间的填充面（拱洞的背板），弦在圆心上方 chord_z 处。"""
    bm = bmesh.new(); ring = [bm.verts.new((R * math.cos(a0 + (a1 - a0) * i / segs), 0, R * math.sin(a0 + (a1 - a0) * i / segs))) for i in range(segs + 1)]
    l = bm.verts.new((R * math.cos(a0), 0, chord_z)); rgt = bm.verts.new((R * math.cos(a1), 0, chord_z))
    bm.faces.new([rgt, l] + ring[::-1]) if False else bm.faces.new(ring + [rgt, l][::-1]) if False else None
    f = bm.faces.new(ring[::-1] + [l, rgt]) if False else bm.faces.new([l] + ring + [rgt])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    r = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:]); bmesh.ops.translate(bm, verts=[g for g in r["geom"] if isinstance(g, bmesh.types.BMVert)], vec=(0, depth, 0))
    return mesh_obj(name, bm, loc, m, bevel=0)
def dentils(prefix, R, a0, a1, y, z0, m, size=0.05, gap=0.045, depth=0.04):
    """沿弧线摆一排齿：每个齿是小方块，朝向切线。"""
    L = R * (a1 - a0); n = max(1, int(L / (size + gap)))
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        box("%s_%d" % (prefix, i), (size, depth, size * 1.1), (R * math.cos(a), y, z0 + R * math.sin(a)), m, rot=(0, -(a - math.pi / 2), 0), bevel=0.002)
def dentils_line(prefix, x0, x1, y, z, m, size=0.05, gap=0.045, depth=0.04):
    n = max(1, int((x1 - x0) / (size + gap)))
    for i in range(n + 1):
        box("%s_%d" % (prefix, i), (size, depth, size * 1.1), (x0 + (x1 - x0) * i / n, y, z), m, bevel=0.002)

# ---------- 尺寸推算 ----------
z_plinth = PLINTH_H
CAP_H = 0.34                                          # 柱头高（颈线 + 雕花板 + 顶板）
TOP_BAY = 0.36                                        # 最上一层搁板到拱起脚的距离（拱洞两侧的净高）
z_spring = z_plinth + (N_SHELF - 1) * PITCH + TOP_BAY # 拱起脚线 = 柱头顶 = 顶层搁板 + TOP_BAY
C = WI / 2; RISE = 0.40
R_ARCH = (C * C + RISE * RISE) / (2 * RISE); zc = z_spring - (R_ARCH - RISE)
a0 = math.asin((R_ARCH - RISE) / R_ARCH); a1 = math.pi - a0
total_w = WI + 2 * UP_T + 2 * PIL_W
YF = -PIL_D
DENT = 0.05; CROWN = 0.06
R_DENT = R_ARCH + ARCH_T          # 齿带起始半径
R_CROWN = R_DENT + DENT + 0.015   # 冠线起始半径
z_arch_top = zc + R_CROWN + CROWN
ENT_H = 0.30                      # 柱头上方的檐口块高

# 墙与地
box("yx_wall", (7.0, 0.02, 4.4), (0, DEPTH + 0.011, 2.2), PLASTER, bevel=0)
box("yx_floor", (7.0, 6.0, 0.02), (0, DEPTH - 3.0, -0.01), FLOOR, bevel=0)
box("yx_skirting", (7.0, 0.03, 0.10), (0, DEPTH - 0.015, 0.05), OAK_D, bevel=0.003)
# 底座
box("yx_plinth", (total_w, DEPTH + PIL_D, PLINTH_H - 0.05), (0, (DEPTH - PIL_D) / 2, (PLINTH_H - 0.05) / 2), OAK)
box("yx_plinth_cap", (total_w + 0.05, DEPTH + PIL_D + 0.05, 0.05), (0, (DEPTH - PIL_D) / 2, PLINTH_H - 0.025), OAK)
for k in range(3):
    px = -WI / 3 + WI / 3 * k; pw = WI / 3 - 0.10
    box("yx_plinth_frame_%d" % k, (pw, 0.014, PLINTH_H - 0.16), (px, YF - 0.007, (PLINTH_H - 0.05) / 2 + 0.02), OAK, bevel=0.003)
    box("yx_plinth_panel_%d" % k, (pw - 0.10, 0.010, PLINTH_H - 0.26), (px, YF - 0.012, (PLINTH_H - 0.05) / 2 + 0.02), OAK_D, bevel=0.002)
    box("yx_plinth_knob_%d" % k, (0.025, 0.02, 0.025), (px + pw / 2 - 0.06, YF - 0.024, (PLINTH_H - 0.05) / 2 + 0.02), BRASS, bevel=0.001)
box("yx_plinth_foot", (total_w + 0.02, DEPTH + PIL_D + 0.02, 0.08), (0, (DEPTH - PIL_D) / 2, 0.04), OAK_D)
# 背板（竖板）到起脚线，拱洞填充
nb = 16; bw = WI / nb
for i in range(nb):
    box("yx_back_%d" % i, (bw - 0.004, 0.02, z_spring - z_plinth), (-WI / 2 + bw * (i + 0.5), DEPTH - 0.01, (z_spring + z_plinth) / 2), OAK_D, bevel=0.002)
arc_fill("yx_back_arch", R_ARCH - 0.001, a0, a1, z_spring - zc, 0.02, (0, DEPTH - 0.02, zc), OAK_D)
# 两侧立板（到起脚线）
for sx in (-1, 1):
    box("yx_upright_%d" % (sx > 0), (UP_T, DEPTH, z_spring - z_plinth), (sx * (WI / 2 + UP_T / 2), DEPTH / 2, (z_spring + z_plinth) / 2), OAK)
# 搁板 + 前沿线脚 + 黄铜牌
for k in range(1, N_SHELF):
    z = z_plinth + k * PITCH
    box("yx_shelf_%d" % k, (WI, DEPTH - 0.02, SH_T), (0, DEPTH / 2, z - SH_T / 2), OAK)
    box("yx_lip_%d" % k, (WI, 0.022, 0.075), (0, -0.001, z - 0.0375), OAK, bevel=0.004)
    box("yx_plate_%d" % k, (0.14, 0.004, 0.03), (0, -0.014, z - 0.0375), BRASS, bevel=0.001)
box("yx_plate_0", (0.14, 0.004, 0.03), (0, YF - 0.004, PLINTH_H - 0.025), BRASS, bevel=0.001)
# 立柱：柱础、柱身带凹槽、柱头（颈线 + 雕花板 + 玫瑰花 + 涡卷 + 顶板），上面是檐口块（带齿与冠线），蜡烛在檐口块上
for sx in (-1, 1):
    x = sx * (WI / 2 + UP_T + PIL_W / 2); z0 = z_plinth
    box("yx_pil_base_%d" % (sx > 0), (PIL_W + 0.05, PIL_D + 0.05, 0.12), (x, YF / 2, z0 + 0.06), OAK)
    box("yx_pil_base2_%d" % (sx > 0), (PIL_W + 0.02, PIL_D + 0.02, 0.05), (x, YF / 2, z0 + 0.145), OAK)
    hs = z_spring - CAP_H - z0 - 0.17
    box("yx_pil_%d" % (sx > 0), (PIL_W, PIL_D, hs), (x, YF / 2, z0 + 0.17 + hs / 2), OAK)
    for f_ in range(5):
        box("yx_flute_%d_%d" % (sx > 0, f_), (0.018, 0.012, hs - 0.14), (x - PIL_W / 2 + PIL_W * (f_ + 1) / 6, YF - 0.003, z0 + 0.17 + hs / 2), OAK_D, bevel=0.002)
    zc0 = z0 + 0.17 + hs
    box("yx_neck_%d" % (sx > 0), (PIL_W + 0.03, PIL_D + 0.03, 0.03), (x, YF / 2, zc0 + 0.015), OAK)
    box("yx_capblk_%d" % (sx > 0), (PIL_W + 0.02, PIL_D + 0.02, CAP_H - 0.09), (x, YF / 2, zc0 + 0.03 + (CAP_H - 0.09) / 2), OAK)
    box("yx_cappanel_%d" % (sx > 0), (PIL_W - 0.04, 0.012, CAP_H - 0.15), (x, YF - 0.016, zc0 + 0.03 + (CAP_H - 0.09) / 2), OAK_D, bevel=0.002)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.04, minor_radius=0.011, location=(x, YF - 0.024, zc0 + 0.03 + (CAP_H - 0.09) / 2), rotation=(math.pi / 2, 0, 0)); t = bpy.context.object; t.name = "yx_rosette_%d" % (sx > 0); t.data.materials.append(OAK)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.02, location=(x, YF - 0.026, zc0 + 0.03 + (CAP_H - 0.09) / 2)); sp_ = bpy.context.object; sp_.name = "yx_rosette_c_%d" % (sx > 0); sp_.data.materials.append(OAK)
    for vx in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.05, location=(x + vx * (PIL_W / 2 - 0.01), YF - 0.02, zc0 + CAP_H - 0.09), rotation=(0, math.pi / 2, 0)); v = bpy.context.object; v.name = "yx_volute_%d_%d" % (sx > 0, vx > 0); v.data.materials.append(OAK)
    box("yx_abacus_%d" % (sx > 0), (PIL_W + 0.08, PIL_D + 0.08, 0.05), (x, YF / 2, z_spring - 0.025), OAK)
    # 檐口块：从起脚线到 ENT_H；齿一排在块的中段，冠线压顶
    box("yx_ent_%d" % (sx > 0), (PIL_W + 0.12, PIL_D + 0.10, ENT_H), (x, YF / 2, z_spring + ENT_H / 2), OAK)
    dentils_line("yx_dent_%d" % (sx > 0), x - PIL_W / 2 - 0.03, x + PIL_W / 2 + 0.03, YF - 0.065, z_spring + ENT_H - CROWN - DENT * 0.6 - 0.02, OAK, size=DENT * 0.8, gap=0.035, depth=0.045)
    box("yx_crown_%d" % (sx > 0), (PIL_W + 0.20, PIL_D + 0.18, CROWN), (x, YF / 2, z_spring + ENT_H - CROWN / 2), OAK)
    cz = z_spring + ENT_H
    bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=0.02, location=(x, YF / 2, cz + 0.01)); cs = bpy.context.object; cs.name = "yx_cstick_%d" % (sx > 0); cs.data.materials.append(BRASS)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.028, depth=0.07, location=(x, YF / 2, cz + 0.055)); cs2 = bpy.context.object; cs2.name = "yx_cstick2_%d" % (sx > 0); cs2.data.materials.append(BRASS)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.015, location=(x, YF / 2, cz + 0.095)); cs3 = bpy.context.object; cs3.name = "yx_cstick3_%d" % (sx > 0); cs3.data.materials.append(BRASS)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.017, depth=0.14, location=(x, YF / 2, cz + 0.17)); cw = bpy.context.object; cw.name = "yx_candle_%d" % (sx > 0); cw.data.materials.append(WAX)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.012, location=(x, YF / 2, cz + 0.255)); fl = bpy.context.object; fl.name = "yx_flame_%d" % (sx > 0); fl.scale = (0.6, 0.6, 1.4); fl.data.materials.append(FLAME)
    bpy.ops.object.light_add(type="POINT", location=(x, YF / 2 - 0.05, cz + 0.28)); pl = bpy.context.object; pl.name = "yx_candlelight_%d" % (sx > 0)
    pl.data.energy = 70; pl.data.color = (1.0, 0.62, 0.28); pl.data.shadow_soft_size = 0.04
# 拱：拱圈 + 内圈细线 + 齿带 + 冠线，一条檐口绕着拱走，拱顶就是柜顶，上面露墙
arc_ring("yx_arch", R_ARCH, a0, a1, ARCH_T, PIL_D + 0.02, (0, YF, zc), OAK)
arc_ring("yx_arch_inner", R_ARCH - 0.035, a0, a1, 0.035, PIL_D - 0.02, (0, YF + 0.02, zc), OAK_D)
arc_ring("yx_arch_dentback", R_DENT, a0, a1, DENT + 0.015, PIL_D - 0.03, (0, YF + 0.03, zc), OAK_D)   # 齿后面的暗底
dentils("yx_adent", R_DENT + DENT * 0.55, a0, a1, YF - 0.015, zc, OAK, size=DENT * 0.8, gap=0.035, depth=0.045)
arc_ring("yx_arch_crown", R_CROWN, a0, a1, CROWN, PIL_D + 0.08, (0, YF - 0.06, zc), OAK)

# ---------- 光与机位：左上一束强暖光打在墙上，四角压暗，柜内靠蜡烛和弱补光 ----------
# 主光：近、小、斜。离墙近（y=-1.0，墙在 y=0.35），在左上角外侧，往右下照；衰减快，左上亮、右下暗
bpy.ops.object.light_add(type="AREA", location=(-2.6, -1.0, 4.0)); k = bpy.context.object; k.name = "yx_key"
k.data.energy = 620; k.data.size = 1.5; k.data.color = (1.0, 0.72, 0.40); k.data.spread = math.radians(100)
k.rotation_euler = (math.radians(58), 0, math.radians(-52))
# 右上一点点回光，让右边柱头不死黑
bpy.ops.object.light_add(type="AREA", location=(3.2, -1.4, 3.6)); k2 = bpy.context.object; k2.name = "yx_key2"
k2.data.energy = 110; k2.data.size = 1.5; k2.data.color = (1.0, 0.66, 0.34); k2.rotation_euler = (math.radians(55), 0, math.radians(48))
bpy.ops.object.light_add(type="AREA", location=(0.6, -3.6, 1.4)); f = bpy.context.object; f.name = "yx_fill"
f.data.energy = 45; f.data.size = 3.0; f.data.color = (1.0, 0.85, 0.7); f.rotation_euler = (math.radians(80), 0, math.radians(8))
if sc.world is None: sc.world = bpy.data.worlds.new("yx_world")
sc.world.use_nodes = True; bg = sc.world.node_tree.nodes.get("Background")
if bg: bg.inputs["Color"].default_value = (0.4, 0.3, 0.2, 1); bg.inputs["Strength"].default_value = 0.03
H_TOTAL = z_arch_top + 0.45
bpy.ops.object.camera_add(location=(0, -7.1, H_TOTAL * 0.55)); cam = bpy.context.object; cam.name = "yx_cam"
cam.data.type = "PERSP"; cam.data.lens = 50; cam.rotation_euler = (math.radians(90), 0, 0); sc.camera = cam
sc.render.resolution_x = 1500; sc.render.resolution_y = 1000; sc.render.film_transparent = False
for area in bpy.context.screen.areas:
    if area.type == "VIEW_3D":
        sp = area.spaces[0]; sp.shading.type = "MATERIAL"; sp.region_3d.view_perspective = "CAMERA"; sp.overlay.show_overlays = False
print("bookcase v14: shelves", N_SHELF, "arch top", round(z_arch_top, 2), "width", round(total_w, 2))
sc.render.filepath = r"C:\Users\cnyan\blender_mcp\yanxilu\shots\case_render.png"
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\cnyan\blender_mcp\yanxilu\yanxilu_props.blend")
print("rendered + saved")
