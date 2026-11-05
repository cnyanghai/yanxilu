#!/usr/bin/env python3
"""阶段 5 合成（调色部分，在 Blender 外做，几秒一轮，便于对着量值调）：
光晕（高光高斯泛光）、暗角（椭圆）、分通道增益与伽马、饱和、局部对比、颗粒。
用法：python3 comp_grade.py 输入.png 输出.png [--vig 0.5 --vigcx 0.5 --vigcy 0.46 --vigw 1.15 --vigh 1.05 --gain 1,0.95,0.86 --gamma 1,0.98,0.95 --sat 1.08 --clarity 0.25 --grain 0.04 --glow 0.35 --expo 0]
Blender 合成器只留分层通道与光晕，整体调色在这里。"""
import sys, argparse
import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser(); ap.add_argument("src"); ap.add_argument("dst")
ap.add_argument("--vig", type=float, default=0.5); ap.add_argument("--vigcx", type=float, default=0.5); ap.add_argument("--vigcy", type=float, default=0.46)
ap.add_argument("--vigw", type=float, default=1.15); ap.add_argument("--vigh", type=float, default=1.05); ap.add_argument("--vigpow", type=float, default=2.2)
ap.add_argument("--gain", default="1,0.95,0.86"); ap.add_argument("--gamma", default="1,0.98,0.95"); ap.add_argument("--sat", type=float, default=1.08)
ap.add_argument("--clarity", type=float, default=0.25); ap.add_argument("--grain", type=float, default=0.04); ap.add_argument("--glow", type=float, default=0.35); ap.add_argument("--expo", type=float, default=0.0); ap.add_argument("--q", type=int, default=90); ap.add_argument("--width", type=int, default=0)
a = ap.parse_args()
im0 = Image.open(a.src); alpha = np.asarray(im0.convert("RGBA"))[..., 3:4].astype(np.float32) / 255.0 if im0.mode in ("RGBA", "LA", "P") else None
im = im0.convert("RGB"); x = np.asarray(im).astype(np.float32) / 255.0
H, W, _ = x.shape
lin = x ** 2.2                                                   # 近似线性
# 曝光
lin *= 2 ** a.expo
# 光晕：高光部分大半径高斯，叠加
lum = lin @ np.array([0.2126, 0.7152, 0.0722], np.float32)
hi = np.clip(lum - 0.55, 0, None)[..., None] * lin / np.maximum(lum[..., None], 1e-4)
hi_img = Image.fromarray(np.clip(hi * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=max(2, int(W * 0.03))))
lin = lin + np.asarray(hi_img).astype(np.float32) / 255.0 * a.glow
# 分通道增益与伽马
gain = np.array([float(v) for v in a.gain.split(",")], np.float32); gamma = np.array([float(v) for v in a.gamma.split(",")], np.float32)
lin = np.clip(lin * gain, 0, None) ** (1.0 / gamma)
# 暗角：椭圆距离的幂
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
dx = (xx / W - a.vigcx) / (a.vigw / 2); dy = (yy / H - a.vigcy) / (a.vigh / 2)
d = np.sqrt(dx * dx + dy * dy); v = 1.0 - a.vig * np.clip(d, 0, 1.4) ** a.vigpow
lin *= v[..., None]
# 饱和
lum = lin @ np.array([0.2126, 0.7152, 0.0722], np.float32)
lin = lum[..., None] + (lin - lum[..., None]) * a.sat
# 回到显示空间
out = np.clip(lin, 0, 1) ** (1 / 2.2)
# 局部对比（反锐化掩模，大半径）
if a.clarity:
    o8 = Image.fromarray((out * 255).astype(np.uint8)); bl = np.asarray(o8.filter(ImageFilter.GaussianBlur(radius=max(2, int(W * 0.012))))).astype(np.float32) / 255.0
    out = np.clip(out + (out - bl) * a.clarity, 0, 1)
# 颗粒
if a.grain:
    rng = np.random.default_rng(7); g = rng.normal(0, 1, (H, W, 1)).astype(np.float32)
    out = np.clip(out + g * a.grain * (0.35 + 0.65 * (1 - out.mean(axis=2, keepdims=True))), 0, 1)
if a.width:
    from PIL import Image as _I
    def _rs(arr, mode):
        im_ = _I.fromarray((arr * 255).astype(np.uint8), mode); h_ = int(round(im_.height * a.width / im_.width)); return np.asarray(im_.resize((a.width, h_), _I.LANCZOS)).astype(np.float32) / 255.0
    if alpha is not None:
        rgba_ = _rs(np.concatenate([out, alpha], axis=2), "RGBA"); out, alpha = rgba_[..., :3], rgba_[..., 3:4]
    else: out = _rs(out, "RGB")
if alpha is not None:
    rgba = np.concatenate([out, alpha], axis=2); Image.fromarray((rgba * 255).astype(np.uint8), "RGBA").save(a.dst, quality=a.q, method=6)
else:
    Image.fromarray((out * 255).astype(np.uint8)).save(a.dst, quality=a.q)
print("ok", a.dst)
