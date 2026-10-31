# OpenRA 拆解：数据驱动的样板

- 来源：OpenRA 引擎源码（github.com/OpenRA/OpenRA，本地只读副本），协议 GPL-3.0。
- 用法：只读学习结构与规则，**不复制任何代码、资产、YAML 原文**进研习录仓库。
- 对应项目决定：「一切是表、代码只读表」+ 房间 / 院子摆放编辑器。

## 1. Trait 系统：不是 ECS，是「组件即 YAML 节点」

**结论：OpenRA 是 actor = 一袋 trait 的组合模式，不是 ECS（没有 System 按组件类型批处理，逻辑在 trait 自己里）。**

- 写法：`mods/ra/rules/*.yaml` 里每个 actor 一节，子节点名就是 trait 类名（`Power:`、`Sellable:`），再下一层是字段。同一 trait 多份用 `@` 加后缀（`Inherits@shape`、`Armament@secondary`）。
- 实例化：`OpenRA.Game/GameRules/ActorInfo.cs` 的 `LoadTraitInfo` 用反射找 `<名>Info` 类（`ObjectCreator.CreateObject`），`FieldLoader.Load` 把 YAML 字段填进 `public readonly` 字段，缺 `[FieldLoader.Require]` 的字段直接报错。运行时 `Actor.cs` 构造函数按 `TraitsInConstructOrder()` 调每个 `TraitInfo.Create(init)`，顺序由 `Requires<T>` / `NotBefore<T>` 接口做拓扑排序（`RequiresBuildableAreaInfo : Requires<BuildingInfo>`）。
- 通信：全靠接口。`OpenRA.Game/Traits/TraitsInterfaces.cs` 定义上百个 `INotifyCreated`、`INotifySold`、`ITick`、`IResolveOrder` 等，谁实现谁被广播：`self.TraitsImplementing<INotifySold>()`。查找用 `TraitDictionary.cs`（按类型分桶，`Trait<T>` / `TraitOrDefault<T>`）。
- 开关：`Traits/Conditions/ConditionalTrait.cs`。每个 trait 可带 `RequiresCondition: !build-incomplete && !being-captured`（布尔表达式），条件由各种 `GrantConditionOnXxx` 发 token（`Actor.GrantCondition / RevokeCondition`），表达式变了就 `TraitEnabled / TraitDisabled`。这是整个系统的「胶水」。

**对我们组件 JSON 的借鉴规则**：(a) 组件名即类型名，字段名即属性名，反射 / 查表装配，没有第二层注册代码；(b) 组件之间只通过「我实现了哪个接口」通信，不直接引用对方；(c) 组件可声明依赖，装配时排序并在缺失时报错，而不是运行时崩；(d) 用「条件字符串 + 布尔表达式」开关组件，比在每个组件里写 if 干净得多（舒适度 ≥ 3 → 授予 `cozy` 条件 → `Glow@cozy` 生效）。

## 2. 规则文件：继承、覆盖、默认值、条件

- 继承：`MiniYaml.cs` 的 `ResolveInherits`。`^` 开头是抽象模板（`^Building`），`Inherits:` 可多次（带 `@tag`），`-TraitName:` 删掉继承来的 trait，同名字段后者覆盖（`MergePartial`）。合并发生在**读 YAML 阶段**，trait 类看到的已经是扁平结果。
- 默认值：在 C# 字段初始化里（`RefundPercent = 50`、`Adjacent = 2`），YAML 只写差异。`Lint/` 目录 38 个检查器在启动 / CI 把表全部校验一遍（未知字段、引用不存在的 actor、条件没人授予等）。
- 版本迁移：`UpdateRules/Rules/<日期>/` 每次改字段名都附一条自动改写旧表的规则，玩家的地图 / mod 不会因引擎升级失效。
- RA 规模：约 420 个 actor、398 种 trait 名。`defaults.yaml` 里 64 个 `^` 模板承担了大部分复用。

**一个建筑（`structures.yaml` 的 POWR 电厂）展开后的 trait 分层**：
继承链 `^ExistsInWorld` → `^SpriteActor` → `^BasicBuilding`（`Building` 占地 + `RequiresBuildableArea` + `Targetable` + `Demolishable` + `MapEditorData` 分类）→ `^Building`（`RepairableBuilding` 可修、`Sellable` 可卖、`Capturable`、`SpawnActorsOnSell`、`GivesBuildableArea`）→ 自身：`Buildable`（队列、前置、图标顺序）、`Valued: Cost`、`Building: Footprint "xx xx ==" / Dimensions 2,3`、`Health`、`Armor`、`Power: Amount 100`、`ScalePowerWithHealth`、`ProvidesPrerequisite`。「可卖」「可修」「供电」各自一个 trait，建筑是否有这能力只看有没有这一行。

## 3. 建造与摆放：三层判定 + 预览即判定

- 数据：`Traits/Buildings/Building.cs` 的 `BuildingInfo`：`Footprint`（字符串画格子，`x` 占、`=` 可过、`_` 空）、`Dimensions`、`TerrainTypes`、`RequiresBaseProvider`、`AllowInvalidPlacement`；`RequiresBuildableArea.cs`：`AreaTypes` + `Adjacent`（离己方建筑几格内）；`Buildable.cs`：队列、前置、上限、建造时长。
- 判定三层（`Buildings/BuildingUtils.cs`）：`IsCellBuildable` 逐格查「地图内、无 actor 占用（`ActorMap`）、无建筑影响层（`BuildingInfluence`）、非斜坡、地形类型在白名单」；`CanPlaceBuilding` 对 footprint 全部格子取与；`BuildingInfo.IsCloseEnoughToBase` 扫 `Adjacent` 范围内有没有 `GivesBuildableArea` 的己方建筑，再看 `BaseProvider` 半径。
- 预览：`Orders/PlaceBuildingOrderGenerator.cs` 每帧对每个格子跑同一套判定，产出 `Dictionary<CPos, PlaceBuildingCellType>`（Valid / Invalid / LineBuild），交给 `IPlaceBuildingPreview`（`FootprintPlaceBuildingPreview` 画格、`ActorPreviewPlaceBuildingPreview` 画半透明本体）。**预览和下单用同一个函数**，下单后 `Traits/Player/PlaceBuilding.cs` 的 `ResolveOrder` 再跑一遍（防作弊 / 网络延迟），通过才 `CreateActor`。
- 撤销 / 出售：游戏里没有通用撤销。出售是 `Sellable.cs` + `Activities/Sell.cs`：`refund = 价值 × RefundPercent × 当前血 / 满血`，广播 `INotifySold`，`SpawnActorsOnSell` 吐人，`Dispose`。取消建造在 `ProductionQueue.cs` 按已付金额 `RefundCash`。

## 4. 地图格式与编辑器

- 地图是一个目录 / zip 两个文件：`map.yaml`（元数据 + `Players` + `Actors` + 可选的 `Rules/Weapons/Sequences` 覆盖，地图可以改规则）和 `map.bin`（二进制：格式号、宽高、每格 `TerrainTile(ushort 模板, byte 索引)`、可选高度 byte、`ResourceTile(byte 类型, byte 索引)`）。见 `OpenRA.Game/Map/Map.cs` 的 `Save / SaveBinaryData`，字段表 `YamlFields`，`MapFormat` 带版本号（当前 12，最低支持 11）。
- actor 保存：`map.yaml` 的 `Actors:` 下 `Actor210: v04` 加子键 `Owner / Location / Facing / Health`，每个子键是一个 `ActorInit`（`Map/ActorReference.cs` 反射 `<名>Init` 类加载）。即：**地图里的实例 = 类型名 + 一组可选初始化值**，不存整份属性。
- 编辑器架构（`OpenRA.Mods.Common`）：
  - 笔刷：`EditorBrushes/` 实现 `IEditorBrush { HandleMouseInput; Tick; TickRender }`，一次只激活一个（默认选择、地块、资源、actor、复制粘贴、标记层）。
  - 撤销重做：`Traits/World/EditorActionManager.cs`，两个栈 + `Modified` 标志 + `OnChange` 事件；每个操作是 `IEditorAction { Execute; Do; Undo; Text }`，笔刷文件里就地定义（`AddActorAction`、`RemoveActorAction`、`ChangeSelectionAction`、`DeleteAreaAction`），连「改选择」都是可撤销动作。`HistoryLogLogic` 把栈直接显示成列表。
  - 实例层：`Traits/World/EditorActorLayer.cs` 维护 `EditorActorPreview` 列表 + 两个空间分区（格子、屏幕），预览自己算 `Footprint` 用于点选与占用。
  - 属性面板：`Widgets/Logic/Editor/ActorEditLogic.cs` 不写死字段，而是问 actor 的每个 trait `IEditorActorOptions.ActorOptions()`，trait 自己返回 `EditorActorCheckbox / Slider / Dropdown`（`Health`、`Turreted`、`Mobile` 朝向、`Pluggable` 都这么暴露），改值走 `ReplaceInit / RemoveInit`，也进撤销栈。
  - 分类：actor 里的 `MapEditorData: Categories` 决定它在左侧选择器哪一栏。

## 5. 资源与加载：manifest 是「挂载表」

- `mods/ra/mod.yaml` 即 `OpenRA.Game/Manifest.cs`。每一节是一类资源的文件清单：`Rules / Sequences / TileSets / Weapons / Voices / Cursors / Chrome / Hotkeys / Fonts / FluentMessages / Assemblies`，按列表顺序合并，后者覆盖前者。
- 文件系统（`FileSystem/FileSystem.cs`）：`FileSystem:` 节声明挂载点，`别名|路径` 寻址（`ra|rules/x.yaml`、`content|conquer.mix`），`~` 前缀表示可选、缺了不报错；`PackageFormats: Mix` 说明用哪个解包器。正版资产单独列 `ContentPackages` + `RequiredContentFiles`，缺就进 `ModContent.cs` 的安装器（`ModPackage.TestFiles / Sources / Download`）。
- 按需：规则、序列表启动即全读（纯文本小）；贴图、声音通过 `SpriteCache` / `SoundLoaders` 第一次用到才解码。`ModData.cs` 构造顺序：反射装程序集 → 挂载文件系统 → 本地化 → 加载屏 → 各 loader → 规则懒加载。
- 引擎与 mod 分离：`OpenRA.Game` 不认识任何具体 trait，全部在 `OpenRA.Mods.Common/Cnc/D2k` 程序集里，manifest 的 `Assemblies:` 决定装哪些。

**对「风格包 + 依赖清单」的启发**：风格包 = 一个 manifest（主题名、版本、`requires` 引擎最低版本、分节清单：模型 / 贴图 / 材质 / 声音 / 物品表），路径用 `包名|相对路径` 寻址，可选资源加 `~`；缺失清单项在加载前一次性检查并给出「缺什么、去哪拿」。

## 6. 总结表

| OpenRA 做法 | 研习录对应 | 代价 |
|---|---|---|
| actor = trait 列表，trait 名即类名，字段反射填充 | 家具 = `components: {Model, Footprint, Placeable, Comfort, Light, Audio}` JSON，注册表 `name → class` | 要维护组件 schema 文档；错字只能靠 lint 抓 |
| `^模板` + `Inherits` + `-删除` + 字段覆盖 | `extends: "^Chair"`，加载时扁平化 | 扁平化器要写对合并与删除语义，一次写好 |
| C# 字段默认值 + YAML 只写差异 | 组件类里给默认值，JSON 只写差异 | 默认值藏在代码里，要在 schema 导出 |
| `RequiresCondition` 布尔表达式 + `GrantCondition` | 增益系统：舒适度 / 时段 / 天气授予条件，组件按条件开关 | 需要一个条件管理器和表达式解析（可先只支持 `&& ! ||`） |
| Footprint 字符串 + 三层判定 + 预览即判定 | 家具 footprint 字符串（格子 + 高度层）；`canPlace()` 一个函数供预览和确认共用 | 三维要多一个「表面 / 层」概念（地面、桌面、墙面） |
| 地图 = yaml 元数据 + 二进制格子 + `Actors: 类型 + 初始化值` | 房间存档 = `room.json`：元数据 + 格子层 + `placed: [{type, pos, rot, inits}]` | 不要把整份属性写进存档，只存差异（否则改表后旧存档不更新） |
| `EditorActionManager` 双栈 + 每操作一个 Do/Undo 对象 | 编辑器所有改动（含选择）走 action 对象 | 直接改状态的捷径一旦出现，撤销就坏了 |
| 属性面板由 trait 自述（`IEditorActorOptions`） | 组件自带 `editorOptions()` 返回控件描述 | 比写死面板多一层抽象，但新组件零 UI 代码 |
| manifest 分节清单 + `别名|路径` + `~` 可选 | 风格包 `pack.json` 分节清单 + 依赖检查 | 要写一个加载前的完整性检查 |
| `Lint/` 38 个表检查器、`UpdateRules` 版本迁移 | `tools/lint_tables.py`、表格式号 + 迁移脚本 | 持续成本，但这是「表驱动」能活下去的前提 |

**必须现在就定、以后改不动的四件事**：
1. **组件 JSON 的外形**：`{组件名: {字段}}` 一层，多实例用 `@后缀`，继承用 `^模板` + `extends`，删除用 `-组件名`。所有家具表、存档、编辑器、风格包都依赖这一外形。
2. **实例存档只存「类型 + 初始化差异」**，不存展开后的属性；存档和表都带格式号。
3. **摆放合法性是一个纯函数** `canPlace(world, def, pos, rot) → 每格 Valid/Invalid`，预览、确认、加载校验三处共用。
4. **编辑器改动全部经过 action 对象**，没有旁路。

可以晚一点的：条件表达式解析器（先用简单的 `&&` / `!`）、lint 的覆盖面、manifest 的可选资源与安装器、版本迁移脚本。
