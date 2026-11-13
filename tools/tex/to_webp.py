"""把下载的 Poly Haven 贴图（JPG，放在 tools/out/tex-dl/<名字>/，不入库）转成 WebP 放进 vendor/tex/。
用法：python3 -I tools/tex/to_webp.py [另外要转的 名字/文件.jpg:质量 ...]
转过以后小四倍左右（1.5 兆 → 0.4 兆），手机上打开快。用到哪几张、各自的质量写在下面 KEEP 里；来源和授权见 vendor/tex/SOURCES.md。
读的是从网上下载的文件，所以带 -I 跑（不从当前目录找模块）。"""
import os, sys, site
sys.path.append(site.getusersitepackages())          # -I 不带用户目录里装的包，Pillow 在那里
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "tools", "out", "tex-dl"); DST = os.path.join(ROOT, "vendor", "tex")
KEEP = [("dark_wood/dark_wood_diff_1k.jpg", 90),          # 木头的颜色
        ("dark_wood/dark_wood_rough_1k.jpg", 80),         # 木头哪里亮哪里哑（灰度）
        ("book_pattern/book_pattern_nor_gl_1k.jpg", 86)]  # 书布的凹凸
jobs = KEEP + [(a.rsplit(":", 1)[0], int(a.rsplit(":", 1)[1])) for a in sys.argv[1:]]
os.makedirs(DST, exist_ok=True)
for rel, q in jobs:
    im = Image.open(os.path.join(SRC, rel)); ex = im.convert("RGB").getextrema()
    gray = all(abs(ex[0][k] - ex[1][k]) < 8 and abs(ex[1][k] - ex[2][k]) < 8 for k in (0, 1))   # 三个通道一样的就按灰度存
    out = os.path.join(DST, os.path.basename(rel)[:-4] + ".webp")
    (im.convert("L") if gray else im.convert("RGB")).save(out, "WEBP", quality=q, method=6)
    print("%-34s %4d K → %4d K%s" % (os.path.basename(out), os.path.getsize(os.path.join(SRC, rel)) / 1e3, os.path.getsize(out) / 1e3, "（灰度）" if gray else ""))
