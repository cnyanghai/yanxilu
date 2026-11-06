#!/usr/bin/env python3
"""瓷砖无缝化：把一张材质图做成可平铺的方砖，并出 2x2 平铺预览看接缝。
用法：python3 tools/ui/tile.py 纸纹.png -o vendor/ui/tiles --size 512 --name paper
做法：先裁中间正方形缩到 size，错位半格让四边接缝跑到中心，再把原图中心用羽化十字盖回去。出 .webp 与预览 .png，并打印平均色（填 CSS 变量当底色）。"""
import argparse, os
import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser(); ap.add_argument("src"); ap.add_argument("-o", "--out", default="tools/out/ui"); ap.add_argument("--size", type=int, default=512)
ap.add_argument("--name", default=None); ap.add_argument("--feather", type=float, default=0.18, help="羽化带占边长比例"); ap.add_argument("--q", type=int, default=86)
a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
im = Image.open(a.src).convert("RGB"); s = min(im.size); im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2)).resize((a.size, a.size), Image.LANCZOS)
x = np.asarray(im).astype(np.float32); n = a.size
rolled = np.roll(np.roll(x, n // 2, axis=0), n // 2, axis=1)
# 十字羽化掩模：离中心十字越近越用原图（原图中心是连续的），把错位后的接缝盖掉
yy, xx = np.mgrid[0:n, 0:n]; f = max(2, int(n * a.feather))
dx = np.abs(xx - n / 2); dy = np.abs(yy - n / 2)
m = np.clip(1 - np.minimum(dx, dy) / f, 0, 1)  # 十字带内 1，往外线性落到 0
m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(f / 3))).astype(np.float32) / 255
out = rolled * (1 - m[..., None]) + x * m[..., None]
tile = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
name = a.name or os.path.splitext(os.path.basename(a.src))[0]
tile.save(os.path.join(a.out, name + ".webp"), quality=a.q, method=6)
prev = Image.new("RGB", (n * 2, n * 2))
for i in range(2):
    for j in range(2): prev.paste(tile, (i * n, j * n))
prev.resize((min(n * 2, 1024), min(n * 2, 1024)), Image.LANCZOS).save(os.path.join(a.out, name + "-2x2.png"))
mean = out.reshape(-1, 3).mean(axis=0)
print("ok", os.path.join(a.out, name + ".webp"), "平均色 #%02x%02x%02x" % tuple(int(v) for v in mean), "预览", os.path.join(a.out, name + "-2x2.png"))
