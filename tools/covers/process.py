import json, cv2, numpy as np, sys, os
from ann import A
os.makedirs("out", exist_ok=True); os.makedirs("dbg", exist_ok=True)
def hexc(c): return "#%02x%02x%02x" % tuple(int(v) for v in c[::-1])  # BGR->hex
res = {}
only = [int(a) for a in sys.argv[1:]]
for n, a in sorted(A.items()):
    if only and n not in only: continue
    if not os.path.exists("big/%02d.jpg" % n): continue
    img = cv2.imread("big/%02d.jpg" % n); H, W = img.shape[:2]
    P = lambda r: (int(r[0] * W / 10), int(r[1] * H / 10), int(r[2] * W / 10), int(r[3] * H / 10))
    cx0, cy0, cx1, cy1 = P(a["crop"])
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edge = (cv2.Canny(cv2.GaussianBlur(gray, (0, 0), 2.2), 30, 70) > 0).astype(np.float32)
    ii = cv2.integral(edge)
    ers = [P(r) for r in a["erase"]]
    occupied = np.zeros((H, W), np.uint8)
    for (x0, y0, x1, y1) in ers: occupied[max(0, y0 - 6):y1 + 6, max(0, x0 - 6):x1 + 6] = 1
    oi = cv2.integral(occupied)
    out = img.copy(); inks = []
    ix0, iy0 = cx0 + int((cx1 - cx0) * 0.08), cy0 + int((cy1 - cy0) * 0.05); ix1, iy1 = cx1 - int((cx1 - cx0) * 0.06), cy1 - int((cy1 - cy0) * 0.05)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    ci = [cv2.integral(img[:, :, c].astype(np.float64)) for c in range(3)]
    for (x0, y0, x1, y1) in ers:
        pad = 12; x0, y0 = max(cx0, x0 - pad), max(cy0, y0 - pad); x1, y1 = min(cx1, x1 + pad), min(cy1, y1 + pad)
        w, h = x1 - x0, y1 - y0
        reg = img[y0:y1, x0:x1]
        # letter mask: far from a heavily median-blurred background
        k = max(15, (min(w, h) // 3) | 1); k = min(k, 61) | 1
        bg = cv2.medianBlur(reg, k if k <= 255 else 255)
        d = np.linalg.norm(cv2.cvtColor(reg, cv2.COLOR_BGR2LAB).astype(np.float32) - cv2.cvtColor(bg, cv2.COLOR_BGR2LAB).astype(np.float32), axis=2)
        thr = max(11, np.percentile(d, 60) * 1.9)
        m = (d > thr).astype(np.uint8) * 255
        m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
        m[:3, :] = 0; m[-3:, :] = 0; m[:, :3] = 0; m[:, -3:] = 0
        if m.mean() < 1: continue
        far = reg.reshape(-1, 3)[(d > thr).ravel()].astype(np.float32)
        if len(far): inks.append(np.median(far, 0))
        keep = m == 0
        bgc = reg[keep].reshape(-1, 3).astype(np.float32).mean(0) if keep.any() else reg.reshape(-1, 3).mean(0)
        # low frequency: inpaint from surrounding pixels; high frequency (weave): from the plainest patch of the same cover
        lf = cv2.inpaint(out[y0:y1, x0:x1], m, 9, cv2.INPAINT_TELEA).astype(np.float32)
        lf = cv2.GaussianBlur(lf, (0, 0), 1.5)
        tw_, th_ = min(w, 160), min(h, 160)
        ys = np.arange(iy0, iy1 - th_, 4); xs = np.arange(ix0, ix1 - tw_, 4)
        Y, X = np.meshgrid(ys, xs, indexing="ij")
        box = lambda I: I[Y + th_, X + tw_] - I[Y, X + tw_] - I[Y + th_, X] + I[Y, X]
        e = box(ii) / (tw_ * th_); occ = box(oi) > 0
        col = np.stack([box(I) / (tw_ * th_) for I in ci], -1)
        sc = e * 10 + np.linalg.norm(col - bgc[None, None, :], axis=-1) / 255 * 0.5; sc[occ] = 1e9
        j = np.unravel_index(np.argmin(sc), sc.shape); sx, sy = int(X[j]), int(Y[j])
        tile = img[sy:sy + th_, sx:sx + tw_].astype(np.float32)
        hf = tile - cv2.GaussianBlur(tile, (0, 0), 3.0)
        # mirror-tile the texture up to the region size
        rx = int(np.ceil(w / tw_)) + 1; ry = int(np.ceil(h / th_)) + 1
        row = np.concatenate([hf if i % 2 == 0 else hf[:, ::-1] for i in range(rx)], 1)
        big_ = np.concatenate([row if i % 2 == 0 else row[::-1] for i in range(ry)], 0)[:h, :w]
        fill = lf + big_ * 1.0
        al = cv2.GaussianBlur(m.astype(np.float32) / 255, (0, 0), 1.6)[:, :, None]
        out[y0:y1, x0:x1] = np.clip(out[y0:y1, x0:x1].astype(np.float32) * (1 - al) + fill * al, 0, 255).astype(np.uint8)
        print(n, "erase", (x0, y0, w, h), "tex", (sx, sy), "edge %.3f mask %.2f" % (float(e[j]), (m > 0).mean()))
    crop = out[cy0:cy1, cx0:cx1]
    ch, cw = crop.shape[:2]
    tx0, ty0, tx1, ty1 = P(a["title"])
    tb = [round((tx0 - cx0) / cw, 4), round((ty0 - cy0) / ch, 4), round((tx1 - tx0) / cw, 4), round((ty1 - ty0) / ch, 4)]
    # ink
    ink = a.get("ink")
    if inks: inkc = hexc(np.median(np.array(inks), 0))
    else:
        reg = crop.reshape(-1, 3).astype(np.float32); L = reg.mean(1)
        inkc = hexc(np.median(reg[L > np.percentile(L, 95)], 0)) if ink in ("gold", "cream") else hexc(np.median(reg[L < np.percentile(L, 5)], 0))
    # dominant ground colour (for plate / spine fallback)
    reg = crop.reshape(-1, 3).astype(np.float32); L = reg.mean(1)
    ground = hexc(np.median(reg, 0)); dark = hexc(np.median(reg[L < np.percentile(L, 20)], 0)); bright = hexc(np.median(reg[L > np.percentile(L, 90)], 0))
    # spine strip: choose x (fraction) with most ornament, avoiding title box
    ce = (cv2.Canny(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY), 50, 120) > 0).astype(np.float32)
    sw = int(cw * 0.2); best_x, best_v = 0, -1
    for x in range(0, cw - sw, max(1, cw // 50)):
        if x < (tx1 - cx0) and x + sw > (tx0 - cx0) and a["style"] == "stamp": pass
        v = ce[:, x:x + sw].mean() - (0.5 if (x < tx1 - cx0 and x + sw > tx0 - cx0) else 0) * ce[int(ty0 - cy0):int(ty1 - cy0), x:x + sw].mean()
        if v > best_v: best_v, best_x = v, x
    tw = 540; th = int(ch * tw / cw)
    small = cv2.resize(crop, (tw, th), interpolation=cv2.INTER_AREA)
    cv2.imwrite("out/c%02d.webp" % n, small, [cv2.IMWRITE_WEBP_QUALITY, 74])
    r = dict(n=n, ar=round(ch / cw, 4), tb=tb, style=a["style"], ink=inkc, inkk=ink or "gold", ground=ground, dark=dark, bright=bright, sx=round(best_x / cw, 3), vert=bool(a.get("vert")))
    if "spine" in a:
        s0 = P(a["spine"]); sp = out[s0[1]:s0[3], s0[0]:s0[2]]
        sh = 600; sww = int(sp.shape[1] * sh / sp.shape[0])
        cv2.imwrite("out/s%02d.webp" % n, cv2.resize(sp, (sww, sh), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_WEBP_QUALITY, 74]); r["spine"] = 1
    dbg = small.copy()
    cv2.rectangle(dbg, (int(tb[0] * tw), int(tb[1] * th)), (int((tb[0] + tb[2]) * tw), int((tb[1] + tb[3]) * th)), (255, 0, 255), 2)
    cv2.imwrite("dbg/d%02d.jpg" % n, dbg)
    res[n] = r
old = json.load(open("covers.json")) if os.path.exists("covers.json") and only else {}
old.update({str(k): v for k, v in res.items()})
json.dump(old, open("covers.json", "w"), indent=1)
