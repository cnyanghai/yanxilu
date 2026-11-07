#!/usr/bin/env python3
"""定稿曲线：提亮中间调（圣经第三节）。用法：lift.py IN OUT [--gamma 0.85] [--black 0.0] [--sat 1.08]"""
import argparse
from PIL import Image, ImageEnhance
ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out'); ap.add_argument('--gamma', type=float, default=0.85); ap.add_argument('--black', type=float, default=0.0); ap.add_argument('--sat', type=float, default=1.08)
a = ap.parse_args()
lut = [int(255 * ((a.black + (1 - a.black) * (i / 255)) ** a.gamma)) for i in range(256)]
im = Image.open(a.src).convert('RGB').point(lut * 3)
ImageEnhance.Color(im).enhance(a.sat).save(a.out, quality=92); print('->', a.out)
