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
- 运行外部克隆的代码需要用户加一条权限规则（自动模式分类器拦"外部代码"），见 STATUS 未决问题。

## 阶段一的目标样本

- 箱子：`data/hd/objects/chests/arcane_chest_1/model/torso_lod0.model` + 同目录贴图三件套
- 帐篷：`data/hd/env/model/act1/town/act1_town_tents/act1_town_tent02_canvas_a/`
- 角色部件：`data/hd/character/player/barbarian/rarm_hvy_lod0.model`（右臂重甲，LOD 0）

## 记录

- 2026-11-01 立项；护栏落地（目录、校验）；.NET 8 装到 ~/.dotnet、LSLib 克隆并试编译 → 两处卡死后判定 LSLib 路线排除；找到并审阅 WindyYam 转换器；运行待授权。
