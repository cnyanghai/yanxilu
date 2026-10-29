"""研习录版本 2 · 书房静帧（构图稿 / 色彩板）。场景在 study_scene.py 里。
    blender -b --python tools/blender/study_frames.py -- --out tools/out/board --samples 96 --res 1280 800 \
        --shots yard,room,desk --lights day,night,rain --fov yard=5,room=8,desk=12
"""
import bpy, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import study_scene as S
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default, n=1, cast=str):
    if name in argv:
        i = argv.index(name); vals = [cast(v) for v in argv[i + 1:i + 1 + n]]; return vals if n > 1 else vals[0]
    return default
OUT = arg("--out", "tools/out/board"); SAMPLES = arg("--samples", 64, cast=int); RES = arg("--res", [1280, 800], n=2, cast=int)
SHOTS_WANTED = arg("--shots", "yard,room,desk").split(","); LIGHTS_WANTED = arg("--lights", "day").split(",")
FOV = {}
for kv in arg("--fov", "").split(","):
    if "=" in kv: k, v = kv.split("="); FOV[k] = float(v)
os.makedirs(OUT, exist_ok=True)
S.build(); S.cycles(SAMPLES); cam = S.camera()
scene = bpy.context.scene
scene.render.resolution_x, scene.render.resolution_y = RES; scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"; scene.render.film_transparent = False
for light in LIGHTS_WANTED:
    S.set_light(light)
    for shot in SHOTS_WANTED:
        d = S.place(cam, shot, FOV.get(shot))
        fn = os.path.join(OUT, f"{shot}_{light}.png"); scene.render.filepath = fn
        bpy.ops.render.render(write_still=True)
        print(f"已渲染 {fn}  视场角 {FOV.get(shot) or S.SHOTS[shot]['fov']}° 距离 {d:.1f} m", flush=True)
print("全部完成", flush=True)
