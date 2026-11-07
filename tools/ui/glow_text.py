#!/usr/bin/env python3
"""发光锈铁字：在图上某个矩形里写隶书字，牌后透光、外发光、锈纹字芯、暗边。
发光锈铁字：在图上某个矩形里写隶书字（牌后透光、外发光、锈纹字芯、暗边）。第四稿规则：生图里一律留白，字由这里叠。
  glow_text.py SRC OUT --items "文字@x0,y0,x1,y1[@tilt]" ... [--probe]
"""
import argparse, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

import os
LISU = subprocess.run(['fc-match', '-f', '%{file}', 'LiSu'], capture_output=True, text=True).stdout.strip() or os.environ.get('YXL_LISU', '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc')


def fit_font(text, w, h, start=160):
    for size in range(start, 12, -2):
        f = ImageFont.truetype(LISU, size)
        l, t, r, b = f.getbbox(text)
        if r - l <= w and b - t <= h:
            return f
    return ImageFont.truetype(LISU, 12)


def glow(im, rect, text, tilt=0, strength=1.0):
    """im: RGBA 全图。rect: 牌面矩形。strength: 光的强弱（路牌小字用 0.6）。"""
    W, H = im.size
    x0, y0, x1, y1 = rect
    f = fit_font(text, (x1 - x0) * 0.84, (y1 - y0) * 0.74)
    l, t, r, b = f.getbbox(text)
    tw, th = r - l, b - t
    pad = 60
    m = Image.new('L', (tw + pad * 2, th + pad * 2), 0)
    ImageDraw.Draw(m).text((pad - l, pad - t), text, font=f, fill=255)
    if tilt:
        m = m.rotate(tilt, expand=True, resample=Image.BICUBIC)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    full = Image.new('L', (W, H), 0)
    full.paste(m, (cx - m.width // 2, cy - m.height // 2))
    # 牌后透光
    back = Image.new('L', (W, H), 0)
    ImageDraw.Draw(back).ellipse([cx - (x1 - x0) * 0.55, cy - (y1 - y0) * 0.6, cx + (x1 - x0) * 0.55, cy + (y1 - y0) * 0.6], fill=255)
    back = back.filter(ImageFilter.GaussianBlur(max(8, (y1 - y0) * 0.45)))
    warm = Image.new('RGBA', (W, H), (255, 150, 50, 0)); warm.putalpha(back.point(lambda v: int(v * 0.40 * strength)))
    im.alpha_composite(warm)
    # 外发光两层
    for rad, alpha, col in ((max(6, th * 0.30), 0.5, (255, 120, 30)), (max(3, th * 0.10), 0.85, (255, 170, 60))):
        g = full.filter(ImageFilter.GaussianBlur(rad)).point(lambda v: int(min(255, v * 1.6) * alpha * strength))
        layer = Image.new('RGBA', (W, H), col + (0,)); layer.putalpha(g); im.alpha_composite(layer)
    # 字芯：亮暖渐变 × 锈纹，比光晕亮一档
    grad = np.linspace(0, 1, H).reshape(H, 1).repeat(W, 1)
    top = np.array([255, 246, 205]); bot = np.array([255, 190, 80])
    core = np.zeros((H, W, 3))
    for i in range(3): core[:, :, i] = top[i] * (1 - grad) + bot[i] * grad
    rng = np.random.default_rng(3)
    noise = rng.normal(0, 1, (max(2, H // 4), max(2, W // 4)))
    noise = Image.fromarray(((noise - noise.min()) / (noise.max() - noise.min()) * 255).astype('uint8')).resize((W, H), Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.2))
    n = np.asarray(noise).astype(float) / 255
    core = np.clip(core * (0.80 + 0.28 * n)[:, :, None], 0, 255).astype('uint8')
    corei = Image.fromarray(core).convert('RGBA')
    k = 3 if th > 40 else 1
    inner = full.filter(ImageFilter.MinFilter(k)) if k > 1 else full
    corei.putalpha(inner); im.alpha_composite(corei)
    # 暗边
    if th > 40:
        edge = ImageChops.subtract(full, full.filter(ImageFilter.MinFilter(5)))
        el = Image.new('RGBA', (W, H), (70, 30, 10, 0)); el.putalpha(edge.point(lambda v: int(v * 0.8))); im.alpha_composite(el)
        hi = ImageChops.subtract(full.filter(ImageFilter.MinFilter(3)), full.filter(ImageFilter.MinFilter(9)))
        hl = Image.new('RGBA', (W, H), (255, 252, 230, 0)); hl.putalpha(hi.point(lambda v: int(v * 0.35))); im.alpha_composite(hl)
    else:
        edge = ImageChops.subtract(full.filter(ImageFilter.MaxFilter(3)), full)
        el = Image.new('RGBA', (W, H), (40, 18, 6, 0)); el.putalpha(edge.point(lambda v: int(v * 0.7))); im.alpha_composite(el)
    return im


def probe(src, out, step=50):
    im = Image.open(src).convert('RGB'); d = ImageDraw.Draw(im)
    f = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc', 16)
    for y in range(0, im.height, step):
        d.line([(0, y), (im.width, y)], fill=(255, 255, 0) if y % 100 == 0 else (150, 150, 0), width=1)
        if y % 100 == 0: d.text((4, y + 2), str(y), font=f, fill=(255, 255, 255))
    for x in range(0, im.width, step):
        d.line([(x, 0), (x, im.height)], fill=(0, 255, 255) if x % 100 == 0 else (0, 140, 140), width=1)
        if x % 100 == 0: d.text((x + 2, 4), str(x), font=f, fill=(255, 255, 255))
    im.save(out, quality=90); print('probe', im.size, '->', out)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--items', nargs='*', default=[])
    ap.add_argument('--probe', action='store_true')
    ap.add_argument('--strength', type=float, default=1.0)
    a = ap.parse_args()
    if a.probe:
        probe(a.src, a.out)
    else:
        im = Image.open(a.src).convert('RGBA')
        for it in a.items:
            parts = it.split('@')
            text = parts[0]; rect = [int(v) for v in parts[1].split(',')]
            tilt = float(parts[2]) if len(parts) > 2 else 0
            glow(im, rect, text, tilt, a.strength if len(text) <= 2 else a.strength * 0.7)
        im.convert('RGB').save(a.out, quality=92); print('->', a.out)
