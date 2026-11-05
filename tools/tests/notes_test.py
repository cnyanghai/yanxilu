"""笔记本架：记一笔落到今天、刷新还在、点纸面编辑自动保存、日历翻页、全站搜索能搜到。
用法：先起 python3 tools/baba_mock.py 8790，再 python3 tools/tests/notes_test.py
截图落在 tools/out/notes-*.png（已 gitignore）。"""
import os, sys, time, datetime
from playwright.sync_api import sync_playwright

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
BASE = "http://127.0.0.1:%d" % PORT
OUT = os.path.join(os.path.dirname(__file__), "..", "out")
os.makedirs(OUT, exist_ok=True)
errors = []
stamp = "测试笔记 " + datetime.datetime.now().strftime("%H%M%S")

def check(name, ok, extra=""):
    print(("ok   " if ok else "FAIL ") + name + (" | " + extra if extra else ""))
    if not ok: errors.append(name)

with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={"width": 1400, "height": 960})
    c.add_cookies([{"name": "sid", "value": "u1", "url": BASE}])
    pg = c.new_page()
    pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

    # 1 书架切换条里有笔记本架，页面能开
    pg.goto(BASE + "/#shelf"); pg.wait_for_timeout(1200)
    check("切换条有笔记本架", pg.locator('.shelf-seg a[href="#notes"]').count() == 1)
    pg.click('.shelf-seg a[href="#notes"]'); pg.wait_for_timeout(800)
    check("笔记本架页：架子与随手本", pg.locator(".nrack .nbk-b").count() >= 1 and pg.locator(".nbk").count() == 1)
    check("今天这一页是空的", pg.locator(".np-paper.empty").count() == 1)
    pg.screenshot(path=os.path.join(OUT, "notes-empty.png"))

    # 2 在别的页面按 N 记一笔
    pg.goto(BASE + "/#shelf"); pg.wait_for_timeout(800)
    pg.keyboard.press("n"); pg.wait_for_timeout(300)
    check("按 N 弹出纸条", pg.locator("#jot-ta").count() == 1 and pg.evaluate("document.activeElement && document.activeElement.id") == "jot-ta")
    pg.keyboard.type(stamp + " 第一句")
    pg.keyboard.press("Shift+Enter"); pg.keyboard.type("第二行")
    pg.screenshot(path=os.path.join(OUT, "notes-jot.png"))
    pg.keyboard.press("Enter"); pg.wait_for_timeout(600)
    check("回车后纸条收起", pg.locator("#jot-ta").count() == 0)
    check("提示记到随手本", "随手本" in (pg.locator("#toast").text_content() or ""))

    # 3 去笔记本架看：今天这一页有这一笔，带时间
    pg.goto(BASE + "/#notes"); pg.wait_for_timeout(800)
    ents = pg.locator(".np-ent")
    check("今天这一页有 1 段", ents.count() == 1, str(ents.count()))
    check("段首有时间", bool(pg.locator(".np-ent time").first.text_content().strip()))
    check("正文在", stamp in (pg.locator(".np-paper").text_content() or ""))
    check("日历今天有墨点", pg.locator(".np-d.np-today.np-dot").count() == 1)
    check("架上页数为 1", "1 页" in (pg.locator(".nbk-b").first.text_content() or ""))

    # 4 刷新后还在（mock 内存持久）
    pg.reload(); pg.wait_for_timeout(1200)
    check("刷新后还在", stamp in (pg.locator(".np-paper").text_content() or ""))

    # 5 点纸面编辑，自动保存，失焦后渲染
    pg.click(".np-paper"); pg.wait_for_timeout(300)
    check("进入编辑态", pg.locator("#np-ta").count() == 1 and pg.evaluate("document.activeElement && document.activeElement.id") == "np-ta")
    pg.keyboard.press("End"); pg.keyboard.type("\n\n补一句 **加粗** 的话")
    pg.wait_for_timeout(1100)
    st = pg.locator("#np-st").text_content() or ""
    check("停笔后已保存", st.startswith("已保存"), st)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
    check("Esc 退出编辑态并渲染", pg.locator("#np-ta").count() == 0 and pg.locator(".np-body strong").count() == 1)
    check("现在 2 段", pg.locator(".np-ent").count() == 2)
    pg.screenshot(path=os.path.join(OUT, "notes-page.png"))

    # 6 日历翻月再翻回；前一页按钮在只有一页时禁用
    pg.click('.np-mb[aria-label="上个月"]'); pg.wait_for_timeout(300)
    check("翻到上个月，今天不在格里", pg.locator(".np-d.np-today").count() == 0)
    pg.click('.np-mb[aria-label="下个月"]'); pg.wait_for_timeout(300)
    check("翻回来", pg.locator(".np-d.np-today").count() == 1)
    check("前一页禁用", pg.locator('.np-dnav button:has-text("前一页")').is_disabled())
    hs = pg.evaluate("Array.from(document.querySelectorAll('.np-d')).map(e => Math.round(e.getBoundingClientRect().height))")
    check("日历格子一样高", max(hs) - min(hs) <= 1, str(sorted(set(hs))))

    # 7 点昨天：空页，地址带日期；点「今天」回来
    y = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    pg.click('.np-d[data-d="%s"]' % y); pg.wait_for_timeout(600)
    check("地址带日期", pg.evaluate("location.hash") == "#notes-" + y, pg.evaluate("location.hash"))
    check("昨天是空页", pg.locator(".np-paper.empty").count() == 1)
    check("后一页可用", not pg.locator('.np-dnav button:has-text("后一页")').is_disabled())
    pg.click('.np-dnav button:has-text("今天")'); pg.wait_for_timeout(600)
    check("回到今天", pg.evaluate("location.hash") == "#notes" and pg.locator(".np-ent").count() == 2)

    # 8 全站搜索搜到这一笔
    pg.keyboard.press("Control+k"); pg.wait_for_timeout(300)
    pg.keyboard.type(stamp.split(" ")[1]); pg.wait_for_timeout(400)
    hit = pg.locator(".ck-it:has-text('随手本')")
    check("搜索命中笔记", hit.count() >= 1)
    pg.keyboard.press("Escape")

    # 9 手机宽度：单栏、纸条从底部起
    m = b.new_context(viewport={"width": 390, "height": 800}, device_scale_factor=2)
    m.add_cookies([{"name": "sid", "value": "u1", "url": BASE}])
    mp = m.new_page(); mp.goto(BASE + "/#notes"); mp.wait_for_timeout(1200)
    cols = mp.evaluate("getComputedStyle(document.querySelector('.nbk')).gridTemplateColumns.split(' ').length")
    check("手机单栏", cols == 1, str(cols))
    check("手机不横向溢出", mp.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
    mp.click(".tb-jot"); mp.wait_for_timeout(300)
    check("手机能打开纸条", mp.locator("#jot-ta").count() == 1)
    mp.screenshot(path=os.path.join(OUT, "notes-mobile.png"))
    m.close()

    # 收拾：把今天这页清空，免得下次测试撞上
    pg.goto(BASE + "/#notes"); pg.wait_for_timeout(600)
    pg.click(".np-paper"); pg.wait_for_timeout(200)
    pg.keyboard.press("Control+a"); pg.keyboard.press("Delete"); pg.wait_for_timeout(1100)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
    check("清空后回到空页", pg.locator(".np-paper.empty").count() == 1)
    b.close()

print("errors:", errors)
sys.exit(1 if errors else 0)
