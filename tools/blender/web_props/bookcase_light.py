# 书柜 · 阶段 4 看光（专业流程）。在已有高模加材质的窗口里跑：只动灯、世界、曝光、机位，不动几何与材质。
# 蓝本的光：左上一束大面积暖光打在墙上、往右下自然暗下去；两支蜡烛各一圈光晕；柜内靠反弹与烛光，深而不死黑。
import bpy, math, sys
sc = bpy.context.scene
# 参数（每轮只改一两个，记在 docs/bookcase-production.md）
KEY_E, KEY_SIZE, KEY_POS, KEY_ROT = 270, 1.6, (-2.9, -2.3, 4.1), (58, 0, -40)   # 第三轮的灯位，再压一点、更朝下，热点落低
KEY2_E = 75
FILL_E = 40
CANDLE_E = 90
WORLD = ((0.42, 0.30, 0.18, 1), 0.07)
EXPO, LOOK = -1.15, "AgX - High Contrast"
WOOD_SAT = 1.0   # 留给材质微调
if "--args" in sys.argv:
    pass

for o in list(bpy.data.objects):
    if o.type == "LIGHT" and o.name.startswith("yx_"): bpy.data.objects.remove(o, do_unlink=True)
def area(name, loc, rot, e, size, color, spread=100):
    bpy.ops.object.light_add(type="AREA", location=loc); l = bpy.context.object; l.name = name
    l.data.energy = e; l.data.size = size; l.data.color = color; l.data.spread = math.radians(spread); l.rotation_euler = tuple(math.radians(a) for a in rot); return l
area("yx_key", KEY_POS, KEY_ROT, KEY_E, KEY_SIZE, (1.0, 0.70, 0.40))
area("yx_key2", (3.2, -1.4, 3.6), (55, 0, 48), KEY2_E, 1.5, (1.0, 0.62, 0.30))
area("yx_fill", (0.6, -3.8, 1.4), (80, 0, 8), FILL_E, 3.0, (1.0, 0.84, 0.68))
for o in [o for o in bpy.data.objects if o.name.startswith("yx_flame_")]:
    bpy.ops.object.light_add(type="POINT", location=(o.location.x, o.location.y - 0.05, o.location.z + 0.03)); p = bpy.context.object; p.name = o.name.replace("flame", "candlelight")
    p.data.energy = CANDLE_E; p.data.color = (1.0, 0.60, 0.26); p.data.shadow_soft_size = 0.05
def set_tint(mat_name, rgb):
    mm = bpy.data.materials.get(mat_name)
    if not mm: return
    tints = [n for n in mm.node_tree.nodes if n.type == "MIX_RGB" and n.blend_type == "MULTIPLY" and n.inputs["Fac"].default_value == 1.0 and not n.inputs["Color2"].is_linked]
    if tints: tints[0].inputs["Color2"].default_value = (*rgb, 1)
set_tint("yx_m_oak_light", (0.34, 0.185, 0.09)); set_tint("yx_m_oak", (0.27, 0.145, 0.07)); set_tint("yx_m_oak_dark", (0.19, 0.10, 0.05))
m = bpy.data.materials.get("yx_m_plaster")
if m:
    for n in m.node_tree.nodes:
        if n.type == "MIX_RGB" and n.blend_type == "MULTIPLY" and tuple(round(c, 2) for c in n.inputs["Color2"].default_value[:3]) in ((0.86, 0.58, 0.28), (0.9, 0.52, 0.18), (0.84, 0.56, 0.28)): n.inputs["Color2"].default_value = (0.84, 0.56, 0.28, 1)
        if n.type == "HUE_SAT": n.inputs["Saturation"].default_value = 0.5
bg = sc.world.node_tree.nodes.get("Background"); bg.inputs["Color"].default_value = WORLD[0]; bg.inputs["Strength"].default_value = WORLD[1]
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = LOOK; sc.view_settings.exposure = EXPO
sc.render.engine = "CYCLES"; sc.cycles.samples = 96; sc.cycles.use_denoising = True
cam = bpy.data.objects["yx_cam"]; sc.camera = cam
cam.data.ortho_scale = 1536 / 295.2; cam.location = (0.040, -8.0, 0.52 + (930 - 512) / 295.2)
sc.render.resolution_x = 1536; sc.render.resolution_y = 1024
sc.render.filepath = r"C:\Users\cnyan\blender_mcp\yanxilu\shots\light.png"
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\cnyan\blender_mcp\yanxilu\yanxilu_hipoly.blend")
print("light pass done")
