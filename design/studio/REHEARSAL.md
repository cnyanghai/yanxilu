# 排练：用暗黑 2 重制版的资产走一遍它的生产流程

2026-11-01 用户定：先完整地用暗黑 2 的生产思路和资产，把游戏的生产流程模拟一遍，学会了再自建。本页是排练的计划、护栏和记录。

## 护栏（不可商量）

1. 暗黑 2 的任何文件（解包原件、解出的贴图、转出的模型、截图）只放 `tools/out/d2r_local/`，该目录被 `tools/.gitignore` 的 `out/` 忽略，永不入库。
2. `tools/tables_check.py` 检查所有已跟踪的 `world/ design/ tools/` 文件：出现 `d2r_local` 字样即报错（本页、STATUS 与校验脚本自身除外），防止表或代码指向这些文件。
3. 排练用的代码（解码器、转换器、本地路由）可以入库，因为那是我们写的或 MIT 的；喂给它们的数据不入库。
4. 排练结束的交付物是《研习录生产流程 1.0》和一组自己的资产；届时 `tools/out/d2r_local/` 整个删掉。
5. 不发布：Baba 上不出现任何排练产物。本地看效果用 `tools/baba_mock.py` 加一条只认本机目录的路由。

## 四个阶段

| 阶段 | 做什么 | 学到什么 | 产出 |
|---|---|---|---|
| 一 资产解包导入 | 一只箱子、一顶帐篷、野蛮人一件部件：.model 转 glTF，配上解码的 albedo / normal / orm 三件套，在 three.js 里本机渲出来 | 他们一件资产的完整形态：LOD、顶点压缩、贴图三件套、定义 JSON 的字段 | 本机截图；`asset_import.py` 对照他们补字段 |
| 二 预设摆放 | 读 towne1 的实体 JSON：变体、墙透明、灯、生物群系；在我们的 rooms / presets 表里复刻罗格营地一角的摆法 | 预设怎么写、变体怎么选、哪些是表哪些是代码 | presets 表的字段修正；摆放编辑器的动作清单 |
| 三 光与后期 | 把 act1 town 的 vis 数值搬进我们的 vis 表看效果；对比他们的 LUT 与雾 | 光的参数有哪些、量级多少、分时段怎么过渡 | vis 表字段与数值范围定稿 |
| 四 角色与交互 | 野蛮人骨骼与状态机、门与箱子的三态 | 一骨骼多部件、状态 × 手持物的动画绑定、交互物件状态机 | characters 表与交互状态机的外形 |

每阶段结束写一段"学到的与改的"到本页，再对 `D2R-DISSECTION.md` 第 15 节的修正表核对一遍。

## 工具链（2026-11-01 的状态）

- 封包读取：CascLib（本机编译，`cascx list / extract`），存档在 D:\Game\AH2CZB。
- 贴图：`tools/d2_decode.py texture`（.texture 是 BC3，格式 61 线性 / 62 sRGB）。
- 模型：`.model` 是 Granny 2 的 GR2 v7 64 位容器，**所有 261 个样本的全部数据段都用 BitKnit2 压缩（压缩类型 4）**。
  - LSLib（Norbyte）的 Divine 走不通：它解 BitKnit2 要调 `granny2.dll`，而 D2R 把 Granny 静态链进了 `D2R.exe`，目录里没有这个 dll；LSLib 的 Linux 构建还卡在 Windows 专用的 GpLex / Gppg 预编译步骤。排除。
  - 走得通的是 WindyYam 的 Diablo2_Resurrected_Model_Converter（MIT，纯 Python + numpy，自带 carbon_granny 的 BitKnit2 纯净室解码器），`.model` 直转 `.glb`，还能把改过的几何写回。已克隆到 `~/.local/src/d2rconv`，代码过了一遍：除图形界面外无子进程、无网络。
  - 备用：pybg3 / maclarian（Rust）里也有 BitKnit 的纯净室实现。
- 运行转换器的权限规则：`.claude/settings.local.json` 只放行 `python3 -I /home/cnyanghai/.local/src/d2rconv/*`（用户 2026-11-01 放行）；`-I` 隔离模式不读用户 site-packages，目录里加了 `run.py` 把它加回来再转交。转换器打了一个两行补丁：没有骨重的静态网格（箱体）也能出 glb。

## 阶段一的目标样本

- 箱子：`data/hd/objects/chests/arcane_chest_1/model/torso_lod0.model` + 同目录贴图三件套
- 帐篷：`data/hd/env/model/act1/town/act1_town_tents/act1_town_tent02_canvas_a/`
- 角色部件：`data/hd/character/player/barbarian/rarm_hvy_lod0.model`（右臂重甲，LOD 0）

## 记录

- 2026-11-01 立项；护栏落地（目录、校验）；.NET 8 装到 ~/.dotnet、LSLib 克隆并试编译 → 两处卡死后判定 LSLib 路线排除；找到并审阅 WindyYam 转换器；用户放行。
- 2026-11-01 **阶段一完成**：箱子、帐篷布、野蛮人右臂三件转成 glb，配 BC3 解出的贴图在 three.js 本机渲出白天 / 夜晚，对照图 `tools/out/d2r_local/shots/contact_sheet_stage1.jpg`（本机）。

### 阶段一学到的与改的

| 看到的 | 数字 | 对我们的改动 |
|---|---|---|
| 单位是英尺（UnitsPerMeter 3.28），Y 向上 | 箱子 0.71 × 0.69 × 1.15 米，帐篷布 4.93 × 3.38 米，右臂 0.70 米长 | 我们已是厘米整数；导入时按文件里的 UnitsPerMeter 换算，不信文件名 |
| 一级 LOD 一个文件（`_lod0`…`_lod4`），同目录 | 箱子 LOD0 3962 三角，帐篷布 2923，右臂 3017 | 近 / 远两个文件，命名照抄 `_lod0` / `_lod1`；asset_import 出两档 |
| 贴图三件套的分辨率不一样：alb 1024 sRGB、nrm 1024 线性、**orm 512 线性**；角色多一张 mask 1024 | ORM 的通道：R 环境遮蔽、G 粗糙、B 金属（帐篷布 B 全 0，箱子包角与护手 B 高） | asset_shrink 加「ORM 半分辨率」；定义 JSON 的 Model 组件记三件套各自尺寸；角色留 mask 槽给染色 |
| 材质里写着着色器名：StandardMaterial（道具）、StandardColor（角色，带 MaskTexture）、AlphaThresholdMaterial（占位 / 镂空）；帐篷布双面 + BackscatterTexture（布背面透光） | 帐篷布一件 5 个材质 | 定义 JSON 加 `shader`、`doubleSided`、`backscatter` 三个字段，布类资产走双面 + 透光 |
| 箱子 = 静态箱体 + 蒙在 3 根骨头上的盖；帐篷布是 59 骨的布驱动；每个角色部件文件都带整副 167 骨 | — | 交互物件的活动部分（盖、门扇）走小骨架不走分件；角色部件共用一副骨架 |
| 「帐篷」这个 .model 只是帐篷布；杆、绳、地面是同目录别的资产，在预设里拼 | act1_town_tents 下十几个目录 | 套件拆件粒度照这个：布、杆、箱、货各一件，预设拼 |
| 金属度一读对，没有环境图就是黑的 | 箱子盖、护手 | 我们的 vis 表要带一张每时段的环境图（或天空渐变），不能只有三盏灯 |
| 解码器坑：texture2ddecoder 输出 BGRA | 皮肤 R 110 / B 175 → 修后 R 175 / B 110 | `tools/d2_decode.py` 已修，写进注释 |

下一步：阶段二 预设摆放（towne1 的实体 JSON：变体、墙透明、灯、生物群系）。

- 2026-11-01 **阶段二完成**：拆了 towne1.json（1639 实体、16 种组件）、两个预制体（帐篷二号 88 实体、篝火 147 实体）、户外生物群系（10 个地形层 + IBL + 6 个时段的 vis）、vis 白天与夜晚的全部字段；用 `d2r_prefab.py`（解包 → 转换 → 贴图 → 场景清单）加 `scene.html`（多模型多实例、点灯、档位开关）把帐篷二号整个预制体在本机摆出来：69 个实例、46 个模型、12.6 万三角，白天与夜晚各两张在 `tools/out/d2r_local/shots/scene_tent02_*.png`（本机）。

### 阶段二学到的与改的

| 看到的 | 数字 | 对我们的改动 |
|---|---|---|
| 一座城 = 一个预设文件 = 实体列表，每个实体 = Transform + 若干组件，没有别的结构 | towne1 1639 个实体、16 种组件；Transform 是位置（英尺）+ 四元数 + 缩放 | 我们的实体-组件外形是对的；Transform 加 `rot`（三轴度数）和 `scale` |
| 大东西是预制体：帐篷 = 帆布 ×3 + 支架 + 木板 ×5 + 桶、床、罐、瓶 + 草 + 压实泥 + 贴花 ×17 + 一盏点灯 + 一个空地印章，88 个实体打成一包，城里放一次 | 7 个预制体（帐篷 3、篷车 4、篝火 1），全部整数坐标、0 度朝向 | 加 `Prefab` 组件与 `packs/<包>/prefabs/`；营地切片按"预制体 + 零散"两层写 |
| 一半以上实体是植被与杂物：藤 322、草丛 143、湿石 134、木杂物 88 | 朝向 0 度占一半，直角占 1/5，其余自由角；缩放 60% 是 1，植被 0.5 到 0.8 | 摆放编辑器要有"自由角 + 15 度吸附"和缩放；散布工具比逐个摆更要紧 |
| 变体靠 `ModelVariation`（模型 + 权重），同一面墙 59 处各自随机 | — | 加 `Variation` 组件 |
| 墙透明挂在藤蔓上，不挂在墙上：靠 `wallTileLocalCoord` 绑到原版瓦片格 | 254 个全是植被 | 我们是 `Model.wallFade`，由房间瓦片层决定哪段淡出，不需要绑格 |
| 地面不是贴图而是三层：地形网格（terrain.model）+ 生物群系 10 个地面层（各带 albedo / normal / orm / 噪声 / 杂物清单与密度）+ 印章与贴花改层 | 河床印章 90 × 80 尺，鹅卵石贴花 16 尺，空地印章 50 尺 | tiles 表的地面层照"层 + 印章"改：地面块变成层编号网格，`Stamp` 改层、`Decal` 加污渍 |
| 光：vis 按时段给主光（白天功率 13.5 色 1 .94 .87 俯角 45；夜晚 4.5 色 .42 .45 1 俯角 40）、IBL 强度（.4 / .1）、深度雾色与密度（白 .5 / 蓝 .15）、角色影子深浅、物品与角色亮度系数；曝光白天夜晚都是 4.0 | 9 个灯实体，各带 lightMask 分别照世界 / 角色 / 物品 | vis 表加 `ibl`、`fogDepth`、`characterShadow`、`itemBrightness` 四项；曝光不随时段变，靠灯变 |
| 预制体里的局部灯：帐篷一盏点灯（色 1 .69 .43，功率 200，半径 25 尺），聚光灯占位功率 0 | 篝火预制体里没有灯，火光在 VFX 里 | 灯跟预制体走，不单独摆；篝火 = 模型 + 粒子 + 粒子自带光 |
| 特效与声音也是实体：雾 / 薄霭 / 飞虫 105 个，风吹树 / 水声 171 个 | — | 加 `Vfx`、`Audio` 组件；营地切片要摆雾与声 |
| 每个实体有硬件分档（visibilityTier / shadowTier，-1 到 3）、floorModel（贴地网格不投影）、lightMask 19 / shadowMask 3 或 0 | 分档 (0,1) 213、(0,0) 172、(0,-1) 162 | `Tier` 允许 -1；`Model.floor`；阴影按开关不按掩码 |
| 预设和预制体开头是依赖清单（模型 / 贴图 / 骨骼 / 粒子 / 物理），是预载表 | towne1 依赖 363 模型 954 贴图 | tables_check 生成 `dependencies`，不手写 |
| 坐标：城 567 × 462 尺 = 原版 57 × 41 格，一格 10 尺 = 3.05 米 | 我们一格 1 米、一格 25 厘米的摆放格 | 不改；营地切片按 3 米一个"大格"规划布局，细摆用 25 厘米 |

### 摆放编辑器的动作清单（从预设反推）

放置 / 删除、移动（25 厘米吸附 + 自由）、旋转（15 度吸附 + 自由、三轴）、缩放、变体重摇、预制体整包放置与拆包、贴花投影、印章刷层、散布（在遮罩内按密度撒植被杂物）、灯与雾与声的实体放置、每个实体的分档。

下一步：阶段三 光与后期（把 act1_outdoors 六个时段的 vis 数值搬进我们的 vis 表，对比 LUT 与雾）。
