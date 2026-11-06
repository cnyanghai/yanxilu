#!/usr/bin/env python3
"""九宫格框：给一张框件 PNG 定四条切线，输出 CSS border-image 片段、kit.json 条目，和三种尺寸拉伸后的预览图（看角不变形、边无缝）。
用法：
  python3 tools/ui/nine.py vendor/ui/frames/paper.png --inset 48,52,48,52 -o tools/out/ui
  --inset 上,右,下,左（像素）；不给则各取三分之一。--sizes 预览尺寸，默认 320x200,640x360,240x480。--repeat stretch|round（边的平铺方式）
预览图用纯 PIL 复刻 border-image 的拼法，和浏览器一致。"""
import argparse, json, os
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser(); ap.add_argument("src"); ap.add_argument("--inset", default=None); ap.add_argument("-o", "--out", default="tools/out/ui")
ap.add_argument("--sizes", default="320x200,640x360,240x480"); ap.add_argument("--repeat", default="stretch", choices=["stretch", "round"])
a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
im = Image.open(a.src).convert("RGBA"); W, H = im.size
t, r, b, l = [int(v) for v in a.inset.split(",")] if a.inset else (H // 3, W // 3, H // 3, W // 3)
assert t + b < H and l + r < W, "切线把中间切没了"

def nine(w, h):
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0)); cw, ch = w - l - r, h - t - b
    assert cw > 0 and ch > 0, "目标尺寸比角还小"
    def fit(box, dw, dh, axis):
        piece = im.crop(box)
        if a.repeat == "round" and axis in ("x", "y"):
            n = max(1, round((dw if axis == "x" else dh) / (piece.width if axis == "x" else piece.height)))
            tile = piece.resize((dw // n if axis == "x" else dw, dh if axis == "x" else dh // n), Image.LANCZOS)
            strip = Image.new("RGBA", (dw, dh)); 
            for i in range(n): strip.paste(tile, (i * tile.width, 0) if axis == "x" else (0, i * tile.height))
            return strip
        return piece.resize((dw, dh), Image.LANCZOS)
    out.paste(im.crop((0, 0, l, t)), (0, 0)); out.paste(im.crop((W - r, 0, W, t)), (w - r, 0))
    out.paste(im.crop((0, H - b, l, H)), (0, h - b)); out.paste(im.crop((W - r, H - b, W, H)), (w - r, h - b))
    out.paste(fit((l, 0, W - r, t), cw, t, "x"), (l, 0)); out.paste(fit((l, H - b, W - r, H), cw, b, "x"), (l, h - b))
    out.paste(fit((0, t, l, H - b), l, ch, "y"), (0, t)); out.paste(fit((W - r, t, W, H - b), r, ch, "y"), (w - r, t))
    out.paste(fit((l, t, W - r, H - b), cw, ch, "c"), (l, t))
    return out

sizes = [tuple(int(v) for v in s.split("x")) for s in a.sizes.split(",")]
gap = 24; sheet = Image.new("RGBA", (sum(w for w, _ in sizes) + gap * (len(sizes) + 1), max(h for _, h in sizes) + gap * 2 + 40), (236, 226, 204, 255))
x = gap
for w, h in sizes:
    sheet.alpha_composite(nine(w, h), (x, gap)); ImageDraw.Draw(sheet).text((x, gap + h + 10), "%dx%d" % (w, h), fill=(60, 40, 20, 255)); x += w + gap
# 原图上画切线
guide = im.copy(); d = ImageDraw.Draw(guide)
for yy in (t, H - b): d.line([(0, yy), (W, yy)], fill=(0, 120, 255, 255), width=2)
for xx in (l, W - r): d.line([(xx, 0), (xx, H)], fill=(0, 120, 255, 255), width=2)
name = os.path.splitext(os.path.basename(a.src))[0]
guide.save(os.path.join(a.out, name + "-slices.png")); sheet.save(os.path.join(a.out, name + "-nine.png"))
entry = {"file": os.path.relpath(a.src), "w": W, "h": H, "slice": [t, r, b, l], "repeat": a.repeat}
css = ".frame-%s{border-style:solid;border-width:%dpx %dpx %dpx %dpx;border-image:url(%s) %d %d %d %d fill / %dpx %dpx %dpx %dpx %s}" % (name, t, r, b, l, os.path.relpath(a.src), t, r, b, l, t, r, b, l, a.repeat)
print(json.dumps(entry, ensure_ascii=False)); print(css); print("预览", os.path.join(a.out, name + "-nine.png"), "切线", os.path.join(a.out, name + "-slices.png"))
