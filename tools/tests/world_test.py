#!/usr/bin/env python3
"""版本 2 小世界的截图测试：起本地模拟 Baba，开 /world，四个景别各截一张（桌面 + 手机），
顺便数 draw call 和三角面，有控制台报错就失败。截图落在 tools/out/world/。
用法：python3 tools/tests/world_test.py [端口]"""
import asyncio, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "tools", "out", "world"); os.makedirs(OUT, exist_ok=True)
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8791
ROUTES = ["/", "/study", "/study/wall", "/study/wall/0", "/study/archive", "/study/desk", "/study/desk/plant", "/study/desk/card"]

def wait_up():
    for _ in range(50):
        try: urllib.request.urlopen(f"http://127.0.0.1:{PORT}/world/", timeout=1); return
        except Exception: time.sleep(0.2)
    raise SystemExit("模拟服务器没起来")

async def shoot(pw, name, viewport, mobile):
    b = await pw.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    ctx = await b.new_context(viewport=viewport, device_scale_factor=1, is_mobile=mobile, has_touch=mobile,
                              user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1" if mobile else None))
    pg = await ctx.new_page(); errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://127.0.0.1:{PORT}/world/#/"); await pg.wait_for_function("window.__yxlWorld", timeout=15000)
    stats = []; t_route = time.time()
    for r in ROUTES:
        await pg.evaluate(f"window.__yxlWorld.go('{r}')"); await pg.wait_for_timeout(200)
        await pg.wait_for_function("window.__yxlWorld.settled()", timeout=45000); await pg.wait_for_timeout(300)
        fn = os.path.join(OUT, f"{name}_{r.strip('/').replace('/', '-') or 'yard'}.png"); await pg.screenshot(path=fn)
        info = await pg.evaluate("(() => { const i = window.__yxlWorld.info(); return { calls: i.calls, tris: i.triangles, route: window.__yxlWorld.route() }; })()")
        info["sec"] = round(time.time() - t_route, 1); t_route = time.time()
        stats.append((r, info))
    # 三种光各一张（站在书房里）
    for l in ("day", "rain", "night"):
        await pg.evaluate("window.__yxlWorld.go('/study')"); await pg.evaluate(f"window.__yxlWorld.setLight('{l}')"); await pg.wait_for_timeout(200)
        await pg.wait_for_function("window.__yxlWorld.settled()", timeout=45000); await pg.wait_for_timeout(300)
        await pg.screenshot(path=os.path.join(OUT, f"{name}_light-{l}.png"))
    # Esc 退后一级
    await pg.evaluate("window.__yxlWorld.go('/study/desk/plant')"); await pg.wait_for_timeout(200)
    await pg.keyboard.press("Escape"); await pg.wait_for_timeout(400)
    back = await pg.evaluate("window.__yxlWorld.route()")
    await b.close()
    return stats, errs, back

async def main():
    srv = subprocess.Popen([sys.executable, os.path.join(ROOT, "tools", "baba_mock.py"), str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait_up()
        async with async_playwright() as pw:
            ok = True
            for name, vp, mob in (("desktop", {"width": 1440, "height": 900}, False), ("mobile", {"width": 390, "height": 844}, True)):
                stats, errs, back = await shoot(pw, name, vp, mob)
                print(f"== {name}")
                for r, i in stats: print(f"  {r:22s} route={i['route']:22s} calls={i['calls']:4d} tris={i['tris']:6d} {i['sec']:5.1f}s")
                print(f"  Esc 后路由 = {back}  (应为 /study/desk)")
                if back != "/study/desk": ok = False
                if errs: ok = False; print("  控制台报错："); [print("   ", e[:300]) for e in errs[:10]]
            print("截图在", OUT); print("通过" if ok else "失败"); sys.exit(0 if ok else 1)
    finally:
        srv.terminate()
asyncio.run(main())
