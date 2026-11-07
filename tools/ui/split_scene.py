#!/usr/bin/env python3
"""把场景拆成两层：家具（透明底）与空场。
输入：原场景（家具画在里面）与 edit 端点去掉家具后的「空场」版；两张差分出家具的遮罩，清理、羽化，写出 furniture.webp（RGBA）与 field.webp。
用法：split_scene.py SCENE.png EMPTY.png OUTDIR --name shelf [--thr 34] [--feather 6] [--keep-top 60]
  --keep-top：遮罩只认 y ≥ 该值的区域（天空里模型重画出的云差异不算家具）
打印遮罩占比与包围盒，并出一张检查图 OUTDIR/<name>-split.jpg（空场 / 家具贴回 / 遮罩）。"""
import argparse, os
import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser(); ap.add_argument('scene'); ap.add_argument('empty'); ap.add_argument('out'); ap.add_argument('--name', required=True)
ap.add_argument('--thr', type=int, default=34); ap.add_argument('--feather', type=float, default=6); ap.add_argument('--keep-top', type=int, default=0); ap.add_argument('--min-area', type=int, default=4000)
ap.add_argument('--regions', default='', help='只认这些区域里的差异：rect:x0,y0,x1,y1 与 ell:cx,cy,rx,ry 用分号连，取并集')
a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
S = Image.open(a.scene).convert('RGB'); E = Image.open(a.empty).convert('RGB').resize(S.size, Image.LANCZOS)
s = np.asarray(S).astype(np.int16); e = np.asarray(E).astype(np.int16)
diff = np.abs(s - e).max(axis=2)
m = (diff > a.thr).astype(np.uint8)
if a.keep_top: m[:a.keep_top, :] = 0
if a.regions:
    yy, xx = np.mgrid[0:m.shape[0], 0:m.shape[1]]; reg = np.zeros_like(m)
    for part in a.regions.split(';'):
        kind, nums = part.split(':'); v = [float(t) for t in nums.split(',')]
        if kind == 'rect': reg |= ((xx >= v[0]) & (yy >= v[1]) & (xx <= v[2]) & (yy <= v[3])).astype(np.uint8)
        else: reg |= ((((xx - v[0]) / v[2]) ** 2 + ((yy - v[1]) / v[3]) ** 2) <= 1).astype(np.uint8)
    m &= reg
# 形态学清理：先开后闭，再去小块
mi = Image.fromarray(m * 255)
mi = mi.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
m = (np.asarray(mi) > 127).astype(np.uint8)
# 连通块：只留大块
from collections import deque
H, W = m.shape; lab = np.zeros_like(m, dtype=np.int32); n = 0; keep = np.zeros_like(m)
for y in range(H):
    for x in range(W):
        if m[y, x] and not lab[y, x]:
            n += 1; q = deque([(y, x)]); lab[y, x] = n; pts = []
            while q:
                cy, cx = q.popleft(); pts.append((cy, cx))
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n; q.append((ny, nx))
            if len(pts) >= a.min_area:
                for cy, cx in pts: keep[cy, cx] = 1
m = keep
# 填洞：反相后把接触边框的背景保留，其余算洞
inv = (1 - m).astype(np.uint8); outside = np.zeros_like(inv); q = deque()
for y in range(H):
    for x in (0, W - 1):
        if inv[y, x] and not outside[y, x]: outside[y, x] = 1; q.append((y, x))
for x in range(W):
    for y in (0, H - 1):
        if inv[y, x] and not outside[y, x]: outside[y, x] = 1; q.append((y, x))
while q:
    cy, cx = q.popleft()
    for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
        if 0 <= ny < H and 0 <= nx < W and inv[ny, nx] and not outside[ny, nx]: outside[ny, nx] = 1; q.append((ny, nx))
m = np.where((inv == 1) & (outside == 0), 1, m).astype(np.uint8)
alpha = Image.fromarray(m * 255).filter(ImageFilter.GaussianBlur(a.feather))
ys, xs = np.where(m); box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(xs) else None
furn = S.convert('RGBA'); furn.putalpha(alpha)
furn.save(os.path.join(a.out, f'{a.name}-furniture.webp'), 'WEBP', quality=90, method=6)
E.save(os.path.join(a.out, f'{a.name}-field.webp'), 'WEBP', quality=86, method=6)
# 检查图
back = E.convert('RGBA'); back.alpha_composite(furn)
chk = Image.new('RGB', (S.width * 3 + 20, S.height), (255, 0, 255)); chk.paste(E, (0, 0)); chk.paste(back.convert('RGB'), (S.width + 10, 0)); chk.paste(Image.fromarray(m * 255).convert('RGB'), (S.width * 2 + 20, 0))
chk.resize((chk.width // 2, chk.height // 2)).save(os.path.join(a.out, f'{a.name}-split.jpg'), quality=85)
print(a.name, '遮罩占比 %.1f%%' % (m.mean() * 100), '包围盒', box, '→', os.path.join(a.out, f'{a.name}-furniture.webp'))
