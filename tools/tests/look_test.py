"""样子没坏：书墙、档案架、开盒、笔记本架、足迹，手机与桌面各拍一张，再加冻结的独立 App 两张，对着基准图比。
用法：python3 tools/tests/look_test.py            # 比对。自己起一份干净的模拟服务（端口 8793），不用另开终端
      python3 tools/tests/look_test.py --update   # 样子是有意改的：重拍基准，基准图跟代码一起提交
      python3 tools/tests/look_test.py --inject "css 文本"   # 自检用：往页面塞一段样式，看测试报不报
基准在 tools/tests/look/*.webp，缩到四分之一存：纸的颗粒被平均掉，留下版面、颜色和字的位置。
判坏有两条：变了的格子（每格 4×4 像素，任一通道差 5 级以上）多于 24 格；或整张图某个通道平均偏了 1 级以上（整页偏色）。
同一台机器上重拍是逐格不变的，所以门槛收得紧：一个按钮的圆角、一种纸色差几级都会报。
差异图落在 tools/out/look/（已 gitignore）：左基准、右现在，变了的格子涂蓝。日期钉在 2026-11-10，动效全关。
基准是在 WSL 的 Chromium 上拍的；换机器字的抗锯齿会有细微差别，第一次跑不过就先 --update 再比。"""
import os, sys, json, time, subprocess, datetime, urllib.request
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
BASE_DIR = os.path.join(HERE, "look")
OUT = os.path.join(ROOT, "tools", "out", "look")
PORT = 8793
B = "http://127.0.0.1:%d" % PORT
UPDATE = "--update" in sys.argv
INJECT = sys.argv[sys.argv.index("--inject") + 1] if "--inject" in sys.argv else ""
CELL, T_CELL, MAX_CELLS, MAX_TINT = 4, 5, 24, 1.0
NOW = datetime.datetime(2026, 11, 10, 9, 0, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=8)))
STILL = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}"
SIZES = {"m": {"width": 390, "height": 844}, "d": {"width": 1440, "height": 1000}}
# 名字, 地址, 进去以后要点的东西
SHOTS = [("shelf", "/#shelf", None), ("archive", "/#archive", None), ("archive-open", "/#archive", ".apack[data-t]"),
         ("notes", "/#notes", None), ("journal", "/#journal", None)]
APP_SHOTS = [("m", "y-gate", "/youchai/#gate"), ("m", "y-shelf", "/youchai/#shelf")]

op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
def put(coll, id, data):
    r = urllib.request.Request(B + "/api/yxl/doc", data=json.dumps({"coll": coll, "id": id, "data": data}).encode(), method="PUT",
                               headers={"content-type": "application/json", "cookie": "sid=u1"})
    return op.open(r).read()
def seed():
    """五张剪报，让档案架上有盒子可开。标题是编的。"""
    titles = ["如何计算凯利公式的仓位系数？", "几家基金公开的仓位规则", "波动率为什么会聚在一起出现", "久期：利率动一点，债券动多少", "我自己整理的夏普比率算法"]
    for i, t in enumerate(titles):
        put("clips", "cl-f%d" % i, {"key": "zh-a-%d" % i, "url": "https://example.com/a/%d" % i, "title": t, "author": "某某", "site": "知乎", "kind": "answer", "date": "",
                                     "track": "fin", "note": "", "excerpt": "开头", "words": 3000 + i * 900, "sel": 0, "status": "full",
                                     "t": "2026-10-2%dT07:00:00Z" % i, "ut": "2026-10-20T07:00:00Z"})
        put("clipbody", "cl-f%d" % i, {"html": "<p>正文</p>", "t": "2026-10-20T07:00:00Z"})

def reduce4(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    return im.crop((0, 0, w - w % CELL, h - h % CELL)).reduce(CELL)

def compare(name, cur):
    base_path = os.path.join(BASE_DIR, name + ".webp")
    if UPDATE or not os.path.exists(base_path):
        cur.save(base_path, "WEBP", lossless=True, method=6)
        return ("new  " if not UPDATE else "save ") + name, True
    base = Image.open(base_path).convert("RGB")
    if base.size != cur.size:
        return "FAIL %s | 尺寸变了 %s → %s" % (name, base.size, cur.size), False
    a, b = np.asarray(base).astype(np.int16), np.asarray(cur).astype(np.int16)
    d = np.abs(a - b).max(axis=2)
    changed = d > T_CELL
    n = int(changed.sum())
    tint = (b - a).reshape(-1, 3).mean(axis=0)
    ok = n <= MAX_CELLS and float(np.abs(tint).max()) <= MAX_TINT
    msg = "%s %s | 变了 %d 格（%.2f%%），整页偏色 %+.1f %+.1f %+.1f" % ("ok  " if ok else "FAIL", name, n, changed.mean() * 100, tint[0], tint[1], tint[2])
    if not ok:
        mark = np.asarray(cur).copy(); mark[changed] = (30, 107, 255)
        w, h = cur.size
        sheet = Image.new("RGB", (w * 4 + 12, h * 2), (255, 255, 255))
        sheet.paste(base.resize((w * 2, h * 2), Image.NEAREST), (0, 0))
        sheet.paste(Image.fromarray(mark).resize((w * 2, h * 2), Image.NEAREST), (w * 2 + 12, 0))
        p = os.path.join(OUT, name + "-diff.png"); sheet.save(p)
        msg += " | 差异图 " + os.path.relpath(p, ROOT)
    return msg, ok

def main():
    os.makedirs(BASE_DIR, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    mock = subprocess.Popen([sys.executable, os.path.join(ROOT, "tools", "baba_mock.py"), str(PORT)], cwd=ROOT)
    fails = []
    try:
        for _ in range(50):
            try: op.open(B + "/api/yxl/state", timeout=1).read(); break
            except Exception: time.sleep(.1)
        else: raise SystemExit("模拟服务没起来（端口 %d 被占了？）" % PORT)
        seed()
        with sync_playwright() as p:
            br = p.chromium.launch()
            def shoot(tag, name, url, click=None):
                ctx = br.new_context(viewport=SIZES[tag], device_scale_factor=1, locale="zh-CN", timezone_id="Asia/Shanghai",
                                     reduced_motion="reduce", color_scheme="light", service_workers="block")
                ctx.add_cookies([{"name": "sid", "value": "u1", "url": B}])
                pg = ctx.new_page(); errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.clock.set_fixed_time(NOW)
                pg.goto(B + url); pg.wait_for_timeout(1500)
                # 页面自己的样式在 body 里，塞进去的这段要排在它后面才压得住
                pg.evaluate("css => { var s = document.createElement('style'); s.textContent = css; document.body.appendChild(s); }", STILL + INJECT)
                if click: pg.locator(click).first.click()
                pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(900)
                shot = os.path.join(OUT, name + ".png"); pg.screenshot(path=shot)
                ctx.close()
                msg, ok = compare(name, reduce4(shot))
                if errs: msg += " | 页面报错 " + "; ".join(errs)[:200]; ok = False
                print(msg)
                if not ok: fails.append(name)
            for tag in ("m", "d"):
                for nm, url, click in SHOTS: shoot(tag, tag + "-" + nm, url, click)
            for tag, nm, url in APP_SHOTS: shoot(tag, nm, url)
            br.close()
    finally:
        mock.terminate()
    if UPDATE: print("基准已重拍：" + os.path.relpath(BASE_DIR, ROOT))
    print("errors:", fails)
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
