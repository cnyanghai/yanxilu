# 研习录网页版 · 笔记本架（斜面展示架）：在 Blender 窗口里建，最后渲成透明底图给网页用
# 尺寸沿用 yanxilu-world ASSET-SPEC：1.5 宽 × 0.45 深 × 1.0 高（米）。本子由网页按数据叠上去，这里不建本子。
import bpy, math

# ---- 清场（只清本窗口的默认物体） ----
for o in list(bpy.data.objects):
    if o.name in ("Cube", "Light", "Camera") or o.name.startswith("yx_"):
        bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.materials):
    if m.name.startswith("yx_") or m.users == 0: bpy.data.materials.remove(m)

sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE_NEXT"
sc.view_settings.view_transform = "AgX"

# ---- 材质：橡木（和书架板同一块木头）、黄铜、深铁 ----
def oak(name="yx_oak", color=(0.30, 0.18, 0.09)):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.45
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1, 18, 1)
    w = nt.nodes.new("ShaderNodeTexWave"); w.inputs["Scale"].default_value = 2.0; w.inputs["Distortion"].default_value = 7; w.inputs["Detail"].default_value = 5
    r = nt.nodes.new("ShaderNodeValToRGB"); r.color_ramp.elements[0].color = (*[c * 0.7 for c in color], 1); r.color_ramp.elements[1].color = (*color, 1)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"]); nt.links.new(mp.outputs["Vector"], w.inputs["Vector"]); nt.links.new(w.outputs["Fac"], r.inputs["Fac"]); nt.links.new(r.outputs["Color"], b.inputs["Base Color"])
    bm = nt.nodes.new("ShaderNodeBump"); bm.inputs["Strength"].default_value = 0.10; nt.links.new(w.outputs["Fac"], bm.inputs["Height"]); nt.links.new(bm.outputs["Normal"], b.inputs["Normal"])
    return m
def plain(name, color, rough=0.5, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    return m
OAK = oak(); BRASS = plain("yx_brass", (0.85, 0.66, 0.30), 0.35, 1.0); IRON = plain("yx_iron", (0.10, 0.09, 0.08), 0.5)

def box(name, size, loc, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = size; o.data.materials.append(m)
    # 轻微倒角，让棱线能受光
    md = o.modifiers.new("bevel", "BEVEL"); md.width = 0.003; md.segments = 2
    return o

# ---- 几何：两块侧板、一块斜面板、前沿挡条、背上横档、底下一块平板 ----
W, D, H = 1.5, 0.45, 1.0
T = 0.03                      # 板厚
TILT = math.radians(22)       # 斜面倾角
box("yx_cheek_l", (T, D, H), (-W / 2 + T / 2, 0, H / 2), OAK)
box("yx_cheek_r", (T, D, H), (W / 2 - T / 2, 0, H / 2), OAK)
# 斜面板：绕 X 轴倾斜，后高前低；中心在高度 0.78 处
box("yx_slope", (W - 2 * T, D - 0.04, T), (0, 0.0, 0.78), OAK, rot=(TILT, 0, 0))
# 前沿挡条：贴在斜面板前下沿，拦住本子
lip_y = -(D - 0.04) / 2 * math.cos(TILT); lip_z = 0.78 - (D - 0.04) / 2 * math.sin(TILT)
box("yx_lip", (W - 2 * T, 0.025, 0.065), (0, lip_y - 0.005, lip_z + 0.015), OAK, rot=(TILT, 0, 0))
# 背上横档与底板
box("yx_rail", (W - 2 * T, T, 0.08), (0, D / 2 - T / 2, H - 0.04), OAK)
box("yx_base", (W - 2 * T, D, T), (0, 0, 0.12), OAK)
# 黄铜题牌（架子正面居中）
box("yx_plate", (0.16, 0.004, 0.035), (0, lip_y - 0.02, lip_z - 0.02), BRASS)

# ---- 光与机位：左上一盏暖主光，右侧弱补光；正交相机正面略俯 ----
bpy.ops.object.light_add(type="AREA", location=(-1.6, -1.8, 2.4)); k = bpy.context.object; k.name = "yx_key"
k.data.energy = 170; k.data.size = 1.5; k.data.color = (1.0, 0.93, 0.82); k.rotation_euler = (math.radians(50), 0, math.radians(-40))
bpy.ops.object.light_add(type="AREA", location=(1.8, -2.2, 1.2)); f = bpy.context.object; f.name = "yx_fill"
f.data.energy = 50; f.data.size = 2.5; f.data.color = (0.9, 0.93, 1.0); f.rotation_euler = (math.radians(70), 0, math.radians(40))
if sc.world is None: sc.world = bpy.data.worlds.new("yx_world")
sc.world.use_nodes = True; bg = sc.world.node_tree.nodes.get("Background")
if bg: bg.inputs["Color"].default_value = (0.62, 0.59, 0.54, 1); bg.inputs["Strength"].default_value = 0.35
bpy.ops.object.camera_add(location=(0, -3.2, 1.45)); cam = bpy.context.object; cam.name = "yx_cam"
cam.data.type = "PERSP"; cam.data.lens = 75; cam.rotation_euler = (math.radians(75), 0, 0); sc.camera = cam
# 地面：浅灰泥色，接住影子（出透明底图时去掉）
bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0)); fl = bpy.context.object; fl.name = "yx_floor"; fl.data.materials.append(plain("yx_floor", (0.72, 0.68, 0.60), 0.95))
sc.render.resolution_x = 1600; sc.render.resolution_y = 1000; sc.render.film_transparent = False  # 设计阶段先看得见背景，最后出图再透明

# ---- 视口：切到相机视角、渲染着色，方便截图看 ----
for area in bpy.context.screen.areas:
    if area.type == "VIEW_3D":
        sp = area.spaces[0]; sp.shading.type = "RENDERED"; sp.region_3d.view_perspective = "CAMERA"; sp.overlay.show_overlays = False
print("rack built")
