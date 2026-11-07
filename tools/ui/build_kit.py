#!/usr/bin/env python3
"""把定稿图与零件收进 vendor/ui/，写 kit.json。
输入在 tools/out/（不入库）：
  tools/out/ui/trials3/{home,archive,notes}_*.png、final/image2_*.png（擦脸后的宽柜）、book/{spread,paper}_*.png、
  spines/cut_*/*.png（宽书脊 32）、spines2/cut/*.png（细书脊 16）、book/cut_covers/*.png（书封面 8）、
  notebook/cut/*.png（本子封面 6）、card/cut_front、cut_back、cut_seals。
输出 vendor/ui/{scenes,spines,covers,notebooks,cards,seals,paper}/*.webp 与 vendor/ui/kit.json。
场景套定稿曲线（圣经第三节：gamma 0.85，档案与笔记 0.9），零件不动。坐标都是输出图的像素坐标（场景不缩放）。
用法：python3 tools/ui/build_kit.py [--out vendor/ui]
"""
import argparse, glob, json, os, time
from PIL import Image, ImageEnhance

R = 'tools/out/ui/trials3/'


def first(pattern):
    m = sorted(glob.glob(pattern))
    if not m: raise SystemExit('缺输入：' + pattern)
    return m[0]


def lift(im, gamma, lo=0.0, sat=1.08):
    lut = [int(255 * ((lo + (1 - lo) * (i / 255)) ** gamma)) for i in range(256)]
    return ImageEnhance.Color(im.convert('RGB').point(lut * 3)).enhance(sat)


def save(im, path, q=85, alpha=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if alpha: im.save(path, 'WEBP', quality=q, method=6, exact=False)
    else: im.convert('RGB').save(path, 'WEBP', quality=q, method=6)
    return os.path.getsize(path)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default='vendor/ui'); a = ap.parse_args()
    out = a.out; kit = {'version': time.strftime('%Y-%m-%d'), 'style': '第四稿 青橙墓园（docs/ui-style-bible.md）', 'curve': {'gamma': 0.85, 'archive_notes_gamma': 0.9, 'black': 0.0, 'saturation': 1.08}, 'scenes': {}, 'parts': {}}
    total = 0
    # 场景
    scenes = {
        'home': dict(src=first(R + 'home_*.png'), gamma=0.85, prompt='P017', plate=[250, 300, 770, 420], boards=[[315, 870, 448, 905, 4], [307, 922, 445, 958, -2], [330, 975, 440, 1018, 3]], note='首页大门 2:3；plate 站名牌、boards 三块路牌（x0,y0,x1,y1,斜度）'),
        'shelf': dict(src=first(R + 'final/image2_*.png'), gamma=0.85, black=0.03, prompt='P029', rows=[dict(plaque=[250, 437, 343, 473], feet=462, cavity=62), dict(plaque=[250, 522, 343, 558], feet=552, cavity=78), dict(plaque=[250, 607, 343, 643], feet=637, cavity=73), dict(plaque=[250, 702, 343, 738], feet=732, cavity=83), dict(plaque=[250, 792, 343, 828], feet=822, cavity=78)], inner=[362, 1300], note='宽柜 3:2 擦脸版；rows 每层：plaque 领域牌、feet 书脚 y、cavity 空腔高；inner 书可放的 x 范围'),
        'archive': dict(src=first(R + 'archive_*.png'), gamma=0.9, prompt='P019', panels=[[150, 470, 330, 700], [460, 380, 620, 690], [800, 470, 985, 730], [1125, 470, 1310, 730]], note='碑林 3:2；panels 四座碑的空板'),
        'notes': dict(src=first(R + 'notes_*.png'), gamma=0.9, prompt='P020', books=[[235, 450, 350, 520, -3], [462, 290, 580, 360, 4], [555, 530, 680, 600, 2], [812, 430, 925, 500, -6], [1042, 320, 1160, 390, -3], [1262, 540, 1380, 610, 2]], note='骨臂 3:2；books 六本封面上可叠题签的矩形（x0,y0,x1,y1,斜度）。正式版骨臂与本子要分层'),
        'spread': dict(src=first(R + 'book/spread_*.png'), gamma=1.0, prompt='P023', pages=[[350, 210, 760, 670], [830, 210, 1230, 670]], note='石台对开 3:2；pages 左右页可排字区'),
    }
    for name, s in scenes.items():
        im = Image.open(s['src'])
        if s['gamma'] != 1.0: im = lift(im, s['gamma'], s.get('black', 0.0))
        p = f'{out}/scenes/{name}.webp'; sz = save(im, p, 86); total += sz
        e = {k: v for k, v in s.items() if k not in ('src',)}; e.update(file=f'scenes/{name}.webp', w=im.width, h=im.height, bytes=sz); kit['scenes'][name] = e
    # 纸
    im = Image.open(first(R + 'book/paper_*.png')).convert('RGB').crop((120, 160, 904, 1376))
    p = f'{out}/paper/parchment.webp'; sz = save(im, p, 80); total += sz
    kit['scenes']['paper'] = dict(file='paper/parchment.webp', w=im.width, h=im.height, bytes=sz, prompt='P024', note='单页纸纹，已裁掉四边暗角；阅读页平铺或拉伸，正文底色 #EFE8D6')
    # 零件
    def parts(name, pattern, prefix, q=88, plate=None, extra=None, min_h=150):
        nonlocal total
        lst = []
        for i, src in enumerate(sorted(glob.glob(pattern)), 1):
            im = Image.open(src).convert('RGBA')
            if im.height < min_h: continue
            fn = f'{name}/{prefix}{i:02d}.webp'; sz = save(im, f'{out}/{fn}', q, alpha=True); total += sz
            e = dict(file=fn, w=im.width, h=im.height, bytes=sz)
            if plate: e['plate'] = plate(i, im) if callable(plate) else plate
            if extra: e.update(extra(i) if callable(extra) else extra)
            lst.append(e)
        return lst
    kit['parts']['spines_narrow'] = dict(prompt='P030', note='细书脊十六根（宽高约 1:4），优先用；题签板在上三分之一到三分之二', items=parts('spines', R + 'spines2/cut/*.png', 'n'))
    wide = []
    for di, d in enumerate(sorted(glob.glob(R + 'spines/cut_*/'))):
        wide += parts('spines', d + '*.png', 'w' + 'abcdef'[di] + '_')
    kit['parts']['spines_wide'] = dict(prompt='P021', note='宽书脊三十二根（宽高约 1:3），厚书或补位用', items=wide)
    cover_plates = {1: [105, 100, 275, 325]}
    kit['parts']['covers'] = dict(prompt='P022', note='书封面八本；plate 题签板（第 1 本量过，其余按比例估，叠字前复核）', items=parts('covers', R + 'book/cut_covers/*.png', 'c', plate=lambda i, im: cover_plates.get(i, [int(im.width * .32), int(im.height * .24), int(im.width * .80), int(im.height * .74)])))
    nb_plates = [[99, 105, 231, 215], [100, 85, 245, 155], [110, 90, 245, 160], [100, 90, 250, 180], [100, 95, 250, 185], [100, 95, 250, 175]]
    nb_names = ['青布皮筋', '棕皮搭扣', '黑皮铁角', '犊皮蜡封', '锈橙绶带', '灰蓝布铜扣']
    kit['parts']['notebooks'] = dict(prompt='P028', note='本子封面六本；plate 题签板', items=parts('notebooks', R + 'notebook/cut/*.png', 'b', plate=lambda i, im: nb_plates[i - 1], extra=lambda i: dict(name=nb_names[i - 1])))
    kit['parts']['card_front'] = dict(prompt='P025', note='羊皮纸牌正面；plate 题签板，seal 蜡封位（圆心与半径）', items=parts('cards', R + 'card/cut_front/*.png', 'front', plate=[130, 210, 670, 370], extra=dict(seal=[403, 1075, 85])))
    kit['parts']['card_back'] = dict(prompt='P026', note='牌背；plate 下方题签板', items=parts('cards', R + 'card/cut_back/*.png', 'back', plate=[260, 1090, 600, 1160]))
    seal_names = ['ring', 'disc', 'feather', 'square']; seal_cn = ['没读（空圈）', '读了（实心）', '写了批注（羽毛）', '结卷（方印）']
    kit['parts']['seals'] = dict(prompt='P027', note='状态印四枚，形状各不同', items=parts('seals', R + 'card/cut_seals/*.png', 's', min_h=60, extra=lambda i: dict(state=seal_names[i - 1], name=seal_cn[i - 1])))
    kit['total_bytes'] = total
    with open(f'{out}/kit.json', 'w', encoding='utf-8') as f: json.dump(kit, f, ensure_ascii=False, indent=1)
    n = sum(len(v['items']) for v in kit['parts'].values())
    print(f'场景 {len(kit["scenes"])} 张，零件 {n} 件，共 {total / 1024 / 1024:.1f} MB → {out}/kit.json')


if __name__ == '__main__':
    main()
