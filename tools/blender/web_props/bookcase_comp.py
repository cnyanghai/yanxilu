# 书柜 · 阶段 5 分层渲染与合成（专业流程）。在已有高模、材质、灯的窗口里跑：开分层通道，合成器里做光晕、暗角、调色、锐化、颗粒。
import bpy, math, os
sc = bpy.context.scene; vl = bpy.context.view_layer
SHOTS = r"C:\Users\cnyan\blender_mcp\yanxilu\shots"
# 参数（每轮只动一两个）
VIG_FAC, VIG_W, VIG_H, VIG_CX, VIG_CY, VIG_BLUR = 0.55, 1.15, 1.05, 0.5, 0.46, 420
GLARE_THR, GLARE_SIZE, GLARE_MIX = 1.0, 7, -0.35
GAIN, GAMMA, LIFT = (1.0, 0.95, 0.86), (1.0, 0.98, 0.95), (1.0, 1.0, 1.0)   # 偏暖、压蓝
SAT, CONTRAST, EXPO_C = 1.08, 1.06, -0.05
SHARPEN = 0.25
GRAIN = 0.06

# 分层通道
for k in ("use_pass_diffuse_direct", "use_pass_diffuse_indirect", "use_pass_diffuse_color", "use_pass_glossy_direct", "use_pass_glossy_indirect", "use_pass_glossy_color", "use_pass_emit", "use_pass_ambient_occlusion", "use_pass_mist"):
    try: setattr(vl, k, True)
    except Exception as e: print("pass", k, e)
sc.use_nodes = True; nt = sc.node_tree
for n in list(nt.nodes): nt.nodes.remove(n)
rl = nt.nodes.new("CompositorNodeRLayers")
# 光晕
gl = nt.nodes.new("CompositorNodeGlare"); gl.glare_type = "FOG_GLOW"; gl.threshold = GLARE_THR; gl.size = GLARE_SIZE; gl.mix = GLARE_MIX
nt.links.new(rl.outputs["Image"], gl.inputs["Image"])
# 调色：曝光 → 色彩平衡（提亮暖、压蓝）→ 饱和与对比
ex = nt.nodes.new("CompositorNodeExposure"); ex.inputs["Exposure"].default_value = EXPO_C; nt.links.new(gl.outputs["Image"], ex.inputs["Image"])
cb = nt.nodes.new("CompositorNodeColorBalance"); cb.correction_method = "LIFT_GAMMA_GAIN"; cb.lift = LIFT; cb.gamma = GAMMA; cb.gain = GAIN; nt.links.new(ex.outputs["Image"], cb.inputs["Image"])
hs = nt.nodes.new("CompositorNodeHueSat"); hs.inputs["Saturation"].default_value = SAT; nt.links.new(cb.outputs["Image"], hs.inputs["Image"])
bc = nt.nodes.new("CompositorNodeBrightContrast"); bc.inputs["Contrast"].default_value = (CONTRAST - 1) * 20; nt.links.new(hs.outputs["Image"], bc.inputs["Image"])
# 轻锐化（局部对比）
sh = nt.nodes.new("CompositorNodeFilter"); sh.filter_type = "SHARPEN"; sh.inputs["Fac"].default_value = SHARPEN; nt.links.new(bc.outputs["Image"], sh.inputs["Image"])
# 暗角：椭圆遮罩模糊后乘
el = nt.nodes.new("CompositorNodeEllipseMask"); el.width = VIG_W; el.height = VIG_H; el.x = VIG_CX; el.y = VIG_CY
bl = nt.nodes.new("CompositorNodeBlur"); bl.filter_type = "GAUSS"; bl.size_x = VIG_BLUR; bl.size_y = VIG_BLUR; bl.use_relative = False; nt.links.new(el.outputs["Mask"], bl.inputs["Image"])
inv = nt.nodes.new("CompositorNodeMath"); inv.operation = "MULTIPLY_ADD"; inv.inputs[1].default_value = VIG_FAC; inv.inputs[2].default_value = 1.0 - VIG_FAC; nt.links.new(bl.outputs["Image"], inv.inputs[0])   # 边缘 1-fac，中心 1
vg = nt.nodes.new("CompositorNodeMixRGB"); vg.blend_type = "MULTIPLY"; vg.inputs["Fac"].default_value = 1.0; nt.links.new(sh.outputs["Image"], vg.inputs[1]); nt.links.new(inv.outputs[0], vg.inputs[2])
# 颗粒
tx = bpy.data.textures.get("yx_grain") or bpy.data.textures.new("yx_grain", type="NOISE")
tn = nt.nodes.new("CompositorNodeTexture"); tn.texture = tx
gr = nt.nodes.new("CompositorNodeMixRGB"); gr.blend_type = "OVERLAY"; gr.inputs["Fac"].default_value = GRAIN; nt.links.new(vg.outputs["Image"], gr.inputs[1]); nt.links.new(tn.outputs["Value"], gr.inputs[2])
cmp = nt.nodes.new("CompositorNodeComposite"); nt.links.new(gr.outputs["Image"], cmp.inputs["Image"])
# 分层存盘
fo = nt.nodes.new("CompositorNodeOutputFile"); fo.base_path = os.path.join(SHOTS, "passes"); fo.format.file_format = "PNG"; fo.format.color_depth = "16"
fo.file_slots.clear()
for name, sock in (("beauty", gr.outputs["Image"]), ("diffuse_direct", rl.outputs.get("DiffDir")), ("diffuse_color", rl.outputs.get("DiffCol")), ("glossy_direct", rl.outputs.get("GlossDir")), ("emission", rl.outputs.get("Emit")), ("ao", rl.outputs.get("AO")), ("mist", rl.outputs.get("Mist"))):
    if sock is None: print("no pass", name); continue
    fo.file_slots.new(name); nt.links.new(sock, fo.inputs[-1])
sc.render.filepath = os.path.join(SHOTS, "comp.png"); sc.render.resolution_x = 1536; sc.render.resolution_y = 1024
sc.cycles.samples = 128
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\cnyan\blender_mcp\yanxilu\yanxilu_hipoly.blend")
print("comp done")
