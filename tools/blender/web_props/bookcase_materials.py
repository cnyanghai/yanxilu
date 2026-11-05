# 书柜 · 阶段 3 UV 与分层材质（专业流程）。在已建好高模的窗口里跑：按物体名指派材质，不重建几何。
# 木：4K 橡木底材 + 每块板随机偏移与色相 + 棱角磨损（Bevel 遮罩）+ 缝隙积灰（AO 遮罩）+ 清漆层；三档深浅。
# 黄铜：金属 + 指纹噪声粗糙度 + 棱角磨损；灰泥：4K 底材 + 大尺度斑驳 + 法线；蜡：次表面。
# 渲染：Cycles（显卡），中性光，四块材质近景 + 正视。
import bpy, math, os
TEX = r"C:\Users\cnyan\blender_mcp\yanxilu\tex"; SHOTS = r"C:\Users\cnyan\blender_mcp\yanxilu\shots"
sc = bpy.context.scene

def img(nt, base, kind, cs, res="4k"):
    p = os.path.join(TEX, "%s_%s_%s.jpg" % (base, kind, res))
    if not os.path.exists(p): p = os.path.join(TEX, "%s_%s_1k.jpg" % (base, kind))
    if not os.path.exists(p): return None
    n = nt.nodes.new("ShaderNodeTexImage"); n.image = bpy.data.images.load(p, check_existing=True); n.image.colorspace_settings.name = cs
    n.projection = "BOX"; n.projection_blend = 0.3; return n
def link(nt, a, b): nt.links.new(a, b)

def wood(name, tint=(1, 1, 1), value=1.0, contrast=0.35, scale=1.0, coat=0.3, rough_mul=0.85, wear=0.35, dust=0.25, per_object=True):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial"); b = nt.nodes.new("ShaderNodeBsdfPrincipled"); link(nt, b.outputs[0], out.inputs[0])
    # 坐标：物体坐标 + 每个物体随机偏移（每块板纹理不同）
    tc = nt.nodes.new("ShaderNodeTexCoord"); oi = nt.nodes.new("ShaderNodeObjectInfo")
    rnd = nt.nodes.new("ShaderNodeVectorMath"); rnd.operation = "MULTIPLY"; rnd.inputs[1].default_value = (3.7, 2.3, 5.1)
    link(nt, oi.outputs["Random"], rnd.inputs[0])
    add = nt.nodes.new("ShaderNodeVectorMath"); add.operation = "ADD"; link(nt, tc.outputs["Object"], add.inputs[0])
    if per_object: link(nt, rnd.outputs[0], add.inputs[1])
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (scale, scale, scale); link(nt, add.outputs[0], mp.inputs["Vector"])
    d = img(nt, "mocha_oak_veneer", "diffuse", "sRGB"); r = img(nt, "mocha_oak_veneer", "rough", "Non-Color"); nn = img(nt, "mocha_oak_veneer", "nor_gl", "Non-Color"); ao = img(nt, "mocha_oak_veneer", "ao", "Non-Color")
    for n in (d, r, nn, ao):
        if n: link(nt, mp.outputs[0], n.inputs["Vector"])
    # 颜色：对比 → 每板色相/明度微变 → 色调 → 乘 AO
    bc = nt.nodes.new("ShaderNodeBrightContrast"); bc.inputs["Contrast"].default_value = contrast; link(nt, d.outputs["Color"], bc.inputs["Color"])
    hs = nt.nodes.new("ShaderNodeHueSaturation"); link(nt, bc.outputs["Color"], hs.inputs["Color"])
    hue = nt.nodes.new("ShaderNodeMath"); hue.operation = "MULTIPLY_ADD"; hue.inputs[1].default_value = 0.03; hue.inputs[2].default_value = 0.485; link(nt, oi.outputs["Random"], hue.inputs[0]); link(nt, hue.outputs[0], hs.inputs["Hue"])
    val = nt.nodes.new("ShaderNodeMath"); val.operation = "MULTIPLY_ADD"; val.inputs[1].default_value = 0.18 * value; val.inputs[2].default_value = value - 0.09; link(nt, oi.outputs["Random"], val.inputs[0]); link(nt, val.outputs[0], hs.inputs["Value"])
    tn = nt.nodes.new("ShaderNodeMixRGB"); tn.blend_type = "MULTIPLY"; tn.inputs["Fac"].default_value = 1.0; tn.inputs["Color2"].default_value = (*tint, 1); link(nt, hs.outputs["Color"], tn.inputs["Color1"])
    aom = nt.nodes.new("ShaderNodeMixRGB"); aom.blend_type = "MULTIPLY"; aom.inputs["Fac"].default_value = 0.5; link(nt, tn.outputs["Color"], aom.inputs["Color1"]); link(nt, ao.outputs["Color"], aom.inputs["Color2"])
    # 棱角磨损：Bevel 法线与几何法线夹角 → 遮罩（棱上亮一点、糙一点）
    bv = nt.nodes.new("ShaderNodeBevel"); bv.inputs["Radius"].default_value = 0.004; bv.samples = 6
    gm = nt.nodes.new("ShaderNodeNewGeometry"); dot = nt.nodes.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"; link(nt, bv.outputs[0], dot.inputs[0]); link(nt, gm.outputs["Normal"], dot.inputs[1])
    wr = nt.nodes.new("ShaderNodeMapRange"); wr.inputs["From Min"].default_value = 0.995; wr.inputs["From Max"].default_value = 0.9; wr.inputs["To Min"].default_value = 0.0; wr.inputs["To Max"].default_value = wear; link(nt, dot.outputs["Value"], wr.inputs["Value"])
    wearcol = nt.nodes.new("ShaderNodeMixRGB"); wearcol.blend_type = "SCREEN"; wearcol.inputs["Color2"].default_value = (0.55, 0.42, 0.28, 1); link(nt, wr.outputs[0], wearcol.inputs["Fac"]); link(nt, aom.outputs["Color"], wearcol.inputs["Color1"])
    # 缝隙积灰：AO 节点 → 暗处偏灰偏哑
    aon = nt.nodes.new("ShaderNodeAmbientOcclusion"); aon.inputs["Distance"].default_value = 0.05; aon.samples = 8
    dm = nt.nodes.new("ShaderNodeMapRange"); dm.inputs["From Min"].default_value = 0.2; dm.inputs["From Max"].default_value = 0.75; dm.inputs["To Min"].default_value = dust; dm.inputs["To Max"].default_value = 0.0; link(nt, aon.outputs["AO"], dm.inputs["Value"])
    dustcol = nt.nodes.new("ShaderNodeMixRGB"); dustcol.inputs["Color2"].default_value = (0.42, 0.38, 0.32, 1); link(nt, dm.outputs[0], dustcol.inputs["Fac"]); link(nt, wearcol.outputs["Color"], dustcol.inputs["Color1"])
    link(nt, dustcol.outputs["Color"], b.inputs["Base Color"])
    # 粗糙：贴图 × 系数，磨损处 +，积灰处 +
    rm = nt.nodes.new("ShaderNodeMath"); rm.operation = "MULTIPLY"; rm.inputs[1].default_value = rough_mul; link(nt, r.outputs["Color"], rm.inputs[0])
    ra = nt.nodes.new("ShaderNodeMath"); ra.operation = "ADD"; link(nt, rm.outputs[0], ra.inputs[0]); link(nt, wr.outputs[0], ra.inputs[1])
    ra2 = nt.nodes.new("ShaderNodeMath"); ra2.operation = "ADD"; link(nt, ra.outputs[0], ra2.inputs[0]); link(nt, dm.outputs[0], ra2.inputs[1]); link(nt, ra2.outputs[0], b.inputs["Roughness"])
    # 法线 + 清漆
    nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 1.9; link(nt, nn.outputs["Color"], nm.inputs["Color"]); link(nt, nm.outputs["Normal"], b.inputs["Normal"])
    if "Coat Weight" in b.inputs:
        cw = nt.nodes.new("ShaderNodeMath"); cw.operation = "MULTIPLY_ADD"; cw.inputs[1].default_value = -coat; cw.inputs[2].default_value = coat; link(nt, dm.outputs[0], cw.inputs[0]); link(nt, cw.outputs[0], b.inputs["Coat Weight"])
        b.inputs["Coat Roughness"].default_value = 0.18; b.inputs["Coat IOR"].default_value = 1.45
    b.inputs["Specular IOR Level"].default_value = 0.45
    return m

def brass(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial"); b = nt.nodes.new("ShaderNodeBsdfPrincipled"); link(nt, b.outputs[0], out.inputs[0])
    b.inputs["Metallic"].default_value = 1.0; b.inputs["Base Color"].default_value = (0.62, 0.42, 0.16, 1)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n1 = nt.nodes.new("ShaderNodeTexNoise"); n1.inputs["Scale"].default_value = 90; n1.inputs["Detail"].default_value = 4; link(nt, tc.outputs["Object"], n1.inputs["Vector"])
    n2 = nt.nodes.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = 9; n2.inputs["Detail"].default_value = 2; link(nt, tc.outputs["Object"], n2.inputs["Vector"])
    mx = nt.nodes.new("ShaderNodeMixRGB"); mx.inputs["Fac"].default_value = 0.5; link(nt, n1.outputs["Fac"], mx.inputs["Color1"]); link(nt, n2.outputs["Fac"], mx.inputs["Color2"])
    rr = nt.nodes.new("ShaderNodeMapRange"); rr.inputs["From Min"].default_value = 0.3; rr.inputs["From Max"].default_value = 0.7; rr.inputs["To Min"].default_value = 0.16; rr.inputs["To Max"].default_value = 0.34; link(nt, mx.outputs["Color"], rr.inputs["Value"])
    bv = nt.nodes.new("ShaderNodeBevel"); bv.inputs["Radius"].default_value = 0.002; gm = nt.nodes.new("ShaderNodeNewGeometry"); dot = nt.nodes.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"; link(nt, bv.outputs[0], dot.inputs[0]); link(nt, gm.outputs["Normal"], dot.inputs[1])
    wr = nt.nodes.new("ShaderNodeMapRange"); wr.inputs["From Min"].default_value = 0.995; wr.inputs["From Max"].default_value = 0.9; wr.inputs["To Max"].default_value = 0.25; link(nt, dot.outputs["Value"], wr.inputs["Value"])
    ra = nt.nodes.new("ShaderNodeMath"); ra.operation = "ADD"; link(nt, rr.outputs[0], ra.inputs[0]); link(nt, wr.outputs[0], ra.inputs[1]); link(nt, ra.outputs[0], b.inputs["Roughness"])
    # 棱角更亮（磨出的新铜）
    ec = nt.nodes.new("ShaderNodeMixRGB"); ec.inputs["Color1"].default_value = (0.62, 0.42, 0.16, 1); ec.inputs["Color2"].default_value = (0.90, 0.70, 0.36, 1); link(nt, wr.outputs[0], ec.inputs["Fac"]); link(nt, ec.outputs["Color"], b.inputs["Base Color"])
    bm = nt.nodes.new("ShaderNodeBump"); bm.inputs["Strength"].default_value = 0.08; link(nt, n1.outputs["Fac"], bm.inputs["Height"]); link(nt, bm.outputs["Normal"], b.inputs["Normal"])
    return m

def plaster(name, tint=(0.86, 0.58, 0.28), scale=0.6):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial"); b = nt.nodes.new("ShaderNodeBsdfPrincipled"); link(nt, b.outputs[0], out.inputs[0])
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (scale, scale, scale); link(nt, tc.outputs["Object"], mp.inputs["Vector"])
    d = img(nt, "grey_plaster", "diffuse", "sRGB"); nn = img(nt, "grey_plaster", "nor_gl", "Non-Color"); r = img(nt, "grey_plaster", "rough", "Non-Color")
    for n in (d, nn, r): link(nt, mp.outputs[0], n.inputs["Vector"])
    hs = nt.nodes.new("ShaderNodeHueSaturation"); hs.inputs["Saturation"].default_value = 0.35; hs.inputs["Value"].default_value = 1.0; link(nt, d.outputs["Color"], hs.inputs["Color"])
    bc = nt.nodes.new("ShaderNodeBrightContrast"); bc.inputs["Contrast"].default_value = -0.35; link(nt, hs.outputs["Color"], bc.inputs["Color"])
    # 大尺度斑驳（抹灰的云状不匀）
    big = nt.nodes.new("ShaderNodeTexNoise"); big.inputs["Scale"].default_value = 0.9; big.inputs["Detail"].default_value = 3; big.inputs["Roughness"].default_value = 0.6; link(nt, tc.outputs["Object"], big.inputs["Vector"])
    bm_ = nt.nodes.new("ShaderNodeMapRange"); bm_.inputs["From Min"].default_value = 0.35; bm_.inputs["From Max"].default_value = 0.65; bm_.inputs["To Min"].default_value = 0.88; bm_.inputs["To Max"].default_value = 1.08; link(nt, big.outputs["Fac"], bm_.inputs["Value"])
    mul = nt.nodes.new("ShaderNodeMixRGB"); mul.blend_type = "MULTIPLY"; mul.inputs["Fac"].default_value = 1.0; link(nt, bc.outputs["Color"], mul.inputs["Color1"]); link(nt, bm_.outputs[0], mul.inputs["Color2"])
    tn = nt.nodes.new("ShaderNodeMixRGB"); tn.blend_type = "MULTIPLY"; tn.inputs["Fac"].default_value = 1.0; tn.inputs["Color2"].default_value = (*tint, 1); link(nt, mul.outputs["Color"], tn.inputs["Color1"]); link(nt, tn.outputs["Color"], b.inputs["Base Color"])
    link(nt, r.outputs["Color"], b.inputs["Roughness"])
    nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 1.6; link(nt, nn.outputs["Color"], nm.inputs["Color"]); link(nt, nm.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Specular IOR Level"].default_value = 0.2
    return m

def wax(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.93, 0.88, 0.76, 1); b.inputs["Roughness"].default_value = 0.42
    for k, v in (("Subsurface Weight", 0.6), ("Subsurface Radius", (0.02, 0.012, 0.006)), ("Subsurface Scale", 1.0)):
        if k in b.inputs: b.inputs[k].default_value = v
    return m
def plain(name, color, rough=0.9):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough; return m
def flame(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (1.0, 0.75, 0.35, 1); b.inputs["Emission Color"].default_value = (1.0, 0.62, 0.22, 1); b.inputs["Emission Strength"].default_value = 14.0; return m

# ---------- 建材质 ----------
for m in list(bpy.data.materials):
    if m.name.startswith("yx_m_"): bpy.data.materials.remove(m)
M_OAK = wood("yx_m_oak", tint=(0.30, 0.17, 0.085), value=0.78, contrast=0.7, scale=1.0, coat=0.32)
M_OAK_L = wood("yx_m_oak_light", tint=(0.40, 0.24, 0.12), value=0.85, contrast=0.7, scale=1.0, coat=0.35)
M_OAK_D = wood("yx_m_oak_dark", tint=(0.20, 0.11, 0.055), value=0.72, contrast=0.65, scale=1.0, coat=0.2, dust=0.35)
M_FLOOR = wood("yx_m_floor", tint=(0.20, 0.12, 0.065), value=0.75, contrast=0.35, scale=0.55, coat=0.2, per_object=False)
M_BRASS = brass("yx_m_brass"); M_PLASTER = plaster("yx_m_plaster"); M_WAX = wax("yx_m_wax"); M_DARK = plain("yx_m_gapdark", (0.05, 0.04, 0.03)); M_FLAME = flame("yx_m_flame")

def assign(o, m):
    o.data.materials.clear(); o.data.materials.append(m)
for o in bpy.data.objects:
    if o.type != "MESH" or not o.name.startswith("yx_"): continue
    n = o.name
    if n.startswith("yx_back_board"): assign(o, M_DARK)
    elif n.startswith("yx_back_"): assign(o, M_OAK_D)
    elif n == "yx_wall": assign(o, M_PLASTER)
    elif n == "yx_floor": assign(o, M_FLOOR)
    elif n.startswith(("yx_plate", "yx_knob", "yx_cstick")): assign(o, M_BRASS)
    elif n.startswith("yx_candle"): assign(o, M_WAX)
    elif n.startswith("yx_flame"): assign(o, M_FLAME)
    elif n.startswith(("yx_archband", "yx_adent", "yx_pil_", "yx_shaft", "yx_astragal", "yx_neckbead", "yx_capblk", "yx_abacus", "yx_ent", "yx_dent", "yx_top_crown", "yx_rosette", "yx_volute", "yx_leaf", "yx_spandrel")): assign(o, M_OAK_L)
    elif n.startswith("yx_capfield"): assign(o, M_OAK_D)
    else: assign(o, M_OAK)
# 火苗（高模里没建）：在蜡烛顶加
for o in [o for o in bpy.data.objects if o.name.startswith("yx_candle_") and not bpy.data.objects.get(o.name.replace("candle", "flame"))]:
    top = o.location.z + o.dimensions.z / 2
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.013, location=(o.location.x, o.location.y, top + 0.02)); f = bpy.context.object; f.name = o.name.replace("candle", "flame"); f.scale = (0.6, 0.6, 1.5); f.data.materials.append(M_FLAME)

# ---------- 渲染：Cycles 显卡，中性光（看材质，不看气氛） ----------
sc.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences; prefs.compute_device_type = "OPTIX"; prefs.get_devices()
    for d in prefs.devices: d.use = (d.type == "OPTIX")
    sc.cycles.device = "GPU"
except Exception as e: print("GPU", e)
sc.cycles.samples = 96; sc.cycles.use_denoising = True
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Base Contrast"; sc.view_settings.exposure = 0
for o in list(bpy.data.objects):
    if o.type == "LIGHT" and o.name.startswith("yx_"): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.light_add(type="AREA", location=(-2.0, -3.0, 3.8)); k = bpy.context.object; k.name = "yx_key"; k.data.energy = 380; k.data.size = 2.5; k.data.color = (1.0, 0.92, 0.82); k.rotation_euler = (math.radians(48), 0, math.radians(-33))
bpy.ops.object.light_add(type="AREA", location=(2.5, -3.5, 1.5)); f_ = bpy.context.object; f_.name = "yx_fill"; f_.data.energy = 90; f_.data.size = 3.0; f_.data.color = (0.9, 0.93, 1.0); f_.rotation_euler = (math.radians(72), 0, math.radians(38))
bg = sc.world.node_tree.nodes.get("Background"); bg.inputs["Color"].default_value = (0.8, 0.78, 0.74, 1); bg.inputs["Strength"].default_value = 0.12
cam = bpy.data.objects["yx_cam"]; sc.camera = cam
def shoot(path, w, h, scale, center):
    sc.render.resolution_x = w; sc.render.resolution_y = h; cam.data.ortho_scale = scale; cam.location = (center[0], -8.0, center[1]); sc.render.filepath = path; bpy.ops.render.render(write_still=True)
z_base = 0.52; shelves = [z_base + 0.57 + k * 0.483 for k in range(4)]; xL = -(2.30 / 2 + 0.05 + 0.315 / 2)
shoot(SHOTS + r"\mat_wood.png", 1200, 700, 0.6, (0.0, shelves[1] - 0.05))
shoot(SHOTS + r"\mat_brass.png", 900, 500, 0.22, (0.0, shelves[2] - 0.03))
shoot(SHOTS + r"\mat_plaster.png", 1000, 1000, 1.1, (xL - 0.55, 2.9))
shoot(SHOTS + r"\mat_capital.png", 1000, 1000, 0.9, (xL + 0.2, shelves[-1] + 0.115 + 0.35))
shoot(SHOTS + r"\mat_full.png", 1536, 1024, 1536 / 295.2, (0.040, z_base + (930 - 512) / 295.2))
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\cnyan\blender_mcp\yanxilu\yanxilu_hipoly.blend")
print("materials assigned; objects", len([o for o in bpy.data.objects if o.name.startswith("yx_")]))
