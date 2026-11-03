# copy chosen covers into the repo, write OLDC into app.js and SOURCES.md
import json, shutil, os, re, sys, html
PD = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.expanduser("~/brain/1-Projects/yanxilu")
cov = json.load(open(os.path.join(PD, "covers.json"))); cands = {c["n"]: c for c in json.load(open(os.path.join(PD, "cands.json")))}
drop = set(int(x) for x in sys.argv[1:])
dst = os.path.join(REPO, "vendor/covers"); os.makedirs(dst, exist_ok=True)
for f in os.listdir(dst):
    if f.endswith(".webp"): os.remove(os.path.join(dst, f))
rows, src = [], []
for k in sorted(cov, key=int):
    c = cov[k]; n = c["n"]
    if n in drop: continue
    shutil.copy(os.path.join(PD, "out/c%02d.webp" % n), dst)
    rows.append([n, c["ar"]] + c["tb"] + ["s" if c["style"] == "stamp" else "p", c["ink"], 1 if c["vert"] else 0, c["sx"], c["dark"]])
    m = cands[n]
    src.append("| c%02d | [%s](%s) | %s | %s |" % (n, m["key"].replace("File:", "").replace("|", "/"), m["page"], m["lic"], (m["cat"] or "").replace("Category:", "")))
s = open(os.path.join(REPO, "src/app.js"), encoding="utf-8").read()
s = re.sub(r"/\*OLDC\*/.*?/\*OLDC\*/", "/*OLDC*/" + json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + "/*OLDC*/", s, flags=re.S)
open(os.path.join(REPO, "src/app.js"), "w", encoding="utf-8").write(s)
md = """# 老书皮的来源与授权

研习录「老书皮」装帧用的封面图，全部来自维基共享资源（Wikimedia Commons）上标为公有领域、CC0 或 CC BY 2.0 的馆藏扫描，原书出版于 1840 到 1910 年代，作品本身在美国已进入公有领域。

处理：裁去背景与比例尺，抹掉原书名与作者名（用同一封面上的空白布面补），缩到 540 像素宽存为 WebP。书名是研习录在页面上叠的字，不在图里。

CC BY 2.0 的图（大多是波士顿公共图书馆 Boston Public Library 拍摄的惠特曼 Sarah Wyman Whitman 装帧）按授权署名：摄影与收藏 Boston Public Library，经修改（裁切、抹字、缩放），授权 https://creativecommons.org/licenses/by/2.0/ 。

| 文件 | 原图 | 授权 | 收藏 / 分类 |
|---|---|---|---|
""" + "\n".join(src) + "\n"
open(os.path.join(dst, "SOURCES.md"), "w", encoding="utf-8").write(md)
print(len(rows), "covers", sum(os.path.getsize(os.path.join(dst, f)) for f in os.listdir(dst)) // 1024, "KB")
