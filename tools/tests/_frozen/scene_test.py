"""场景「拱形书柜」：切上去后书墙有拱顶 / 格层 / 底座，书全在格层里、不溢出，缩放到位；切回素墙照旧；窄屏不用场景。
用法：先起 python3 tools/baba_mock.py 8790，再 python3 tools/tests/scene_test.py
截图落在 tools/out/scene-*.png（已 gitignore）。"""
import os, sys
from playwright.sync_api import sync_playwright

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
BASE = "http://127.0.0.1:%d" % PORT
OUT = os.path.join(os.path.dirname(__file__), "..", "out"); os.makedirs(OUT, exist_ok=True)
errors = []
def check(name, ok, extra=""):
    print(("ok   " if ok else "FAIL ") + name + (" | " + extra if extra else ""))
    if not ok: errors.append(name)

with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={"width": 1440, "height": 900}); c.add_cookies([{"name": "sid", "value": "u1", "url": BASE}])
    pg = c.new_page(); pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    pg.goto(BASE + "/#shelf"); pg.wait_for_timeout(1500)
    # 布置里有场景一栏
    pg.click('[data-act="look"]'); pg.wait_for_timeout(300)
    check("布置里有场景", pg.locator('[data-act="look-scene"][data-v="arch"]').count() == 1)
    pg.click('[data-act="look-scene"][data-v="arch"]'); pg.wait_for_timeout(1500)
    pg.keyboard.press("Escape"); pg.click("body", position={"x": 5, "y": 5}); pg.wait_for_timeout(300)
    check("书墙带 scene-arch", pg.locator(".wall.scene-arch").count() == 1)
    check("有拱顶与底座", pg.locator(".wall.scene-arch .sc-top").count() == 1 and pg.locator(".wall.scene-arch .sc-base").count() == 1)
    # 四张图都加载了
    loaded = pg.evaluate("""() => Promise.all(['top','bay','base','wall'].map(n => new Promise(r => { const i = new Image(); i.onload = () => r([n, i.naturalWidth]); i.onerror = () => r([n, 0]); i.src = 'vendor/scene/arch/' + n + '.webp'; })))""")
    check("四张场景图加载", all(w > 0 for _, w in loaded), str(loaded))
    # 行高按比例，书在格层里且不溢出
    info = pg.evaluate("""() => { const w = document.querySelector('.wall.scene-arch'); const rows = [...w.querySelectorAll('.wall-row')];
      const wr = w.getBoundingClientRect(); const bz = getComputedStyle(w).getPropertyValue('--bz');
      const out = rows.map(r => { const rr = r.getBoundingClientRect(); const cbs = [...r.querySelectorAll('.cb')]; const tops = cbs.map(c => c.getBoundingClientRect().top); const bots = cbs.map(c => c.getBoundingClientRect().bottom);
        return { h: Math.round(rr.height), n: cbs.length, above: tops.length ? Math.round(Math.min(...tops) - rr.top) : null, below: bots.length ? Math.round(Math.max(...bots) - rr.bottom) : null }; });
      return { wallW: Math.round(wr.width), bz: bz, rows: out }; }""")
    print("rows", info)
    exp = round(info["wallW"] * 436 / 2246)
    check("行高 = 墙宽 × 格层比", all(abs(r["h"] - exp) <= 3 for r in info["rows"]), "期望 %d" % exp)
    check("书不冒出格层顶", all(r["above"] is None or r["above"] >= 0 for r in info["rows"]))
    check("书立在格层底", all(r["below"] is None or abs(r["below"]) <= 3 for r in info["rows"]))
    check("书有缩放", 0.4 < float(info["bz"] or 1) < 1.0, str(info["bz"]))
    pg.screenshot(path=os.path.join(OUT, "scene-arch.png"), full_page=True)
    # 指到一本书、点上展台照旧能用
    bk = pg.locator('.wall [data-act="pick"]').nth(2); bk.hover(); pg.wait_for_timeout(400); bk.click(); pg.wait_for_timeout(800)
    check("点书上展台", pg.locator(".dais, .stage, .stg").count() >= 1)
    # 切回素墙
    pg.click('[data-act="look"]'); pg.wait_for_timeout(300); pg.click('[data-act="look-scene"][data-v="none"]'); pg.wait_for_timeout(1200)
    check("切回素墙", pg.locator(".wall.scene-arch").count() == 0 and pg.locator(".sc-top").count() == 0)
    # 窄屏：即使存着 arch 也不用场景
    pg.evaluate("""() => { const k='yanxilu-look', o=JSON.parse(localStorage.getItem(k)||'{}'); o.scene='arch'; localStorage.setItem(k, JSON.stringify(o)); }""")
    m = b.new_context(viewport={"width": 390, "height": 844}); m.add_cookies([{"name": "sid", "value": "u1", "url": BASE}])
    mp = m.new_page(); mp.goto(BASE + "/#shelf"); mp.wait_for_timeout(1500)
    mp.evaluate("""() => { const k='yanxilu-look', o=JSON.parse(localStorage.getItem(k)||'{}'); o.scene='arch'; localStorage.setItem(k, JSON.stringify(o)); }"""); mp.reload(); mp.wait_for_timeout(1500)
    check("窄屏用手机版场景", mp.locator(".wall.scene-arch-m").count() == 1 and mp.locator(".wall.scene-arch").count() == 0)
    loaded_m = mp.evaluate("""() => Promise.all(['top','bay','base'].map(n => new Promise(r => { const i = new Image(); i.onload = () => r([n, i.naturalWidth]); i.onerror = () => r([n, 0]); i.src = 'vendor/scene/arch-m/' + n + '.webp'; })))""")
    check("手机版三张图加载", all(w > 0 for _, w in loaded_m), str(loaded_m))
    mi = mp.evaluate("""() => { const w = document.querySelector('.wall.scene-arch-m'); const wms = [...w.querySelectorAll('.wm:not(.ghost)')];
      return { wallW: Math.round(w.getBoundingClientRect().width), bz: getComputedStyle(w).getPropertyValue('--bz'), scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
        wms: wms.map(m => { const r = m.getBoundingClientRect(); const cbs = [...m.querySelectorAll('.cb')]; const tops = cbs.map(c => c.getBoundingClientRect().top); const bots = cbs.map(c => c.getBoundingClientRect().bottom);
          return { h: Math.round(r.height), n: cbs.length, above: tops.length ? Math.round(Math.min(...tops) - r.top) : null, below: bots.length ? Math.round(Math.max(...bots) - r.bottom) : null }; }) }; }""")
    print("mobile", mi)
    expm = round(mi["wallW"] * 634 / 1239)
    check("手机格层高 = 墙宽 × 比", all(abs(x["h"] - expm) <= 3 for x in mi["wms"]), "期望 %d" % expm)
    check("手机书不冒顶、立在格层底", all((x["above"] is None or x["above"] >= 0) and (x["below"] is None or abs(x["below"]) <= 3) for x in mi["wms"]))
    check("手机不横向溢出", mi["scrollW"] <= mi["innerW"] + 1)
    mp.screenshot(path=os.path.join(OUT, "scene-arch-m.png"), full_page=True)
    # 收拾：恢复默认
    pg.evaluate("""() => { const k='yanxilu-look', o=JSON.parse(localStorage.getItem(k)||'{}'); o.scene='none'; localStorage.setItem(k, JSON.stringify(o)); }""")
    b.close()
print("errors:", errors); sys.exit(1 if errors else 0)
