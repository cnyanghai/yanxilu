#!/usr/bin/env python3
"""烘纸浆纹理：vendor/paper/pulp.webp（2x，512 像素铺 256 CSS 像素）与 pulp-1x.webp（256 像素）。

做法是几层不带方向的深浅起伏（细齿 + 絮团 + 云）加稀疏的深色小坑、亮点和几根纤维；
四边循环（mode='wrap'），可以无缝平铺。输出是中灰 128 的灰度图，网页里用 background-blend-mode:overlay
叠在实色上，所以一张图给所有颜色的纸用。

三段颗粒量（叠在奶油面 #CFA97C 上、缩到样张的 1.42 像素每 CSS 像素后量亮度标准差）对着 Planfix 样张：
细（1 像素内）4.7，中（2 到 8 像素）2.4，粗（8 到 30 像素）1.1（样张大卡片的干净纸面）。
用法：python3 tools/paper/bake_pulp.py        只烘图
      python3 tools/paper/bake_pulp.py check  烘完再量三段颗粒量
"""
import sys, pathlib
import numpy as np
from scipy.ndimage import gaussian_filter
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "vendor/paper"
# 各层的量（灰度级）：齿、絮、云是不带方向的深浅起伏；坑与亮点是稀疏的点；按每 CSS 像素几个像素分两套
AMP = {2: dict(tooth=11.9, lump=1.9, cloud=2.6, pit=52.0, fleck=6.0, fibre=4.0),
       1: dict(tooth=11.9, lump=0.5, cloud=2.9, pit=44.0, fleck=5.0, fibre=3.0)}

def norm(a):
    return (a - a.mean()) / (a.std() + 1e-9)

def slope(h):
    """左上来光：朝左上的坡亮，朝右下的坡暗。"""
    gx = np.roll(h, -1, 1) - np.roll(h, 1, 1)
    gy = np.roll(h, -1, 0) - np.roll(h, 1, 0)
    return norm(-(gx + gy))

def dots(rng, n, k, sigma):
    a = np.zeros((n, n))
    ys, xs = rng.integers(0, n, k), rng.integers(0, n, k)
    np.add.at(a, (ys, xs), rng.uniform(.35, 1, k))
    a = gaussian_filter(a, sigma, mode="wrap")
    return a / (a.max() + 1e-9)

def fibres(rng, n, k, s):
    """短纤维：每根是一小段弯线，循环画在环面上。"""
    a = np.zeros((n, n))
    for _ in range(k):
        x, y = rng.uniform(0, n, 2)
        ang = rng.uniform(0, np.pi)
        bend = rng.normal(0, .035 / s)
        ln = int(rng.uniform(7, 22) * s)
        w = rng.choice([-1, 1]) * rng.uniform(.4, 1)
        for _ in range(ln):
            a[int(y) % n, int(x) % n] += w
            x += np.cos(ang); y += np.sin(ang); ang += bend
    return gaussian_filter(a, .45 * s, mode="wrap")

def bake(n, s, seed=7, amp=None):
    """n 边长（像素），s 每 CSS 像素几个像素。纹理不带方向：样张的纸面是均匀的细麻点加稀疏的深色小坑，
    坡度打光会刷出斜纹（第一版试过，像布），所以齿、絮、云都只是深浅起伏，只有小坑带一圈受光的亮沿。"""
    amp = amp or AMP[s]
    rng = np.random.default_rng(seed)
    g = lambda sig: norm(gaussian_filter(rng.standard_normal((n, n)), sig * s, mode="wrap"))
    t = amp["tooth"] * g(.27) + amp["lump"] * g(1.7) + amp["cloud"] * g(8.0)
    area = (n / s) ** 2
    pit = dots(rng, n, int(area * .0030), .46 * s) + .8 * dots(rng, n, int(area * .0007), .9 * s)
    t -= amp["pit"] * pit
    t += amp["pit"] * .9 * np.clip(np.roll(pit, (1, 1), (0, 1)) - pit, 0, None)
    t += amp["fleck"] * dots(rng, n, int(area * .0012), .45 * s)
    t += amp["fibre"] * norm(fibres(rng, n, int(area * .006), s)) * .35
    t -= t.mean()
    return np.clip(128 + t, 0, 255).astype(np.uint8)

def overlay(base, tex):
    b = np.array(base, float)[None, None, :] / 255
    t = tex.astype(float)[..., None] / 255
    return np.where(b < .5, 2 * b * t, 1 - 2 * (1 - b) * (1 - t)) * 255

def bands(rgb):
    L = .2126 * rgb[..., 0] + .7152 * rgb[..., 1] + .0722 * rgb[..., 2]
    f = L - gaussian_filter(L, 1.0)
    m = gaussian_filter(L, 1.0) - gaussian_filter(L, 4.0)
    c = gaussian_filter(L, 4.0) - gaussian_filter(L, 14.0)
    return round(float(f.std()), 2), round(float(m.std()), 2), round(float(c.std()), 2), round(float(L.mean()), 1)

def measure(tex, s, base=(0xCF, 0xA9, 0x7C)):
    """叠在实色上，缩到样张尺度（1.42 像素每 CSS 像素）再量。"""
    rgb = overlay(base, np.tile(tex, (2, 2)))
    im = Image.fromarray(rgb.astype(np.uint8))
    k = 1.42 / s
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    return bands(np.asarray(im).astype(float))

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, n, s in (("pulp.webp", 512, 2), ("pulp-1x.webp", 256, 1)):
        tex = bake(n, s)
        Image.fromarray(tex, "L").save(OUT / name, "WEBP", quality=92, method=6)
        line = f"{name} {n}px {(OUT / name).stat().st_size} bytes 均值 {tex.mean():.1f}"
        if len(sys.argv) > 1 and sys.argv[1] == "check":
            back = np.asarray(Image.open(OUT / name).convert("L"))
            line += f" 细/中/粗/亮度 {measure(back, s)}"
        print(line)
