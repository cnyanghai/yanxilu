#!/usr/bin/env python3
"""抠底与零件表切分：生图时让背景是一块平色（默认洋红 #FF00FF），这里按色键抠成带透明的 PNG，顺手把一张零件表拆成多件。
用法：
  python3 tools/ui/cut.py 零件表.png -o out/           # 抠底，整张输出 out/零件表.png
  python3 tools/ui/cut.py 零件表.png -o out/ --split --name icon   # 拆成 out/icon-01.png、icon-02.png…（按行再按列排）
参数：--key auto|#rrggbb 背景色（auto = 取四边像素的中位色）；--tol 到背景色的 Lab 距离在此以内全透明（默认 14）；
      --soft 最小过渡宽度（默认 18）；--solid 实心阈值，默认自动；--pad 四周留白像素（默认 8）；--min-area 拆分时忽略小于此面积的碎块（默认 400）。
边缘像素按最近实心像素的颜色算覆盖率并取其色（去色溢），所以深褐描边贴到任何底上都不带洋红边。"""
import argparse, os, sys
import numpy as np, cv2
from PIL import Image

ap = argparse.ArgumentParser(); ap.add_argument("src"); ap.add_argument("-o", "--out", default="tools/out/ui")
ap.add_argument("--key", default="auto"); ap.add_argument("--tol", type=float, default=14); ap.add_argument("--soft", type=float, default=18)
ap.add_argument("--pad", type=int, default=8); ap.add_argument("--split", action="store_true"); ap.add_argument("--name", default=None); ap.add_argument("--min-area", type=int, default=400); ap.add_argument("--solid", type=float, default=0, help="Lab 距离超过此值算实心前景；0 = 自动取前景距离 80 分位的七成")
a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
im = Image.open(a.src).convert("RGB"); rgb = np.asarray(im).astype(np.float32)
H, W, _ = rgb.shape
if a.key == "auto":
    edge = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]); key = np.median(edge, axis=0)
else:
    h = a.key.lstrip("#"); key = np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)
lab = cv2.cvtColor((rgb / 255).astype(np.float32), cv2.COLOR_RGB2Lab)
klab = cv2.cvtColor((key.reshape(1, 1, 3) / 255).astype(np.float32), cv2.COLOR_RGB2Lab)[0, 0]
d = np.linalg.norm(lab - klab, axis=2)
fgd = d[d > a.tol]; thr = a.solid if a.solid > 0 else (0.7 * np.percentile(fgd, 80) if fgd.size else a.tol + a.soft)
solid = d > max(thr, a.tol + a.soft); band = (d > a.tol) & ~solid
print("实心阈值 %.0f（Lab 距离），边带像素 %d" % (max(thr, a.tol + a.soft), band.sum()))
# 边缘像素是前景与背景的混色：找最近的实心像素当作它的前景色 F，按 C 在 K→F 连线上的位置算覆盖率，颜色直接用 F，这样描边不带背景色
if solid.any() and band.any():
    _, labels = cv2.distanceTransformWithLabels((~solid).astype(np.uint8), cv2.DIST_L2, 3, labelType=cv2.DIST_LABEL_PIXEL)
    coords = np.argwhere(solid); near = coords[labels[band] - 1]; F = rgb[near[:, 0], near[:, 1]]
    C = rgb[band]; FK = F - key; cov = np.clip((((C - key) * FK).sum(1)) / np.maximum((FK * FK).sum(1), 1e-3), 0, 1)
    alpha = solid.astype(np.float32); alpha[band] = cov; fg = rgb.copy(); fg[band] = F
else:
    alpha = np.clip((d - a.tol) / max(a.soft, 1e-3), 0, 1); A = alpha[..., None]; fg = np.clip(np.where(A > 0.02, (rgb - (1 - A) * key) / np.maximum(A, 0.02), rgb), 0, 255)
rgba = np.dstack([fg, alpha * 255]).astype(np.uint8)
print("背景色", [int(v) for v in key], "前景占比 %.1f%%" % (100 * (alpha > 0.5).mean()))

def crop(x0, y0, x1, y1):
    x0, y0 = max(0, x0 - a.pad), max(0, y0 - a.pad); x1, y1 = min(W, x1 + a.pad), min(H, y1 + a.pad)
    return Image.fromarray(rgba[y0:y1, x0:x1], "RGBA")

base = a.name or os.path.splitext(os.path.basename(a.src))[0]
if not a.split:
    ys, xs = np.where(alpha > 0.02)
    if len(xs) == 0: sys.exit("整张都是背景，查 --key / --tol")
    out = os.path.join(a.out, base + ".png"); crop(xs.min(), ys.min(), xs.max() + 1, ys.max() + 1).save(out); print("ok", out)
else:
    m = (alpha > 0.5).astype(np.uint8); k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)); m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k)
    n, lab_, st, cen = cv2.connectedComponentsWithStats(m, connectivity=8)
    parts = [(st[i, cv2.CC_STAT_LEFT], st[i, cv2.CC_STAT_TOP], st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT]) for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= a.min_area]
    # 按行分组再按列排：中心 y 相差不到平均高度一半算同一行
    parts.sort(key=lambda p: p[1] + p[3] / 2); rows = []
    for p in parts:
        cy = p[1] + p[3] / 2
        if rows and abs(cy - rows[-1][0]) < max(p[3], rows[-1][1][0][3]) * 0.5: rows[-1][1].append(p)
        else: rows.append([cy, [p]])
    ordered = [p for _, r in rows for p in sorted(r, key=lambda p: p[0])]
    for i, (x, y, w, h) in enumerate(ordered, 1):
        out = os.path.join(a.out, "%s-%02d.png" % (base, i)); crop(x, y, x + w, y + h).save(out); print("ok", out, "%dx%d" % (w, h))
    print("共 %d 件，%d 行" % (len(ordered), len(rows)))
