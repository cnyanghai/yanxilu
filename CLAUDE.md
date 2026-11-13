# 邮差（yanxilu）· 给 Claude Code 的项目说明

邮差（代号 yanxilu，2026-11-08 前叫研习录；仓库、目录、路由名不改）是一间可以养的书房的网页版：书墙放书、档案架放盒、桌上放牌；剪的、读的、写的在里面长成东西。公开版在 GitHub Pages，主版本在 https://baba.wogucloud.cn（Baba 服务器上的一份克隆，cron 每 5 分钟 `git pull`，所以**推到 main 就是上线**）。

三维小世界（版本 2，游戏项目）2026-11-02 拆到了另一个仓库 `cnyanghai/yanxilu-world`（brain 里 `1-Projects/yanxilu-world`），两边共用同一份 Baba 数据，代码互不引用。本仓库只管书架网页（版本 1 系列，git 标签 `v1` 是 2026-10-28 的 main）。

## 先读什么

- `STATUS.md`：进度的唯一事实源。`REFERENCES.md`：参考与结论。
- `README.md`：功能清单和数据模型。`study/README.md`：学习计划、打卡和每日讲义的规则。

## 代码结构

- 单文件前端：`src/app.js`（全部逻辑）+ `src/page.html`（CSS 和外壳）+ `src/server.js`（服务器版垫片）。**改完必须跑 `python3 build.py`**，它生成 `index.html`、`server/index.html`、`dist/artifact.html`、`reports/*.html` 和 `sw.js`（版本号来自 index.html 的 sha1）。生成物要一起提交。
- `vendor/`：自带的字体（`vendor/fonts`）、KaTeX、PDF.js、PWA 清单。不要引用 Google Fonts，国内打不开。
- 方向（2026-11-11 定，全文在 README「方向」一节）：立体做到物件一层，先用能动的灰盒样机把三个瞬间（一眼看全、拆包、进门）按手感做对，再选外观；现有纸模版原样留作日常工具，**外观不再加工**；用户再给参考图先问它适不适合产品目的，不直接改主线。样机在 `lab/`（独立页面，不进 build.py，说明与进度表见 `lab/README.md`；拆包在线上 `/lab`，2026-11-12 用户定「热闹」；书架「一眼看全」在 `/lab/shelf.html`，同日用户答过；进门在 `/lab/door.html`，同日用户定进法「直接到」（不要敲门那一段），2026-11-13 过门；书架与进门公用的零件在 `lab/kit.js`，书和架子的样子只改那里。2026-11-13 用户定外观「旧书房」：`kit.js` 的外观表 `LOOKS` 里旧书房 `study` 是默认，灰盒 `grey` 留着对照（顶栏「外观」按钮或 `?look=grey`），纸模 / 玩具盒是落选的样张、只有 `?look=paper|toy` 看得到、不再跟进；三页（含拆包页）的颜色、光、材质都只改外观表；现在按门把旧书房做到成品，门和进度见 `lab/README.md`「外观：旧书房」一节（门 1 材质 2026-11-13 上线：扫描的木纹与书布在 `vendor/tex/`，来源见那里的 `SOURCES.md`，转换脚本 `tools/tex/to_webp.py`；环境光是 `kit.js` 里用代码搭的）；不要动读没读的明暗区分；下载素材、生图之前先把文件名、来源、大小或模型、单价、提示词报给用户），三维用自带的 three.js 0.186（`vendor/three/`，按相对路径引，不用 importmap），主站的 Service Worker 不缓存 `/lab/`。
- 质感：2026-11-08 起全站走纸模（paper craft），规则量自两张样张，写在 `docs/shelf-design-review.md` 六之四、六之五；变量 `--pp-*` 与公用类 `.pp-paper / .pp-slab / .pp-emb / .pp-cut / .pp-pack` 在 `src/page.html`。2026-11-10 起材质只有一处定义（六之八）：纸浆纹理是烘出来的图 `vendor/paper/pulp*.webp`（脚本 `tools/paper/bake_pulp.py`），用 overlay 叠在实色上；每片纸只写面色 `--face`，凸起用 `box-shadow:var(--raise)` 或 `var(--raise-sm)`，凹用 `var(--pp-sink)`，侧壁与亮边由样式表末尾「一个房间」里的材质名单从面色算，新纸片要把选择器加进名单；不要再写死暗条色值。版面是拼砖：底只当 8 像素砖缝，奶油放内容、橄榄是没选中的数字砖、赤陶是品牌与主操作，选中靠明度与形状不靠红绿。书墙是 `.pwall` 加 `.pspine`（纸片书脊、米白签），档案架是 `.arack` 加 `.apack`（正交画的牌盒），开盒是 `.ytable`，牌是 `.yc`。盒子、牌、书不加颗粒、不用 CSS 3D（会发虚），厚的盒体正交平面画，薄的纸片才上颗粒。
- 书皮（2026-11-09 起书墙不用，装帧库留着）：`docs/cover-masters.md` 是书皮的设计尺子（跟谁学、十条规则、对照墙）。画布装帧在 `src/app.js` 的 `FOIL`（布面烫金 / 维多利亚）与 `GRIM`（秘典）两个库里，书用 `data-grim` 规格、`grimHydrate()` 画。「老书皮」走另一条路：真书封面的公有领域扫描在 `vendor/covers/`（授权见那里的 `SOURCES.md`），清单是 `src/app.js` 的 `OLDC`，生产线在 `tools/covers/`；代码只叠书名、皮签和阅读状态。插画级的美术不要再用画布硬画，先定生产方式。三维资产一律按专业流程（`docs/bookcase-production.md` 是样板）：量尺 → 粗模 → 高模 → 分层材质 → 看光 → 合成 → 出图，脚本在 `tools/blender/web_props/`，在用户开着的桌面 Blender（端口 9877，`tools/blender/mcp_call.py`）里做，每阶段并排蓝本过门。场景图在 `vendor/scene/`。
- 数据：`S.data[集合][id]`，`put(coll, id, val)` / `del(coll, id)` 写入；服务器版走 Baba 的 `/api/yxl/*`，公开版存 localStorage。集合名在 `COLLS`。剪报（`clips`/`clipbody`）只在服务器版有。笔记本架是 `nbooks` / `pages`（设计稿 `docs/notebook-design.md`，字段两边仓库共用，不改含义只加字段）。
- 服务器端（另一个仓库 cnyanghai/baba-english）：`src/lib/yxl.ts` 的 `serveYxl` 直接读研习录克隆里的静态文件。2026-10-28 起是通配路由 `src/app/[...path]/route.ts`：本仓库里**任何带 `index.html` 的顶层目录**推到 main 就能在 `/<目录>` 访问。不对外的目录（server、src、tools、study、dist）写在那边的 DENY 里。`youchai/` 是独立 App「邮差」的入口（build.py 从同一份代码生成，PWA），线上 `/youchai/`；2026-11-08 起与「墓园宽柜」场景一起冻结不再推进，主线是素墙系列做完整（`docs/shelf-design-review.md` 第六节）。`/world` 是 Baba 另克隆 yanxilu-world 仓库后在本克隆里放的链接，不在本仓库里。Baba 的部署由人在 WSL 里跑 `scripts/deploy-yanxilu.sh`，Claude 不要自己部署。

## 怎么测

```
python3 build.py
python3 tools/baba_mock.py 8790          # 本地模拟 Baba：/api/yxl/*、首页给 server/index.html（另开一个终端跑着）
python3 tools/tests/desk_test.py         # 档案架：拆封、翻牌、桌面（Playwright）
python3 tools/tests/notes_test.py        # 笔记本架：记一笔、随手本编辑自动保存、日历、搜索、手机单栏
python3 tools/tests/lab_pack_test.py     # 拆包样机：热闹（默认）与安静各走一遍流程并截关键帧（自己起模拟服务，端口 8798，软件渲染较慢约两三分钟）
python3 tools/tests/lab_shelf_test.py    # 书架样机：划过书脊、抽出、改读没读、放回、换排法、换本数（自己起模拟服务，端口 8799，软件渲染约两三分钟）
python3 tools/tests/lab_door_test.py     # 进门样机：直接到、看懂、往下拉带走一排、点签带走、邮包；对照的敲门进（?way=knock）也走一遍（自己起模拟服务，端口 8796，软件渲染约两三分钟）
python3 tools/tests/lab_look_test.py     # 外观：默认旧书房、单子上只有旧书房和灰盒且三页一起换、落选的两种带参数打得开但不记、读没读明暗差够大（自己起模拟服务，端口 8795，软件渲染约两三分钟）
python3 tools/tests/look_test.py         # 样子没坏：十二张截图对基准（自己起模拟服务，端口 8793）；样子是有意改的就加 --update 重拍，基准图一起提交
```
`tools/tests/_frozen/` 里的 binding_test 与 scene_test 对着 2026-11-09 前的旧书墙（布面 / 烫金 / 老书皮书脊、拱形书柜场景），不跑。
Windows 上把 `python3` 换成 `python`。mock 起来以后浏览器打开 http://127.0.0.1:8790/#archive 就能看到服务器版（测试账号 cookie `sid=u1`，测试脚本会自己带）。截图落在 `tools/out/`（已 gitignore）。`abox_test.py`、`clip_test.py` 写于侧栏面板时期，部分步骤已过时，改之前先看。本机没有 Playwright 就 `pip install playwright && playwright install chromium`。

## 规矩（人定的，不要改）

- 每次改完要同步到 GitHub（提交并推送 main，先 fetch 变基）；永远不要 force-push。
- 回复用简体中文。
- 不读用户的书的内容；公开仓库里不放任何有版权的书、剪报正文、影视台词、歌词。剪报正文只存在用户自己的 Baba 账号里。
- 提交用 `git -c user.name="cnyanghai" -c user.email="usyanghai86@gmail.com" commit`，提交信息用中文，结尾带 `Co-Authored-By: Claude <模型名> <noreply@anthropic.com>`。
- 不打印、不传递任何密钥；不碰 nginx 的 80/443。
- 用户重度色弱：图表不靠红绿区分；笔记不加 emoji。
