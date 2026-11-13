"""进门样机（lab/door.html）：直接到（2026-11-12 用户定，页面上没有切换）、看懂（层板上的签）、左右划看书名、往下拉带走一排（没到弹回、过六成带走、
拉到底自己带走）、点签带走、邮包、倒回去重来、再进一次；留作对照的敲门进（?way=knock）也走一遍；手机竖屏走真的指针操作，再按帧截分镜。
用法：python3 tools/tests/lab_door_test.py           # 自己起模拟服务（端口 8796），软件渲染，约两三分钟
截图落在 tools/out/lab/（已 gitignore）。样机看的是手感，这条测试只保证流程走得通、不报错。"""
import os, sys, time, subprocess, urllib.request
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "tools", "out", "lab"); os.makedirs(OUT, exist_ok=True)
PORT = 8796; B = "http://127.0.0.1:%d" % PORT
errors = []
def check(name, ok, extra=""):
    print(("ok   " if ok else "FAIL ") + name + (" | " + str(extra) if extra != "" else ""), flush=True)
    if not ok: errors.append(name)
op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
mock = subprocess.Popen([sys.executable, os.path.join(ROOT, "tools", "baba_mock.py"), str(PORT)], cwd=ROOT)
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
        def until(js, sec=25):
            t0 = time.time()
            while time.time() - t0 < sec:
                if J(js): return True
                pg.wait_for_timeout(60)
            return False
        idle = lambda sec=25: until("window.__lab.state === 'idle' && !window.__lab.S.pull", sec)
        shot = lambda name: pg.screenshot(path=os.path.join(OUT, "door-%s.png" % name))
        bag_n = lambda: J("window.__lab.S.bag.length")
        def pull(r, dy, hold=250):                      # 按住第 r 排往下拉 dy 像素，不松手
            rr = J("window.__lab.rowRect(%d)" % r); x, y = rr["cx"], rr["cy"]
            pg.mouse.move(x, y); pg.mouse.down(); pg.wait_for_timeout(80); pg.mouse.move(x + 2, y + dy, steps=12); pg.wait_for_timeout(hold)

        pg.goto(B + "/lab/door.html?dev"); pg.wait_for_function("window.__lab", timeout=15000)
        check("默认直接到：没有门，书架就在眼前", J("window.__lab.S.way") == "direct" and not J("window.__lab.doorOn") and J("window.__lab.S.ent") == 1, J("window.__lab.S.way"))
        check("页面上没有进法的切换", pg.locator("#seg-way").count() == 0)
        check("顶上写着谁的书房和他那句话", pg.locator("#owner.on b").inner_text() == J("window.__lab.OWNER.name") + "的书房" and pg.locator("#owner span").inner_text() == J("window.__lab.OWNER.line")); shot("1-arrive")
        check("到了以后停在能动", idle(40), st()); pg.wait_for_timeout(400)
        check("点开到能动不超过一秒半", 0 < J("window.__lab.S.tIdle") <= 1.5, J("window.__lab.S.tIdle"))
        check("五枚签都出来了（四排书加一层牌和本子）", pg.locator("#labs .lab.on").count() == 5, pg.locator("#labs .lab.on").count()); shot("2-in")

        # 左右划：看书名，不抽出来
        a, b3 = J("window.__lab.ROWS[0].books[3].i"), J("window.__lab.ROWS[0].books[7].i")
        r = J("window.__lab.rectOf(%d)" % a); pg.mouse.move(r["cx"], r["cy"]); pg.mouse.down(); pg.wait_for_timeout(120)
        check("按住一本就探头报书名", J("window.__lab.S.hot") == a and pg.locator("#tip b").inner_text() == J("window.__lab.books[%d].title" % a), J("window.__lab.S.hot"))
        r2 = J("window.__lab.rectOf(%d)" % b3); pg.mouse.move(r2["cx"], r2["cy"], steps=10); pg.wait_for_timeout(150)
        check("左右划换成别的书探头", J("window.__lab.S.hot") == b3 and st() == "idle", J("window.__lab.S.hot")); shot("3-scrub")
        pg.mouse.up(); pg.wait_for_timeout(150)
        check("松手只是放下，不抽也不带走", J("window.__lab.S.hot") == -1 and st() == "idle" and bag_n() == 0)

        # 往下拉一排：没到六成松手弹回
        pull(2, 62)
        check("往下拉是带走中，白纸包的那一份出来了", st() == "pull" and J("window.__lab.ROWS[2].books.some(b => b.ck > 0)"), st()); shot("4-pull-part")
        pg.mouse.up(); check("没到六成松手弹回，包还是空的", idle(8) and bag_n() == 0 and not J("window.__lab.ROWS[2].taken"), st())
        # 过六成松手：带走
        pull(2, 125)
        check("过了六成提示松手就带走", pg.locator("#hint").inner_text() == "松手就带走", pg.locator("#hint").inner_text()); shot("5-pull-ready")
        pg.mouse.up(); check("松手带走一排", until("window.__lab.S.bag.length === 1", 15) and idle(8) and J("window.__lab.ROWS[2].taken"), bag_n()); pg.wait_for_timeout(500)
        n2 = J("window.__lab.ROWS[2].n")
        check("邮包上写着一排几本", pg.locator("#bag-n").inner_text() == "1 排 · %d 本" % n2, pg.locator("#bag-n").inner_text())
        check("那一排的签改成已在你包里", "已在你包里" in pg.locator("#labs .lab").nth(2).inner_text()); shot("6-taken")
        check("他架上的书一本没少", J("window.__lab.books.length") == sum(J("window.__lab.ROWS.map(r => r.n)")))
        # 拉到底：不用松手自己带走
        pull(0, 190, hold=100); check("拉到底不用松手就带走", until("window.__lab.S.bag.length === 2", 15), bag_n()); pg.mouse.up(); idle(8)
        # 带走过的再拉：不动
        pull(0, 120, hold=150); check("带走过的一排再拉不动", st() == "idle" and bag_n() == 2 and "已经在你包里" in pg.locator("#hint").inner_text(), pg.locator("#hint").inner_text()); pg.mouse.up()
        # 点签带走
        pg.locator("#labs .lab").nth(1).click(); check("点层板上的签也带走", until("window.__lab.S.bag.length === 3", 15) and idle(8), bag_n()); pg.wait_for_timeout(300)
        # 邮包
        pg.click("#bag"); pg.wait_for_timeout(350)
        check("点邮包看带走了什么", pg.locator("#sheet.on").count() == 1 and pg.locator("#bag-list li").count() == 3, pg.locator("#bag-list li").count()); shot("7-bag")
        pg.click("#b-reset"); pg.wait_for_timeout(350)
        check("倒回去重来", bag_n() == 0 and not J("window.__lab.ROWS.some(r => r.taken)") and pg.locator("#sheet.on").count() == 0 and pg.locator("#bag-n").inner_text() == "空的")

        pg.click("#b-again"); check("再进一次：签收回去重新冒", st() == "door" and pg.locator("#labs .lab.on").count() < 5 and not J("window.__lab.doorOn"), st())
        check("又到了", idle(20) and pg.locator("#labs .lab.on").count() == 5, st())
        check("页面没报错", not errs, "; ".join(errs)[:300])

        # 留作对照的敲门进：地址加 ?way=knock 才走
        pg.goto(B + "/lab/door.html?dev&way=knock"); pg.wait_for_function("window.__lab", timeout=15000)
        check("敲门进：先到门口", st() == "door" and J("window.__lab.doorOn") and J("window.__lab.S.ent") < .05, st()); shot("8-knock")
        check("敲门进：三秒内进来、门收起来", idle(40) and 0 < J("window.__lab.S.tIdle") <= 3 and J("window.__lab.S.ent") == 1 and not J("window.__lab.doorOn"), J("window.__lab.S.tIdle"))
        check("敲门进也没报错", not errs, "; ".join(errs)[:300])

        # 分镜：按帧走，截关键帧（给人看节拍用）
        pg.goto(B + "/lab/door.html"); pg.wait_for_function("window.__lab", timeout=15000)
        J("window.__lab.manual(true); window.__lab.enter()"); step = lambda s: J("window.__lab.step(%s)" % s)
        kf = lambda name: (pg.wait_for_timeout(450), pg.screenshot(path=os.path.join(OUT, "door-kf-%s.png" % name)))
        labs_on = lambda n: pg.wait_for_function("document.querySelectorAll('#labs .lab.on').length === %d" % n, timeout=30000)
        step(.1); kf("1")                                                    # 到了：书架和顶上那句话，签还没出来
        step(.22); labs_on(2); kf("2")                                       # 签一枚枚冒出来
        step(1.0); labs_on(5); pg.wait_for_function("window.__lab.state === 'idle'", timeout=30000); kf("3")   # 看懂
        r = J("window.__lab.rectOf(window.__lab.ROWS[0].books[6].i)"); pg.mouse.move(r["cx"], r["cy"]); pg.mouse.down(); step(.3)
        pg.wait_for_function("document.querySelector('#tip').classList.contains('on')", timeout=30000); kf("4")   # 左右划看书名
        pg.mouse.up(); step(.3)
        J("window.__lab.pullTo(1, .4)"); step(.5); pg.wait_for_function("getComputedStyle(document.querySelector('#tip')).opacity === '0'", timeout=30000); kf("5")                   # 往下拉，出来一半
        J("window.__lab.pullTo(1, .8)"); step(.4); pg.wait_for_function("document.querySelector('#hint').textContent === '松手就带走'", timeout=30000); kf("6")   # 过了六成
        J("window.__lab.pullTo(1, 1.02)"); step(.62); kf("7"); step(.8)      # 捆好，飞进邮包
        pg.wait_for_function("document.querySelector('#bag').classList.contains('full')", timeout=30000); kf("8")   # 落进邮包
        ctx.close()

        # 桌面横屏：鼠标移过去就探头，点签带走
        ctx = br.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1, service_workers="block"); pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(B + "/lab/door.html"); pg.wait_for_function("window.__lab && window.__lab.state === 'idle'", timeout=60000); pg.wait_for_timeout(300)
        i = pg.evaluate("window.__lab.ROWS[1].books[5].i"); r = pg.evaluate("window.__lab.rectOf(%d)" % i)
        pg.mouse.move(r["cx"] - 20, r["cy"]); pg.mouse.move(r["cx"], r["cy"], steps=4); pg.wait_for_timeout(200)
        check("桌面：鼠标移上去就探头", pg.evaluate("window.__lab.S.hot") == i, pg.evaluate("window.__lab.S.hot")); pg.screenshot(path=os.path.join(OUT, "door-desk-1-hover.png"))
        pg.locator("#labs .lab").nth(0).click(); pg.wait_for_function("window.__lab.S.bag.length === 1", timeout=30000); pg.wait_for_timeout(400)
        pg.screenshot(path=os.path.join(OUT, "door-desk-2-taken.png"))
        check("桌面横屏走通", pg.evaluate("window.__lab.state") == "idle" and not errs, "; ".join(errs)[:200])
        ctx.close(); br.close()
finally:
    mock.terminate()
print("errors:", errors)
sys.exit(1 if errors else 0)
