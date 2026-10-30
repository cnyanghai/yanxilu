#!/usr/bin/env python3
"""把烘焙贴图过一遍画风滤镜（Kuwahara 平滑 + 轻微色块化 + 暖调），输出到 world/assets/paint/。
用法: python3 tools/paint_texture.py world/assets/study_day_shell.jpg world/assets/study_day_furn.jpg [--radius 4]
原理（技术卡「贴图风格化」）：Kuwahara 滤镜在每个像素周围四个象限里取方差最小的那块的均值，
平的地方更平、边缘保持硬，像笔触铺出来的色块；再把亮度分成少数几档加一点暖色偏移。
"""
import sys, argparse
import numpy as np
from PIL import Image
from scipy.ndimage import uniform_filter

def kuwahara(img, r):
    out = np.empty_like(img)
    size = r + 1
    means, vars_ = [], []
    for dy in (-r, 0):
        for dx in (-r, 0):
            # 窗口 [dy, dy+r] x [dx, dx+r]，用 uniform_filter 的 origin 偏移实现
            origin = (dy + r // 2 if r % 2 == 0 else dy + r // 2, dx + r // 2 if r % 2 == 0 else dx + r // 2)
            m = np.stack([uniform_filter(img[..., c], size=size, origin=(-(dy + size // 2) + size // 2 - size // 2, -(dx + size // 2) + size // 2 - size // 2), mode="nearest") for c in range(3)], -1)
            sq = np.stack([uniform_filter(img[..., c] ** 2, size=size, origin=(-(dy + size // 2) + size // 2 - size // 2, -(dx + size // 2) + size // 2 - size // 2), mode="nearest") for c in range(3)], -1)
            means.append(m); vars_.append((sq - m ** 2).sum(-1))
    V = np.stack(vars_, 0); M = np.stack(means, 0)
    idx = V.argmin(0)
    out = np.take_along_axis(M, idx[None, ..., None], 0)[0]
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("files", nargs="+"); ap.add_argument("--radius", type=int, default=4); ap.add_argument("--levels", type=int, default=0); ap.add_argument("--warm", type=float, default=0.04)
    a = ap.parse_args()
    for f in a.files:
        im = np.asarray(Image.open(f).convert("RGB")).astype(np.float32) / 255
        k = kuwahara(im, a.radius)
        k = kuwahara(k, max(2, a.radius // 2))
        if a.levels:
            lum = k.mean(-1, keepdims=True); q = np.round(lum * a.levels) / a.levels
            k = np.clip(k + (q - lum) * 0.5, 0, 1)
        k[..., 0] = np.clip(k[..., 0] * (1 + a.warm), 0, 1); k[..., 2] = np.clip(k[..., 2] * (1 - a.warm), 0, 1)
        out = "world/assets/paint/" + f.split("/")[-1]
        Image.fromarray((k * 255).astype(np.uint8)).save(out, quality=90, optimize=True)
        print(out)

if __name__ == "__main__":
    main()
