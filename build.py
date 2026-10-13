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
# 线网图布局
data += "\n" + (root / "src/metro.js").read_text(encoding="utf-8")
data += "\nwindow.YXL_STUDY = " + (root / "study/progress.json").read_text(encoding="utf-8").strip() + ";\n"
# 每日讲义快照：GitHub 版直接读它；云端版优先读数据库 lessons/<日期>，读不到再用它
import json
lessons = {f.stem: f.read_text(encoding="utf-8") for f in sorted((root / "study/daily").glob("*.md"))}
data += "\nwindow.YXL_LESSONS = " + json.dumps(lessons, ensure_ascii=False).replace("</", "<\\/") + ";\n"
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

# 专题页：src/report-*.html 里的 /*@DATA@*/ 换成 reports/data/ 下的 JSON；知识专题没有数据文件，填 None
REPORTS = {"report-consumption.html": ("consumption-population.json", "consumption-population.html"),
           "report-wealth.html": ("wealth.json", "wealth.html"),
           "report-market-making.html": (None, "market-making.html"),
           "report-market-making-plan.html": (None, "market-making-plan.html")}
(root / "reports").mkdir(exist_ok=True)
import html as _html
def insert_code(tpl):
    """<!--@CODE:路径@--> 换成 reports/data/ 下对应文件的内容（转义后放进 <pre><code>）"""
    return re.sub(r"<!--@CODE:([\w./-]+)@-->",
                  lambda m: _html.escape((root / "reports/data" / m.group(1)).read_text(encoding="utf-8").rstrip(), quote=False), tpl)
for src_name, (data_name, out_name) in REPORTS.items():
    tpl = insert_code((root / "src" / src_name).read_text(encoding="utf-8"))
    if data_name is None:
        body = tpl
    else:
        js = (root / "reports/data" / data_name).read_text(encoding="utf-8").strip()
        assert "/*@DATA@*/null" in tpl, src_name
        body = tpl.replace("/*@DATA@*/null", js)
    (root / "dist" / src_name).write_text(body, encoding="utf-8")
    hb = re.findall(r"<title>.*?</title>|<link[^>]*>", body)
    rest = re.sub(r"<title>.*?</title>\n?|<link[^>]*>\n?", "", body)
    page_full = ("<!doctype html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n"
                 "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n"
                 + "\n".join(hb) + "\n<style>" + reset + "</style>\n</head>\n<body>\n" + rest.strip() + "\n</body>\n</html>\n")
    (root / "reports" / out_name).write_text(page_full, encoding="utf-8")
    print("dist/" + src_name, len(body.encode()), "bytes; reports/" + out_name, len(page_full.encode()), "bytes")
