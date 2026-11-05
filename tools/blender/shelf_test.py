"""Blender 书架试渲：一块橡木板、一排布面书（一本斜靠、三本平放）、灰泥墙、左上一盏暖光。
用途：和 CSS 版并排，判断网页版要不要走"Blender 预渲染贴图"的路。
用法：blender -b --python tools/blender/shelf_test.py -- --out tools/out/blender-shelf.png --samples 96 --w 1600 --h 640
"""
import bpy, sys, math, random, os

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(k, d):
    return argv[argv.index(k) + 1] if k in argv else d
OUT = os.path.abspath(arg("--out", "tools/out/blender-shelf.png"))
SAMPLES = int(arg("--samples", "96")); W = int(arg("--w", "1600")); H = int(arg("--h", "640"))
FONT = "/home/cnyanghai/.local/share/fonts/LXGWWenKai-Medium.ttf"
random.seed(11)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = False
sc.cycles.device = "CPU"
sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Base Contrast"; sc.view_settings.exposure = -0.95

def mat(name, color, rough=0.6, bump=None, grain=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1); bsdf.inputs["Roughness"].default_value = rough
    if grain:  # 颜色上叠一点噪声，去掉"平涂"
        n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = grain[0]; n.inputs["Detail"].default_value = 6
        mix = nt.nodes.new("ShaderNodeMixRGB"); mix.blend_type = "MULTIPLY"; mix.inputs["Fac"].default_value = grain[1]
        mix.inputs["Color1"].default_value = (*color, 1)
        ramp = nt.nodes.new("ShaderNodeValToRGB"); ramp.color_ramp.elements[0].position = 0.35; ramp.color_ramp.elements[1].position = 0.65
        nt.links.new(n.outputs["Fac"], ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], mix.inputs["Color2"])
        nt.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])
    if bump:  # 法线上叠凹凸：灰泥 / 布纹 / 木纹
        n2 = nt.nodes.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = bump[0]; n2.inputs["Detail"].default_value = 8; n2.inputs["Roughness"].default_value = 0.7
        b = nt.nodes.new("ShaderNodeBump"); b.inputs["Strength"].default_value = bump[1]; b.inputs["Distance"].default_value = 0.02
        nt.links.new(n2.outputs["Fac"], b.inputs["Height"]); nt.links.new(b.outputs["Normal"], bsdf.inputs["Normal"])
    return m

def wood(name, color):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes["Principled BSDF"]; bsdf.inputs["Roughness"].default_value = 0.42
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1, 14, 1)
    wave = nt.nodes.new("ShaderNodeTexWave"); wave.inputs["Scale"].default_value = 2.2; wave.inputs["Distortion"].default_value = 6; wave.inputs["Detail"].default_value = 4
    ramp = nt.nodes.new("ShaderNodeValToRGB"); ramp.color_ramp.elements[0].color = (*[c * 0.72 for c in color], 1); ramp.color_ramp.elements[1].color = (*color, 1)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"]); nt.links.new(mp.outputs["Vector"], wave.inputs["Vector"])
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    b = nt.nodes.new("ShaderNodeBump"); b.inputs["Strength"].default_value = 0.12
    nt.links.new(wave.outputs["Fac"], b.inputs["Height"]); nt.links.new(b.outputs["Normal"], bsdf.inputs["Normal"])
    return m

def box(name, size, loc, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = (size[0], size[1], size[2])
    o.data.materials.append(m); return o

# 墙：灰泥，略带颗粒
box("wall", (3.2, 0.02, 1.6), (0, 0.11, 1.0), mat("plaster", (0.66, 0.61, 0.53), 0.92, bump=(180, 0.18), grain=(60, 0.10)))
# 书架板：橡木，有厚度，两只托架
oak = wood("oak", (0.56, 0.40, 0.24))
SHELF_Z = 0.80; DEPTH = 0.24; TH = 0.032
box("plank", (2.4, DEPTH, TH), (0, 0, SHELF_Z), oak)
dark = mat("iron", (0.10, 0.09, 0.08), 0.5)
for x in (-1.05, 1.05):
    box("bracket", (0.03, DEPTH - 0.04, 0.09), (x, 0.0, SHELF_Z - TH / 2 - 0.045), dark)
    box("bracket2", (0.03, 0.03, 0.22), (x, DEPTH / 2 - 0.035, SHELF_Z - 0.11), dark)

# 书：布面，六种名色；一本斜靠，三本平放
palette = [(0.42, 0.11, 0.16), (0.09, 0.19, 0.33), (0.07, 0.36, 0.34), (0.62, 0.40, 0.14), (0.86, 0.82, 0.72), (0.12, 0.11, 0.10), (0.48, 0.24, 0.10), (0.30, 0.34, 0.20)]
mats = [mat("cloth%d" % i, c, 0.78, bump=(420, 0.25), grain=(300, 0.18)) for i, c in enumerate(palette)]
gold = mat("gold", (0.85, 0.66, 0.30), 0.35); gold.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 1.0
paper = mat("paper", (0.93, 0.89, 0.78), 0.9)
font = None
try:
    font = bpy.data.fonts.load(FONT)
except Exception:
    font = None
titles = ["大国政治的悲剧", "国际政治理论", "国家间政治", "伯罗奔尼撒战争史", "大国的兴衰", "大外交", "战争论", "大棋局", "注定一战", "政治秩序的起源", "权力精英", "大幻想"]

def book(x, w, h, m, title, z=SHELF_Z + TH / 2, lean=0.0, d=0.17):
    """一本书：盒身 + 书脊上的黑题签 + 金字。全部按世界坐标摆，不用父子关系。"""
    yc = -DEPTH / 2 + d / 2 + 0.012; yf = yc - d / 2  # 书脊所在的前面
    if lean:
        # 绕书底外角斜靠：先算中心
        cx = x + math.sin(-lean) * h / 2; cz = z + math.cos(lean) * h / 2
        o = box("book", (w, d, h), (cx, yc, cz), m, rot=(0, lean, 0))
        return o
    o = box("book", (w, d, h), (x, yc, z + h / 2), m)
    # 题签：黑牌贴在脊上
    ph = min(0.11, h * 0.42); pz = z + h - 0.03 - ph / 2
    box("label", (w * 0.78, 0.0015, ph), (x, yf - 0.0008, pz), labm)
    if font:
        try:
            bpy.ops.object.text_add(location=(x, yf - 0.0018, z + h - 0.03 - 0.004))
            t = bpy.context.object; t.data.font = font; t.data.body = "\n".join(title[:6])
            t.data.size = w * 0.58; t.data.align_x = "CENTER"; t.data.space_line = 1.02
            t.rotation_euler = (math.pi / 2, 0, 0); t.data.materials.append(gold)
        except Exception:
            pass
    return o

labm = mat("lab", (0.08, 0.07, 0.06), 0.6)
x = -1.12
widths = [0.045, 0.036, 0.052, 0.040, 0.034, 0.048, 0.030, 0.056, 0.038, 0.044, 0.035, 0.050]
heights = [0.235, 0.222, 0.248, 0.230, 0.215, 0.240, 0.205, 0.252, 0.226, 0.238, 0.212, 0.244]
for i in range(12):
    w, h = widths[i], heights[i]
    book(x + w / 2, w, h, mats[i % len(mats)], titles[i])
    x += w + 0.004
# 一本斜靠在最后一本上
book(x + 0.006, 0.034, 0.226, mats[1], "权力与相互依赖", lean=-0.16)
x += 0.085
# 三本平放成一摞
zz = SHELF_Z + TH / 2
for j, (w2, h2) in enumerate([(0.050, 0.240), (0.044, 0.228), (0.038, 0.216)]):
    box("flat", (h2, 0.17, w2), (x + h2 / 2 + 0.03 - j * 0.006, -DEPTH / 2 + 0.17 / 2 + 0.012, zz + w2 / 2), mats[(j + 3) % len(mats)])
    zz += w2

# 灯：左上一盏暖的主光，右侧一盏弱的补光，世界光很低
bpy.ops.object.light_add(type="AREA", location=(-1.4, -1.6, 2.1)); key = bpy.context.object
key.data.energy = 170; key.data.size = 1.2; key.data.color = (1.0, 0.93, 0.82)
key.rotation_euler = (math.radians(52), 0, math.radians(-38))
bpy.ops.object.light_add(type="AREA", location=(1.6, -2.0, 1.1)); fill = bpy.context.object
fill.data.energy = 40; fill.data.size = 2.0; fill.data.color = (0.9, 0.93, 1.0)
fill.rotation_euler = (math.radians(75), 0, math.radians(40))
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.52, 0.47, 1); world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.12

# 相机：正面略高一点，能看到板的上沿和书顶
bpy.ops.object.camera_add(location=(-0.52, -2.05, SHELF_Z + 0.22)); cam = bpy.context.object
cam.rotation_euler = (math.radians(87), 0, 0); cam.data.lens = 50; sc.camera = cam

for ob in bpy.data.objects:
    if ob.type == 'MESH' and ob.name.startswith(('book', 'flat', 'plank')): print('POS', ob.name, [round(v, 3) for v in ob.location], [round(v, 3) for v in ob.dimensions])
bpy.ops.render.render(write_still=True)
print("rendered", OUT)
