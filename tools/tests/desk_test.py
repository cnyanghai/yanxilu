import asyncio, json, urllib.request
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
titles = ["如何计算凯利公式的仓位系数？", "几家基金公开的仓位规则", "波动率为什么会聚在一起出现", "久期：利率动一点，债券动多少", "我自己整理的夏普比率算法"]
for i, t in enumerate(titles):
    put("clips", "cl-f%d" % i, {"key": "zh-a-%d" % i, "url": "https://www.zhihu.com/question/1/answer/%d" % i, "title": t, "author": "某某", "site": "知乎", "kind": "answer", "date": "", "track": "fin", "note": "", "excerpt": "开头", "words": 3000 + i * 900, "sel": 0, "status": "full", "t": "2026-10-2%dT07:00:00Z" % i, "ut": "2026-10-20T07:00:00Z"})
    put("clipbody", "cl-f%d" % i, {"html": "<p>正文 %d</p><p>第二段。</p>" % i, "t": "2026-10-20T07:00:00Z"})
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        ctx = await b.new_context(viewport={"width": 1440, "height": 1000})
        await ctx.add_cookies([{"name": "sid", "value": "u1", "url": B}])
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append("main: " + str(e)))
        await pg.goto(B + "/#archive"); await pg.wait_for_timeout(1500)
        print("desk at start:", await pg.locator(".ydesk").count(), "| side panel:", await pg.locator(".pulled").count(), "| clips section:", await pg.locator(".clips").count(), "| clipbar:", await pg.locator(".clipbar").count())
        await pg.screenshot(path=OUT + "desk-shelf.png", full_page=True)
        fin = pg.locator(".bay").nth(1)
        await fin.locator(".afold").click(); await pg.wait_for_timeout(300)
        print("desk open:", await pg.locator(".ydesk").count(), "| body locked:", await pg.evaluate("document.body.classList.contains('desk-on')"), "| focus:", await pg.evaluate("document.activeElement.getAttribute('data-act')"))
        await pg.screenshot(path=OUT + "desk-sealed.png")
        await pg.click(".ydesk .ybag.big.sealed"); await pg.wait_for_timeout(700)
        await pg.screenshot(path=OUT + "desk-flying.png")
        await pg.wait_for_timeout(2200)
        print("hand:", await pg.locator(".ydesk .yhand .yc").count(), "| boxes on desk:", await pg.locator(".ydesk .yd-boxrow .abox").count(), "| anew:", await pg.locator(".ydesk .anew").count())
        await pg.screenshot(path=OUT + "desk-opened.png", full_page=False)
        # flip from the desk
        await pg.click(".ydesk .yhand .yc >> nth=0"); await pg.wait_for_timeout(1500)
        print("reader:", await pg.locator(".rd").count())
        await pg.click('[data-act="rd-close"]'); await pg.wait_for_timeout(400)
        print("desk still open after reader:", await pg.locator(".ydesk").count())
        # file via drop onto a desk box (synthetic DnD)
        moved = await pg.evaluate("""() => {
          const card = document.querySelector('.ydesk .yhand .yc[data-clip]'); const box = document.querySelector('.ydesk .yd-boxrow .abox[data-t]');
          if (!card || !box) return 'missing';
          const dt = new DataTransfer();
          card.dispatchEvent(new DragEvent('dragstart', {bubbles: true, dataTransfer: dt}));
          box.dispatchEvent(new DragEvent('dragover', {bubbles: true, dataTransfer: dt, cancelable: true}));
          box.dispatchEvent(new DragEvent('drop', {bubbles: true, dataTransfer: dt, cancelable: true}));
          return card.getAttribute('data-clip') + ' -> ' + box.getAttribute('data-t');
        }""")
        await pg.wait_for_timeout(500)
        print("drop:", moved, "| toast:", await pg.inner_text("#toast"), "| hand now:", await pg.locator(".ydesk .yhand .yc").count())
        # Esc closes
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
        print("after Esc:", await pg.locator(".ydesk").count(), "| locked:", await pg.evaluate("document.body.classList.contains('desk-on')"))
        # open a box desk
        await pg.locator('.abox[data-t]:not([data-t^="cf:"])').first.click(); await pg.wait_for_timeout(300)
        print("box desk:", await pg.inner_text(".ydesk h2"), "| cards:", await pg.locator(".ydesk .yhand .yc").count())
        await pg.screenshot(path=OUT + "desk-box.png")
        await pg.click('.ydesk [data-act="desk-close"]'); await pg.wait_for_timeout(300)
        # mobile
        await pg.set_viewport_size({"width": 390, "height": 844}); await pg.wait_for_timeout(300)
        await fin.locator(".afold").click(); await pg.wait_for_timeout(400)
        await pg.screenshot(path=OUT + "desk-m.png", full_page=False)
        print("mobile desk:", await pg.locator(".ydesk").count(), "| overflow:", await pg.evaluate("document.querySelector('.ydesk').scrollWidth"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
