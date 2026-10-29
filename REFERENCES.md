---
type: references
project: yanxilu
last_scan: 2026-10-28
---

# 已有方案与参考

## 结论（先看这里）

- 可直接复用：Three.js（引擎，自带进 vendor）；gltf-transform 做 Draco / KTX2 压缩；Kenney、Kay Lousberg 的 CC0 低多边形家具包做灰盒；版本 1 已有的 canvas 书脊 / 盒面 / 牌背绘制逻辑直接当三维贴图。
- 值得借鉴：kriss.ai 的"一个 URL 一间房、总览是剖面"的结构和"说明卡片贴在屏幕边上不进三维"；Bruno Simon 的"光照烘焙进贴图、场景里不放实时光"；igloo.inc 的"一种材质、UI 画在场景里、装饰承担信息"。
- 我们的差异点：参考站的房间内容是写死的，我们的每间房由个人数据生成并每天变化（几百本书、几十个盒、几百张牌、会长的植物）；参考站是看一次的展示页，我们是每天用的工具；材质宇宙是纸木墨铜而不是黏土或冰。
- 是否应该放弃自研：不放弃。没有现成产品同时满足"数据驱动的房间 + 可换风格 + 自托管 + 国内可用"。但三维资产不自研：建筑和家具用 CC0 套件起步，再决定是 Blender 手工还是 AI 生成。

## 检索记录

| 日期 | 渠道 | 查询词 | 结果概述 |
|---|---|---|---|
| 2026-10-28 | 实地（Chrome） | igloo.inc 首页；kriss.ai 首页、/home/overview、三间房 | 两站都看完整，截图在会话里，不入库 |
| 2026-10-28 | WebFetch | Awwwards 两篇案例研究 | 拿到两站技术栈和制作流程 |
| 2026-10-28 | GitHub | three.js room portfolio / isometric room threejs / react-three-fiber room / my-room-in-3d / threlte / needle-engine / babylon.js / awesome threejs / gaussian splatting web viewer / 3d-portfolio topic | 房间类成品多是作品集，可用的只有 Bruno Simon 和 flo-bit 两个；引擎层 three.js 一家独大 |
| 2026-10-28 | WebSearch | kriss.ai case study；3D room scroll-driven websites；Rooms.xyz；Bruno Simon baked lighting；three.js 国内移动端 glTF Draco KTX2；AI 3D 生成 Tripo Meshy Hunyuan3D | 国内微信浏览器 WebGL 的专项资料没搜到，要自己实测 |
| 2026-10-28 | brain 查重 | three.js / webgl / spline | 只有 3DGS 商业图景对话和微缩IP的 Godot 丹房原型沾边，没有重复项目 |

## 条目

| 来源 | 是什么 | 可借鉴 | 不适用的原因 | 结论 |
|---|---|---|---|---|
| https://www.igloo.inc/ 与 https://awwwards.com/igloo-inc-case-study.html | Pudgy Penguins 母公司落地页，Abeto × Bureaux；Three.js + three-mesh-bvh + Svelte + GSAP + Vite，Houdini / Blender 建模 | 一种材质做到极致；滚动驱动镜头与生长时间线；UI 用 WebGL 画在场景里；低端机持续实测；开场用代码生成不用视频 | 只有三章的展示页，专业图形团队，自研工具链；我们每天用、无美术 | 借鉴 |
| https://kriss.ai/home/overview 与 https://www.awwwards.com/case-study-ai-with-a-human-touch-the-new-face-of-kriss-ai.html | 牙科 AI 助手官网，Studio 28K；OGL + Svelte 5 + Blender + PayloadCMS + Cloudflare。2026-10-28 深拆见 `design/KRISS-ANALYSIS.md`：单文件 29 MB 场景、KTX2 贴图、全烘焙 lightmap 无实时阴影、透光玻璃、长焦 3/4 俯视、2 到 2.8 秒 inOutCubic 镜头、待机呼吸、房色系统 | 房间即单元、楼即总览、一个 URL 一间房；厚度 + 圆角 + 剖切面；烘焙光；镜头在房外看进去；每房一色 UI 跟随；卡片贴边；先草图再三维 | 八间房内容写死；黏土粉彩风与我们材质宇宙不同；29 MB 首包我们不许；OGL 生态薄 | 借鉴（方法样板，不抄风格） |
| https://github.com/brunosimon/my-room-in-3d | Bruno Simon 的个人房间，Blender 建模 + 烘焙光照 + Three.js，4.5k 星，2021 | 烘焙进贴图、场景无实时光是网页上"一间房"好看又跑得动的标准做法 | 单间、静态、无数据 | 借鉴（渲染路线） |
| https://github.com/flo-bit/room | Svelte + Threlte 的小房间编辑器，存到 Bluesky 账号，MIT，89 星 | 用 Kenney / Kay Lousberg CC0 套件快速起步；摆放偏好单独存 | 用 Svelte；功能是自由摆家具，不是数据生成 | 仅参考（资产来源可抄） |
| https://rooms.xyz | 体素风房间搭建 + Lua 小游戏，a16z 投，Apple 设计奖 | "房间是舞台，物件是道具"的定义；每个物件可编程 | 用户生成内容平台，体素风，闭源 | 仅参考 |
| https://github.com/img2threejs/img2threejs | 把参考图重建为纯代码的程序化 Three.js 模型，19.6k 星，Apache-2.0 | 数据驱动的物件（书、盒、牌、叶）走程序化几何而非模型文件 | 面向单件物体重建，不是场景 | 借鉴（程序化思路） |
| https://github.com/mrdoob/three.js | WebGL 引擎，117k 星，MIT | 引擎本体；GLTFLoader / DRACOLoader / KTX2Loader / InstancedMesh | 无 | 采纳 |
| https://github.com/threlte/threlte | Svelte 的 Three.js 框架，3.4k 星 | 无 | 要引入 Svelte 全套 | 排除 |
| https://github.com/pmndrs/react-three-fiber | React 的 Three.js 渲染器，33k 星 | 无 | 要引入 React 全套；现有代码无框架 | 排除 |
| https://github.com/needle-tools/needle-engine-support | Unity / Blender 到网页的引擎，带云部署 | Blender 直出网页的流程值得看一眼 | 绑定 Needle 云与许可证，国内访问不可控 | 排除 |
| https://github.com/BabylonJS/Babylon.js | 全功能网页 3D 引擎，26k 星 | 无 | 体积大，物理 / 多人我们用不上 | 排除 |
| Spline、PlayCanvas、Godot 网页导出 | 云编辑器或重运行时 | 无 | 云依赖或 30 MB 运行时，手机开不动 | 排除 |
| https://kenney.nl/assets 与 https://kaylousberg.itch.io/ | CC0 低多边形家具与房间套件 | 灰盒阶段的建筑与家具 | 风格偏卡通，正式版要替换 | 采纳（灰盒阶段） |
| Tripo / Hunyuan3D 2.1 / TRELLIS.2 / Meshy | AI 文生图生三维，出 glb | 中式家具小件的候选来源 | 拓扑脏，要 Blender 减面展 UV | 待看（第 3 步前试一件） |
| https://threejs-journey.com/ | Bruno Simon 的 Three.js 课程，含 Blender 烘焙章节 | 烘焙流程教材 | 付费课 | 仅参考 |

<!-- 结论四选一：采纳 / 借鉴 / 仅参考 / 排除 -->

## 待看

- 微信内置浏览器（X5 内核）的 WebGL 2 内存上限与 KTX2 支持情况：没搜到资料，第 1 步做完直接在用户手机上实测。
- `1-Projects/微缩IP全生态` 的 Godot 丹房原型：看一眼它的资产怎么做的，有没有能借的建模经验。
- igloo.inc 的 three.js 论坛帖 https://discourse.threejs.org/t/landing-site-igloo-inc/67249 。
