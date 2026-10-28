import asyncio, json, urllib.request, urllib.parse
from playwright.async_api import async_playwright
import os
S = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "")  # tools/
OUT = os.path.join(S, "out", ""); os.makedirs(OUT, exist_ok=True)
B = "http://127.0.0.1:8790"
op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
def mock(path): return json.loads(op.open(B + path).read())
FAKE = open(S + "fake_zhihu.html", encoding="utf-8").read()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        ctx = await b.new_context(viewport={"width": 1280, "height": 900})
        await ctx.add_cookies([{"name": "sid", "value": "u1", "url": B}])
        await ctx.route("https://www.zhihu.com/**", lambda r: r.fulfill(status=200, body=FAKE, headers={"content-type": "text/html; charset=utf-8"}))
        await ctx.route("https://picx.zhimg.com/**", lambda r: r.fulfill(status=200, body=b"", headers={"content-type": "image/jpeg"}))
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append("main: " + str(e)))
        await pg.goto(B + "/#archive"); await pg.wait_for_timeout(1500)
        print("clips section:", await pg.eval_on_selector_all(".clips", "e=>e.length"), "| help:", await pg.eval_on_selector_all(".cl-help", "e=>e.length"))
        href = await pg.get_attribute(".cl-bm", "href"); print("bookmarklet length:", len(href))
        await pg.click(".cl-bm"); await pg.wait_for_timeout(200); print("click on button toast:", await pg.inner_text("#toast"))
        # 1 手机上先存链接
        await pg.fill("#clip-link input", "【如何理解进攻性现实主义？ - 李四的回答 - 知乎】https://www.zhihu.com/question/1001/answer/222?share_code=abc&utm_psn=1")
        await pg.click("#clip-link button"); await pg.wait_for_timeout(600)
        print("link card:", (await pg.inner_text(".cl-card")).replace("\n", " | "))
        # 2 在“知乎”页面上点书签按钮
        zh = await ctx.new_page(); zh.on("pageerror", lambda e: errs.append("zh: " + str(e)))
        await zh.goto("https://www.zhihu.com/question/1001/answer/111"); await zh.wait_for_timeout(300)
        code = urllib.parse.unquote(href[len("javascript:"):])
        async with zh.expect_popup() as pop_info:
            await zh.evaluate(code)
        pop = await pop_info.value; pop.on("pageerror", lambda e: errs.append("pop: " + str(e)))
        await pop.wait_for_selector("#clip-form", timeout=15000); await pop.wait_for_timeout(300)
        print("popup url:", pop.url, "| title:", await pop.input_value('#clip-form [name=title]'), "| meta:", await pop.inner_text(".cp-meta"))
        print("preview:", (await pop.inner_text(".cp-pm")), "|", (await pop.inner_text(".cp-body")).replace("\n", " / ")[:160])
        body_html = await pop.inner_html(".cp-body")
        print("sanitized: script" , "script" in body_html, "| onclick", "onclick" in body_html, "| ad", "广告" in body_html, "| link target", "example.com/paper" in body_html, "| img", "v2-aaa_r.jpg" in body_html, "| noreferrer", "no-referrer" in body_html)
        await pop.select_option('#clip-form [name=place]', "geo"); await pop.fill('#clip-form [name=note]', "五个假设讲得清楚")
        await pop.click('#clip-form [type=submit]'); await pop.wait_for_timeout(800)
        print("done:", (await pop.inner_text(".cp-done")).replace("\n", " | ") if await pop.query_selector(".cp-done") else "no")
        await pg.wait_for_timeout(2600); print("popup closed:", pop.is_closed())
        lg = mock("/__log"); print("server docs:", sorted(k for k in lg["docs"] if "clip" in k))
        # 3 选中第二个回答的一段再剪 → 补上手机存的那条
        await zh.evaluate("""() => { const p = [...document.querySelectorAll('.AnswerItem[name="222"] p')][1]; const r = document.createRange(); r.selectNodeContents(p); getSelection().removeAllRanges(); getSelection().addRange(r); }""")
        async with zh.expect_popup() as pop_info:
            await zh.evaluate(code)
        pop = await pop_info.value; await pop.wait_for_selector("#clip-form", timeout=15000)
        print("2nd popup note:", await pop.inner_text(".cp-note"), "| pm:", await pop.inner_text(".cp-pm"), "| author:", await pop.inner_text(".cp-meta"))
        await pop.click('#clip-form [type=submit]'); await pop.wait_for_timeout(800)
        # 4 档案架上看
        await pg.reload(); await pg.wait_for_timeout(1500)
        print("cards:", [t.replace("\n", " | ")[:90] for t in await pg.eval_on_selector_all(".cl-card", "e=>e.map(x=>x.innerText)")])
        print("groups:", await pg.eval_on_selector_all(".clg-h", "e=>e.map(x=>x.textContent)"), "| seg:", await pg.inner_text(".shelf-seg"))
        await pg.click('.cl-card [data-act="clip-open"]'); await pg.wait_for_timeout(2000)
        fr = pg.frame_locator(".rd-frame")
        print("reader title:", await pg.inner_text(".rd-t"), "| body:", (await fr.locator("body").inner_text())[:120].replace("\n", " / "))
        print("reader img referrer:", await fr.locator("img").first.get_attribute("referrerpolicy"))
        # 划一道线
        await pg.evaluate("""() => { const d = document.querySelector('.rd-frame').contentDocument; const p = [...d.querySelectorAll('p')].find(x => x.textContent.includes('五个基本假设')); const r = d.createRange(); r.setStart(p.firstChild, 0); r.setEnd(p.firstChild, 5); d.getSelection().removeAllRanges(); d.getSelection().addRange(r); d.dispatchEvent(new MouseEvent('mouseup', {bubbles:true})); }""")
        await pg.wait_for_timeout(300)
        tip = await pg.is_visible(".rd-tip")
        if tip: await pg.click('.rd-tip [data-act="mk-add"][data-c="y"]'); await pg.wait_for_timeout(400)
        print("highlight tip:", tip, "| marks:", await fr.locator("mark.yx-hl").count())
        await pg.click('[data-act="rd-close"]'); await pg.wait_for_timeout(600)
        print("card after read:", (await pg.inner_text(".cl-card")).replace("\n", " | ")[:120])
        # 5 改领域、删除
        await pg.locator(".cl-trk").first.select_option("fin"); await pg.wait_for_timeout(400)
        print("groups after move:", await pg.eval_on_selector_all(".clg-h", "e=>e.map(x=>x.textContent)"))
        await pg.locator('.cl-card [data-act="clip-del"]').first.click(); await pg.locator('[data-act="clip-del-yes"]').click(); await pg.wait_for_timeout(500)
        lg = mock("/__log"); print("after delete:", sorted(k for k in lg["docs"] if "clip" in k))
        # 手机宽度
        await pg.set_viewport_size({"width": 390, "height": 844}); await pg.wait_for_timeout(400)
        print("mobile overflow:", await pg.evaluate("document.documentElement.scrollWidth"))
        await pg.locator(".clips").screenshot(path=OUT + "clips-m.png")
        print("errors", errs); await b.close()
asyncio.run(main())
