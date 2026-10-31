#!/usr/bin/env python3
"""阶段 3 手绘复现验证的截图：起模拟 Baba，开 /world 站在书房里，依次打开工坊面板的三条路开关各截一张，
最后和主视觉 B 拼成一张对照墙。产物在 tools/out/verify/。
用法：python3 tools/tests/paint_verify.py [端口]"""
import asyncio, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "tools", "out", "verify"); os.makedirs(OUT, exist_ok=True)
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8792
STEPS = [  # (文件名, 标签, 要打开的开关列表；每步前先把上一步的关掉)
    ("base", "现状：烘焙贴图", []),
    ("paint", "路②a 滤镜风格化贴图", ["paint"]),
    ("paintai", "路②b 图生图风格化贴图", ["paintai"]),
    ("post", "路③ 屏幕空间画风后期", ["post"]),
    ("paint_post", "路②a + 路③", ["paint", "post"]),
    ("chair", "路① 图生三维的椅子（无后期）", ["chair"]),
    ("chair_all", "路① + ②a + ③", ["chair", "paint", "post"]),
]
STEPS_DAY2 = [
    ("d2_base", "第 2 天：壳按色板上色重烘", []),
    ("d2_rodin", "重烘 + Rodin 五件家具", ["rodin"]),
    ("d2_rodin_post", "重烘 + Rodin + 路③后期", ["rodin", "post"]),
]
STEPS_DAY3 = [
    ("d3_rodin", "第 3 天：格子家具烘焙 + 书盒落格 + Rodin 桌椅", ["rodin"]),
    ("d3_rodin_post", "第 3 天 + 路③后期", ["rodin", "post"]),
    ("d3_rodin_paint", "第 3 天 + 路②a 滤镜贴图", ["rodin", "paint"]),
]
if len(sys.argv) > 2 and sys.argv[2] == "day2": STEPS = STEPS_DAY2; SHEET = "compare_day2.jpg"
elif len(sys.argv) > 2 and sys.argv[2] == "day3": STEPS = STEPS_DAY3; SHEET = "compare_day3.jpg"
else: SHEET = "compare_day1.jpg"

def wait_up():
    for _ in range(50):
        try: urllib.request.urlopen(f"http://127.0.0.1:{PORT}/world/", timeout=1); return
        except Exception: time.sleep(0.2)
    raise SystemExit("模拟服务器没起来")

async def run():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        pg = await ctx.new_page(); errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://127.0.0.1:{PORT}/world/#/study"); await pg.wait_for_function("window.__yxlWorld", timeout=15000)
        await pg.evaluate("window.__yxlWorld.dev('still')")
        await pg.wait_for_function("window.__yxlWorld.settled()", timeout=20000); await pg.wait_for_timeout(500)
        on = set()
        for fn, label, want in STEPS:
            for k in list(on - set(want)): await pg.evaluate(f"window.__yxlWorld.dev('{k}')"); on.discard(k)
            for k in want:
                if k not in on: await pg.evaluate(f"window.__yxlWorld.dev('{k}')"); on.add(k)
            if "rodin" in want: await pg.wait_for_function("window.__yxlWorld.verifyReady()", timeout=60000)
            await pg.wait_for_timeout(3000 if ("rodin" in want or "chair" in want or "paint" in want or "paintai" in want) else 600)
            await pg.screenshot(path=os.path.join(OUT, f"shot_{fn}.png"))
            info = await pg.evaluate("(() => { const i = window.__yxlWorld.info(); return [i.calls, i.triangles]; })()")
            print(f"  {fn:11s} {label:28s} calls={info[0]} tris={info[1]}")
        await b.close()
        return errs

def montage():
    f = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc", 22)
    W, H = 720, 450; cols = 4
    tiles = [("主视觉 B（目标）", Image.open(os.path.join(ROOT, "design", "concepts", "keyart_modern_r2_B.jpg")))]
    for fn, label, _ in STEPS: tiles.append((label, Image.open(os.path.join(OUT, f"shot_{fn}.png"))))
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * W, rows * (H + 40)), (250, 248, 244)); d = ImageDraw.Draw(sheet)
    for i, (label, im) in enumerate(tiles):
        im = im.convert("RGB"); r = min(W / im.width, H / im.height); im = im.resize((int(im.width * r), int(im.height * r)), Image.LANCZOS)
        x, y = (i % cols) * W, (i // cols) * (H + 40)
        sheet.paste(im, (x + (W - im.width) // 2, y + (H - im.height) // 2)); d.text((x + 10, y + H + 8), label, fill=(40, 40, 40), font=f)
    out = os.path.join(OUT, SHEET); sheet.save(out, quality=86); print("对照墙", out)

if __name__ == "__main__":
    srv = subprocess.Popen([sys.executable, os.path.join(ROOT, "tools", "baba_mock.py"), str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait_up(); errs = asyncio.run(run())
        if errs: print("控制台报错："); [print("   ", e[:300]) for e in errs[:10]]
        montage()
    finally:
        srv.terminate()
