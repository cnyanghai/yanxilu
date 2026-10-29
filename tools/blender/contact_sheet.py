"""把 study_frames.py 渲出的九张静帧拼成一张对照图：行是机位（院子 / 整间 / 案头），列是视场角。
用法：python3 tools/blender/contact_sheet.py tools/out/frames [输出文件]"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
d = sys.argv[1] if len(sys.argv) > 1 else "tools/out/frames"
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(d, "contact.jpg")
shots = [("yard", "院子"), ("room", "整间"), ("desk", "案头")]
fovs = sorted({int(f.split("fov")[1].split(".")[0]) for f in os.listdir(d) if "fov" in f and f.endswith(".png")})
cells = {}
for s, _ in shots:
    for f in fovs:
        p = os.path.join(d, f"{s}_fov{f:02d}.png")
        if os.path.exists(p): cells[(s, f)] = Image.open(p).convert("RGB")
if not cells: raise SystemExit("没有找到静帧")
w, h = next(iter(cells.values())).size
tw = 640; th = int(h * tw / w); pad = 14; top = 44; left = 60
sheet = Image.new("RGB", (left + len(fovs) * (tw + pad), top + len(shots) * (th + pad)), (236, 230, 218))
dr = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc", 20)
except Exception:
    try: font = ImageFont.truetype("/home/cnyanghai/brain/1-Projects/yanxilu/vendor/fonts/files/noto-sans-sc-chinese-simplified-400-normal.woff2", 20)
    except Exception: font = ImageFont.load_default()
for j, f in enumerate(fovs): dr.text((left + j * (tw + pad) + 8, 10), f"视场角 {f} 度", fill=(40, 30, 20), font=font)
for i, (s, name) in enumerate(shots):
    dr.text((8, top + i * (th + pad) + th // 2 - 10), name, fill=(40, 30, 20), font=font)
    for j, f in enumerate(fovs):
        im = cells.get((s, f))
        if im: sheet.paste(im.resize((tw, th)), (left + j * (tw + pad), top + i * (th + pad)))
sheet.save(out, quality=88); print(out)
