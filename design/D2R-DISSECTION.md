# 暗黑 2 重制版 · 制作精髓拆解（2026-10-30）

用户授权后，在本机用开源的 CascLib 读了 `D:\Game\AH2CZB` 的封包，导出了数据表和一批配置文件来研究。只读、不入库、不用它的任何资产；导出的文件留在本机临时目录。研究目的是把它的做法拆开，统一进我们的制作流程（第 6 节）。

## 1. 盒子里有什么

- 封包 175,813 个文件，逻辑大小 57.7 GB。没有源码，可执行文件 32 MB。
- 两层：
  - `data/global/`（3.5 万个文件）：2000 年原版的那一层。364 个数据表（`excel/*.txt|bin`）、关卡拼块（`tiles/*/*.ds1 .dt1`）、角色与音效。**这是游戏本身**：规则、网格、碰撞、物件、掉落都在这里。
  - `data/hd/`（11.3 万个文件）：重制版加的三维表现层。环境模型 4.3 万、贴图 2.2 万、关卡预设 6 千、角色、物品、特效、界面。**这是皮**。
- 两层按名字一一对应：`tiles/act1/town/towne1.ds1`（二维拼块）↔ `hd/env/preset/act1/town/towne1.json`（三维预设）。按 G 键切回老画面能成立，就是因为逻辑层从没变过。

**对我们的意义**：数据层（`S.data`、以后的表）和表现层（风格包）必须像这样可以独立替换，这正是我们"风格包"决定的依据。

## 2. 数据表驱动：全游戏是六十多张表

规模（行 × 列）：sounds 11913 × 38、treasureclassex 1257 × 39、lvlprest 1093 × 23、monstats 752 × 273、missiles 736 × 172、**objects 588 × 147**、skills 429 × 322、weapons 307 × 170、levels 139 × 187、cubemain 227 × 106 ……

三张和我们最相关的：

**objects.txt（物件表）**：门、箱、祭坛、火盆、棺材、桶全在这一张表里，每行 147 列。结构是"8 个模式 × 一组属性"：每个模式有 Selectable（能不能点）、FrameCnt / FrameDelta / CycleAnim（动画帧）、Lit（自身发光）、BlocksLight、HasCollision、Start、OrderFlag；外加 IsDoor、Lockable、OperateFn / PopulateFn / InitFn / ClientFn（四个函数编号）、Parm0-4、Red / Green / Blue（光色）、AutoMap。举例：Door 的 IsDoor=1、OperateFn=8；chest 的 OperateFn=4、PopulateFn=3；Casket 1 / 1；Barrel 5 / 4。**交互不是代码里写死的门和箱子，是表里一个函数编号加一个模式状态机。**

**levels.txt（关卡表）**：每个关卡 187 列，其中有 Intensity / Red / Green / Blue（这一关的环境光）、Rain、Vis0-7（通向哪些关）、DrlgType（随机生成类型）、MonLvl、SizeX/Y。关卡的光在 2000 年就是表里的四个数。

**lvlprest.txt（预设表）**：预设名 → 一到六个 `.ds1` 拼块文件，Populate、Outdoors、SizeX/Y。`soundenviron.txt`：每关白天 / 夜晚的环境音、事件音、EAX 混响参数（Room Vol、Decay Time、Reflect）。`treasureclassex.txt` 掉落表、`cubemain.txt` 合成配方、`gamble.txt`、`automap.txt`。

**对我们的意义**：家具、槽位、商店物件、交互、每间房每种光、环境声，全部做成表（JSON 一行一件），代码只读表。我们已有 `items / inventory / placements` 的打算，还要加 `objects`（交互物件：状态、动画、操作函数名）、`rooms`（每间房的光与声）、`vis`（见第 4 节）。

## 3. 三维表现层：实体-组件 JSON

每个预设（一块地图）是一个 JSON：`dependencies`（这个文件需要的全部模型、贴图、粒子、物理、音频，预加载清单）+ `entities[]`。`towne1.json` 有 1639 个实体，每个实体是一组组件：

| 组件 | 作用 | 出现次数（towne1） |
|---|---|---|
| TransformDefinition | 位置、朝向、缩放 | 1638 |
| ModelDefinition | 模型文件、lightMask、shadowMask、floorModel、terrainBlend | 1413 |
| ModelPlatformTier | visibilityTier / shadowTier：按硬件档位决定显不显示、投不投影 | 687 |
| PhysicsBodyDefinition | 碰撞盒 | 407 |
| **WallTransparency** | 挡住角色的墙段变透明（就是我们的"遮挡淡出"） | 254 |
| AudioEmitter | 树上挂一个"风吹树叶"循环音 | 171 |
| VfxDefinition | 雾、飞虫、火的粒子 | 105 |
| ModelVariation | 带权重的随机变体（同一堵墙三种样子） | 59 |
| PrefabPlacement | 嵌套预制件（河岸预制件里又有 161 个实体） | 32 |
| TerrainStamp / TerrainDecal | 地形印章、地面贴花（碎石、泥） | 20 |
| SpotLight / PointLight | color、power、radius / angle、attenuation、shadowCaster、lightMask | 1 + 调色板里 5 到 9 盏 |
| PhysicsCloth / PartialRagdoll | 帐篷布随风、路灯会晃 | 3 |

另外三类文件：
- **交互物件**：一个目录一件，如 `objects/chests/arcane_chest_1/`：`model/torso_lod0..4.model`、`animation/*.animation`、`*_state_machine.json`。状态机只有三态：Neutral → Operating（loopCount 1）→ Opened，每态绑一个动画，带进入 / 退出事件。门同样是 Neutral / Operating / Opened。**交互物件 = 模型 + 动画 + 三态状态机 + 表里的函数编号。**
- **道具调色板**（`env/preset/prop_palette/<区域>.json`）：一个区域允许用的全部套件，兵营是 314 个模型、577 张贴图、605 个实体样例。这就是"套件"的正式形态。
- **群集**（`env/cluster/`）：一小块地形加一组灌木石头，按需撒在地图上。
- **生物群系**（`env/biome/<区域>.json`）：地形贴图层按四档画质各一套、环境贴图、这个区域的全部时段视觉文件列表。

## 4. 光：每个区域 × 每个时段一个 vis 文件

`env/vis/` 共 369 个文件：53 个区域 × day / night / dawn1 / dawn2 / dusk / desecrated。每个文件一个 `VisualDataComponent` 加九盏方向光。字段：

- `exposureValue`（曝光，白天室外 4.0）、`iblIntensity`、`gradingLutFile`（调色查找表，一张 dds）、bloom 三参数。
- 雾两套：深度雾与高度雾，各有颜色与密度；再加体积雾的风、搅动、颗粒。
- 九盏方向光分两组：`global_key / fill / back`（照环境）和 `player_key / fill / back`、`monster_fill / back`（**只照角色**，靠 lightMask 位分开）。角色有自己的三点布光，不受环境光影响，所以暗处角色也读得清。
- `playerUnitLightPower 2125、attenuation 5.5`：角色脚下那圈光的强度与衰减。`characterBrightnessFactor`、`characterContrastPoints`：角色单独调亮度对比。
- 室内（兵营）`global_key_light.power = 0`：**室内没有太阳，全靠放进场景的点光和聚光**（调色板里每间 5 到 9 盏，颜色 1.0 / 0.27 / 0 的炉火橙，power 300 到 3000，带阴影）。

同一座城白天与夜晚的差别只是这些数：

| | 白天 | 夜晚 |
|---|---|---|
| 主光 power | 50 | 3 |
| 主光颜色 | 0.94 / 0.93 / 0.69（暖黄） | 0.37 / 0.49 / 1.0（蓝） |
| 深度雾颜色 | 0.82 / 0.82 / 0.65 | 0.29 / 0.52 / 1.0 |
| 高度雾密度 | 1.0 | 0 |
| 环境贴图强度 | 0.3 | 0.1 |
| 角色影子深度 | 0.9 | 0.7 |

**对我们的意义**：这就是我们"三种光"该有的样子：一间房 × 一个时段 = 一个 vis 记录（曝光、主光、雾色、调色、角色光圈），夜晚不是把白天调暗，是换一组数；室内靠局部光，角色自己带光。

## 5. 资产规格：贴图密度与 LOD 的真相

- 贴图 2.2 万张，命名 `_alb / _nrm / _orm`（颜色 / 法线 / 遮蔽-粗糙-金属三件套），另有 flow、stamp、path、sss、thickness。
- 分辨率分布：**1024² 占 11,448 张，512² 占 7,291，≤256² 占 3,638，≥2048² 只有 7 张。** 一个木箱自己一套 1024 三件套（1.4 MB × 2 + 0.35 MB）。他们的像素密度不是靠大图集，是靠每件东西各自一张 1024。我们一间房共用一张 2048，这就是 205 像素 / 米的来历。
- 模型：自定义二进制；环境独立网格 8,232 个，**每个 5 级 LOD**（lod0 到 lod4 各 8,100 个）；物件按硬件档位决定可见与投影。
- 角色和物件都带骨骼、布料、部分布娃娃（路灯摇晃），脚印贴花按地面材质换。

## 6. 他们的制作流程（从文件反推）

1. 二维原版是设计真值：网格、碰撞、物件表、掉落、关卡拓扑全在表和 ds1 里，三维层不改它。
2. 美术按区域做套件（道具调色板）：每件独立模型 + 1024 PBR 三件套 + 自动 5 级 LOD + 带权重变体。
3. 关卡用编辑器摆预设 JSON：实体-组件，嵌套预制件与群集，地形印章与贴花补缝。
4. 灯光师按区域 × 时段写 vis 文件，再在场景里放局部光；角色有独立布光。
5. 声音按关卡表与物件上的发声器挂上。
6. 一切按硬件档位分级（可见档、阴影档、地形档、布料最低档）。
7. 每个文件自带依赖清单，用来流式加载与预载。

## 7. 统一进我们的流程：采纳清单

| 他们的做法 | 我们怎么做 | 代价 | 什么时候 |
|---|---|---|---|
| 数据层与表现层分离、按名对应 | 已是方向：`S.data` + 表 / 风格包；槽位名跨包一致 | 0 | 已定 |
| 一切是表 | 新增 `objects.json`（交互物件：状态、动画、操作函数名）、`rooms.json`、`vis.json`、`props.json`（每个包的道具调色板）；代码只读表 | 1 天 | 阶段 3 |
| 交互物件 = 模型 + 三态状态机 + 函数名 | 书、笔记本、门、箱、灯统一为 Neutral / Operating / Opened，操作函数：openReader、openNotebook、toggleLamp、pickUp、place | 随阶段 3 | 阶段 3 |
| vis：每房 × 每时段一组数 | 三种光改成 vis 记录：曝光、主光 power 与色、雾色、调色 LUT、角色光圈；夜晚是换数不是调暗；室内主光 0 靠局部光 | 1 天 | **验证剩下两天的第一件事** |
| 角色独立布光 + 自带光圈 | three.js 里角色单独一组光（layers 分层），脚下一盏点光 | 半天 | 阶段 3 |
| 每件 1024 贴图而非一张大图集 | 壳按面拆材质（每面墙、地板各一张 1024 到 2048），家具各一张 1024；贴图密度目标 ≥ 500 像素 / 米 | 半天改烘焙 | 验证剩下两天 |
| WallTransparency 按墙段 | 近墙按段淡出 | 随在场模式 | 阶段 3 |
| 道具调色板 / 套件 | 每个包一个 `props.json`：允许的模型与贴图清单 | 半天 | 阶段 4 |
| 带权重变体 | 书、盒、笔记本的随机变体表 | 0（已程序化） | — |
| 硬件档位 | 每个物件 visibilityTier / shadowTier；手机只显示 0 档 | 半天 | 阶段 3 末 |
| 5 级 LOD | 我们 2 级：近 3000 面、远 500 面，gltf-transform 出 | 0.5 天 | 阶段 4 |
| 物件上的发声器、布料摇晃、脚印 | 地方感第 4、6 条：灯摇、帘动、翻书声 | 阶段 4 后 | 阶段 4 后 |
| 依赖清单与预载 | 每个包一个清单，进房前预载 | 半天 | 阶段 4 |
| 掉落表、配方表 | 商店与舒适度做成表 | 随阶段 4 | 阶段 4 |

不采纳：写实 PBR 的材质方向（我们是手绘，但"颜色 + 法线 + 遮蔽"三件套的结构可以沿用，法线用低频）、二维网格逻辑（我们直接三维格子）、布料与布娃娃物理（成本高，灯摇用程序正弦代替）。

## 8. 对画质差距的直接证据

把第四天的分析用它的数字坐实：
- 我们的壳 205 像素 / 米，它一个木箱 1024 像素；差五倍以上。
- 我们的三种光是同一盏太阳换颜色；它白天主光 50、夜晚 3，雾色从暖黄到蓝，室内主光 0。
- 我们没有角色光；它角色自带 2125 的光圈加独立三点布光。
- 我们没有雾、没有调色 LUT、没有 bloom；它每个时段都有。
- 我们一间房五件家具；它兵营一个区域的套件 314 个模型。

所以顺序不变：先光（vis 结构 + 局部光 + 角色光），再贴图密度，再套件密度。
