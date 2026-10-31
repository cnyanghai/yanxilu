# 红色警戒原版源码拆解（建造、摆放、经济、科技树、编辑器、规则表）

来源：EA 2020 年开源的 `CnC_Remastered_Collection`（`REDALERT/` C++ 游戏逻辑，`CnCTDRAMapEditor/` C# 地图编辑器）。协议 GPL-3.0。本文只读学习，**不复制任何代码或资产进研习录仓库**。文中路径相对该仓库根。日期 2026-10-30。

## 1. 规则数据：rules.ini 怎么进类型类

**结论：一半数据一半代码。** 每种建筑/单位先在 C++ 里用一个静态构造器写死"形状类"属性，再由 `rules.ini` 覆盖"数值类"属性。

- 入口 `REDALERT/RULES.CPP` `RulesClass::Process()`，按固定顺序读 `[General]`→`[MultiplayerDefaults]`→`[Recharge]`→`[Maximums]`→`[AI]`→`[Powerups]`→地形段→`[Themes]`→`[IQ]`→`Objects()`→难度。`Objects()` 遍历弹头、弹道、武器、车辆、步兵、舰船、飞机、建筑、阵营、任务的类型堆，逐个调 `Read_INI(ini)`。
- 字段映射是**手写的一行一字段**，没有反射：`TECHNO.CPP` `TechnoTypeClass::Read_INI` 读 Cost/Strength/TechLevel/Prerequisite/Owner/Primary/Armor/Sight/Speed/Image 等；`BDATA.CPP` `BuildingTypeClass::Read_INI` 再加 Power/Storage/Adjacent/Capturable/Bib/BaseNormal/Unsellable。每个 `ini.Get_X(段名, 键, 默认值)` 以构造器里的值为默认，所以 INI 缺项不出错。
- 类型化读取器在 `CCINI.CPP`：`Get_Buildings` 把 "PROC,WEAP" 解析成建筑位掩码 `1<<StructType`，`Get_Owners` 解析阵营位，`Get_WeaponType`/`Get_ArmorType` 按名字查表。
- **写死在代码里的**（`BDATA.CPP` 顶部几十个 `static BuildingTypeClass const ClassXxx(...)`）：占地列表 `OccupyList`/`OverlapList`（相对格偏移数组，`REFRESH_EOL` 结尾）、尺寸 `BSIZE_xx`、出口格、是否围墙/炮塔/假建筑、生产哪类对象 `ToBuild`、贴图名。即"长什么样、占哪几格"是代码，"值多少钱、谁能造、需要什么"是表。

## 2. 建造与摆放

**结论：合法性 = 每个占地格可建 + 至少一格与自家建筑相邻；没有旋转，没有预览模型，只有格子光标。**

- 玩家从侧边栏点完工的建筑后进入放置模式：`DISPLAY.CPP` `DisplayClass::Set_Cursor_Shape(list)` 把该建筑的 OccupyList 装成光标，`Cursor_Mark` 给覆盖的格子打 `IsCursorHere`，`CELL.CPP` 画格子时据此画白/红方块。`Set_Cursor_Pos` 每次鼠标移格就重算 `ProximityCheck = Passes_Proximity_Check(...)`。
- 格子可建：`CELL.CPP` `CellClass::Is_Clear_To_Build`：无占用对象、无覆盖物（矿/墙）、不是桥、地形表 `Ground[Land_Type()].Build` 为真。逐格循环在 `TECHNO.CPP` `TechnoTypeClass::Legal_Placement(cell)`，`BuildingClass::Can_Enter_Cell` 外加"必须是已探明格"。
- 相邻：`DisplayClass::Passes_Proximity_Check`：遍历占地格的八邻，找到同阵营且 `IsBase` 的建筑或自家围墙/地基印（bib）即通过；`Adjacent` 字段（默认 1）允许放宽到隔 N 格。
- 确认：`Mouse_Left_Release` 把 `EventClass::PLACE` 投进命令队列，`EVENT.CPP` 转 `HOUSE.CPP` `HouseClass::Place_Object`，从工厂取出对象 `Unlimbo` 到格子。`BUILDING.CPP` `Unlimbo`/`Grand_Opening` 时登记 `ActiveBScan |= 1<<Type`、`Adjust_Power/Drain/Capacity`，`Update_Buildables` 把新解锁的条目加进侧边栏。
- 建筑朝向只有炮塔有（`DirType`），地基本身 `FACING_NONE`，编辑器同样只给 `HasTurret` 的建筑方向选项。

## 3. 经济与建造队列

**结论：钱是两个数（现金 Credits + 矿 Tiberium，受仓储上限 Capacity 约束），电是两个数（Power/Drain），生产是一个 54 步的计时器边走边扣钱。**

- `HOUSE.H/HOUSE.CPP`：`Available_Money = Tiberium + Credits`；`Spend_Money` 先扣矿再扣现金；`Harvested` 入账并截到 `Capacity`（由矿场/筒仓的 Storage 累加，`Adjust_Capacity`）；`Power_Fraction = Power/Drain`。电不够不停产，而是把依赖电的建筑（`IsPowered`）和生产速率减半（`BUILDING.CPP` 4350 附近 `pfrac` 下限 1/2）。
- 队列：`FACTORY.H/FACTORY.CPP` `FactoryClass : StageClass`，一个工厂只造一件，`Set()` 记 `Balance = Cost*CostBias`，`Start()` 把 `Time_To_Build/STEP_COUNT(54)` 设成每步 tick 数；`AI()` 每步扣 `Cost_Per_Tick`，钱不够就把步数退一格（"等钱"）；到 54 步标记完成，等玩家放置。`Suspend()` 暂停，`Abandon()` 把已扣的钱**全额**退回（`Refund_Money`）。
- 建造时间纯由价格派生：`TECHNO.CPP` `TechnoTypeClass::Time_To_Build = Cost * Rule.BuildSpeedBias * ...`，没有独立的 BuildTime 字段。
- 侧边栏 `SIDEBAR.H` 两列 `StripClass`，每列 `Buildables[75]`，入口 `Add(type,id)` 由 `Update_Buildables` 调用，`Recalc()` 用 `Who_Can_Build_Me` 剔除失效项；`Factory_Link` 把条目和工厂实例绑定显示进度。每类（建筑/步兵/车辆/舰船/飞机）各自一条队列，`Begin_Production` 返回 `ProdFailType`（OK/LIMIT/ILLEGAL/CANT）。
- 变卖：`TECHNO.CPP` `Refund_Amount = Raw_Cost * CostBias * Rule.RefundPercent`（默认 0.5，`[General] RefundPercent`）。

## 4. 科技树与前置条件

**结论：前置条件是一个 32 位建筑位掩码，解锁检查是一句位运算，数据全在 rules.ini 每个对象段的 `Prerequisite=`、`TechLevel=`、`Owner=`。**

- 表示：`TechnoTypeClass::Prerequisite`（long 位掩码，由 `Get_Buildings` 生成）、`Level`（TechLevel，-1 表示不可造）、`Ownable`（阵营位）。
- 检查：`HOUSE.CPP` `HouseClass::Can_Build(type, house)`：`(pre & ActiveBScan) == pre && Level <= Control.TechLevel` 且阵营位匹配。`ActiveBScan` 是"当前在场且有效的自家建筑类型位集"，建筑登场/被毁时置位/清位，每帧另有全量重算兜底。代码里仅有少数硬编码等价规则（高级电厂算作电厂、遭遇战里苏/盟科技中心互通）。
- 没有树结构、没有节点表；"树"是每个条目自己声明父节点的隐式图。关卡的 `TechLevel` 做全局上限。

## 5. 地图与格子

**结论：固定 128×128 格，每格一个重结构体，层是"地形模板 / 覆盖物 / 印记 / 占用者 / 重叠者"五层，迷雾是每格两个位。**

- `DEFINES.H` `MAP_CELL_W=128`，`CELL` 是 short 索引，`Adjacent_Cell(cell, facing)` 八向。
- `CELL.H` `CellClass`：`TType/TIcon`（地形模板和子图块，决定 `Land`），`Overlay/OverlayData`（矿、墙、箱子，数据位是矿量/墙连接状态），`Smudge/SmudgeData`（弹坑、地基印），`Owner`（墙/印的归属，用于相邻判定），`OccupierPtr`（唯一占用者）和 `Overlapper[6]`（视觉上压到此格的对象），`Flag.Composite`（步兵五个子格位 Center/NW/NE/SW/SE + Vehicle + Monolith），`Zones[]` 寻路区域，`Trigger`。
- 地形类型 `LandType` 九种（Clear/Road/Water/Rock/Wall/Tiberium/Beach/Rough/River），每种在 `rules.ini` 有段，`RULES.CPP` `Land_Types()` 读 Foot/Track/Wheel/Float 通行系数与 `Buildable`，存进全局 `Ground[]`。
- 迷雾：`IsMapped`（探过）+ `IsVisible`（当前可见）两位（重制版另加按玩家的掩码）；`MAP.H` `Sight_From(cell, range, house)` 以圆形格表揭开，`RADAR.H/DISPLAY.H` `Map_Cell`/`Shroud_Cell`/`Jam_Cell`，`Encroach_Shadow` 让黑幕回长。
- 一格能放：一个建筑或车辆（占用者）或至多五个步兵（子格位），外加一层覆盖物、一层印记、一个触发器。
- 地图文件是 INI：`[Map]` 范围、`[MapPack]`/`[OverlayPack]`（每格 2 字节模板 + 1 字节图块 / 1 字节覆盖物，LCW 压缩分块后 base64，`INI.CPP` `Get_UUBlock`），`[STRUCTURES]`/`[UNITS]`/`[INFANTRY]`/`[TERRAIN]`/`[SMUDGE]` 每行"阵营,类型,血量,格号,朝向,任务,触发器"，`[Waypoints]`、`[CellTriggers]`、`[Trigs]`、`[TeamTypes]`、`[Base]`（AI 基地重建顺序）。

## 6. 地图编辑器（C#）

**结论：模型-工具-渲染三分，模型层是"类型表 + 若干格网 + 占用集"，每个工具是一个鼠标状态机，撤销是闭包对列表。**

- 模型 `Model/Map.cs`：类型表（`BuildingTypes` 等静态列表，`RedAlert/BuildingTypes.cs` 每行一个 `new BuildingType(id, 名, 文案键, bool[,] 占地掩码, 有无地基印, 阵营, 假建筑?, 炮塔?)`）；格网 `CellGrid<T>`（`Templates`、`Overlay`、`Smudge`、`CellTriggers`，带 `CellChanged` 事件）；占用集 `OccupierSet<ICellOccupier>`（`Technos` 和 `Buildings`，`CanAdd(location, occupier, occupyMask)` 逐格查空，`Add/Remove` 发事件）；`OverlapperSet`（`OverlapBounds` 只管绘制重叠不管占用）。`Map.Clone()` 便宜到每帧可做。
- 工具 `Tools/*Tool.cs` 继承 `ViewTool`，持有 `map`、`mapPanel`、`url`（撤销栈）、`navigationWidget`（鼠标所在格）。`BuildingTool`：选中类型后 `placementMode`，`PreRenderMap` 每帧 `previewMap = map.Clone()`，把半透明 `mockBuilding` 试放进去作为预览；左键 `AddBuilding` 走 `CanAdd` 再 `Buildings.Add`；按住拖动已放建筑时先 `Remove` 再 `CanAdd/Add`，失败放回原位；右键弹属性面板（`PropertyTracker` 暂存改动，Commit/Revert）。主窗体 `MainForm.cs` 用 `ToolType` 位标志切换工具，`RefreshAvailableTools` 按地图状态启用。
- 撤销 `Utility/UndoRedoList<T>`：`Track(undo, redo)` 两个闭包入列表，`Undo(ctx)/Redo(ctx)` 移动游标；地形/覆盖物/印记工具用它，建筑工具原版没接（只置 `Dirty`），是已知缺口。
- 保存 `RedAlert/GamePlugin.cs` `Save()`→`Validate()`（各类对象数量上限）→`SaveINI()` 顺序写各段，`CompressLCWSection` 做 LCW+base64；同时导出 `.tga` 预览和 `.json` 元数据。
- 直接可借鉴：占地掩码 `bool[,]` + `CanAdd` 的占用集；克隆地图做预览而不是在真地图上试放；每个工具一个类、共享鼠标格导航件；撤销用闭包对；类型表静态声明、实例只存"类型+格+朝向+属性"。

## 7. 搬运表

| 他们的做法 | 我们的对应 | 代价 |
|---|---|---|
| rules.ini 分段，每对象一段，代码给默认值、INI 覆盖 | `data/catalog.json` 一件家具一条：价格、尺寸、槽位类型、舒适度、前置；代码只放几何与渲染默认 | 要写一次"字段→属性"映射并维护校验脚本 |
| 占地列表 `OccupyList` 写死在类型里 | 家具占地掩码写进目录表（院子菜畦 1×1、书桌 2×1），房间地面划格 | 大件圆形物要近似成格 |
| `Is_Clear_To_Build` + `Passes_Proximity_Check` | 放置 = 每格空且地面类型允许（地板/地毯/土）+ 槽位规则（墙挂必须贴墙、书只能进书架） | 槽位规则比相邻规则多一类，需要"墙格"元数据 |
| 格子光标白/红 | 俯视模式下地面投影格高亮，合法/非法两种不靠红绿区分 | 三维里要做地面贴花或网格材质 |
| `Credits + Tiberium + Capacity` | 一种货币即可（阅读/打卡所得），不要仓储上限 | 无 |
| `Power/Drain` 比例惩罚不停机 | 舒适度：家具和植物给加成，杂乱给扣减，`fraction` 换成增益倍率，低于阈值只减不停 | 要定义"杂乱"的度量 |
| `FactoryClass` 54 步计时 + `Abandon` 全额退款 + 变卖半价 | 商店买即得，但植物生长、书的阅读进度可用同样的分步计时器；退货全额、二手半价 | 计时器要能离线推进 |
| `Prerequisite` 位掩码 + `TechLevel` 上限 + `Can_Build` 一句判断 | 解锁条件 = 拥有物品集合位 + 等级上限，存目录表 `requires:[]`、`level:` | 条目超过 32 个要用 BigInt 或 Set，不用位掩码 |
| `Update_Buildables` 放置后立刻刷新侧栏 | 买到/摆好后触发一次"商店可见项重算" | 无 |
| `[STRUCTURES]` 一行一件"类型,格,朝向,属性" | 存档每件"catalogId, cell, facing, props"，房间与院子各一段 | 与现有 `S.data` 集合合并时要迁移 |
| 编辑器 `OccupierSet.CanAdd(mask)` + `previewMap = map.Clone()` | 摆放编辑器：占用集 + 预览副本 + 半透明试放 | 三维场景克隆贵，改为只克隆占用表，预览用单独实例 |
| 每个工具一个类 + `UndoRedoList` 闭包对 | 摆放/删除/移动各一个工具类，每次操作登记 undo/redo 闭包 | 需要把现在 `put/del` 的直接写入改成可逆操作 |
| `Validate()` 保存前数上限 | 保存前检查每间房家具数上限、槽位冲突 | 无 |

不搬：子格步兵位、矿与仓储、阵营位、寻路区域、触发器脚本、LCW 压缩（我们用 JSON 即可）。
