#!/usr/bin/env python3
"""暗黑 2 原版 / 重制版几种图像格式的纯 Python 解码（只用于本机研究，产物不入库）：
  DT1 瓦片集（原版地砖 / 墙砖，256 色调色板，等轴测块 + RLE 块）、DC6 精灵（原版图标 / 界面）、重制版 .sprite（SpA1，RGBA 未压缩）。
重制版 .texture 是 BC7 压缩的自有格式（头 '<DE(' 后 width、height、mip 数、每级大小与偏移），需要 BC7 解码库，这里不解。
用法：
  python3 tools/d2_decode.py dt1 <x.dt1> <pal.dat> <out.png> [最多块数]
  python3 tools/d2_decode.py dc6 <x.dc6> <pal.dat> <out.png>
  python3 tools/d2_decode.py sprite <x.sprite> <out.png>
"""
import struct, sys
from PIL import Image


def palette(path):
    b = open(path, "rb").read(); return [(b[i * 3 + 2], b[i * 3 + 1], b[i * 3]) for i in range(256)]   # 文件里是 BGR


def dt1(path, pal, maxn=8):
    b = open(path, "rb").read(); n, off = struct.unpack_from("<ii", b, 268); out = []
    for i in range(min(n, maxn)):
        t = off + i * 96; height, width = struct.unpack_from("<ii", b, t + 8); bhp, _, nb = struct.unpack_from("<iii", b, t + 72)
        blocks = []
        for k in range(nb):
            bh = bhp + k * 20; bx, by = struct.unpack_from("<hh", b, bh); fmt, = struct.unpack_from("<h", b, bh + 8)
            length, = struct.unpack_from("<i", b, bh + 10); fo, = struct.unpack_from("<i", b, bh + 16); blocks.append((bx, by, fmt, b[bhp + fo:bhp + fo + length]))
        miny = min(by for _, by, _, _ in blocks); yoff = -miny if miny < 0 else 0   # 墙砖的块 y 是负的，地砖是正的
        H = max(abs(height), max(by for _, by, _, _ in blocks) + yoff + 32); img = Image.new("RGBA", (width, H), (0, 0, 0, 0)); px = img.load()
        for bx, by, fmt, d in blocks:
            y0 = by + yoff
            if fmt == 1:   # 等轴测块：固定 32 × 15 菱形，256 字节
                xjump = [14, 12, 10, 8, 6, 4, 2, 0, 2, 4, 6, 8, 10, 12, 14]; nbp = [4, 8, 12, 16, 20, 24, 28, 32, 28, 24, 20, 16, 12, 8, 4]; i = 0
                for yy in range(15):
                    x = xjump[yy]
                    for _ in range(nbp[yy]):
                        if i < len(d) and 0 <= bx + x < width and 0 <= y0 + yy < H: px[bx + x, y0 + yy] = (*pal[d[i]], 255)
                        i += 1; x += 1
            else:          # RLE：(跳过 n, 画 m) 对，(0,0) 换行
                i = 0; x = 0; y = 0
                while i + 1 < len(d):
                    b1, b2 = d[i], d[i + 1]; i += 2
                    if b1 == 0 and b2 == 0: x = 0; y += 1; continue
                    x += b1
                    for _ in range(b2):
                        if i < len(d) and 0 <= bx + x < width and 0 <= y0 + y < H: px[bx + x, y0 + y] = (*pal[d[i]], 255)
                        i += 1; x += 1
        out.append(img.crop(img.getbbox() or (0, 0, width, H)))
    return out


def dc6(path, pal):
    b = open(path, "rb").read(); dirs, fpd = struct.unpack_from("<ii", b, 16); ptrs = struct.unpack_from(f"<{dirs * fpd}I", b, 24); out = []
    for p in ptrs:
        flip, w, h, ox, oy, alloc, nxt, ln = struct.unpack_from("<iiiiiiii", b, p); data = b[p + 32:p + 32 + ln]
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0)); px = img.load(); x = 0; y = h - 1 if not flip else 0; i = 0
        while i < len(data):
            c = data[i]; i += 1
            if c == 0x80: x = 0; y = y - 1 if not flip else y + 1
            elif c & 0x80: x += c & 0x7F
            else:
                for _ in range(c):
                    if 0 <= x < w and 0 <= y < h: px[x, y] = (*pal[data[i]], 255)
                    i += 1; x += 1
        out.append(img)
    return out


def sprite(path):
    b = open(path, "rb").read(); assert b[:4] == b"SpA1"; w, h = struct.unpack_from("<ii", b, 8)
    return Image.frombytes("RGBA", (w, h), b[0x28:0x28 + w * h * 4])


if __name__ == "__main__":
    kind = sys.argv[1]
    if kind == "dt1":
        tiles = dt1(sys.argv[2], palette(sys.argv[3]), int(sys.argv[5]) if len(sys.argv) > 5 else 8)
        cw = max(t.width for t in tiles); ch = max(t.height for t in tiles); cols = 4
        sheet = Image.new("RGBA", (cw * cols, ch * ((len(tiles) + cols - 1) // cols)), (0, 0, 0, 0))
        for i, t in enumerate(tiles): sheet.paste(t, ((i % cols) * cw, (i // cols) * ch), t)
        sheet.save(sys.argv[4]); print(len(tiles), "tiles", tiles[0].size)
    elif kind == "dc6":
        fr = dc6(sys.argv[2], palette(sys.argv[3])); fr[0].save(sys.argv[4]); print(len(fr), "frames", fr[0].size)
    elif kind == "sprite":
        im = sprite(sys.argv[2]); im.save(sys.argv[3]); print(im.size)
