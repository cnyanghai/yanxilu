"""装帧测试：布置里选「秘典」等画布装帧后，书脊 / 在读封面 / 展台封面都由画布画出来；选「老书皮」则都贴上封面扫描且图片能加载；切回布面精装照旧。截图在 tools/out/。
先另开终端跑 python3 tools/baba_mock.py 8790。"""
import asyncio, json, os, sys, urllib.request
from playwright.async_api import async_playwright
S = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "")
OUT = os.path.join(S, "out", ""); os.makedirs(OUT, exist_ok=True)
B = "http://127.0.0.1:8790"
BD = sys.argv[1] if len(sys.argv) > 1 else "grim"   # grim / foil / victorian / old
K = "old" if BD == "old" else "grim"
OK = "" if BD == "old" else " canvas.gs[data-ok]"   # 老书皮没有画布，看图片加载
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
        n_all = await pg.locator(".wall .cb").count(); n_grim = await pg.locator(".wall .cb." + K).count(); n_ok = await pg.locator(".wall .cb." + K + OK).count()
        stg = await pg.locator(".dais .stg-ob" if K == "old" else ".dais .stg-cover.grim canvas.gs[data-ok]").count()
        if K == "old":
            bad = await pg.evaluate("""() => Promise.all([...new Set([...document.querySelectorAll('.wall .cb.old')].map(e => getComputedStyle(e).getPropertyValue('--ob').trim().replace(/^url\\([\"']?|[\"']?\\)$/g, '')))].map(u => new Promise(r => { const i = new Image(); i.onload = () => r(i.naturalWidth > 0 ? 0 : 1); i.onerror = () => r(1); i.src = u; }))).then(a => a.reduce((x, y) => x + y, 0))""")
            print("封面图加载失败:", bad)
            if bad: errs.append("封面图加载失败 %d 张" % bad)
        print("书墙上的书:", n_all, "| 秘典书脊:", n_grim, "| 画好的:", n_ok, "| 展台封面画好:", stg)
        wall = pg.locator(".wall"); await wall.screenshot(path=OUT + "binding-" + BD + "-wall.png")
        await pg.locator(".dais").screenshot(path=OUT + "binding-" + BD + "-dais.png")
        # 在读的书封面朝外
        await pg.click('[data-act="look"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT + "binding-" + BD + "-panel.png", clip={"x": 0, "y": 0, "width": 1440, "height": 1000})
        await pg.click('[data-act="look-read"][data-v="face"]'); await pg.wait_for_timeout(1200)
        n_face = await pg.locator(".wall .cb.face." + K + (" .cf-cv.old .ob-t" if K == "old" else " canvas.gs[data-ok]")).count()
        print("面朝外的封面画好:", n_face)
        await pg.locator(".wall").screenshot(path=OUT + "binding-" + BD + "-wall-face.png")
        fc = pg.locator(".wall .cb.face." + K).first
        if await fc.count(): await fc.screenshot(path=OUT + "binding-" + BD + "-face.png")
        # 切回布面
        await pg.click('[data-act="look-binding"][data-v="cloth"]'); await pg.wait_for_timeout(1000)
        print("切回布面后原装帧书脊:", await pg.locator(".wall .cb." + K).count(), "| 布面书脊:", await pg.locator(".wall .cb:not(.grim):not(.old)").count())
        # 点一本书飞到展台
        await pg.click('[data-act="look-binding"][data-v="' + BD + '"]'); await pg.wait_for_timeout(800)
        await pg.click('[data-act="look"]'); await pg.wait_for_timeout(300)
        await pg.locator(".wall .cb." + K).nth(2).click(); await pg.wait_for_timeout(1500)
        print("展台封面(点书后):", await pg.locator(".dais .stg-ob" if K == "old" else ".dais .stg-cover.grim canvas.gs[data-ok]").count())
        await pg.locator(".dais").screenshot(path=OUT + "binding-" + BD + "-dais2.png")
        await pg.screenshot(path=OUT + "binding-" + BD + "-page.png", full_page=False)
        print("页面错误:", errs or "无")
        await b.close()
        if errs or n_grim == 0 or n_ok < n_grim or n_face == 0: raise SystemExit("不通过")
        print("通过")
asyncio.run(main())
