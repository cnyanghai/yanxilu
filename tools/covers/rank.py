import json, os, hashlib
from PIL import Image, ImageFilter, ImageDraw, ImageFont
import numpy as np
info = json.load(open("info.json"))
rows = []
for k, v in info.items():
    fn = "th/" + hashlib.md5(k.encode()).hexdigest()[:12] + ".jpg"
    if not os.path.exists(fn): continue
    try: im = Image.open(fn).convert("RGB")
    except Exception: continue
    w, h = im.size; ar = h / w
    if not (1.15 < ar < 1.8) or (v["w"] or 0) < 900: continue
    # inner crop to avoid background
    c = im.crop((int(w*.12), int(h*.12), int(w*.88), int(h*.88)))
    g = np.asarray(c.convert("L").filter(ImageFilter.FIND_EDGES)); ed = (g > 40).mean()
    q = c.quantize(32); cnt = np.bincount(np.asarray(q).ravel(), minlength=32); ncol = int((cnt / cnt.sum() > 0.02).sum())
    a = np.asarray(c).astype(float); sat = (a.max(2) - a.min(2)).mean()
    rows.append(dict(k=k, fn=fn, ar=ar, ed=float(ed), ncol=ncol, sat=float(sat), cat=v["cat"], W=v["w"]))
for r in rows: r["score"] = min(r["ed"], .3) / .3 * 0.6 + min(r["ncol"], 12) / 12 * 0.25 + min(r["sat"], 80) / 80 * 0.15
rows.sort(key=lambda r: -r["score"])
json.dump(rows, open("ranked.json", "w"), ensure_ascii=False, indent=0)
print(len(rows))
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16) if os.path.exists("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf") else ImageFont.load_default()
def sheet(sub, name, start):
    CW, CH, cols = 170, 250, 8
    rws = (len(sub) + cols - 1) // cols
    S = Image.new("RGB", (cols * CW, rws * CH), (240, 236, 228)); d = ImageDraw.Draw(S)
    for i, r in enumerate(sub):
        im = Image.open(r["fn"]).convert("RGB"); im.thumbnail((CW - 10, CH - 26))
        x, y = (i % cols) * CW, (i // cols) * CH
        S.paste(im, (x + 5, y + 5)); d.text((x + 6, y + CH - 21), str(start + i), fill=(150, 20, 20), font=font)
    S.save(name, quality=85)
for s in range(0, 240, 48): sheet(rows[s:s+48], "sheet_%d.jpg" % (s // 48), s)
