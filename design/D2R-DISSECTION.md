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

---

# 第二部分 · 深拆：流程、图像、摆放、资产、动作、装备（2026-11-01）

依据：从封包取出的样本 —— `towne1.ds1`（第一幕城镇地图）、`floor.dt1`（地砖瓦片集）、`act1_town_tents/`（11 顶帐篷的全部文件）、`character/player/barbarian/`（128 个文件）、`chars/ba/cof/`（150 个旧版动作文件）、`items/weapon/sword/long_sword*`、`armor.txt`，加第一部分已读的表与预设。数字都是数出来的。

## 9. 设计与制作流程（两代合起来看）

**2000 年原版（Blizzard North）的流程**，从文件倒推：
1. 设计师在 Excel 里写表（objects、levels、monstats、skills、treasureclass……几十张），导出成 txt，游戏直接读。平衡、掉落、技能全是改表不改代码。
2. 美术在三维软件里建模型，**预渲染成固定视角的二维精灵**：地图砖块一块 160 × 128 像素（`floor.dt1` 144 块全是这个尺寸），角色每个部件每个动作每个方向一套帧（DCC），8 位调色板。三维只在制作期存在，游戏里跑的是二维。
3. 关卡设计师用自家编辑器摆 DS1 地图：一个格网，几层瓦片加一张物件列表。固定区域手摆，随机区域由 DRLG 按 `lvlprest`、`lvlmaze`、`lvlsub` 的表把预设块拼起来。
4. 核心循环先可玩再堆内容；Battle.net 联机与反作弊是后期大头。

**2021 年重制版（Vicarious Visions）的流程**：
1. 原版逻辑一字不改，当"设计真值"：格网、碰撞、物件表、掉落、关卡拓扑全部沿用。
2. 美术按区域做套件：高模雕刻 → 低模 → 烘法线 → PBR 贴图（颜色、法线、遮蔽粗糙金属三件套，主力 1024）→ 自动 5 级 LOD → 碰撞体 → 需要的加骨骼与布料。
3. 环境美术在三维编辑器里按 DS1 一比一摆预设 JSON（实体-组件），每张 DS1 对应一个同名预设；再加原版没有的东西：局部光、粒子、贴花、发声器、墙透明。
4. 灯光师按区域 × 时段写 vis；角色美术重做每个职业的部件模型与动画，但状态机的状态名、武器类、模式编号全部对齐原版（见第 13 节）。
5. 一键切回原版画面做对照验收。

**两代共同的精髓**：数据先于画面；画面是可整体替换的皮；一切资产按套件、按格网、按部件拆；固定镜头换来资产只做看得见的面。

## 10. 图像是怎么做出来的

- **原版**：三维模型在制作端按固定的等轴测镜头渲染成精灵，放进 DT1 瓦片集和 DCC 动画帧；游戏里只是按格子贴图片、按深度排序。光是画死在精灵里的，加一层简单的调色板明暗。这就是为什么它 2000 年的画面今天看仍有"手工感"：每一块砖都是美术渲染好的。
- **重制版**：真正的实时三维。壳与道具是 PBR 模型，光是 vis 文件里的方向光加场景里的点光聚光，再加雾、泛光、调色 LUT；角色有独立三点布光加脚下光圈。原版的精灵只剩下按 G 键切换时用。
- **对我们**：我们走的是重制版的路，但有一处要学原版——**把光画进贴图（烘焙）**，只留两三盏实时光。这是手机能跑的前提，也是原版"手工感"的来源。

## 11. 摆放是怎么做的

`towne1.ds1`（版本 18）：57 × 41 格，第一幕，墙层 2、地层 1、影层 1。它引用 9 个瓦片集（树丛、石墙、城镇地面、桥、传送点、河、城镇物件、栅栏、野外物件）。每一格 4 字节一层：墙层记瓦片编号与朝向（391 格有墙），地层 14 格有特殊地面，影层 4 格。最后是**物件列表 43 条**：每条 `(类型, 编号, x, y)`，类型 1 是 NPC / 怪物预设、类型 2 是 objects 表里的物件，坐标是子格（一格 5 × 5 子格）。

要点：
- 地图 = 格网上的几层瓦片 + 一张物件列表。瓦片管"地和墙长什么样"，物件表管"能点的东西在哪、是什么"。
- 瓦片集是**套件**：`floor.dt1` 里 144 块 160 × 128 的地砖，朝向 0 全是地面；墙的瓦片集按朝向分左墙、右墙、角、门、屋顶（朝向 15 是屋顶，这就是进屋整层去掉的那层）。
- 固定地图手摆，随机地图由表驱动的生成器把预设块拼起来；城镇是手摆的。
- 重制版的预设 JSON 与 DS1 同名一比一，在此之上加光、粒子、贴花、墙透明。

**对我们**：我们的 rooms + presets + placements 正是这个结构：rooms 是格网与槽位（瓦片层），presets 是固定布局（手摆的城镇），placements 是用户摆的物件列表（类型 + 坐标）。少的是"瓦片集"的概念 —— 我们该把院墙段、篱笆段、地面材质块做成可拼的套件，而不是一整面墙一个模型。

## 12. 图像资产是怎么组织的（以帐篷为例）

`act1_town_tents/` 126 个文件：11 顶帐篷与篷布变体，每件 **5 级 LOD 模型**（lod0 到 lod4），会飘的篷布另有 **cloth 文件每级一份**（35 个）和**骨骼**（11 个）；贴图在 `env/texture/` 里按同名目录放 `_alb / _nrm / _orm` 三件套。一个长剑：5 级 LOD 模型 + 四张贴图（颜色、法线、遮蔽粗糙金属、遮罩）+ 一个 `long_sword.json` 定义文件（根实体挂掉落物的公用骨架与附着变换，模型实体挂模型与特效）。

规矩可以直接抄：
- 一件资产一个目录：模型（多级 LOD）、碰撞、骨骼、布料、贴图三件套、一个定义 JSON。
- 贴图 1024 为主、512 为辅，极少 2048。
- 变体是同目录下的 a / b / c / d 后缀，预设里用带权重的变体组件随机取。
- 能动的东西（篷布、路灯）带骨骼与布料，静的不带。

## 13. 人物与动作是怎么做的

**原版**：角色是**部件拼的**。`chars/ba/` 下按部件分目录：hd 头、tr 躯干、lg 腿、ra / la 左右臂、rh / lh 左右手持物、sh 盾、s1 / s2 特殊件；每个部件下是每个动作模式 × 每个武器类的动画帧。`cof/` 目录 150 个文件决定"某动作某武器类下各部件怎么叠"，文件名就是 `ba` + 模式 + 武器类：模式有 nu 站立、tn 城镇站立、wl 走、tw 城镇走、rn 跑、a1 / a2 攻击、sc 施法、th 投掷、kk 踢、bl 格挡、gh 受击、dd / dt 死亡、s1 到 s4 技能；武器类有 hth 空手、1hs / 1ht 单手挥 / 刺、2hs / 2ht 双手、1js / 1jt / 1ss / 1st 单手加盾或双持、stf 杖、bow 弓、xbw 弩。**换装备不换模型，换的是部件图层**。

**重制版**：一个职业一个骨骼（`barbarian.skeleton`），**状态机 65 个状态**（PMODE_NEUTRAL、WALK、RUN、TOWNNEUTRAL、TOWNWALK、ATTACK1 / 2、BLOCK、CAST、THROW、KICK、SKILL1 到 4、GETHIT、DEATH、KNOCKBACK、旋风斩这类序列……），**440 条动画**，每个状态按武器类绑动画：hth、1hs、1ht、2hs、2ht、1js、1jt、1ss、1st、stf、bow、xbw，还有踢技专用的 ht1 / ht2。身体模型按部件分：head、torso、legs、rarm、larm、special1、special2，**每个部件三档外观 lit / med / hvy**（轻中重甲），每档 5 级 LOD；贴图按部件三件套。状态名和武器类与原版 COF 一一对应，所以原版逻辑能直接驱动新骨骼。

**对我们**：
- 一个基础骨骼，一张状态机表（我们的物件表已经是三态状态机，角色照样做一张）：站立、走、坐下 / 起身、取书、翻书、摸猫、张望、浇水。
- 换装按它的办法：身体分部件，每个部件几档外观，**换装 = 换部件模型，不换骨骼不换动画**。
- 动画按"状态 × 手持物"绑：拿书、拿灯、空手，各一套上半身动作，下半身共用。这比每件东西一套动画省一个数量级。

## 14. 装备是怎么做的

- **表**：`armor.txt` 里管外观的列有 `component`（这件装备属于哪个部件槽）、`rArm / lArm / Torso / Legs / rSPad / lSPad`（穿上后各部件用哪一档外观：0 轻 1 中 2 重）、`invfile / uniqueinvfile / setinvfile`（背包图标）、`flippyfile`（掉在地上的动画）、`invwidth / invheight`（占背包几格）、`type`、`gemapplytype`。武器表同理加 `1hs / 2hs` 这类武器类。
- **穿在身上**：不是给每件装备做一个穿着模型，是**装备决定每个部件用哪一档**，部件模型只有三档。几百件装备 × 七个职业，靠三档乘部件数就覆盖了。
- **拿在手里**：武器是独立模型，按武器类附着到手部插槽（长剑 json 的 OverrideAttachmentTransform 就是附着偏移），掉在地上用公用的掉落物骨架和 flippy 动画。
- **图标**：背包与地面图标是二维精灵（`global/ui/items/*.sprite`），和三维模型分开做。

**对我们**：商店里的服装与饰品走同一套：一张 `items` 表加三列"部件、档位、手持物"，角色部件模型只做少数几档；书、灯、杯是手持物按插槽附着；卡片上的图标单独出二维图，不从三维截。

## 15. 这一轮对我们流程的修正（在第 7 节清单之上）

| 新学到的 | 我们怎么改 | 什么时候 |
|---|---|---|
| 地图 = 瓦片层 + 物件列表；瓦片集是套件 | 院墙段、篱笆段、地面块做成可拼的套件（0.5 米或 1 米模数），rooms 表加"瓦片层"：地面材质块与墙段的编号网格；预设只放物件 | M1 第 3 天起 |
| 一件资产一个目录 + 定义 JSON | `world/packs/<包>/<类>/<id>/` 下放模型、碰撞、贴图三件套、`<id>.json`（实体-组件定义）；资产导入命令生成这个目录 | M1 工具 |
| 5 级 LOD、1024 为主 | 我们两级，近 3000 面远 500 面；贴图 1024 为主 | M1 工具 |
| 会动的带骨骼布料，静的不带 | 帘、灯、树叶用程序正弦，不上布料物理 | — |
| 角色：一骨骼、一状态机表、部件三档、动画按手持物绑 | 角色表 `characters.json`：骨骼、部件清单与档位、状态 × 手持物的动画绑定；换装只换部件 | M2 |
| 装备：表决定部件档位，武器按插槽附着 | `items` 表加 `component / tier / holdable` 三列；手持物插槽表 | M2 |
| 固定镜头只做看得见的面 | 屋顶独立层进屋整层隐藏；近侧院墙降矮；所有室内完整建 | 营地切片 |
| 原版的"光画进精灵" | 烘焙为主、三盏实时光为辅不变 | 灯光第一轮 |

## 16. `.model` 容器与顶点格式（2026-11-01，从文件与 WindyYam 的格式笔记对照）

**容器**：Granny 2 的 GR2，版本 7，64 位小端。16 字节魔数，头 456 字节，8 个数据段（每段 44 字节头：压缩类型、文件内偏移、压缩后与解压后大小、对齐、16 位区与 8 位区起点、重定位表、混合封送表）。我们拆的 261 个样本里 522 个非空段**全部**是压缩类型 4 = BitKnit2（流以 `B1 75` 开头）。重定位表与混合封送表也各自 BitKnit2 压缩。CRC 是从段表起到文件尾的 CRC32。

**内容**：根是 `FileInfo`，下面 ArtToolInfo（Maya 2018，UnitsPerMeter 3.28084，也就是英尺，Y 向上）、Textures（贴图路径表）、Materials（Maya 着色图的倾倒）、Skeletons、VertexDatas、TriTopologies、Meshes、Models、ExtendedData。动画不在这里，在同目录的 `.animations`；骨骼有独立的 `.skeleton`。一个 `.model` 文件就是一级 LOD（文件名 `_lod0` 到 `_lod4`）。

**顶点布局**（每个网格一份）：

| 成员 | 存法 | 还原 |
|---|---|---|
| 位置 | 4 × int16 | xyz ÷ 32767 × 网格 ExtendedData 里的 VertexScale（整模最大坐标），w 填充 |
| 骨重 | 4 × uint8 | ÷ 255，四权和为 255 |
| 骨索引 | 4 × uint8 | 查 Mesh.BoneBindings → 骨名 → 骨架 |
| 法线 | 4 × int8 | ÷ 127 |
| 切线 | 4 × int8 | xyz ÷ 127，w = ±127 是手性 |
| UV0 | 2 × half | Maya 的 V 向上 |

索引是 uint16 三角列表，按材质分组（MaterialIndex / TriFirst / TriCount）。每根骨带一个骨骼局部空间的包围盒（OBBMin / OBBMax），用于剔除与碰撞。

**对我们的意思**：
- 他们把顶点压到 16 字节位置 + 4 法线 + 4 切线 + 4 UV + 8 蒙皮 = 每顶点约 36 字节；我们走 glTF 用 Draco 或 meshopt 的量化（`gltf-transform quantize`），效果等价，不自造格式。
- "一级 LOD 一个文件"而不是一个文件装五级：按需加载远近，正好对应我们"近 3000 面远 500 面"两个文件。
- 贴图三件套的路径写在模型里（Textures 表），材质图是工具倾倒不是运行时用的：运行时靠定义 JSON 里的材质槽，与第 12 节一致。我们的 `<id>.json` 的 Model 组件照这个只记模型文件与贴图槽。
- 解 BitKnit2 的开源实现（WindyYam 的 carbon_granny、pybg3、maclarian）都是纯净室写的，MIT 或同类许可；LSLib 不行，它要 granny2.dll。
- 贴图三件套实测（2026-11-01 三件资产）：alb 1024 sRGB（格式 62）、nrm 1024 线性（61）、**orm 只有 512**（61）；角色另有 mask 1024。ORM 通道 R 遮蔽 / G 粗糙 / B 金属（帐篷布 B 恒 0）。材质记录着色器名：StandardMaterial、StandardColor（角色带 mask）、AlphaThresholdMaterial；布类双面并带 BackscatterTexture。复现图见 studio/REHEARSAL.md 阶段一。

## 17. 预设与预制体的数据（2026-11-01，towne1.json 与 pf_town_tent02 / pf_town_campfire01 实读）

- **预设**：`type: Preset`，顶部 `dependencies`（模型 363、贴图 954、骨骼 9、粒子 5、物理 20），`terrain`（一个带 terrain.model 的实体），`biomeFilename`，`perTileBiomeOverrides`，`specialTiles`，然后 `entities` 1639 个。实体只有 `name / id / components`。
- **16 种组件**：Transform（位置英尺、四元数、缩放、inheritOnlyPosition）、Model（filename、visibleLayers、lightMask 19、shadowMask 3 或 0、ghostShadows、floorModel、terrainBlendMode）、ModelPlatformTier（visibilityTier、shadowTier，-1 到 3）、PhysicsBody（static、盒 fixture、filter "wall"）、WallTransparency（drawOrder、wallTileLocalCoord）、AudioEmitter、Vfx、ModelVariation（variations 带 weight）、PrefabPlacement（prefab 路径）、TerrainStamp（mask、stomp、biomeName、layerIndexR/G/B）、TerrainDecal（albedo/normal/orm、parallax、layerIndex）、SpotLight（color、power、angle、distance、attenuation、shadowCaster、lightMask）、PointLight（color、power、radius、attenuation）、Skeleton、PhysicsCloth、PhysicsPartialRagdoll、Terrain。
- **预制体**：`type: Prefab`，同样的 dependencies + entities，坐标相对预制体原点。帐篷二号 88 个实体（模型 69、贴花 17、点灯 1、聚光占位 1、印章 1、布 2）；篝火 147 个（模型 144、贴花 2、印章 1，没有灯）。城里 7 个预制体全在整数或半整数坐标、朝向 0。
- **生物群系**（act1_outdoors.json）：6 个时段的 vis 文件、IBL 立方图、瓦片遮罩、按画质档四套地形数据，每套 10 个地面层（path、moss、mud、grass、puddle、riverbank），每层 albedo / normal / orm / noise / 草贴图 / 杂物清单（模型、密度、缩放、下沉、随机转角）/ 噪声尺度 / 高度混合阈值 / 视差。
- **vis**（act1_outdoors_day 对 night）：一个后期实体（曝光 4.0 不变；深度雾色白→蓝灰、密度 .5→.15；IBL .4→.1；角色影子 .9→.7；主光俯角 45→40；角色亮度系数 .4、物品亮度系数 2.0、玩家光 2000、单位光 500；LUT default）+ 8 个灯实体（主光功率 13.5→4.5、色 1 .94 .87→.42 .45 1；其余是分 lightMask 的补光、边光、角色光，功率 0 到 30）。
- 复现图与对我们的改动见 studio/REHEARSAL.md 阶段二。

## 18. vis 六个时段的数值（act1_outdoors，2026-11-01 实读）

| 时段 | 曝光 | IBL | 主光色（线性） | 主光功率 | 俯角 / 方位 | 角色影 | 深度雾色 | 雾密度 |
|---|---|---|---|---|---|---|---|---|
| dawn1 | 4.0 | .10 | .76 .83 1.0 | 4.0 | 47° / 7° | .67 | .15 .15 .19 | 0 |
| dawn2 | 4.0 | .40 | 1.0 .86 .48 | 5.0 | 47° / 15° | .90 | .38 .42 .49 | .40 |
| day | 4.0 | .40 | 1.0 .94 .87 | 13.5 | 47° / 40° | .90 | 1 1 1 | .50 |
| dusk1 | 4.0 | .65 | .89 .59 .68 | 5.0 | 47° / 45° | .90 | .5 .5 .5 | .50 |
| dusk2 | 4.0 | .20 | .31 .28 1.0 | 6.0 | 47° / 50° | .80 | .77 .56 .61 | .30 |
| night | 4.0 | .10 | .42 .45 1.0 | 4.5 | 47° / 52° | .70 | .30 .37 .50 | .15 |

每个 vis 文件 = 一个后期实体（上表加 LUT default、泛光阈值 1.0、角色亮度 .4、物品亮度 2.0、玩家光 2000 衰减 5.5、单位光 500 衰减 5、风向风速）+ 8 盏方向光：世界主光（mask 9，唯一投影）、世界补光与背光（功率 0）、玩家主光 30 / 补光 4 / 背光 0（mask 68 / 4）、怪物补光 30 / 背光 4（mask 74 / 10）。俯角六个时段一律 47 度，只转方位：太阳从东（7°）走到西（52°）。复现与映射曲线见 studio/REHEARSAL.md 阶段三与 TECH-NOTES 卡十二。

## 19. 角色状态机与动画时间线的数据（2026-11-01，barbarian_state_machine.json 与 combined.timelines 实读）

- **状态机文件**：`type: AnimationStateMachine`，`unitType` UNIT_PLAYER / UNIT_OBJECT，三张表：`animations`（名 → 文件，野蛮人 440 条）、`states`（65 条：name、stateId、modeId、loopCount 0 停 1 播一遍、audioId、skillIndex、stepIndex、animationBindings、enterEvents / exitEvents 全空、exitBlendType）、`transitions`（每个状态一组，组里 65 条 to + crossfadeSeconds）。
- **绑定**：`animationBindings` 的键是手持物类（hth 徒手、1hs / 1ht 单手剑 / 单手挥、2hs / 2ht 双手、1js / 1jt / 1ss / 1st 持盾变体、stf 杖、bow、xbw 弩、ht1 / ht2 双持），值是动画名数组；动画名 = `<类>_<模式>`。PMODE_NEUTRAL 等 20 个有名字的状态对应原版的 COF 模式，其余 45 个是技能序列（modeId 18 / 100）。
- **转移**：全连通 4225 条，淡接 0.2 秒占 91%，其余 0 / 0.01 / 0.05 / 0.07 / 0.1 / 0.3。
- **时间线**（combined.timelines，JSON）：每条动画一条，`duration`、`timeStep` 1/30、`animationEvents`：PlaySoundByCategory 329、PlaySoundById 289、SpawnFootprint 146、AnimationReleasePoint 31、ChangeEquipmentLayerWeight 20、StartUnitSkillStep 18、SpawnVFX 2、DisableTwoHandAttach 2；时长 0.23 到 7.47 秒，中位 0.63。
- **物件**：宝箱 Neutral / Operating / Opened 三态三动画，淡接 0.01，全连通；门多一个备用态，淡接 0.2。
- **文件**：`<角色>_state_machine.json` 与 `_shell.json`（37 态无动画表的低配壳）；`animation/combined.animations`（GR2 曲线，6.5 MB）与 `combined.timelines`；`skeleton/<角色>.skeleton`（GR2，167 骨）；部件 `<部位>_<档>_lod<n>.model` 各自带整副骨架。
- 装配复现与对我们的表见 studio/REHEARSAL.md 阶段四；表的落点 `world/data/characters.json`。
