# 研习录（yanxilu）· 给 Claude Code 的项目说明

研习录是一间可以养的书房的网页版：书墙放书、档案架放盒、桌上放牌；剪的、读的、写的在里面长成东西。公开版在 GitHub Pages，主版本在 https://baba.wogucloud.cn（Baba 服务器上的一份克隆，cron 每 5 分钟 `git pull`，所以**推到 main 就是上线**）。

三维小世界（版本 2，游戏项目）2026-11-02 拆到了另一个仓库 `cnyanghai/yanxilu-world`（brain 里 `1-Projects/yanxilu-world`），两边共用同一份 Baba 数据，代码互不引用。本仓库只管书架网页（版本 1 系列，git 标签 `v1` 是 2026-10-28 的 main）。

## 先读什么

- `STATUS.md`：进度的唯一事实源。`REFERENCES.md`：参考与结论。
- `README.md`：功能清单和数据模型。`study/README.md`：学习计划、打卡和每日讲义的规则。

## 代码结构

- 单文件前端：`src/app.js`（全部逻辑）+ `src/page.html`（CSS 和外壳）+ `src/server.js`（服务器版垫片）。**改完必须跑 `python3 build.py`**，它生成 `index.html`、`server/index.html`、`dist/artifact.html`、`reports/*.html` 和 `sw.js`（版本号来自 index.html 的 sha1）。生成物要一起提交。
- `vendor/`：自带的字体（`vendor/fonts`）、KaTeX、PDF.js、PWA 清单。不要引用 Google Fonts，国内打不开。
- 书皮：`docs/cover-masters.md` 是书皮的设计尺子（跟谁学、十条规则、对照墙）。画布装帧在 `src/app.js` 的 `FOIL`（布面烫金 / 维多利亚）与 `GRIM`（秘典）两个库里，书用 `data-grim` 规格、`grimHydrate()` 画。「老书皮」走另一条路：真书封面的公有领域扫描在 `vendor/covers/`（授权见那里的 `SOURCES.md`），清单是 `src/app.js` 的 `OLDC`，生产线在 `tools/covers/`；代码只叠书名、皮签和阅读状态。插画级的美术不要再用画布硬画，先定生产方式。
- 数据：`S.data[集合][id]`，`put(coll, id, val)` / `del(coll, id)` 写入；服务器版走 Baba 的 `/api/yxl/*`，公开版存 localStorage。集合名在 `COLLS`。剪报（`clips`/`clipbody`）只在服务器版有。
- 服务器端（另一个仓库 cnyanghai/baba-english）：`src/lib/yxl.ts` 的 `serveYxl` 直接读研习录克隆里的静态文件。2026-10-28 起是通配路由 `src/app/[...path]/route.ts`：本仓库里**任何带 `index.html` 的顶层目录**推到 main 就能在 `/<目录>` 访问。不对外的目录（server、src、tools、study、dist）写在那边的 DENY 里。`/world` 是 Baba 另克隆 yanxilu-world 仓库后在本克隆里放的链接，不在本仓库里。Baba 的部署由人在 WSL 里跑 `scripts/deploy-yanxilu.sh`，Claude 不要自己部署。

## 怎么测

```
python3 build.py
python3 tools/baba_mock.py 8790          # 本地模拟 Baba：/api/yxl/*、首页给 server/index.html（另开一个终端跑着）
python3 tools/tests/desk_test.py         # 档案架：拆封、翻牌、桌面（Playwright）
python3 tools/tests/binding_test.py foil # 装帧：书脊、在读封面、展台封面都画出或贴上，切回布面照旧；参数 old / foil / victorian / grim
```
Windows 上把 `python3` 换成 `python`。mock 起来以后浏览器打开 http://127.0.0.1:8790/#archive 就能看到服务器版（测试账号 cookie `sid=u1`，测试脚本会自己带）。截图落在 `tools/out/`（已 gitignore）。`abox_test.py`、`clip_test.py` 写于侧栏面板时期，部分步骤已过时，改之前先看。本机没有 Playwright 就 `pip install playwright && playwright install chromium`。

## 规矩（人定的，不要改）

- 每次改完要同步到 GitHub（提交并推送 main，先 fetch 变基）；永远不要 force-push。
- 回复用简体中文。
- 不读用户的书的内容；公开仓库里不放任何有版权的书、剪报正文、影视台词、歌词。剪报正文只存在用户自己的 Baba 账号里。
- 提交用 `git -c user.name="cnyanghai" -c user.email="usyanghai86@gmail.com" commit`，提交信息用中文，结尾带 `Co-Authored-By: Claude <模型名> <noreply@anthropic.com>`。
- 不打印、不传递任何密钥；不碰 nginx 的 80/443。
- 用户重度色弱：图表不靠红绿区分；笔记不加 emoji。
