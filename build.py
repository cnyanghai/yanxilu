#!/usr/bin/env python3
"""把 src/ 下的页面、数据和脚本合成两个文件：
- dist/artifact.html：发布到 claude.ai 的版本（不含 <html>/<head> 外壳，由平台包裹）
- index.html：GitHub 上的完整网页（可直接打开或用 GitHub Pages 访问）
用法：python3 build.py
"""
import re, pathlib
root = pathlib.Path(__file__).parent
page = (root / "src/page.html").read_text(encoding="utf-8")
data = (root / "src/data.js").read_text(encoding="utf-8") + "\n" + "\n".join(
    f.read_text(encoding="utf-8") for f in sorted((root / "src").glob("deep-*.js")))
# 每日课表：课程安排 + 打卡进度快照（study/progress.json 由早晚两个定时任务更新）
data += "\n" + (root / "src/plan.js").read_text(encoding="utf-8")
data += "\nwindow.YXL_STUDY = " + (root / "study/progress.json").read_text(encoding="utf-8").strip() + ";\n"
app = (root / "src/app.js").read_text(encoding="utf-8")

body = page.rstrip() + "\n<script>\n" + data.strip() + "\n</script>\n<script>\n" + app.strip() + "\n</script>\n"
(root / "dist").mkdir(exist_ok=True)
(root / "dist/artifact.html").write_text(body, encoding="utf-8")

# 完整网页：把 <title> 和字体 <link> 移进 <head>
head_bits = re.findall(r"<title>.*?</title>|<link[^>]*>", page)
rest = re.sub(r"<title>.*?</title>\n?|<link[^>]*>\n?", "", page)
reset = (":root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}"
         "body{margin:0}img{max-width:100%}[hidden]{display:none!important}")
full = ("<!doctype html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n"
        + "\n".join(head_bits) + "\n<style>" + reset + "</style>\n</head>\n<body>\n"
        + rest.strip() + "\n<script>\n" + data.strip() + "\n</script>\n<script>\n" + app.strip() + "\n</script>\n</body>\n</html>\n")
(root / "index.html").write_text(full, encoding="utf-8")
print("dist/artifact.html", len(body.encode()), "bytes; index.html", len(full.encode()), "bytes")
