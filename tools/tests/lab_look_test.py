"""选外观阶段的候选样张（lab/kit.js 的外观表）：默认还是灰盒；纸模、玩具盒、旧书房三种各自打得开、不报错，
读没读的明暗差够大（不靠色相）；顶栏「外观」按钮能换，换过以后进门页跟着换；拆包页不受影响。
用法：python3 tools/tests/lab_look_test.py           # 自己起模拟服务（端口 8795），软件渲染，约两三分钟
截图落在 tools/out/lab/（已 gitignore）。这条测试只保证切换走得通、状态分得清，好不好看要人在手机上看。"""
import os, sys, time, subprocess, urllib.request
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "tools", "out", "lab"); os.makedirs(OUT, exist_ok=True)
PORT = 8795; B = "http://127.0.0.1:%d" % PORT
errors = []
def check(name, ok, extra=""):
    print(("ok   " if ok else "FAIL ") + name + (" | " + str(extra) if extra != "" else ""), flush=True)
    if not ok: errors.append(name)
def lum(hexs):                                   # 相对亮度（0 黑 1 白）
    v = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    v = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in v]
    return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]
op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
mock = subprocess.Popen([sys.executable, os.path.join(ROOT, "tools", "baba_mock.py"), str(PORT)], cwd=ROOT)
try:
    for _ in range(50):
        try: op.open(B + "/api/yxl/state", timeout=1).read(); break
        except Exception: time.sleep(.1)
    with sync_playwright() as p:
        br = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        def page():
            ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, has_touch=True, service_workers="block"); pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            # 没有声卡的机器上浏览器会报一条音频设备的错，和页面无关，不算
            pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" and "audio device" not in m.text else None)
            pg.on("response", lambda r: errs.append("%d %s" % (r.status, r.url)) if r.status >= 400 else None)
            return ctx, pg, errs
        idle = lambda pg: pg.wait_for_function("window.__lab && window.__lab.state === 'idle'", timeout=90000, polling=300)
        look = lambda pg: pg.evaluate("document.documentElement.dataset.look")

        # 什么都没选过：灰盒
        ctx, pg, errs = page()
        pg.goto(B + "/lab/shelf.html?n=40"); idle(pg)
        check("没选过外观：还是灰盒", look(pg) == "grey", look(pg))
        looks = pg.evaluate("import('./kit.js').then(m => Object.fromEntries(Object.entries(m.LOOKS).map(([k, L]) => [k, { name: L.name, pale: L.pale, tones: L.tones }])))")
        check("外观表里有灰盒和三个候选", sorted(looks) == ["grey", "paper", "study", "toy"], sorted(looks))
        for k, L in looks.items():               # 读没读只靠明暗：没读的那层纸要比任何一种读过的面都亮得多
            ratio = min((lum(L["pale"]) + .05) / (lum(t) + .05) for t in L["tones"])
            check("%s：没读的比读过的亮得多（对比不低于 4）" % L["name"], ratio >= 4, round(ratio, 2))
        check("灰盒没报错", not errs, "; ".join(errs)[:300]); ctx.close()

        # 三个候选：各自打得开，书抽得出来
        for k in ["paper", "toy", "study"]:
            ctx, pg, errs = page()
            pg.goto(B + "/lab/shelf.html?n=40&look=" + k); idle(pg); pg.wait_for_timeout(600)
            check("%s：打开了" % looks[k]["name"], look(pg) == k and pg.evaluate("getComputedStyle(document.body).backgroundColor") != "rgb(42, 34, 28)", look(pg))
            pg.screenshot(path=os.path.join(OUT, "look-%s-1-shelf.png" % k))
            i = pg.evaluate("window.__lab.books.findIndex(b => b.st === 'done')"); pg.evaluate("window.__lab.pull(%d)" % i)
            pg.wait_for_function("window.__lab.S.outReady", timeout=60000, polling=300); pg.wait_for_timeout(800)
            pg.screenshot(path=os.path.join(OUT, "look-%s-2-out.png" % k))
            pg.evaluate("window.__lab.mark('todo')"); pg.wait_for_timeout(700); pg.screenshot(path=os.path.join(OUT, "look-%s-3-todo.png" % k))
            pg.evaluate("window.__lab.back()"); idle(pg)
            check("%s：抽出、改成没读、放回都走通，没报错" % looks[k]["name"], pg.evaluate("window.__lab.state") == "idle" and not errs, "; ".join(errs)[:300])
            if k == "study":                      # 用顶栏的按钮换外观；换过以后别的样机页跟着换
                pg.click("#look"); pg.wait_for_timeout(200)
                check("点「外观」出来一张单子，四个选项，现在这个是按下的", pg.locator(".lookmenu.on button").count() == 4 and pg.locator('.lookmenu button[aria-pressed="true"]').get_attribute("data-look") == "study")
                pg.screenshot(path=os.path.join(OUT, "look-menu.png"))
                pg.click('.lookmenu button[data-look="toy"]'); pg.wait_for_load_state("domcontentloaded"); idle(pg)
                check("单子里点玩具盒：换过去了", look(pg) == "toy" and "look=toy" in pg.url, pg.url)
                pg.goto(B + "/lab/door.html"); idle(pg); pg.wait_for_timeout(600)
                check("进门页没带参数也跟着是玩具盒", look(pg) == "toy", look(pg)); pg.screenshot(path=os.path.join(OUT, "look-toy-4-door.png"))
                pg.evaluate("window.__lab.take(0)"); pg.wait_for_function("window.__lab.S.bag.length === 1", timeout=60000, polling=300)
                check("玩具盒外观下带走一排走通，没报错", not errs, "; ".join(errs)[:300])
                pg.goto(B + "/lab?dev"); pg.wait_for_function("window.__lab", timeout=20000); pg.wait_for_timeout(1500)
                check("拆包页还没接外观，打开不受影响", not errs, "; ".join(errs)[:300])
                pg.goto(B + "/lab/shelf.html?n=40&look=grey"); idle(pg)
                check("换回灰盒", look(pg) == "grey", look(pg))
            ctx.close()
        br.close()
finally:
    mock.terminate()
print("errors:", errors)
sys.exit(1 if errors else 0)
