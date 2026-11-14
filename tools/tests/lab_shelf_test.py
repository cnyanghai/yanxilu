"""书架样机（lab/shelf.html）：上架、看全（屏幕上只有书架和一道小把手）、手指划过书脊、抽出、打开读（读没读跟着进度自己变）、放回、工具纸里换排法、换在读的记号、换本数；手机竖屏走一遍真的指针操作，再按帧截分镜。
用法：python3 tools/tests/lab_shelf_test.py           # 自己起模拟服务（端口 8799），软件渲染，约两三分钟
截图落在 tools/out/lab/（已 gitignore）。样机看的是手感，这条测试只保证流程走得通、整座架子装得进一屏、不报错。"""
import os, sys, time, subprocess, urllib.request
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "tools", "out", "lab"); os.makedirs(OUT, exist_ok=True)
PORT = 8799; B = "http://127.0.0.1:%d" % PORT
errors = []
def check(name, ok, extra=""):
    print(("ok   " if ok else "FAIL ") + name + (" | " + str(extra) if extra != "" else ""), flush=True)
    if not ok: errors.append(name)
op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
mock = subprocess.Popen([sys.executable, os.path.join(ROOT, "tools", "baba_mock.py"), str(PORT)], cwd=ROOT)
# 按读没读放时，书在架上的先后（层、再左右）应当是：读过的、在读的、没读的
ORDER_JS = """(() => { const L = window.__lab.L, bs = window.__lab.books, rank = { done: 0, doing: 1, todo: 2 };
  const seq = L.rows.flat().map(i => rank[bs[i].st]); return seq.every((v, k) => !k || seq[k - 1] <= v); })()"""
INSIDE_JS = """(() => { const lab = window.__lab, top = 0, bot = innerHeight - 20; let bad = 0;
  lab.books.forEach((b, i) => { const r = lab.rectOf(i); if (r.l < -1 || r.r > innerWidth + 1 || r.t < top || r.b > bot) bad++; }); return bad; })()"""
SETTLED_JS = """window.__lab.books.every(b => !b.hero && Math.abs(b.k - 1) < 1e-3 && Math.abs(b.pz - (-1 - b.d / 2)) < 1e-3)"""
try:
    for _ in range(50):
        try: op.open(B + "/api/yxl/state", timeout=1).read(); break
        except Exception: time.sleep(.1)
    with sync_playwright() as p:
        br = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, has_touch=True, service_workers="block")
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        # 没有声卡的机器上浏览器会报一条音频设备的错，和页面无关，不算
        pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" and "audio device" not in m.text else None)
        pg.on("response", lambda r: errs.append("%d %s" % (r.status, r.url)) if r.status >= 400 else None)
        J = lambda js: pg.evaluate(js)
        st = lambda: J("window.__lab && window.__lab.state")
        def until(want, sec=20):
            t0 = time.time()
            while time.time() - t0 < sec:
                if st() == want: return True
                pg.wait_for_timeout(60)
            return False
        shot = lambda name: pg.screenshot(path=os.path.join(OUT, "shelf-%s.png" % name))
        rect = lambda i: J("window.__lab.rectOf(%d)" % i)
        def tool(sel):                                  # 工具纸平时收着：先点把手，再点里面的按钮
            if not J("window.__lab.S.tools"): pg.click("#grab"); pg.wait_for_timeout(450)
            pg.click(sel)
        grab_on = lambda: J("getComputedStyle(document.querySelector('#grab')).opacity") == "1"

        pg.goto(B + "/lab/shelf.html")
        check("不带参数打开是四十本", until("idle", 40) and J("window.__lab.books.length") == 40, st()); pg.wait_for_timeout(400)
        # 2026-11-13 夜里用户定：进书架只看到书架。没有顶栏、底栏，工具纸收在屏幕外面，只有底下一道小把手
        bare = J("""(() => { const vis = [...document.body.querySelectorAll('header, footer, .bar, .foot, a, button, p, h1, h2')].filter(e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e);
          return e.id !== 'grab' && r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && c.visibility !== 'hidden' && +c.opacity > .01 && !e.closest('#sheet'); }); return vis.map(e => e.id || e.className || e.tagName); })()""")
        check("屏幕上只有书架：没有字和按钮，只有一道把手", bare == [] and grab_on() and not J("window.__lab.S.tools"), bare); shot("0-bare")
        check("四十本整座装在一屏里", J(INSIDE_JS) == 0, J(INSIDE_JS))
        r = pg.evaluate("(() => { const r = document.querySelector('#grab').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()")
        pg.mouse.move(r["x"], r["y"]); pg.mouse.down(); pg.mouse.move(r["x"], r["y"] - 40, steps=4); pg.mouse.up(); pg.wait_for_timeout(500)
        check("在把手上往上划，工具纸出来", J("window.__lab.S.tools") and pg.locator("#tools.on").count() == 1 and "共 40 本" in pg.locator("#hint").inner_text(), pg.locator("#hint").inner_text()[:40]); shot("0-tools")
        pg.mouse.click(195, 120); pg.wait_for_timeout(450)
        check("点外面，工具纸收回去", not J("window.__lab.S.tools") and J("document.querySelector('#tools').getBoundingClientRect().top >= innerHeight - 1"))
        check("在读的记号默认是丝带", J("window.__lab.S.mark") == "ribbon")
        tool('#seg-mark [data-mark="tab"]'); pg.wait_for_timeout(500)
        check("工具纸里换成白签，纸自己收起", J("window.__lab.S.mark") == "tab" and not J("window.__lab.S.tools")); shot("0-mark-tab")
        tool('#seg-mark [data-mark="ribbon"]'); pg.wait_for_timeout(300)
        tool('#seg-n [data-n="120"]'); check("工具纸里换成一百二十本", until("idle", 60) and J("window.__lab.books.length") == 120, st()); pg.wait_for_timeout(400)
        check("一百二十本都在自己的位置上", J("window.__lab.books.length") == 120 and J(SETTLED_JS))
        check("整座架子装在一屏里", J(INSIDE_JS) == 0, J(INSIDE_JS)); shot("1-idle")

        # 手指按在一本上，顺着这一层划过三本，松手抽出最后碰到的那本
        row = J("window.__lab.L.rows[2]"); a, b3 = row[3], row[6]
        r = rect(a); pg.mouse.move(r["cx"], r["cy"]); pg.mouse.down(); pg.wait_for_timeout(150)
        check("按住是划过中、碰到的那本探头", st() == "scrub" and J("window.__lab.S.hot") == a, J("window.__lab.S.hot"))
        check("探头的书往外出来了", J("window.__lab.books[%d].pop" % a) > .5, J("window.__lab.books[%d].pop" % a))
        check("小签报的是这本的书名", pg.locator("#tip b").inner_text() == J("window.__lab.books[%d].title" % a))
        r2 = rect(b3); pg.mouse.move(r2["cx"], r2["cy"], steps=10); pg.wait_for_timeout(200)
        check("划到第四本换成它探头", J("window.__lab.S.hot") == b3, J("window.__lab.S.hot")); shot("2-scrub")
        pg.mouse.up()
        check("松手抽出来的是它", st() == "out" and J("window.__lab.S.cur") == b3, st())
        pg.wait_for_function("window.__lab.S.outReady", timeout=15000); pg.wait_for_timeout(350); shot("3-out")
        check("底下的纸写着书名", pg.locator("#s-title").inner_text() == J("window.__lab.books[%d].title" % b3) and pg.locator("#sheet.on").count() == 1)
        # 转着看
        pg.mouse.move(195, 300); pg.mouse.down(); pg.mouse.move(275, 300, steps=6); pg.wait_for_timeout(150)
        check("左右拖是转着看", abs(J("window.__lab.S.yaw")) > .3, J("window.__lab.S.yaw")); pg.mouse.up(); pg.wait_for_timeout(200)
        check("拖完还拿在手里", st() == "out")
        # 在别处读完的：小字补标成读过，放回去
        before = J("window.__lab.counts().done")
        if pg.locator("#b-done").is_visible(): pg.click("#b-done"); pg.wait_for_timeout(450)
        check("补标成读过：进度到头，「打开读」收起", J("window.__lab.books[%d].st" % b3) == "done" and J("window.__lab.books[%d].prog" % b3) == 1 and J("window.__lab.counts().done") >= before and not pg.locator("#b-read").is_visible(), J("window.__lab.books[%d].st" % b3)); shot("4-marked")
        pg.click("#b-back"); check("放回去回到看全", until("idle", 15), st()); pg.wait_for_timeout(300)
        check("放回去以后都在位置上", J(SETTLED_JS))
        check("那道把手回来了", grab_on() and pg.locator("#sheet.on").count() == 0)

        # 换排法：读过的站到一起
        tool('#seg-arr [data-arr="state"]'); pg.wait_for_timeout(350); shot("5-sorting")
        check("换排法飞完", until("idle", 25) and J("window.__lab.L.arr") == "state", st()); pg.wait_for_timeout(400)
        check("先读过、再在读、再没读", J(ORDER_JS)); check("换完都在位置上", J(SETTLED_JS))
        check("层板上三枚小签", pg.locator("#labs .lab").count() == 3, pg.locator("#labs .lab").count()); shot("6-state")
        # 这种排法下抽一本没读的，点「打开读」：读没读不用手标，读了一点它自己变成在读；点空白放回，它该站到在读那一组去
        tid = J("window.__lab.books.find(b => b.st === 'todo').i")
        # 书脊图集里这一本腰封那一段是不是纸的颜色（离腰封的纸色多远），顺带把它的布色和款式拿回来
        FOOT_JS = """(i) => { const a = window.__lab.atlas, b = window.__lab.books[i], x = (b.i % a.cols) * a.cw + a.cw * .28, y = Math.floor(b.i / a.cols) * a.ch + a.ch * (1 - 2.5 / b.h);
          const d = a.canvas.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data, p = [244, 236, 216];
          return { far: Math.max(Math.abs(d[0] - p[0]), Math.abs(d[1] - p[1]), Math.abs(d[2] - p[2])), cloth: b.bd.cloth, style: b.bd.style }; }"""
        f0 = pg.evaluate(FOOT_JS, tid)
        check("没读的书脚围着腰封（书脊图上那一段是纸的颜色）", f0["far"] < 40, f0)
        r = rect(tid); pg.mouse.move(r["cx"], r["cy"]); pg.mouse.down(); pg.wait_for_timeout(120); pg.mouse.up()
        pg.wait_for_function("window.__lab.S.outReady", timeout=15000)
        check("没读的抽出来：写着还没打开过，按钮是「打开读」", "还没打开过" in pg.locator("#s-meta").inner_text() and pg.locator("#b-read").inner_text() == "打开读" and not pg.locator("#b-todo").is_visible())
        pg.click("#b-read"); pg.wait_for_timeout(400)
        check("打开读了一下（百分之二），自己变成在读", J("window.__lab.books[%d].st" % tid) == "doing" and abs(J("window.__lab.books[%d].prog" % tid) - .02) < 1e-6 and "读到 2%" in pg.locator("#s-meta").inner_text() and pg.locator("#b-read").inner_text() == "接着读", pg.locator("#s-meta").inner_text())
        f1 = pg.evaluate(FOOT_JS, tid)
        check("读起来腰封就摘了，书还是原来那块布、那个款式", f1["far"] > 40 and f1["cloth"] == f0["cloth"] and f1["style"] == f0["style"], (f0, f1))
        pg.click("#b-read"); pg.wait_for_timeout(300)
        check("接着读：进度往前走，还是在读", J("window.__lab.books[%d].st" % tid) == "doing" and J("window.__lab.books[%d].prog" % tid) > .2 and J("document.querySelector('#s-prog i').style.width") == "22%", J("window.__lab.books[%d].prog" % tid)); shot("6b-reading")
        pg.mouse.move(40, 420); pg.mouse.down(); pg.wait_for_timeout(60); pg.mouse.up()            # 点空白处放回
        check("点空白处也能放回", until("idle", 20), st()); pg.wait_for_timeout(400)
        check("改成在读的站到在读那一组", J("window.__lab.books[%d].st" % tid) == "doing" and J(ORDER_JS) and J(SETTLED_JS)); shot("7-moved")
        tool('#seg-arr [data-arr="topic"]'); check("换回按类放", until("idle", 25) and J("window.__lab.L.arr") == "topic", st())

        # 换本数：四十本、三百本，整座都要装进一屏
        for n in (40, 300):
            tool('#seg-n [data-n="%d"]' % n); check("%d 本上架完" % n, until("idle", 90) and J("window.__lab.books.length") == n, st()); pg.wait_for_timeout(400)
            check("%d 本整座装在一屏里" % n, J(INSIDE_JS) == 0, J(INSIDE_JS)); shot("8-n%d" % n)
        check("页面没报错", not errs, "; ".join(errs)[:300])

        # 分镜：按帧走，截关键帧（给人看节拍用）
        pg.goto(B + "/lab/shelf.html?n=120"); pg.wait_for_function("window.__lab && window.__lab.books.length", timeout=15000)
        J("window.__lab.manual(true)"); step = lambda s: J("window.__lab.step(%s)" % s)
        kf = lambda name: pg.screenshot(path=os.path.join(OUT, "shelf-kf-%s.png" % name))
        # 软件渲染下一口气走完一两秒的帧，显卡那头要排一阵队，网页层的淡入淡出跟着晚到；等底下那道把手真的回来了再截
        foot_back = lambda: (pg.wait_for_function("getComputedStyle(document.querySelector('#grab')).opacity === '1'", timeout=30000), pg.wait_for_timeout(300))
        step(.75); kf("1"); step(2.2); kf("2")
        i = J("window.__lab.L.rows[2][5]"); r = rect(i); J("window.__lab.S.state = 'scrub'; window.__lab.hot(%d, %f, %f)" % (i, r["cx"], r["cy"])); step(.25); pg.wait_for_timeout(500); kf("3")
        J("window.__lab.S.state = 'idle'; window.__lab.pull(%d)" % i); step(.34); kf("4"); step(.8); pg.wait_for_timeout(700); kf("5")
        J("window.__lab.mark('doing')"); step(.5); J("window.__lab.back()"); step(1.3); foot_back(); kf("6")
        J("window.__lab.arrange('state')"); step(.6); kf("7"); step(1.6); foot_back(); step(.05); pg.wait_for_timeout(300); kf("8")
        ctx.close()

        # 桌面横屏：鼠标移过去就探头，点一下抽出
        ctx = br.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1, service_workers="block"); pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(B + "/lab/shelf.html?n=40"); pg.wait_for_function("window.__lab && window.__lab.state === 'idle'", timeout=60000); pg.wait_for_timeout(300)
        r = pg.evaluate("window.__lab.rectOf(7)"); pg.mouse.move(r["cx"] - 30, r["cy"]); pg.mouse.move(r["cx"], r["cy"], steps=4); pg.wait_for_timeout(200)
        check("桌面：鼠标移上去就探头", pg.evaluate("window.__lab.S.hot") == 7, pg.evaluate("window.__lab.S.hot")); pg.screenshot(path=os.path.join(OUT, "shelf-desk-1-hover.png"))
        pg.mouse.down(); pg.wait_for_timeout(80); pg.mouse.up(); pg.wait_for_function("window.__lab.S.outReady", timeout=20000); pg.wait_for_timeout(300)
        pg.screenshot(path=os.path.join(OUT, "shelf-desk-2-out.png"))
        check("桌面横屏走通", pg.evaluate("window.__lab.state") == "out" and not errs, "; ".join(errs)[:200])
        ctx.close(); br.close()
finally:
    mock.terminate()
print("errors:", errors)
sys.exit(1 if errors else 0)
