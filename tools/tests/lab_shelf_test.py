"""书架样机（lab/shelf.html）：上架、看全、手指划过书脊、抽出、改读没读、放回、换排法、换本数；手机竖屏走一遍真的指针操作，再按帧截分镜。
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
INSIDE_JS = """(() => { const lab = window.__lab, top = 48, bot = innerHeight - 110; let bad = 0;
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

        pg.goto(B + "/lab/shelf.html?dev")
        check("上架完停在看全", until("idle", 40), st()); pg.wait_for_timeout(400)
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
        # 改成读过，放回去
        before = J("window.__lab.counts().done"); pg.click('#seg-st [data-st="done"]'); pg.wait_for_timeout(450)
        check("标成读过", J("window.__lab.books[%d].st" % b3) == "done" and J("window.__lab.counts().done") >= before, J("window.__lab.books[%d].st" % b3)); shot("4-marked")
        pg.click("#b-back"); check("放回去回到看全", until("idle", 15), st()); pg.wait_for_timeout(300)
        check("放回去以后都在位置上", J(SETTLED_JS))
        check("底下的按钮回来了", J("getComputedStyle(document.querySelector('#foot')).opacity") == "1" and pg.locator("#sheet.on").count() == 0)

        # 换排法：读过的站到一起
        pg.click('#seg-arr [data-arr="state"]'); pg.wait_for_timeout(350); shot("5-sorting")
        check("换排法飞完", until("idle", 25) and J("window.__lab.L.arr") == "state", st()); pg.wait_for_timeout(400)
        check("先读过、再在读、再没读", J(ORDER_JS)); check("换完都在位置上", J(SETTLED_JS))
        check("层板上三枚小签", pg.locator("#labs .lab").count() == 3, pg.locator("#labs .lab").count()); shot("6-state")
        # 这种排法下把一本没读的改成在读：点一下抽出、改、点空白放回，它该站到在读那一组去
        tid = J("window.__lab.books.find(b => b.st === 'todo').i")
        r = rect(tid); pg.mouse.move(r["cx"], r["cy"]); pg.mouse.down(); pg.wait_for_timeout(120); pg.mouse.up()
        pg.wait_for_function("window.__lab.S.outReady", timeout=15000)
        pg.click('#seg-st [data-st="doing"]'); pg.wait_for_timeout(400)
        pg.mouse.move(40, 420); pg.mouse.down(); pg.wait_for_timeout(60); pg.mouse.up()            # 点空白处放回
        check("点空白处也能放回", until("idle", 20), st()); pg.wait_for_timeout(400)
        check("改成在读的站到在读那一组", J("window.__lab.books[%d].st" % tid) == "doing" and J(ORDER_JS) and J(SETTLED_JS)); shot("7-moved")
        pg.click('#seg-arr [data-arr="topic"]'); check("换回按类放", until("idle", 25) and J("window.__lab.L.arr") == "topic", st())

        # 换本数：四十本、三百本，整座都要装进一屏
        for n in (40, 300):
            pg.click('#seg-n [data-n="%d"]' % n); check("%d 本上架完" % n, until("idle", 90) and J("window.__lab.books.length") == n, st()); pg.wait_for_timeout(400)
            check("%d 本整座装在一屏里" % n, J(INSIDE_JS) == 0, J(INSIDE_JS)); shot("8-n%d" % n)
        check("页面没报错", not errs, "; ".join(errs)[:300])

        # 分镜：按帧走，截关键帧（给人看节拍用）
        pg.goto(B + "/lab/shelf.html?n=120"); pg.wait_for_function("window.__lab && window.__lab.books.length", timeout=15000)
        J("window.__lab.manual(true)"); step = lambda s: J("window.__lab.step(%s)" % s)
        kf = lambda name: pg.screenshot(path=os.path.join(OUT, "shelf-kf-%s.png" % name))
        # 软件渲染下一口气走完一两秒的帧，显卡那头要排一阵队，网页层的淡入淡出跟着晚到；等底下的按钮真的回来了再截
        foot_back = lambda: (pg.wait_for_function("getComputedStyle(document.querySelector('#foot')).opacity === '1'", timeout=30000), pg.wait_for_timeout(300))
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
