"""立体书房（主站的 #shufang 一页）：把 lab/shelf.html 嵌进主站，架上摆的是账号里真的书、牌盒、本子，不是编的样品。
三维那一页自己不取数据、不认账号，向主站要快照（window.parent.YXL_ROOM.snap()），要打开什么也交回主站：
抽出来的书、本子、邮包再点它一下就进去（书到阅读器、书页或纸模版的书立，本子到本子页，邮包到纸模版的档案架去拆）；
开着的牌盒里，立着的那张背面朝上点一下翻开，面朝上再点一下读全文（主站的阅读器盖在书房上面，合上回到原处）。
这一步只读：读没读是在阅读器里读出来的，翻开看一眼牌面不算。没登录时架上是书单里的书，工具纸里有「登录」。
单独打开 lab/shelf.html 还是样品，工具纸里有一行「进我的书房」。
用法：python3 tools/tests/lab_room_test.py           # 自己起模拟服务（端口 8794），软件渲染，约两三分钟
截图落在 tools/out/lab/（已 gitignore）。这条测试只保证接得上、走得通、不报错；真账号里的书多了少了好不好看要人在手机上看。"""
import os, sys, time, json, subprocess, urllib.request, datetime
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "tools", "out", "lab"); os.makedirs(OUT, exist_ok=True)
PORT = 8794; B = "http://127.0.0.1:%d" % PORT
errors = []
def check(name, ok, extra=""):
    print(("ok   " if ok else "FAIL ") + name + (" | " + str(extra) if extra != "" else ""), flush=True)
    if not ok: errors.append(name)
op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
def put(coll, id, data):
    r = urllib.request.Request(B + "/api/yxl/doc", data=json.dumps({"coll": coll, "id": id, "data": data}).encode(), method="PUT", headers={"content-type": "application/json", "cookie": "sid=u1"})
    return op.open(r).read()
mock = subprocess.Popen([sys.executable, os.path.join(ROOT, "tools", "baba_mock.py"), str(PORT)], cwd=ROOT)
today = datetime.date.today().isoformat()
try:
    for _ in range(50):
        try: op.open(B + "/api/yxl/state", timeout=1).read(); break
        except Exception: time.sleep(.1)
    # 测试账号里放：一本自己加的书、一个自己立的盒（四篇剪报，头一篇读过、写了为什么存）、一篇没拆的剪报、一本主题本、随手本今天的一页
    put("mybooks", "mb-t1", {"title": "测试放的一本书", "by": "某人", "track": "geo", "t": "2026-11-01T00:00:00Z"})
    put("aboxes", "ab-t1", {"title": "测试的盒", "track": "fin", "question": "", "t": "2026-11-01T00:00:00Z"})
    for i in range(4):
        put("clips", "cl-t%d" % i, {"key": "zh-a-9%d" % i, "url": "https://www.zhihu.com/question/1/answer/9%d" % i, "title": "测试剪报第 %d 篇" % (i + 1), "site": "知乎", "kind": "answer", "track": "fin", "box": "ab-t1",
                                   "note": "讲清了来龙去脉" if i == 0 else "", "excerpt": "开头的一句话", "words": 2400, "status": "full", "seen": "2026-11-02T00:00:00Z", "t": "2026-11-0%dT07:00:00Z" % (i + 1)})
        put("clipbody", "cl-t%d" % i, {"html": "<p>正文 %d</p><p>第二段。</p>" % i, "t": "2026-11-02T07:00:00Z"})
    put("reading", "cl-t0", {"pct": .6, "t": "2026-11-03T00:00:00Z"})
    put("clips", "cl-new", {"key": "zh-a-77", "url": "https://www.zhihu.com/question/1/answer/77", "title": "还没拆的一篇", "site": "知乎", "kind": "answer", "track": "geo", "note": "", "excerpt": "开头", "words": 900, "status": "full", "t": "2026-11-05T07:00:00Z"})
    put("nbooks", "nb-t1", {"name": "测试本", "color": "terra", "kind": "topic", "t": "2026-11-01T00:00:00Z"})
    put("pages", "np-t-t1", {"nb": "nb-t1", "title": "第一页", "text": "写了点什么", "t": "2026-11-03T00:00:00Z"})
    put("pages", "np-d-" + today, {"nb": "nb-daily", "date": today, "text": "09:00 今天的一段", "t": today + "T01:00:00Z"})

    with sync_playwright() as p:
        br = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        def page(login=True):
            ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, has_touch=True, service_workers="block")
            if login: ctx.add_cookies([{"name": "sid", "value": "u1", "url": B}])
            # 这台设备以前在主站的「布置」里选过墓园宽柜（那个入口早拿掉了，换不回来）：主站不该再认它
            ctx.add_init_script("try { if (!location.pathname.startsWith('/lab/')) localStorage.setItem('yanxilu-look', JSON.stringify({ v: 2, scene: 'youchai' })); } catch (e) {}")
            pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" and "audio device" not in m.text and "/login" not in m.text and "404" not in m.text else None)
            pg.on("response", lambda r: errs.append("%d %s" % (r.status, r.url)) if r.status >= 400 and "/login" not in r.url else None)   # 模拟服务没有登录页，那一条 404 不算
            return ctx, pg, errs
        ctx, pg, errs = page()
        def lab(sec=60):                                 # 书房那一页（iframe 里），等它摆好
            t0 = time.time()
            while time.time() - t0 < sec:
                f = next((x for x in pg.frames if "lab/shelf.html" in x.url), None)
                try:
                    if f and f.evaluate("!!(window.__lab && window.__lab.state === 'idle')"): return f
                except Exception: pass
                pg.wait_for_timeout(150)
            return None
        def until(F, js, sec=30):
            t0 = time.time()
            while time.time() - t0 < sec:
                try:
                    if F.evaluate(js): return True
                except Exception: pass
                pg.wait_for_timeout(80)
            return False
        shot = lambda name: pg.screenshot(path=os.path.join(OUT, "room-%s.png" % name))
        def pull(F, i): F.evaluate("window.__lab.pull(%d)" % i); ok = until(F, "window.__lab.S.outReady"); pg.wait_for_timeout(250); return ok
        def tap_hero(F): r = F.evaluate("window.__lab.heroRect()"); pg.mouse.click(r["cx"], r["cy"])       # 真的点一下抽出来的那一件（iframe 铺满整屏，坐标就是屏上的）
        def swap(F, kind): F.evaluate("window.__lab.goto('%s')" % kind); return until(F, "window.__lab.state === 'idle' && window.__lab.kind === '%s'" % kind)
        hash_ = lambda: pg.evaluate("location.hash")
        skin = lambda: pg.evaluate("(() => { const c = document.documentElement.classList; return { yx: c.contains('yx-scene') || c.contains('yx-dark'), room: c.contains('room-skin'), back: document.querySelectorAll('.room-back').length, bg: getComputedStyle(document.body).backgroundColor }; })()")
        def left(h): pg.wait_for_function("location.hash === '%s' && !document.querySelector('#room-frame')" % h, timeout=20000); pg.wait_for_timeout(500)      # 换页带一下淡接，等真的换完（书房那一页拿掉了）再看
        def settle(F, more="true"): ok = until(F, "window.__lab.state === 'open' && !window.__lab.box.busy && (%s)" % more, 40); pg.wait_for_timeout(250); return ok      # 牌还在发、还在翻的时候点了不算，等它停

        # ---- 一 进书房：整屏一页，架上是账号里的书
        pg.goto(B + "/#shufang"); F = lab()
        check("进 #shufang：嵌着书房那一页，摆好了", F is not None and F.evaluate("window.__lab.host") is True)
        shell = pg.evaluate("({ top: getComputedStyle(document.querySelector('.topbar')).display, main: document.querySelector('#main').children.length, fr: (() => { const r = document.querySelector('#room-frame').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })() })")
        check("主站的顶栏收起，书房铺满整屏", shell["top"] == "none" and shell["main"] == 0 and shell["fr"] == [0, 0, 390, 844], shell)
        snap = F.evaluate("(() => { const s = window.__lab.snap; return { user: s.user && s.user.name, login: s.login, nb: s.books.length, mine: s.books.filter(b => b.id === 'mb-t1').length, boxes: s.boxes.map(b => b.id + ':' + b.cards.length), packs: s.packs.map(p => p.id + ':' + p.n), notes: s.notes.map(n => n.id + ':' + n.pages + ':' + n.ago) }; })()")
        check("快照是这个账号的：自己加的书、自己立的盒、没拆的剪报、两本本子", snap["user"] == "测试用户" and snap["login"] is False and snap["mine"] == 1 and "ab-t1:4" in snap["boxes"] and snap["packs"] == ["geo:1"] and snap["notes"][0] == "nb-daily:1:0" and snap["notes"][1].startswith("nb-t1:1:"), snap)
        nb = F.evaluate("window.__lab.books.length")
        check("架上的书就是快照里的那些（不是四十本样品）", nb == snap["nb"] and nb != 40 and F.evaluate("window.__lab.books.some(b => b.title === '测试放的一本书')"), nb)
        check("书按领域排在一起", F.evaluate("window.__lab.books.every((b, i, a) => !i || a[i - 1].cat <= b.cat)"))
        rows = F.evaluate("({ demo: document.querySelector('#t-demo').hidden, host: document.querySelector('#t-host').hidden, n: document.querySelector('#seg-n').closest('.trow').hidden, who: document.querySelector('#t-who').textContent, login: document.querySelector('#b-login').hidden, lab: document.querySelector('#t-lab').hidden })")
        check("工具纸：写着谁的书房，没有「本数」「样品」「别的样机」，登录了就没有「登录」", rows == {"demo": True, "host": False, "n": True, "who": "测试用户 的书房", "login": True, "lab": True}, rows); shot("0-shelf")

        # ---- 二 书：抽出来再点一下就进去。没挂电子书、没有书页的，去纸模版的书架（那里能挂）；有书页的去书页
        bi = F.evaluate("window.__lab.books.findIndex(b => b.id === 'mb-t1')"); pull(F, bi)
        sh = F.evaluate("({ meta: document.querySelector('#s-meta').textContent, read: document.querySelector('#b-read').textContent, done: document.querySelector('#b-done').hidden, todo: document.querySelector('#b-todo').hidden })")
        check("抽出一本：底下写「再点一下这本书打开」，没有手标读没读的两行", "再点一下这本书打开" in sh["meta"] and "某人" in sh["meta"] and "页" not in sh["meta"] and sh["read"] == "去挂电子书" and sh["done"] and sh["todo"], sh); shot("1-book")
        tap_hero(F); left("#shelf")
        check("再点一下这本书：到纸模版的书架，这本的书立开着，书房那一页拿掉了", pg.locator("#room-frame").count() == 0 and pg.locator(".pstand").count() == 1 and "测试放的一本书" in pg.locator(".pstand").inner_text() and pg.evaluate("getComputedStyle(document.querySelector('.topbar')).display") != "none")
        sk = skin()
        check("这一页不是墓园，是旧书房的颜色（深木头的底），底下有「回书房」", sk["yx"] is False and sk["room"] is True and sk["back"] == 1 and sk["bg"] == "rgb(43, 28, 17)", sk)
        pg.go_back(); F = lab()
        check("按返回：回到书房，上架那一段快进", F is not None and hash_() == "#shufang" and "quick=1" in F.url, F and F.url)
        bi = F.evaluate("window.__lab.books.findIndex(b => b.page && !b.eb)"); pull(F, bi)
        check("书单里有书页的那些：按钮是「看这本书的页」", F.evaluate("document.querySelector('#b-read').textContent") == "看这本书的页")
        bid = F.evaluate("window.__lab.books[%d].id" % bi); F.evaluate("document.querySelector('#b-read').click()"); left("#b-" + bid)
        check("点按钮也进得去：到这本书的页", pg.locator("#room-frame").count() == 0)
        pg.go_back(); F = lab()

        # ---- 三 档案架：真的盒、真的牌；面朝上的再点一下读全文，阅读器盖在书房上面，合上回到原处
        check("换到档案架", swap(F, "rack"))
        rk = F.evaluate("window.__lab.books.map(b => (b.pack ? 'pack' : 'box') + ':' + b.title + ':' + b.n + ':' + b.u)")
        few = F.evaluate("(() => { const L = window.__lab, r = L.rectOf(L.books.findIndex(b => b.id === 'ab-t1')); return { W: L.S.W, R: L.S.R, t: Math.min(...L.books.filter(b => !b.pack).map(b => b.t)), w: Math.round(r.r - r.l), h: Math.round(r.b - r.t) }; })()")
        check("只有四件东西：架子缩到刚好装下、镜头靠近，一个盒在屏上有五十像素宽以上（原来不到二十）；最薄的盒也有四厘米", few["W"] <= 24 and few["t"] >= 4.2 and few["w"] >= 50 and few["h"] >= 170, few)
        check("档案架上是账号里的盒和一包没拆的剪报", any(x.startswith("box:测试的盒:4:3") for x in rk) and any(x.startswith("pack:") and x.endswith(":1:1") for x in rk), rk); shot("2-rack")
        xi = F.evaluate("window.__lab.books.findIndex(b => b.id === 'ab-t1')"); pull(F, xi); tap_hero(F)
        check("抽出这一盒再点一下：打开成扇", settle(F))
        cards = F.evaluate("window.__lab.box.cards.map(c => c.c.id + ':' + c.c.read + ':' + c.c.real + ':' + (c.c.whyLab || '') + ':' + c.c.min)")
        check("四张牌是那四篇剪报：头一篇读过（写了为什么存），后三篇背面朝上（没写的印开头几句）", cards == ["cl-t0:true:true::6", "cl-t1:false:false:开头几句:6", "cl-t2:false:false:开头几句:6", "cl-t3:false:false:开头几句:6"], cards)
        check("一打开停在头一张没读的上", F.evaluate("window.__lab.box.focus") == 1, F.evaluate("window.__lab.box.focus")); shot("3-fan")
        def big(): r = F.evaluate("window.__lab.box.dispRect()"); return r["x"], r["y"]              # 立着的那张的正中
        x, y = big(); pg.mouse.click(x, y); settle(F, "window.__lab.box.cards[1].c.read")
        flip = F.evaluate("(() => { const c = window.__lab.box.cards[1].c, b = window.__lab.books[window.__lab.S.cur]; return { read: c.read, real: c.real, u: b.u, meta: document.querySelector('#s-meta').textContent }; })()")
        check("点一下背面朝上的：翻开看牌面，不算读过（没读的还是三张），底下写「再点一下读全文」", flip["read"] is True and flip["real"] is False and flip["u"] == 3 and "还没读" in flip["meta"] and "再点一下读全文" in flip["meta"] and pg.locator(".rd").count() == 0, flip); shot("4-peek")
        x, y = big(); pg.mouse.click(x, y); pg.wait_for_selector(".rd", timeout=15000); pg.wait_for_timeout(900)
        rd = pg.evaluate("({ title: (document.querySelector('.rd') || {}).textContent.indexOf('测试剪报第 2 篇') >= 0, z: +getComputedStyle(document.querySelector('.rd')).zIndex > +getComputedStyle(document.querySelector('#room-frame')).zIndex })")
        check("再点一下：主站的阅读器盖在书房上面，打开的是这一篇", rd == {"title": True, "z": True} and hash_() == "#shufang", rd)
        shot("5-reader"); check("阅读器开着的时候书房不画", F.evaluate("window.__lab.S.paused") is True)
        pg.click('[data-act="rd-close"]'); pg.wait_for_timeout(1200)
        after = F.evaluate("(() => { const c = window.__lab.box.cards[1].c, b = window.__lab.books[window.__lab.S.cur]; return { st: window.__lab.state, paused: !!window.__lab.S.paused, real: c.real, u: b.u, focus: window.__lab.box.focus }; })()")
        check("合上阅读器：回到原处（盒还开着、还是这一张），这一篇算读过了，没读的剩两张", pg.locator(".rd").count() == 0 and after == {"st": "open", "paused": False, "real": True, "u": 2, "focus": 1}, after)
        F.evaluate("window.__lab.closeBox()"); until(F, "window.__lab.state === 'out' && window.__lab.S.outReady", 30); F.evaluate("window.__lab.back()"); until(F, "window.__lab.state === 'idle'", 30); pg.wait_for_timeout(500)
        check("合上放回去：架上这一盒的没读数跟着账号里的走", F.evaluate("(() => { const b = window.__lab.books.find(x => x.id === 'ab-t1'); return b.u === 2 && b.cards[1].real === true && b.cards[2].read === false; })()"))
        # 自己的档案（书单里带的报告）也是牌：没有分钟数，圈里是一个字；面朝上再点一下在新标签页打开，地址照主站拼
        hi = F.evaluate("window.__lab.books.findIndex(b => !b.pack && b.cards && b.cards.some(c => c.kind === 'report'))"); pull(F, hi); tap_hero(F); settle(F)
        rc = F.evaluate("(() => { const c = window.__lab.box.cards[window.__lab.box.focus].c; return { kind: c.kind, min: c.min, mark: c.mark, lab: c.whyLab }; })()")
        x, y = big(); pg.mouse.click(x, y); settle(F, "window.__lab.box.cards[window.__lab.box.focus].c.read")
        with ctx.expect_page(timeout=15000) as pop: pg.mouse.click(x, y)
        pu = pop.value.url; pop.value.close()
        check("自己的档案这张牌：圈里一个字，再点一下在新标签页打开，地址没拼错", rc["kind"] == "report" and rc["min"] == 0 and len(rc["mark"]) == 1 and rc["lab"] == "里面是" and "/reports/" in pu and "/lab/" not in pu, (rc, pu))
        F.evaluate("window.__lab.closeBox()"); until(F, "window.__lab.state === 'out' && window.__lab.S.outReady", 30); F.evaluate("window.__lab.back()"); until(F, "window.__lab.state === 'idle'", 30); pg.wait_for_timeout(400)
        pi = F.evaluate("window.__lab.books.findIndex(b => b.pack)"); pull(F, pi)
        check("没拆的邮包：底下写「再点一下去拆」", "再点一下去拆" in F.evaluate("document.querySelector('#s-meta').textContent"))
        tap_hero(F); left("#archive")
        check("再点一下邮包：到纸模版的档案架，这一袋摆在桌上等着拆", pg.locator("#room-frame").count() == 0 and pg.locator(".ytable .ybag.sealed").count() == 1)
        pg.go_back(); F = lab()
        check("按返回：回到书房，还在档案架前", F is not None and F.evaluate("window.__lab.kind") == "rack" and "f=rack" in F.url, F and F.url)

        # ---- 四 笔记本架：抽出来再点一下就翻开（到本子页，能写）
        check("换到笔记本架", swap(F, "notes"))
        nt = F.evaluate("window.__lab.books.map(b => b.id + ':' + b.title + ':' + b.pages + ':' + b.st)")
        check("两本本子：随手本今天写过（垂着丝带）、测试本", nt == ["nb-daily:随手本:1:doing", "nb-t1:测试本:1:done"], nt); shot("6-notes")
        pull(F, 1)
        check("抽出测试本：底下写「再点一下本子翻开」", "再点一下本子翻开" in F.evaluate("document.querySelector('#s-meta').textContent")); shot("7-note-out")
        tap_hero(F); left("#nb-t1")
        sk = skin(); check("本子页不是墓园，是旧书房的颜色", sk["yx"] is False and sk["room"] is True and sk["back"] == 1, sk)
        txt = pg.locator("#main").inner_text()
        check("再点一下本子：翻开了，是这一本的这一页（纸模版的本子页，在那里写）", pg.locator("#room-frame").count() == 0 and "写了点什么" in txt and "第一页" in txt and "撕掉这一页" in txt)
        shot("8-note-page")
        pg.click(".room-back"); F = lab()
        check("点「回书房」：回到书房，还在笔记本架前", F is not None and hash_() == "#shufang" and F.evaluate("window.__lab.kind") == "notes")
        pull(F, 0); tap_hero(F); left("#notes")
        pg.wait_for_timeout(500); check("随手本：翻到今天这一页", "今天的一段" in pg.locator("#main").inner_text())
        pg.goto(B + "/#notes"); pg.reload(); pg.wait_for_timeout(1200); sk = skin()      # 重新载入：这一次不是从书房走出来的
        check("直接打开纸模的本子页（不经过书房）：还是牛皮纸，也不是墓园，没有「回书房」", sk["yx"] is False and sk["room"] is False and sk["back"] == 0, sk)
        check("登录着走完一遍没有报错", not errs, errs[:6])
        ctx.close()

        # ---- 五 没登录：架上是书单里的书，工具纸里有「登录」，点了去登录页、登录完回书房
        ctx, pg, errs = page(login=False)
        pg.goto(B + "/#shufang"); F = lab()
        out = F.evaluate("({ who: document.querySelector('#t-who').textContent, login: document.querySelector('#b-login').hidden, user: window.__lab.snap.user, mine: window.__lab.books.some(b => b.id === 'mb-t1'), n: window.__lab.books.length })") if F else None
        check("没登录：架上只有书单里的书，工具纸里有「登录」", out is not None and out["user"] is None and out["login"] is False and out["mine"] is False and out["n"] > 10 and "没登录" in out["who"], out)
        F.evaluate("document.querySelector('#b-login').click()"); pg.wait_for_url("**/login?callbackUrl=*", timeout=15000)
        check("点「登录」：去登录页，带着回书房的地址", pg.url.endswith("/login?callbackUrl=%2F%23shufang"), pg.url)
        check("没登录走一遍没有报错", not errs, errs[:6])
        ctx.close()

        # ---- 六 单独打开样机那一页：还是样品，工具纸里有一行进真的书房
        ctx, pg, errs = page()
        pg.goto(B + "/lab/shelf.html"); pg.wait_for_function("window.__lab && window.__lab.state === 'idle'", timeout=60000)
        demo = pg.evaluate("({ host: window.__lab.host, n: window.__lab.books.length, demo: document.querySelector('#t-demo').hidden, row: document.querySelector('#t-host').hidden, href: document.querySelector('#t-demo a').getAttribute('href'), read: (window.__lab.pull(0), document.querySelector('#b-read').hidden) })")
        check("单独打开样机：四十本样品，工具纸里有「进我的书房」", demo["host"] is False and demo["n"] == 40 and demo["demo"] is False and demo["row"] is True and demo["href"] == "../#shufang", demo)
        check("样机走一遍没有报错", not errs, errs[:6])
        ctx.close(); br.close()
finally:
    mock.terminate()
print("\n%d 项没过：%s" % (len(errors), errors) if errors else "\n全部通过")
sys.exit(1 if errors else 0)
