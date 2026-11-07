#!/usr/bin/env python3
"""把生图书脊零件按编号挑根贴进宽柜格层，叠竖排隶书题签与状态（未读幽灵 / 在读橙光 / 读完金口）。
把生图书脊零件按编号挑根贴进宽柜格层，叠竖排隶书题签与状态（未读幽灵 / 在读橙光 / 读完金口）。零件来自 cut.py --split。
用法：shelf_books.py SCENE.png OUT.jpg --parts DIR [DIR ...] --rows "名@x0,y0,x1,y1@feet@cav@n" ... [--zoom x0,y0,x1,y1 ZOOM.jpg]
"""
import argparse, glob, os, random, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glow_text import glow, LISU

TITLES = ['山海经', '史记', '天工开物', '梦溪笔谈', '营造法式', '齐民要术', '考工记', '水经注', '资治通鉴', '东京梦华录',
          '陶庵梦忆', '聊斋志异', '世说新语', '文心雕龙', '诗品', '说文解字', '本草纲目', '徐霞客游记', '长物志', '园冶',
          '随园食单', '闲情偶寄', '浮生六记', '夜航船', '容斋随笔', '老学庵笔记', '困学纪闻', '日知录', '艺舟双楫', '履园丛话',
          '板桥杂记', '扬州画舫录', '武林旧事', '洛阳伽蓝记', '岭外代答', '诸蕃志', '海录', '瀛涯胜览', '真腊风土记', '大唐西域记',
          '金石录', '集古录', '宣和画谱', '林泉高致', '画继', '历代名画记', '书谱', '笔阵图', '续书断']
STATES = ['unread', 'reading', 'done', 'none']


def load_parts(dirs, min_h=150):
    parts = []
    for d in dirs:
        for p in sorted(glob.glob(d + '/*.png')):
            im = Image.open(p).convert('RGBA')
            if im.height >= min_h and im.width >= 20:
                parts.append(im)
    return parts


def vtitle(canvas, x, y0, y1, text, size, fill=(236, 226, 196)):
    """竖排题签：一个字一个字往下排，带暗边。"""
    f = ImageFont.truetype(LISU, size)
    d = ImageDraw.Draw(canvas)
    step = size + 1
    maxn = max(1, (y1 - y0) // step)
    if len(text) > maxn:
        text = text[:maxn]
    n = len(text)
    total = n * step
    y = y0 + max(0, (y1 - y0 - total) // 2)
    for ch in text:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx or dy:
                    d.text((x + dx, y + dy), ch, font=f, fill=(20, 12, 8), anchor='mt')
        d.text((x, y), ch, font=f, fill=fill, anchor='mt')
        y += step


def place_book(canvas, part, x, feet, h, title, state, rng):
    sc = h / part.height
    w = max(8, int(part.width * sc))
    im = part.resize((w, int(h)), Image.LANCZOS)
    if state == 'unread':
        # 幽灵：压暗去饱和、青色、半透明
        im = ImageEnhance.Color(im).enhance(0.25)
        tint = Image.new('RGBA', im.size, (90, 200, 210, 0)); tint.putalpha(im.split()[3].point(lambda v: int(v * 0.35)))
        im.alpha_composite(tint)
        a = im.split()[3].point(lambda v: int(v * 0.6)); im.putalpha(a)
    canvas.alpha_composite(im, (x, feet - int(h)))
    # 题签：留白大致在上三分之一到三分之二
    if title and w >= 14:
        size = max(8, min(14, w - 8))
        vtitle(canvas, x + w // 2, feet - int(h * 0.78), feet - int(h * 0.22), title, size)
    # 状态：书口一线光
    if state in ('reading', 'done'):
        col = (255, 170, 60) if state == 'reading' else (255, 222, 140)
        line = Image.new('RGBA', canvas.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(line)
        ld.rectangle([x + 2, feet - int(h) - 1, x + w - 2, feet - int(h) + 1], fill=col + (230,))
        glow_l = line.filter(ImageFilter.GaussianBlur(3 if state == 'reading' else 1.5))
        canvas.alpha_composite(glow_l); canvas.alpha_composite(line)
    return w


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('scene'); ap.add_argument('out')
    ap.add_argument('--parts', nargs='+', required=True)
    ap.add_argument('--rows', nargs='+', required=True)
    ap.add_argument('--x0', type=int, default=362); ap.add_argument('--x1', type=int, default=1300)
    ap.add_argument('--zoom', default=''); ap.add_argument('--zoomout', default='')
    ap.add_argument('--seed', type=int, default=11)
    a = ap.parse_args()
    parts = load_parts(a.parts)
    print('parts', len(parts), [p.size for p in parts][:8])
    canvas = Image.open(a.scene).convert('RGBA')
    rng = random.Random(a.seed)
    k = 0
    for spec in a.rows:
        name, rect, feet, cav, n = spec.split('@')
        rect = [int(v) for v in rect.split(',')]; feet = int(feet); cav = int(cav); n = int(n)
        x = a.x0
        for j in range(n):
            part = parts[(k * 7 + 3) % len(parts)]          # 按编号稳定挑根
            h = cav * rng.uniform(0.66, 0.94)
            state = rng.choice(['none', 'none', 'unread', 'reading', 'done', 'none'])
            w = place_book(canvas, part, x, feet, h, TITLES[k % len(TITLES)], state, rng)
            x += w + rng.randint(0, 3); k += 1
            if x > a.x1 - 20: break
        glow(canvas, rect, name, 0, 0.55)
    canvas.convert('RGB').save(a.out, quality=92); print('->', a.out, 'books', k)
    if a.zoom and a.zoomout:
        x0, y0, x1, y1 = [int(v) for v in a.zoom.split(',')]
        canvas.convert('RGB').crop((x0, y0, x1, y1)).resize(((x1 - x0) * 3, (y1 - y0) * 3), Image.LANCZOS).save(a.zoomout, quality=90)
        print('zoom ->', a.zoomout)


if __name__ == '__main__':
    main()
