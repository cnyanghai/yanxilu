"""三件家具（lab/shelf.html，旧书房）：书架、档案架、笔记本架同一页里换着看。底下一排三个记号，点哪个去哪个，按在那一排上左右划也行；
档案架上是牌盒（厚跟着牌数走，有没读的顶上露一枚签）和没拆的邮包，笔记本架上的本子封面朝外；都能划过、抽出、放回；
换走再换回来，书架上改过的读没读还在。灰盒没做后两件，记号不出来。
用法：python3 tools/tests/lab_rack_test.py           # 自己起模拟服务（端口 8797），软件渲染，约两三分钟
截图落在 tools/out/lab/（已 gitignore）。这条测试只保证流程走得通、整座装得进一屏、不报错，好不好看、换的那一下顺不顺要人在手机上看。"""
import os, sys, time, subprocess, urllib.request
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "tools", "out", "lab"); os.makedirs(OUT, exist_ok=True)
PORT = 8797; B = "http://127.0.0.1:%d" % PORT
errors = []
def check(name, ok, extra=""):
    print(("ok   " if ok else "FAIL ") + name + (" | " + str(extra) if extra != "" else ""), flush=True)
    if not ok: errors.append(name)
op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
mock = subprocess.Popen([sys.executable, os.path.join(ROOT, "tools", "baba_mock.py"), str(PORT)], cwd=ROOT)
INSIDE_JS = """(() => { const lab = window.__lab, bot = innerHeight - 50; let bad = 0;
  lab.books.forEach((b, i) => { const r = lab.rectOf(i); if (r.l < -1 || r.r > innerWidth + 1 || r.t < 0 || r.b > bot) bad++; }); return bad; })()"""
try:
    for _ in range(50):
        try: op.open(B + "/api/yxl/state", timeout=1).read(); break
        except Exception: time.sleep(.1)
    with sync_playwright() as p:
        br = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        def page():
            ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, has_touch=True, service_workers="block"); pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" and "audio device" not in m.text else None)   # 没有声卡的机器上那条音频设备的错不算
            pg.on("response", lambda r: errs.append("%d %s" % (r.status, r.url)) if r.status >= 400 else None)
            return ctx, pg, errs
        ctx, pg, errs = page()
        J = lambda js: pg.evaluate(js)
        st = lambda: J("window.__lab && window.__lab.state")
        def until(want, sec=40):
            t0 = time.time()
            while time.time() - t0 < sec:
                if st() == want: return True
                pg.wait_for_timeout(60)
            return False
        shot = lambda name: pg.screenshot(path=os.path.join(OUT, "rack-%s.png" % name))
        rect = lambda i: J("window.__lab.rectOf(%d)" % i)
        pressed = lambda: pg.locator('#marks button[aria-pressed="true"]').get_attribute("data-f")
        def tap_out(i):                                  # 真的用手指：按在这一件上，松手就抽出来
            r = rect(i); pg.mouse.move(r["cx"], r["cy"]); pg.mouse.down(); pg.wait_for_timeout(150)
            tip = pg.locator("#tip").inner_text() if pg.locator("#tip.on").count() else ""
            pg.mouse.up(); pg.wait_for_function("window.__lab.S.outReady", timeout=30000); pg.wait_for_timeout(300); return tip
        def put_back():
            pg.click("#b-back"); return until("idle", 30)

        pg.goto(B + "/lab/shelf.html")
        check("打开是书架，四十本", until("idle", 40) and J("window.__lab.kind") == "shelf" and J("window.__lab.books.length") == 40, st()); pg.wait_for_timeout(400)
        mk = J("(() => { const m = document.querySelector('#marks'), r = m.getBoundingClientRect(); return { n: m.querySelectorAll('button').length, on: getComputedStyle(m).opacity === '1', inside: r.top > innerHeight - 80 && r.bottom <= innerHeight, text: m.innerText.trim() }; })()")
        check("底下一排三个记号，不写字，亮着的是书架", mk == {"n": 3, "on": True, "inside": True, "text": ""} and pressed() == "shelf", (mk, pressed())); shot("0-shelf")
        # 先在书架上改一本：抽一本没读的，打开读一下，放回去
        bi = J("window.__lab.books.findIndex(b => b.st === 'todo')"); J("window.__lab.pull(%d)" % bi); pg.wait_for_function("window.__lab.S.outReady", timeout=30000)
        check("抽出一本的时候，记号和把手都收起来", J("getComputedStyle(document.querySelector('#marks')).opacity") == "0")
        pg.click("#b-read"); pg.wait_for_timeout(300); put_back()
        check("书架上那一本变成在读", J("window.__lab.books[%d].st" % bi) == "doing")

        # 点第二个记号：去档案架
        pg.click('#marks button[data-f="rack"]'); pg.wait_for_timeout(120)
        check("点档案架的记号：镜头横着走过去", st() == "swap", st()); shot("1-swap")
        check("到了档案架", until("idle", 40) and J("window.__lab.kind") == "rack" and pressed() == "rack", (st(), J("window.__lab.kind"))); pg.wait_for_timeout(500); shot("2-rack")
        bx = J("window.__lab.books.map(b => ({ pack: !!b.pack, n: b.n, u: b.u, t: b.t, st: b.st, out: b.outT, fam: b.bd && b.bd.fam }))")
        boxes = [b for b in bx if not b["pack"]]; packs = [b for b in bx if b["pack"]]
        check("架上是二十二个牌盒加三包没拆的邮包", len(boxes) == 22 and len(packs) == 3, (len(boxes), len(packs)))
        check("牌盒的厚跟着牌数走", all(a["t"] <= b["t"] + 1e-6 for a in boxes for b in boxes if a["n"] < b["n"]))
        check("有没读的牌的盒子探出来一点（顶上露签），别的不探", all((b["u"] > 0) == (b["st"] == "doing") == (b["out"] == 1) for b in boxes) and any(b["u"] for b in boxes), [b["u"] for b in boxes])
        check("牌盒的颜色还是那六个色系，一类一个", len({b["fam"] for b in boxes}) == 6, sorted({b["fam"] for b in boxes}))
        check("整座档案架装在一屏里", J(INSIDE_JS) == 0, J(INSIDE_JS))
        pg.click("#grab"); pg.wait_for_timeout(450); hint = pg.locator("#hint").inner_text()
        check("工具纸上写着几盒几张牌、几包没拆", "共 22 盒" in hint and "没拆的邮包 3 包" in hint, hint[:60])
        check("排法、在读的记号、本数这三行只有书架有", J("[...document.querySelectorAll('#tools [data-only]')].every(e => e.hidden && e.getBoundingClientRect().height === 0)")); shot("3-rack-tools")
        pg.mouse.click(195, 120); pg.wait_for_timeout(450)
        b0 = J("window.__lab.books.findIndex(b => !b.pack && b.u > 0 && b.t > 3)"); title = J("window.__lab.books[%d].title" % b0); tip = tap_out(b0)
        check("按在一个盒子上：小签报盒名和几张牌", title in tip and "张" in tip, tip.replace("\n", " "))
        meta = pg.locator("#s-meta").inner_text()
        check("松手抽出来：底下写卷号、哪一类、几张牌、几张没读", pg.locator("#s-title").inner_text() == title and "张牌" in meta and "张没读" in meta, meta)
        hid = J("['#b-read', '#b-done', '#b-todo', '#b-go', '#s-prog'].map(s => getComputedStyle(document.querySelector(s)).display)")
        check("牌盒底下只有「放回去」（没有读书的按钮，也没有「去拆」）", hid == ["none"] * 5 and pg.locator("#b-back").is_visible(), hid); shot("4-box-out")
        check("放回去", put_back() and not J("window.__lab.books[%d].hero" % b0))
        pk = J("window.__lab.books.findIndex(b => b.pack)"); tap_out(pk)
        check("抽出一包没拆的邮包：写着还没拆，有「去拆这一包」，连到拆包页", "还没拆" in pg.locator("#s-meta").inner_text() and pg.locator("#b-go").is_visible() and pg.locator("#b-go").get_attribute("href") == "./", pg.locator("#s-meta").inner_text()); shot("5-pack-out")
        put_back()

        # 按在记号那一排上往左划：去右边那一件（笔记本架）
        r = J("(() => { const r = document.querySelector('#marks').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()")
        pg.mouse.move(r["x"] + 30, r["y"]); pg.mouse.down(); pg.mouse.move(r["x"] - 5, r["y"], steps=4); pg.mouse.move(r["x"] - 40, r["y"], steps=4); pg.mouse.up()
        check("在记号上往左划：去笔记本架", until("idle", 40) and J("window.__lab.kind") == "notes" and pressed() == "notes", (st(), J("window.__lab.kind"))); pg.wait_for_timeout(500); shot("6-notes")
        nb = J("window.__lab.books.map((b, i) => { const r = window.__lab.rectOf(i); return { title: b.title, st: b.st, ago: b.ago, k: (r.r - r.l) / (r.b - r.t), ry: b.ry, rz: b.rz }; })")
        check("架上八本，封面朝外（看到的是宽的一面），往后仰着靠着", len(nb) == 8 and all(.55 < b["k"] < .85 and abs(b["ry"] + 1.5708) < 1e-3 and b["rz"] > .05 for b in nb), [round(b["k"], 2) for b in nb])
        check("今天写过的那一本垂着丝带（探出来），别的不探", [b["title"] for b in nb if b["st"] == "doing"] == ["随手本"] and all((b["ago"] == 0) == (b["st"] == "doing") for b in nb))
        check("整座笔记本架装在一屏里，每层摆满", J(INSIDE_JS) == 0 and J("window.__lab.L.rows.slice(0, -1).every(r => r.length === window.__lab.L.rows[0].length)"), J("window.__lab.L.rows.map(r => r.length)"))
        n0 = J("window.__lab.books.findIndex(b => b.title === '随手本')"); tip = tap_out(n0)
        meta = pg.locator("#s-meta").inner_text()
        check("抽出随手本：写着一天一页、多少页、今天写过", "随手本" in tip and "一天一页" in meta and "212 页" in meta and "今天写过" in meta, meta); shot("7-note-out")
        check("放回去，还是封面朝外仰着", put_back() and J("(() => { const b = window.__lab.books[%d]; return Math.abs(b.ry + Math.PI / 2) < 1e-3 && b.rz > .05 && !b.hero; })()" % n0))

        # 回书架：改过的那一本还在读
        pg.click('#marks button[data-f="shelf"]')
        check("点书架的记号回去：还是四十本，刚才读了一下的那本还是在读", until("idle", 40) and J("window.__lab.kind") == "shelf" and J("window.__lab.books.length") == 40 and J("window.__lab.books[%d].st" % bi) == "doing", (J("window.__lab.kind"), J("window.__lab.books[%d].st" % bi)))
        pg.wait_for_timeout(300); pg.click("#grab"); pg.wait_for_timeout(450)
        check("回到书架，工具纸里那三行又出来了", J("[...document.querySelectorAll('#tools [data-only]')].every(e => !e.hidden)") and "共 40 本" in pg.locator("#hint").inner_text())
        pg.mouse.click(195, 120); pg.wait_for_timeout(400)
        pg.keyboard.press("ArrowRight"); check("键盘右箭头也能换到下一件", until("idle", 40) and J("window.__lab.kind") == "rack", J("window.__lab.kind"))
        check("换了一圈，页面没报错", not errs, "; ".join(errs)[:300]); ctx.close()

        # 地址带 ?f= 直接进某一件；灰盒没做后两件
        ctx, pg, errs = page()
        pg.goto(B + "/lab/shelf.html?f=notes"); until("idle", 40)
        check("地址带 ?f=notes 直接进笔记本架", J("window.__lab.kind") == "notes" and pressed() == "notes" and not errs, "; ".join(errs)[:200]); ctx.close()
        ctx, pg, errs = page()
        pg.goto(B + "/lab/shelf.html?look=grey&f=rack"); until("idle", 40)
        check("灰盒没做档案架和笔记本架：记号不出来，带了参数也还是书架", J("window.__lab.kind") == "shelf" and J("document.querySelector('#marks').hidden") and not errs, (J("window.__lab.kind"), "; ".join(errs)[:200])); ctx.close()
        br.close()
finally:
    mock.terminate()
print("errors:", errors)
sys.exit(1 if errors else 0)
