# 研习录（yanxilu）· 给 Claude Code 的项目说明

研习录是一间可以养的书房：书墙放书、档案架放盒、桌上放牌；剪的、读的、写的，在里面长成东西。公开版在 GitHub Pages，主版本在 https://baba.wogucloud.cn（Baba 服务器上的一份克隆，cron 每 5 分钟 `git pull`，所以**推到 main 就是上线**）。

## 先读什么

- `design/PRODUCTION-PLAN.md`：**唯一的计划**，五个阶段、门、预算、待办区；会话开头先报现在第几阶段、这次做哪个交付物，新想法进待办区不打断当前阶段。
- `design/ART-BIBLE.md`：第一个风格包的样子（主视觉、色板、材质、三种光、零件表、验收单）；`design/ASSET-SPEC.md`：尺寸、槽位、面数、交付定义，做任何资产前先读。
- `design/MASTER-PLAN.md`：版本 2 的总体方案（三层结构、小镇式、一种风格、烘焙的三维），五个根本问题的答案；`design/BRIEF.md`：气质定义与已定的设计决定。改界面之前先读这两页。
- `README.md`：功能清单和数据模型。
- `study/README.md`：学习计划、打卡和每日讲义的规则。

## 代码结构

- 单文件前端：`src/app.js`（全部逻辑）+ `src/page.html`（CSS 和外壳）+ `src/server.js`（服务器版垫片）。**改完必须跑 `python3 build.py`**，它生成 `index.html`、`server/index.html`、`dist/artifact.html`、`reports/*.html` 和 `sw.js`（版本号来自 index.html 的 sha1）。生成物要一起提交。
- `room/index.html`：书房样机（CSS 3D 路线的第一稿），独立页面，服务器版在 `/room`。
- `world/`：版本 2 的小世界（WebGL）。`index.html` 外壳和 HUD，`world.js` 全部逻辑（ES 模块，用 importmap 引 `vendor/three/`），`sample.js` 样例数据，`assets/` 是 Blender 烘焙出来的壳（`study.gltf.json` 几何、`study_<光>_<组>.jpg` 三套贴图、`study.json` 机位与槽位配置）。服务器版在 `/world`（走 Baba 的通配路由）。按反引号键或加 `?dev=1` 打开「工坊」面板（线框、关烘焙、广角对比、热点、贴图集、性能数），每个开关对应 `design/TECH-NOTES.md` 的一张技术卡；引入新技术要加卡。不打包，不引框架。场景里没有实时光：建筑和大件家具用烘焙贴图当无光照材质，三种光是三套贴图淡接；书、盒、牌、文竹程序化生成。
- `tools/blender/`：bpy 脚本。`study_scene.py` 搭场景（尺寸、槽位、机位、三种光的唯一来源，`config()` 导出给 world.js），`study_frames.py` 渲静帧，`bake_study.py` 烘焙导出，`bake.sh` 一键跑（优先用 Windows 侧 `D:\齐河OnLine\tools\blender\blender.exe` 4.5，有显卡；没有就用 WSL 的 4.0 CPU，慢几十倍且没降噪器）。改了房间尺寸或家具位置要重新 `bash tools/blender/bake.sh`，产物提交。
- `vendor/`：自带的字体（`vendor/fonts`）、KaTeX、PDF.js、PWA 清单。不要引用 Google Fonts，国内打不开。
- 数据：`S.data[集合][id]`，`put(coll, id, val)` / `del(coll, id)` 写入；服务器版走 Baba 的 `/api/yxl/*`，公开版存 localStorage。集合名在 `COLLS`。剪报（`clips`/`clipbody`）只在服务器版有。
- 服务器端（另一个仓库 cnyanghai/baba-english）：`src/lib/yxl.ts` 的 `serveYxl` 直接读研习录克隆里的静态文件。2026-10-28 起是通配路由 `src/app/[...path]/route.ts`：本仓库里**任何带 `index.html` 的顶层目录**（`room/`、`world/`、以后的花房）推到 main 就能在 `/<目录>` 访问，不用再改 Baba。不对外的目录（server、src、tools、study、dist、design、data）写在那边的 DENY 里。页面地址是 `/<目录>`（没有尾斜杠），页面里的相对路径要能按目录解析：Baba 会注入 `<base>`（12cbf4e 之后的部署），在那之前新页面的 `index.html` 开头照抄 `world/index.html` 里补 `<base>` 的那段脚本。Baba 的部署由人在 WSL 里跑 `scripts/deploy-yanxilu.sh`，Claude 不要自己部署（用户明确授权的那次除外）。

## 怎么测

```
python3 build.py
python3 tools/baba_mock.py 8790          # 本地模拟 Baba：/api/yxl/*、首页给 server/index.html（另开一个终端跑着）
python3 tools/tests/desk_test.py         # 档案架：拆封、翻牌、桌面（Playwright）
python3 tools/tests/world_test.py        # 小世界：四景别截图、三种光、draw call 数（自己起模拟服务器）
bash tools/blender/bake.sh               # 重新烘焙小世界的壳（约 10 分钟，显卡）；静帧：blender -b --python tools/blender/study_frames.py -- --lights day,night,rain
```
Windows 上把 `python3` 换成 `python`；脚本都是纯 Python，Windows 和 Linux 都能跑。mock 起来以后浏览器窗格打开 http://127.0.0.1:8790/#archive 就能看到服务器版（测试账号 cookie `sid=u1`，测试脚本会自己带）。
截图落在 `tools/out/`（已 gitignore）。`abox_test.py`、`clip_test.py` 写于侧栏面板时期，部分步骤已过时，改之前先看。本机没有 Playwright 就 `pip install playwright && playwright install chromium`。

## 规矩（人定的，不要改）

- 每次改完要同步到 GitHub（提交并推送 main）；永远不要 force-push。
- 回复用简体中文。
- 不读用户的书的内容；公开仓库里不放任何有版权的书、剪报正文、影视台词、歌词。剪报正文只存在用户自己的 Baba 账号里。
- 借鉴游戏（炉石、魔兽）的机制和结构，绝不用暴雪的美术、边框、图标、字体、音效。
- 提交用 `git -c user.name="cnyanghai" -c user.email="usyanghai86@gmail.com" commit`，提交信息用中文，结尾带 `Co-Authored-By: Claude <模型名> <noreply@anthropic.com>`。
- 不打印、不传递任何密钥；不碰 nginx 的 80/443；不改 `data/`。

## 版本与状态

- 进度的唯一事实源是 `STATUS.md`，先读它。参考与结论在 `REFERENCES.md`。
- **版本 1 系列**：现在的书架 + 档案架网页（git 标签 `v1`），保留并继续可开发。档案架每篇文章一张牌，剪报夹是档案袋，盒和夹点开是整屏桌面。
- **版本 2 系列**：三维小世界，立项分析和分步路线在 `design/V2-ROADMAP.md`；代码将放 `world/`（服务器版 `/world`），用自带的 Three.js，不引框架不走 CDN。`room/` 是 CSS 3D 样机，版本 2 第 3 步做完后归档。
- 设计稿在 claude.ai 的画布里（见 `design/BRIEF.md` 的链接），那是讨论用的，不是代码。
