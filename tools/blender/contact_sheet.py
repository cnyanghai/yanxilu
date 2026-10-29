"""把 study_frames.py 渲出的静帧拼成对照图：行是机位（院子 / 整间 / 案头），列是文件名里机位后面的标签（视场角或光）。
用法：python3 tools/blender/contact_sheet.py tools/out/frames [输出文件]"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
d = sys.argv[1] if len(sys.argv) > 1 else "tools/out/frames"
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(d, "contact.jpg")
shots = [("yard", "院子"), ("room", "整间"), ("desk", "案头")]
LABEL = {"day": "晴窗", "night": "夜读", "rain": "雨天"}
ORDER = {"day": 0, "night": 1, "rain": 2}
tags = sorted({f[:-4].split("_", 1)[1] for f in os.listdir(d) if f.endswith(".png") and "_" in f}, key=lambda t: (ORDER.get(t, 9), t))
cells = {(s, t): Image.open(os.path.join(d, f"{s}_{t}.png")).convert("RGB") for s, _ in shots for t in tags if os.path.exists(os.path.join(d, f"{s}_{t}.png"))}
if not cells: raise SystemExit("没有找到静帧")
w, h = next(iter(cells.values())).size
tw = 640; th = int(h * tw / w); pad = 14; top = 44; left = 60
sheet = Image.new("RGB", (left + len(tags) * (tw + pad), top + len(shots) * (th + pad)), (236, 230, 218))
dr = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc", 20)
except Exception: font = ImageFont.load_default()
for j, t in enumerate(tags): dr.text((left + j * (tw + pad) + 8, 10), LABEL.get(t, t.replace("fov", "视场角 ") + (" 度" if t.startswith("fov") else "")), fill=(40, 30, 20), font=font)
for i, (s, name) in enumerate(shots):
    dr.text((8, top + i * (th + pad) + th // 2 - 10), name, fill=(40, 30, 20), font=font)
    for j, t in enumerate(tags):
        im = cells.get((s, t))
        if im: sheet.paste(im.resize((tw, th)), (left + j * (tw + pad), top + i * (th + pad)))
sheet.save(out, quality=88); print(out)
