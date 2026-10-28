import asyncio, json, urllib.request
from playwright.async_api import async_playwright
import os
S = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "")  # tools/
OUT = os.path.join(S, "out", ""); os.makedirs(OUT, exist_ok=True)
B = "http://127.0.0.1:8790"
op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
def put(coll, id, data):
    r = urllib.request.Request(B + "/api/yxl/doc", data=json.dumps({"coll": coll, "id": id, "data": data}).encode(), method="PUT", headers={"content-type": "application/json", "cookie": "sid=u1"})
    return op.open(r).read()
# 种两条划线（一条带批注）和一篇剪报
put("marks", "mk-t1", {"book": "tragedy", "kind": "epub", "loc": 0, "label": "第一章", "exact": "大国政治的悲剧性在于结构使然", "c": "y", "note": "全书题眼", "t": "2026-10-20T01:00:00Z", "pos": 3})
put("clips", "cl-cfa1", {"key": "zh-a-2050614713181025760", "url": "https://www.zhihu.com/question/23534782/answer/2050614713181025760", "title": "如何计算凯利公式的仓位系数？", "author": "某某", "site": "知乎", "kind": "answer", "date": "2025-01-01", "track": "fin", "box": "", "note": "", "excerpt": "", "words": 100, "sel": 0, "status": "full", "t": "2026-10-20T07:00:00Z", "ut": "2026-10-20T07:00:00Z"})
put("clipbody", "cl-cfa1", {"html": "<p>开头一段。</p><p>凯利公式的本质是几何增长率最大化，这一点常被忽略。</p>", "t": "2026-10-20T07:00:00Z"})
put("marks", "mk-t2", {"book": "cl-cfa1", "kind": "epub", "loc": 0, "label": "", "exact": "凯利公式的本质是几何增长率最大化", "c": "b", "t": "2026-10-21T01:00:00Z", "pos": 1})
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        ctx = await b.new_context(viewport={"width": 1440, "height": 1000})
        await ctx.add_cookies([{"name": "sid", "value": "u1", "url": B}])
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(B + "/#shelf"); await pg.wait_for_timeout(1600)
        # seg 里的摘抄册
        seg = await pg.inner_text(".shelf-seg")
        print("seg:", seg.replace("\n", " | "))
        await pg.click('.shelf-seg a[href="#marks"]'); await pg.wait_for_timeout(600)
        print("marks page:", await pg.inner_text(".mkbook h1"), "| srcs:", await pg.locator(".mkb-src").count(), "| quotes:", await pg.locator(".mkb-m").count())
        print("stats:", (await pg.inner_text(".mkbook .pstats")).replace("\n", " "))
        await pg.screenshot(path=OUT + "mkbook.png", full_page=True)
        # 颜色筛选
        await pg.click('.mkf-dot.c-b'); await pg.wait_for_timeout(300)
        print("filter blue:", await pg.locator(".mkb-m").count())
        await pg.click('.mkf-dot.c-b'); await pg.wait_for_timeout(300)
        # 回到原处（剪报划线）
        await pg.click('.mkb-m.c-b [data-act="mk-open"]'); await pg.wait_for_timeout(1800)
        print("reader open:", await pg.locator(".rd").count(), "| title:", await pg.inner_text(".rd-t"))
        hl = await pg.evaluate("()=>{const f=document.querySelector('.rd iframe');return f? f.contentDocument.querySelectorAll('mark.yx-hl').length : -1}")
        print("highlight in reader:", hl)
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(400)
        # Ctrl+K
        await pg.keyboard.press("Control+k"); await pg.wait_for_timeout(300)
        print("palette open:", await pg.locator(".ck").count(), "| default groups:", (await pg.inner_text(".ck-res")).split("\n")[0])
        await pg.fill(".ck-in", "凯利"); await pg.wait_for_timeout(250)
        res = await pg.locator(".ck-it").all_inner_texts()
        print("hits for 凯利:", [r.replace("\n", "·")[:38] for r in res][:6])
        await pg.keyboard.press("Enter"); await pg.wait_for_timeout(1500)
        print("enter opened reader:", await pg.locator(".rd").count(), "|", await pg.inner_text(".rd-t") if await pg.locator(".rd").count() else "")
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
        # 搜讲义和档案盒
        await pg.keyboard.press("Control+k"); await pg.fill(".ck-in", "做市商"); await pg.wait_for_timeout(250)
        res2 = await pg.locator(".ck-it").all_inner_texts()
        print("hits for 做市商:", [r.replace("\n", "·")[:40] for r in res2][:8])
        await pg.keyboard.press("ArrowDown"); await pg.keyboard.press("Escape"); await pg.wait_for_timeout(200)
        print("palette closed:", await pg.locator(".ck").count() == 0)
        # 搜索按钮
        await pg.click(".tb-srch"); await pg.wait_for_timeout(250)
        print("button opens:", await pg.locator(".ck").count() == 1)
        await pg.keyboard.press("Escape")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
