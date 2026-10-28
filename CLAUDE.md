# 研习录（yanxilu）· 给 Claude Code 的项目说明

研习录是一间可以养的书房：书墙放书、档案架放盒、桌上放牌；剪的、读的、写的，在里面长成东西。公开版在 GitHub Pages，主版本在 https://baba.wogucloud.cn（Baba 服务器上的一份克隆，cron 每 5 分钟 `git pull`，所以**推到 main 就是上线**）。

## 先读什么

- `design/BRIEF.md`：气质定义、已经定下的设计决定、正在做的方向（CSS 3D 的书房）。改界面之前先读它。
- `README.md`：功能清单和数据模型。
- `study/README.md`：学习计划、打卡和每日讲义的规则。

## 代码结构

- 单文件前端：`src/app.js`（全部逻辑）+ `src/page.html`（CSS 和外壳）+ `src/server.js`（服务器版垫片）。**改完必须跑 `python3 build.py`**，它生成 `index.html`、`server/index.html`、`dist/artifact.html`、`reports/*.html` 和 `sw.js`（版本号来自 index.html 的 sha1）。生成物要一起提交。
- `room/index.html`：书房样机（CSS 3D 路线的第一稿），独立页面，服务器版在 `/room`。
- `vendor/`：自带的字体（`vendor/fonts`）、KaTeX、PDF.js、PWA 清单。不要引用 Google Fonts，国内打不开。
- 数据：`S.data[集合][id]`，`put(coll, id, val)` / `del(coll, id)` 写入；服务器版走 Baba 的 `/api/yxl/*`，公开版存 localStorage。集合名在 `COLLS`。剪报（`clips`/`clipbody`）只在服务器版有。
- 服务器端（另一个仓库 cnyanghai/baba-english）：`src/lib/yxl.ts` 的 `serveYxl` 直接读研习录克隆里的静态文件；新的顶层路径要在那边加一条 route（例如 `src/app/room/route.ts`）。Baba 的部署由人在 WSL 里跑 `scripts/deploy-yanxilu.sh`，Claude 不要自己部署。

## 怎么测

```
python3 build.py
python3 tools/baba_mock.py 8790 &        # 本地模拟 Baba：/api/yxl/*、首页给 server/index.html
python3 tools/tests/desk_test.py         # 档案架：拆封、翻牌、桌面（Playwright）
```
截图落在 `tools/out/`（已 gitignore）。`abox_test.py`、`clip_test.py` 写于侧栏面板时期，部分步骤已过时，改之前先看。本机没有 Playwright 就 `pip install playwright && playwright install chromium`。

## 规矩（人定的，不要改）

- 每次改完要同步到 GitHub（提交并推送 main）；永远不要 force-push。
- 回复用简体中文。
- 不读用户的书的内容；公开仓库里不放任何有版权的书、剪报正文、影视台词、歌词。剪报正文只存在用户自己的 Baba 账号里。
- 借鉴游戏（炉石、魔兽）的机制和结构，绝不用暴雪的美术、边框、图标、字体、音效。
- 提交用 `git -c user.name="cnyanghai" -c user.email="usyanghai86@gmail.com" commit`，提交信息用中文，结尾带 `Co-Authored-By: Claude <模型名> <noreply@anthropic.com>`。
- 不打印、不传递任何密钥；不碰 nginx 的 80/443；不改 `data/`。

## 现在的状态（2026-10-28）

- 档案架：每篇文章一张牌（牌背是固定封面加题签，宝石灰/青/金/朱记学到哪一步），剪报夹是封着的档案袋（拆封动画），盒子和夹子点开是整屏深色桌面。
- 书房样机 `room/` 刚上线第一稿，等用户看过效果再定主角（今天的牌 / 案头的文竹）和下一步。
- 设计稿在 claude.ai 的画布里（见 `design/BRIEF.md` 的链接），那是讨论用的，不是代码。
