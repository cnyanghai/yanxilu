"""装帧测试：布置里选「秘典」后，书脊 / 在读封面 / 展台封面都由画布画出来；切回布面精装照旧。截图在 tools/out/。
先另开终端跑 python3 tools/baba_mock.py 8790。"""
import asyncio, json, os, sys, urllib.request
from playwright.async_api import async_playwright
S = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "")
OUT = os.path.join(S, "out", ""); os.makedirs(OUT, exist_ok=True)
B = "http://127.0.0.1:8790"
BD = sys.argv[1] if len(sys.argv) > 1 else "grim"   # grim / foil / victorian
op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
def put(coll, id, data):
    r = urllib.request.Request(B + "/api/yxl/doc", data=json.dumps({"coll": coll, "id": id, "data": data}).encode(), method="PUT", headers={"content-type": "application/json", "cookie": "sid=u1"})
    return op.open(r).read()
# 造两本书的状态：《涛动周期录》在读（刚碰过 → 宝石亮），《大国政治的悲剧》读完（盖印）
put("progress", "zhoulu", {"s": "doing", "t": "2026-11-03T00:00:00Z"})
put("progress", "tragedy", {"s": "done", "t": "2026-10-20T00:00:00Z"})
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        ctx = await b.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=2)
        await ctx.add_cookies([{"name": "sid", "value": "u1", "url": B}])
        look = {"v": 2, "read": "pull", "fx": "sheen", "color": "named", "binding": BD, "deco": ["globe", "glass", "vase", "succ", "pothos", "candle"], "place": {}}
        await ctx.add_init_script("localStorage.setItem('yanxilu-look', " + json.dumps(json.dumps(look, ensure_ascii=False), ensure_ascii=False) + ")")
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(B + "/#shelf"); await pg.wait_for_timeout(2500)
        n_all = await pg.locator(".wall .cb").count(); n_grim = await pg.locator(".wall .cb.grim").count(); n_ok = await pg.locator(".wall .cb.grim canvas.gs[data-ok]").count()
        stg = await pg.locator(".dais .stg-cover.grim canvas.gs[data-ok]").count()
        print("书墙上的书:", n_all, "| 秘典书脊:", n_grim, "| 画好的:", n_ok, "| 展台封面画好:", stg)
        wall = pg.locator(".wall"); await wall.screenshot(path=OUT + "binding-" + BD + "-wall.png")
        await pg.locator(".dais").screenshot(path=OUT + "binding-" + BD + "-dais.png")
        # 在读的书封面朝外
        await pg.click('[data-act="look"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT + "binding-" + BD + "-panel.png", clip={"x": 0, "y": 0, "width": 1440, "height": 1000})
        await pg.click('[data-act="look-read"][data-v="face"]'); await pg.wait_for_timeout(1200)
        n_face = await pg.locator(".wall .cb.face.grim canvas.gs[data-ok]").count()
        print("面朝外的封面画好:", n_face)
        await pg.locator(".wall").screenshot(path=OUT + "binding-" + BD + "-wall-face.png")
        fc = pg.locator(".wall .cb.face.grim").first
        if await fc.count(): await fc.screenshot(path=OUT + "binding-" + BD + "-face.png")
        # 切回布面
        await pg.click('[data-act="look-binding"][data-v="cloth"]'); await pg.wait_for_timeout(1000)
        print("切回布面后秘典书脊:", await pg.locator(".wall .cb.grim").count(), "| 布面书脊:", await pg.locator(".wall .cb:not(.grim)").count())
        # 点一本书飞到展台
        await pg.click('[data-act="look-binding"][data-v="' + BD + '"]'); await pg.wait_for_timeout(800)
        await pg.click('[data-act="look"]'); await pg.wait_for_timeout(300)
        await pg.locator(".wall .cb.grim").nth(2).click(); await pg.wait_for_timeout(1500)
        print("展台封面(点书后):", await pg.locator(".dais .stg-cover.grim canvas.gs[data-ok]").count())
        await pg.screenshot(path=OUT + "binding-" + BD + "-page.png", full_page=False)
        print("页面错误:", errs or "无")
        await b.close()
        if errs or n_grim == 0 or n_ok < n_grim or n_face == 0: raise SystemExit("不通过")
        print("通过")
asyncio.run(main())
