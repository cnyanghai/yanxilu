import asyncio, json, urllib.request
from playwright.async_api import async_playwright
import os
S = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "")  # tools/
OUT = os.path.join(S, "out", ""); os.makedirs(OUT, exist_ok=True)
B = "http://127.0.0.1:8790"
op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
def docs(coll):
    lg = json.loads(op.open(B + "/__log").read())["docs"]
    return {k.split("|")[2]: v for k, v in lg.items() if k.startswith("u1|" + coll + "|")}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        ctx = await b.new_context(viewport={"width": 1440, "height": 1000})
        await ctx.add_cookies([{"name": "sid", "value": "u1", "url": B}])
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(B + "/#home"); await pg.wait_for_timeout(1600)
        btn = pg.locator('button.stp.end[data-act="ritual"]')
        print("end-station button:", await btn.count(), "|", (await btn.inner_text()).replace("\n", " "))
        await btn.click(); await pg.wait_for_timeout(300)
        n = await pg.locator(".rt-s").count()
        print("ritual stations:", n, "| labels:", [t.replace("\n", "·") for t in await pg.locator(".rt-tx b").all_inner_texts()])
        print("minutes prefilled:", [await pg.input_value(f'[name=rm{i}]') for i in range(n)])
        # 关掉最后一站，改第一站分钟，写一句
        await pg.locator(".rt-s").nth(n - 1).locator(".rt-tgl").click()
        await pg.fill("[name=rm0]", "80")
        await pg.fill("[name=rnote]", "第 1 段跟读完，连读还卡")
        await pg.screenshot(path=OUT + "rt-form.png")
        await pg.click(".rt-seal"); await pg.wait_for_timeout(600)
        print("done panel:", (await pg.inner_text(".rt-done h2")), "|", await pg.inner_text(".rt-done .meta"))
        print("stamps shown:", await pg.locator(".rt-st").count())
        await pg.screenshot(path=OUT + "rt-done.png")
        d = docs("study").get("progress", {})
        today = sorted(d.get("days", {}))[-1] if d.get("days") else None
        rec = d["days"][today] if today else {}
        print("server doc:", today, "| status:", rec.get("status"), "| done:", rec.get("done"), "| min:", rec.get("minutes"), "| note:", rec.get("note"), "| next:", d.get("next"))
        # 收册 → 首页终点站变已盖章
        await pg.click('.rt-done [data-act="ritual-close"]:not([href])'); await pg.wait_for_timeout(400)
        print("home end now:", (await pg.inner_text(".stp.end")).replace("\n", " "))
        # 足迹页：今天的章和一句话
        await pg.goto(B + "/#journal"); await pg.wait_for_timeout(1200)
        await pg.click('.fd-day[data-d="' + today + '"]'); await pg.wait_for_timeout(400)
        print("day card:", (await pg.inner_text(".fdc .meta")).replace("\n", " "), "| stamps:", await pg.locator(".fdc-st svg").count(), "| note:", (await pg.inner_text(".fdc-note")).replace("\n", " ")[:40])
        print("restamp link:", await pg.locator('.fdc [data-act="ritual"]').count())
        print("streak stat:", (await pg.inner_text(".pstats")).replace("\n", " ")[:80])
        await pg.screenshot(path=OUT + "rt-journal.png", full_page=True)
        # 改一下：重新盖章把关掉的那站点亮
        await pg.click('.fdc [data-act="ritual"]'); await pg.wait_for_timeout(300)
        checked = [await pg.locator(".rt-on").nth(i).is_checked() for i in range(n)]
        print("reopen prefill:", checked)
        await pg.locator(".rt-s").nth(n - 1).locator(".rt-tgl").click()
        await pg.click(".rt-seal"); await pg.wait_for_timeout(500)
        rec2 = docs("study")["progress"]["days"][today]
        print("after amend:", rec2["status"], rec2["done"], "next:", docs("study")["progress"]["next"])
        await pg.click('.rt-done [data-act="ritual-close"]:not([href])'); await pg.wait_for_timeout(300)
        print("errors:", errs)
        await b.close()
asyncio.run(main())
