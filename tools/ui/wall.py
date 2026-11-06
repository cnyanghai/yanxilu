#!/usr/bin/env python3
"""对照墙与盲测：把我们做的件混进参考图里排成一墙，只标序号，答案另写一个文件；同时量每张的明度、彩度、描边密度，看我们的是不是离群。
用法：
  python3 tools/ui/wall.py --ref 参考目录或文件... --ours 我们的.png ... -o tools/out/ui/wall.png [--cell 360 --cols 4 --no-shuffle]
量值：L 平均明度(0-100)、C 平均彩度、E 描边密度（Laplacian 方差，厚涂描边风格参考在 100-600 之间较常见）、S 饱和度中位。
门槛参考：我们的每项都落在参考的最小值到最大值之间，才算"混得进去"；盲测由用户看墙猜哪几张是我们的。"""
import argparse, glob, os, random
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser(); ap.add_argument("--ref", nargs="+", required=True); ap.add_argument("--ours", nargs="+", required=True)
ap.add_argument("-o", "--out", default="tools/out/ui/wall.png"); ap.add_argument("--cell", type=int, default=360); ap.add_argument("--cols", type=int, default=4); ap.add_argument("--no-shuffle", action="store_true"); ap.add_argument("--seed", type=int, default=None)
a = ap.parse_args(); os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
def expand(items):
    out = []
    for it in items:
        if os.path.isdir(it): out += sorted(f for ext in ("png", "jpg", "jpeg", "webp") for f in glob.glob(os.path.join(it, "*." + ext)))
        else: out += glob.glob(it) or [it]
    return out
refs, ours = expand(a.ref), expand(a.ours)
items = [(f, "ref") for f in refs] + [(f, "ours") for f in ours]
if not a.no_shuffle: random.Random(a.seed).shuffle(items)

def measure(f):
    im = Image.open(f).convert("RGBA"); bg = Image.new("RGBA", im.size, (236, 226, 204, 255)); bg.alpha_composite(im); rgb = np.asarray(bg.convert("RGB"))
    s = 512 / max(rgb.shape[:2]); rgb = cv2.resize(rgb, None, fx=s, fy=s, interpolation=cv2.INTER_AREA) if s < 1 else rgb
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2Lab).astype(np.float32); hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    mask = np.asarray(im.resize((rgb.shape[1], rgb.shape[0])))[..., 3] > 32 if im.mode == "RGBA" else np.ones(rgb.shape[:2], bool)
    L = lab[..., 0][mask].mean() * 100 / 255; C = np.hypot(lab[..., 1] - 128, lab[..., 2] - 128)[mask].mean()
    E = cv2.Laplacian(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), cv2.CV_32F).var(); S = np.median(hsv[..., 1][mask]) / 255
    return dict(L=L, C=C, E=E, S=S)

cell, cols = a.cell, a.cols; rows = (len(items) + cols - 1) // cols; pad = 16
wall = Image.new("RGB", (cols * (cell + pad) + pad, rows * (cell + pad + 28) + pad), (236, 226, 204))
try: font = ImageFont.truetype(glob.glob("vendor/fonts/*.ttf")[0], 22) if glob.glob("vendor/fonts/*.ttf") else ImageFont.load_default()
except Exception: font = ImageFont.load_default()
d = ImageDraw.Draw(wall); stats = []
for i, (f, kind) in enumerate(items):
    im = Image.open(f).convert("RGBA"); im.thumbnail((cell, cell), Image.LANCZOS)
    x = pad + (i % cols) * (cell + pad); y = pad + (i // cols) * (cell + pad + 28)
    wall.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2), im)
    d.text((x, y + cell + 4), "%d" % (i + 1), fill=(60, 40, 20), font=font); m = measure(f); stats.append((i + 1, kind, f, m))
wall.save(a.out)
key = os.path.splitext(a.out)[0] + "-key.txt"
with open(key, "w") as fh:
    fh.write("序号\t谁的\t文件\tL明度\tC彩度\tE描边\tS饱和\n")
    for i, kind, f, m in stats: fh.write("%d\t%s\t%s\t%.1f\t%.1f\t%.0f\t%.2f\n" % (i, "我们" if kind == "ours" else "参考", f, m["L"], m["C"], m["E"], m["S"]))
print("墙", a.out, "答案", key)
for k in ("L", "C", "E", "S"):
    rv = [m[k] for _, kind, _, m in stats if kind == "ref"]; ov = [(i, m[k]) for i, kind, _, m in stats if kind == "ours"]
    lo, hi = (min(rv), max(rv)) if rv else (0, 0)
    bad = [i for i, v in ov if not (lo <= v <= hi)]
    print("%s 参考 %.1f~%.1f  我们 %s  %s" % (k, lo, hi, " ".join("#%d=%.1f" % (i, v) for i, v in ov), ("离群 " + str(bad)) if bad else "在范围内"))
