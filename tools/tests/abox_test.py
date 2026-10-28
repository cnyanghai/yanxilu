import asyncio, json, urllib.request, urllib.parse
from playwright.async_api import async_playwright
import os
S = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "")  # tools/
OUT = os.path.join(S, "out", ""); os.makedirs(OUT, exist_ok=True)
B = "http://127.0.0.1:8790"
op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
def mock(path): return json.loads(op.open(B + path).read())
def put(coll, id, data):
    r = urllib.request.Request(B + "/api/yxl/doc", data=json.dumps({"coll": coll, "id": id, "data": data}).encode(), method="PUT", headers={"content-type": "application/json", "cookie": "sid=u1"})
    return op.open(r).read()
def docs(coll):
    lg = mock("/__log")["docs"]
    return {k.split("|")[2]: v for k, v in lg.items() if k.startswith("u1|" + coll + "|")}
FAKE = open(S + "fake_math.html", encoding="utf-8").read()
put("clips", "cl-cfa1", {"key": "zh-a-2050614713181025760", "url": "https://www.zhihu.com/question/23534782/answer/2050614713181025760", "title": "如何计算凯利公式的仓位系数？", "author": "某某", "site": "知乎", "kind": "answer", "date": "2025-01-01", "track": "fin", "note": "", "excerpt": "第一章 你是一个上班族", "words": 5200, "sel": 0, "status": "full", "t": "2026-10-20T07:00:00Z", "ut": "2026-10-20T07:00:00Z"})
put("clipbody", "cl-cfa1", {"html": "<p>正文</p><yx-math display=\"1\">f^*=\\frac{bp-q}{b}</yx-math>", "t": "2026-10-20T07:00:00Z"})
put("clips", "cl-nod", {"key": "zh-a-9", "url": "https://www.zhihu.com/question/1/answer/9", "title": "没分领域的一篇", "author": "王五", "site": "知乎", "kind": "answer", "date": "", "track": "", "note": "", "excerpt": "随便", "words": 10, "sel": 0, "status": "full", "t": "2026-10-20T06:00:00Z", "ut": "2026-10-20T06:00:00Z"})
put("clipbody", "cl-nod", {"html": "<p>随便写点</p>", "t": "2026-10-20T06:00:00Z"})
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        ctx = await b.new_context(viewport={"width": 1440, "height": 1000})
        await ctx.add_cookies([{"name": "sid", "value": "u1", "url": B}])
        await ctx.route("https://www.zhihu.com/**", lambda r: r.fulfill(status=200, body=FAKE, headers={"content-type": "text/html; charset=utf-8"}))
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append("main: " + str(e)))
        await pg.goto(B + "/#archive"); await pg.wait_for_timeout(1500)
        fin = pg.locator(".bay").nth(1)
        print("fin bay:", await fin.locator(".plate").inner_text(), "| folder:", await fin.locator(".afold").count(), "| slots:", await pg.locator(".anew").count())
        print("tray plate:", await pg.inner_text(".atray .plate"), "| tray sheets:", await pg.locator(".atray .asheet").count())
        # 1 打开剪报夹
        await fin.locator(".afold").click(); await pg.wait_for_timeout(200)
        print("folder panel:", (await pg.inner_text(".afpanel h2")), "| rows:", await pg.locator(".afpanel tbody tr").count())
        # 2 在 CFA 这一格新立一盒
        await fin.locator(".anew").click(); await pg.wait_for_timeout(200)
        print("sheet:", await pg.inner_text("#box-h"), "| track checked:", await pg.eval_on_selector('#box-form input[name=track]:checked', "e=>e.value"), "| status:", await pg.eval_on_selector('#box-form input[name=bstatus]:checked', "e=>e.value"))
        await pg.fill("#box-title", "凯利公式与仓位管理"); await pg.fill('#box-form [name=question]', "下注比例怎么定才不会输光？")
        await pg.click('#box-form [type=submit]'); await pg.wait_for_timeout(500)
        print("toast:", await pg.inner_text("#toast"))
        bx = docs("aboxes"); bid = list(bx)[0]; print("server aboxes:", {k: (v["title"], v["track"], v["status"]) for k, v in bx.items()})
        print("panel:", await pg.inner_text(".apanel h2"), "|", await pg.inner_text(".apanel .ap-no"), "| empty msg:", await pg.locator(".apanel .ap-empty").count(), "| acts:", await pg.inner_text(".apanel .pb-rm"))
        print("fin plate now:", await fin.locator(".plate").inner_text(), "| boxes in fin:", await fin.locator(".abox").count())
        # 3 剪报装进这一盒（剪报列表里的“放到哪”）
        await pg.select_option('.cl-card select.cl-trk[data-id="cl-cfa1"]', "b:" + bid); await pg.wait_for_timeout(400)
        print("toast:", await pg.inner_text("#toast"), "| server clip:", {k: docs("clips")["cl-cfa1"][k] for k in ("track", "box")})
        print("fin plate:", await fin.locator(".plate").inner_text(), "| folder left:", await fin.locator(".afold").count())
        await fin.locator(".abox.mine").click(); await pg.wait_for_timeout(200)
        print("box rows:", (await pg.inner_text(".apanel tbody")).replace("\n", " | ")[:160])
        print("box slips:", await fin.locator(".abox.mine .ab-slips i").count(), "| legend has 剪报:", "剪报" in await pg.inner_text(".k-legend"))
        # 打开阅读器
        await pg.evaluate("document.querySelectorAll('.apanel details.ylist').forEach(d=>d.open=true)")
        await pg.click('.apanel .ai-t[data-act="clip-open"]'); await pg.wait_for_timeout(1500)
        print("reader:", await pg.locator(".rd").count(), "| katex:", await pg.evaluate("()=>{const f=document.querySelector('.rd iframe');return f?f.contentDocument.querySelectorAll('.katex').length:-1}"))
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
        # 4 搜索
        await pg.fill("#arch-q", "凯利"); await pg.wait_for_timeout(200)
        print("search dims:", await pg.locator(".abox.dim").count(), "of", await pg.locator(".abox").count())
        await pg.fill("#arch-q", ""); await pg.wait_for_timeout(100)
        # 5 改这一盒：换到经济周期
        await pg.click('.apanel [data-act="abox-edit"]'); await pg.wait_for_timeout(200)
        print("edit title:", await pg.input_value("#box-title"))
        await pg.check('#box-form input[name=track][value=cycle]', force=True); await pg.check('#box-form input[name=bstatus][value=yearly]', force=True)
        await pg.click('#box-form [type=submit]'); await pg.wait_for_timeout(500)
        print("after edit:", docs("aboxes")[bid]["track"], docs("aboxes")[bid]["status"], "| clip track:", docs("clips")["cl-cfa1"]["track"], "| cycle boxes:", await pg.locator(".bay").nth(3).locator(".abox").count(), "| yearly tag:", await pg.locator(".abox.mine .ab-tag").count())
        # 6 没分领域的剪报：收件匣 → 打开 → 放进经济周期的剪报夹
        await pg.click('.atray button.plate'); await pg.wait_for_timeout(200)
        print("inbox panel:", await pg.inner_text(".afpanel h2"), "| rows:", await pg.locator(".afpanel tbody tr").count())
        await pg.evaluate("document.querySelectorAll('.apanel details.ylist').forEach(d=>d.open=true)")
        await pg.select_option('.afpanel select.cl-trk', "cycle"); await pg.wait_for_timeout(400)
        print("toast:", await pg.inner_text("#toast"), "| cycle folder:", await pg.locator(".bay").nth(3).locator(".afold").count(), "| panel now:", await pg.inner_text(".apanel h2"))
        # 7 用 “新立一盒…” 选项
        await pg.select_option('.cl-card select.cl-trk[data-id="cl-nod"]', "nb:geo"); await pg.wait_for_timeout(300)
        print("sheet from select:", await pg.inner_text("#box-h"), "|", await pg.inner_text("#box-form .meta"))
        await pg.fill("#box-title", "俄乌战争的结局"); await pg.click('#box-form [type=submit]'); await pg.wait_for_timeout(500)
        print("toast:", await pg.inner_text("#toast"), "| geo boxes:", await pg.locator(".bay").nth(0).locator(".abox").count(), "| clip box:", docs("clips")["cl-nod"]["box"] in docs("aboxes"))
        # 8 删掉自己立的一盒：剪报回剪报夹
        await pg.click('.apanel [data-act="abox-del"]'); await pg.wait_for_timeout(150)
        print("confirm:", await pg.inner_text(".apanel .pb-rm"))
        await pg.click('.apanel [data-act="abox-del-yes"]'); await pg.wait_for_timeout(400)
        print("toast:", await pg.inner_text("#toast"), "| aboxes:", len(docs("aboxes")), "| clip:", docs("clips")["cl-nod"]["box"], docs("clips")["cl-nod"]["track"], "| geo folder:", await pg.locator(".bay").nth(0).locator(".afold").count())
        # 9 撤下内置的盒子，再放回
        await pg.click('.abox[data-t="market-making"], .bay:nth-child(2) .abox:not(.mine)') if False else None
        builtin = pg.locator(".abox:not(.mine)").first; bt = await builtin.get_attribute("data-t")
        await builtin.click(); await pg.wait_for_timeout(200)
        await pg.click('.apanel [data-act="abox-del"]'); await pg.wait_for_timeout(150)
        print("builtin confirm:", (await pg.inner_text(".apanel .pb-rm"))[:60])
        await pg.click('.apanel [data-act="abox-del-yes"]'); await pg.wait_for_timeout(400)
        print("toast:", await pg.inner_text("#toast"), "| aboxoff:", list(docs("aboxoff")), "| still shown:", await pg.locator('.abox[data-t="' + bt + '"]').count(), "| restore:", await pg.inner_text(".a-off"))
        print("inbox count (should not grow):", await pg.inner_text(".atray .plate"))
        await pg.click('[data-act="abox-on"]'); await pg.wait_for_timeout(400)
        print("restored:", await pg.locator('.abox[data-t="' + bt + '"]').count(), "| aboxoff:", list(docs("aboxoff")), "| a-off left:", await pg.locator(".a-off").count())
        # 10 自己加的领域：有盒子就在下面另起一层
        await pg.click('.chip-new'); await pg.wait_for_timeout(200)
        await pg.fill("#box-title", "注意力与记忆"); await pg.check('#box-form input[name=track][value="__new"]', force=True)
        await pg.fill('#box-form [name=dname]', "心理学"); await pg.click('#box-form [type=submit]'); await pg.wait_for_timeout(500)
        print("tiers:", await pg.locator(".cab-body .tier").count(), "| custom bay plate:", await pg.locator(".bay.grow .plate").inner_text(), "| panel:", await pg.inner_text(".apanel .ap-no"))
        await pg.screenshot(path=OUT + "abox-d.png", full_page=True)
        # 11 小窗：新立一盒并装进去
        zh = await ctx.new_page(); zh.on("pageerror", lambda e: errs.append("zh: " + str(e)))
        await zh.goto("https://www.zhihu.com/question/23534782/answer/2050614713181025760"); await zh.wait_for_timeout(300)
        href = await pg.evaluate("()=>{const s=document.createElement('a');return null}") or None
        code = await pg.evaluate("()=>{return null}")
        await pg.click('[data-act="clip-help"]'); await pg.wait_for_timeout(200)
        href = await pg.get_attribute(".cl-bm", "href")
        async with zh.expect_popup() as pop_info:
            await zh.evaluate(urllib.parse.unquote(href[len("javascript:"):]))
        pop = await pop_info.value; pop.on("pageerror", lambda e: errs.append("pop: " + str(e)))
        await pop.wait_for_selector("#clip-form", timeout=15000); await pop.wait_for_timeout(300)
        print("popup place:", await pop.eval_on_selector('#clip-form [name=place]', "e=>e.value"), "| nb hidden:", await pop.eval_on_selector(".cp-nb", "e=>e.hidden"))
        await pop.select_option('#clip-form [name=place]', "nb:fin"); await pop.wait_for_timeout(100)
        print("nb shown:", not await pop.eval_on_selector(".cp-nb", "e=>e.hidden"))
        await pop.click('#clip-form [type=submit]'); await pop.wait_for_timeout(300)
        print("empty name toast:", await pop.inner_text("#toast"))
        await pop.fill('#clip-form [name=nbtitle]', "仓位管理"); await pop.click('#clip-form [type=submit]'); await pop.wait_for_timeout(800)
        print("done:", (await pop.inner_text(".cp-done p")))
        cl = docs("clips")["cl-cfa1"]; ab = docs("aboxes")
        print("clip now in:", ab.get(cl["box"], {}).get("title"), cl["track"])
        await pg.wait_for_timeout(2600)
        # 12 手机宽度
        m = await b.new_context(viewport={"width": 390, "height": 844}); await m.add_cookies([{"name": "sid", "value": "u1", "url": B}])
        mp = await m.new_page(); mp.on("pageerror", lambda e: errs.append("m: " + str(e)))
        await mp.goto(B + "/#archive"); await mp.wait_for_timeout(1500)
        print("mobile overflow:", await mp.evaluate("document.documentElement.scrollWidth"))
        await mp.screenshot(path=OUT + "abox-m.png", full_page=True)
        print("errors", errs)
        await b.close()
asyncio.run(main())
