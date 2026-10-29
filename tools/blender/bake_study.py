"""研习录版本 2 · 第 3 步：把书房的建筑壳和大件家具烘焙成贴图并导出 glTF，给 world/ 用。
    blender -b --python tools/blender/bake_study.py -- --out world/assets --size 2048 --samples 96 --lights day,night,rain

做法照 kriss.ai：Cycles 烘 Combined（直接光 + 间接光 + 颜色），three.js 那边当无光照材质用，场景里不放任何实时光。
- 两组各一张图集：shell（楼板、墙、窗框、踢脚、看板、地毯、院子地基）和 furn（书墙、档案架、桌椅、灯五金、花盆、砚）
- 每组用 lightmap_pack 把所有物体的面打进同一张 UV；每个物体的材质先做成独立副本，各挂一个指向该组图集的图像节点再烘
- 数据驱动的东西（书、盒、牌、文竹）烘焙时隐藏，不进贴图、不导出，由 three.js 程序化生成
- 玻璃、灯泡、窗外月光板、地面只参与烘焙（发光 / 遮挡），不导出
- 光的能量整体压到 0.55 倍，避免 8 位贴图过曝；three.js 用曝光补回来
产物：study.glb（Draco，若本机 Blender 带 Draco）、study_<light>_<group>.jpg、study.json（机位、槽位、尺寸，three.js 坐标）
"""
import bpy, sys, os, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import study_scene as S

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default, cast=str):
    return cast(argv[argv.index(name) + 1]) if name in argv else default
OUT = arg("--out", "world/assets"); SIZE = arg("--size", 2048, int); SAMPLES = arg("--samples", 96, int)
LIGHTS_WANTED = arg("--lights", "day,night,rain").split(","); BAKE_SCALE = arg("--scale", 0.55, float); GPU = "--gpu" in argv
GROUP_SIZE = {"shell": SIZE, "furn": SIZE}
os.makedirs(OUT, exist_ok=True)
t0 = time.time()

G = S.build(with_items=True)
S.cycles(SAMPLES, gpu=GPU)
scene = bpy.context.scene
# 烘焙时数据物件隐藏（不投影、不进图）
for o in G["items"]: o.hide_render = True; o.hide_viewport = True

def select(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

# 1. 应用倒角等修改器（烘焙和导出都要最终几何），材质做成每个物体独立的副本
for g in ("shell", "furn"):
    select(G[g]); bpy.ops.object.convert(target="MESH")
    for o in G[g]:
        for i, m in enumerate(o.data.materials):
            o.data.materials[i] = m.copy()
        while len(o.data.uv_layers): o.data.uv_layers.remove(o.data.uv_layers[0])

# 2. 每组一张 UV：lightmap_pack 把组内所有物体打进同一张图
for g in ("shell", "furn"):
    select(G[g])
    bpy.ops.uv.lightmap_pack(PREF_CONTEXT="ALL_FACES", PREF_PACK_IN_ONE=True, PREF_NEW_UVLAYER=False, PREF_BOX_DIV=48, PREF_MARGIN_DIV=0.25)
    print(f"UV 打包完成：{g}（{len(G[g])} 个物体）", flush=True)

# 3. 烘焙：每种光 × 每组一张图
scene.cycles.bake_type = "COMBINED"
scene.render.bake.use_pass_direct = True; scene.render.bake.use_pass_indirect = True
scene.render.bake.use_pass_color = True; scene.render.bake.margin = 10; scene.render.bake.use_clear = True
scene.render.image_settings.file_format = "JPEG"; scene.render.image_settings.quality = 88
scene.view_settings.view_transform = "Standard"; scene.view_settings.look = "None"; scene.view_settings.exposure = 0
images = {}
for light in LIGHTS_WANTED:
    S.set_light(light, BAKE_SCALE)
    for g in ("shell", "furn"):
        img = bpy.data.images.new(f"bake_{light}_{g}", GROUP_SIZE[g], GROUP_SIZE[g], alpha=False)
        img.colorspace_settings.name = "sRGB"
        for o in G[g]:
            for m in o.data.materials:
                nodes = m.node_tree.nodes
                n = nodes.get("BAKE") or nodes.new("ShaderNodeTexImage"); n.name = "BAKE"; n.image = img; nodes.active = n
        select(G[g])
        t1 = time.time()
        bpy.ops.object.bake(type="COMBINED", margin=10, use_clear=True)
        fn = os.path.join(OUT, f"study_{light}_{g}.jpg")
        img.save_render(fn)
        images[(light, g)] = fn
        print(f"烘焙完成：{light} / {g} → {fn}  {time.time() - t1:.0f} 秒  共 {time.time() - t0:.0f} 秒", flush=True)

# 4. 导出 glTF：只要 shell 和 furn 的几何，名字加组前缀，不带材质贴图
for g in ("shell", "furn"):
    for o in G[g]:
        o.name = f"{g}_{o.name}"
        # 拆掉图像节点，免得导出器把 2048 的图塞进 glb
        for m in o.data.materials:
            n = m.node_tree.nodes.get("BAKE")
            if n: m.node_tree.nodes.remove(n)
select(G["shell"] + G["furn"])
glb = os.path.join(OUT, "study.glb")
common = dict(filepath=glb, export_format="GLB", use_selection=True, export_apply=True, export_texcoords=True, export_normals=True,
              export_materials="NONE", export_cameras=False, export_lights=False, export_yup=True, export_animations=False, export_skins=False)
try:
    bpy.ops.export_scene.gltf(**common, export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6, export_draco_position_quantization=14, export_draco_texcoord_quantization=12)
    print("glTF 已导出（Draco）", flush=True)
except Exception as e:
    print("Draco 导出失败，改为不压缩：", str(e)[:200], flush=True)
    bpy.ops.export_scene.gltf(**common)
    print("glTF 已导出（无压缩）", flush=True)

# 5. 配置
cfg = S.config(); cfg["bake_scale"] = BAKE_SCALE; cfg["atlas"] = {g: GROUP_SIZE[g] for g in GROUP_SIZE}
cfg["textures"] = {f"{l}_{g}": os.path.basename(images[(l, g)]) for (l, g) in images}
cfg["glb"] = "study.gltf.json"   # bake.sh 会把 study.glb 压成 Draco 再转成内嵌 base64 的 JSON glTF（Baba 只认 .json）
with open(os.path.join(OUT, "study.json"), "w", encoding="utf-8") as f: json.dump(cfg, f, ensure_ascii=False, indent=1)
sizes = {fn: os.path.getsize(os.path.join(OUT, fn)) // 1024 for fn in os.listdir(OUT)}
print("产物（KB）：", sizes, flush=True)
print(f"全部完成，{time.time() - t0:.0f} 秒", flush=True)
