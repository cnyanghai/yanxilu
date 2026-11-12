"""拆包样机（lab/）：送到、划开封口、发牌、翻牌、拿起来看、收下、下一包；热闹与安静两种开法各走一遍，手机竖屏。
用法：python3 tools/tests/lab_pack_test.py           # 自己起模拟服务（端口 8797），软件渲染
截图落在 tools/out/lab/（已 gitignore）。样机看的是手感，这条测试只保证流程走得通、不报错。"""
import os, sys, time, subprocess, urllib.request
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "tools", "out", "lab"); os.makedirs(OUT, exist_ok=True)
PORT = 8798; B = "http://127.0.0.1:%d" % PORT
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
        for mode in ("loud", "quiet"):
            ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, has_touch=True, service_workers="block")
            pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            # 没有声卡的机器上浏览器会报一条音频设备的错，和页面无关，不算
            pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" and "audio device" not in m.text else None)
            st = lambda: pg.evaluate("window.__lab && window.__lab.state")
            def until(want, sec=8):
                t0 = time.time()
                while time.time() - t0 < sec:
                    if st() == want: return True
                    pg.wait_for_timeout(60)
                return False
            shot = lambda name: pg.screenshot(path=os.path.join(OUT, "%s-%s.png" % (mode, name)))
            pg.goto(B + "/lab?dev&mode=" + mode)
            check(mode + " 送到后停在等待", until("idle", 25), st())
            shot("1-idle")
            # 手指沿封口从左划到右：先划到一半停住截图，再划到头
            r = pg.evaluate("window.__lab.packRect()")
            y = r["t"] + (r["b"] - r["t"]) * .08; x0 = r["l"] + 6; x1 = r["r"] + 10
            pg.mouse.move(x0, y); pg.mouse.down()
            for i in range(1, 13): pg.mouse.move(x0 + (x1 - x0) * .5 * i / 12, y); pg.wait_for_timeout(16)
            check(mode + " 划到一半是撕开中", st() == "tear", st()); pg.wait_for_timeout(120); shot("2-tear")
            # 没划到七成松手要弹回去
            pg.mouse.up(); pg.wait_for_timeout(500)
            check(mode + " 松手弹回", st() == "idle" and pg.evaluate("window.__lab.S.p") < .02, pg.evaluate("window.__lab.S.p"))
            pg.mouse.move(x0, y); pg.mouse.down()
            for i in range(1, 25): pg.mouse.move(x0 + (x1 - x0) * i / 24, y); pg.wait_for_timeout(12)
            pg.mouse.up()
            check(mode + " 划到头就开了", st() in ("burst", "deal"), st()); pg.wait_for_timeout(260); shot("3-burst")
            pg.wait_for_timeout(260); shot("4-deal")
            check(mode + " 发完牌等翻", until("reveal", 8), st()); pg.wait_for_timeout(500); shot("5-dealt")
            n_down = pg.evaluate("window.__lab.cards.filter(c => !c.up && c.where === 'table').length")
            check(mode + " 五张背朝上在桌上", n_down == 5, n_down)
            # 点中间那张翻开
            pg.mouse.click(195, 440); pg.wait_for_timeout(280); shot("6-flipping"); pg.wait_for_timeout(700)
            n_up = pg.evaluate("window.__lab.cards.filter(c => c.up).length")
            check(mode + " 点一张翻一张", n_up == 1, n_up); shot("7-one-up")
            pg.mouse.click(195, 440); pg.wait_for_timeout(700)
            check(mode + " 翻开的再点是拿起来看", pg.evaluate("window.__lab.S.inspect") >= 0); shot("8-inspect")
            pg.mouse.click(195, 700); pg.wait_for_timeout(600)
            check(mode + " 再点放回去", pg.evaluate("window.__lab.S.inspect") == -1)
            pg.click("#b-all"); pg.wait_for_timeout(1800)
            check(mode + " 全部翻开", pg.evaluate("window.__lab.cards.every(c => c.up)")); shot("9-all-up")
            check(mode + " 出现收下", pg.locator("#b-take").is_visible())
            pg.click("#b-take"); pg.wait_for_timeout(450); shot("10-take")
            check(mode + " 收下后下一包送到", until("idle", 8), st())
            check(mode + " 记了第 2 包", pg.evaluate("window.__lab.S.packNo") == 2)
            # 关键帧：停掉时钟一步步走，截到固定的时刻（给人看的分镜）
            pg.evaluate("window.__lab.manual(true)")
            step = lambda sec: pg.evaluate("window.__lab.step(%f)" % sec)
            kf = lambda name: pg.screenshot(path=os.path.join(OUT, "kf-%s-%s.png" % (mode, name)))
            step(.6); kf("1")
            pg.evaluate("(() => { const L = window.__lab; L.S.state = 'tear'; L.S.p = .55; })()"); step(.4); kf("2")
            pg.evaluate("window.__lab.tearTo(1)"); step(.14 if mode == "loud" else .2); kf("3")
            step(.3 if mode == "loud" else .6); kf("4")
            step(2.0); kf("5")
            pg.evaluate("window.__lab.flip(2)"); step(.2 if mode == "loud" else .3); kf("6")
            step(.8); pg.evaluate("window.__lab.flipAll()"); step(1.8); kf("7")
            pg.evaluate("window.__lab.inspect(2)"); step(.6); kf("8")
            check(mode + " 页面没报错", not errs, "; ".join(errs)[:300])
            ctx.close()
        # 横屏桌面：牌排成一排
        ctx = br.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1, service_workers="block"); pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(B + "/lab?mode=quiet"); pg.wait_for_function("window.__lab && window.__lab.state === 'idle'", timeout=15000)
        pg.evaluate("window.__lab.manual(true)"); pg.evaluate("window.__lab.step(.5)"); pg.screenshot(path=os.path.join(OUT, "desk-1-idle.png"))
        pg.evaluate("window.__lab.tearTo(1)"); pg.evaluate("window.__lab.step(3)"); pg.evaluate("window.__lab.flipAll()"); pg.evaluate("window.__lab.step(2)")
        pg.screenshot(path=os.path.join(OUT, "desk-2-all-up.png"))
        check("桌面横屏走通", pg.evaluate("window.__lab.cards.every(c => c.up)") and not errs, "; ".join(errs)[:200])
        ctx.close(); br.close()
finally:
    mock.terminate()
print("errors:", errors)
sys.exit(1 if errors else 0)
