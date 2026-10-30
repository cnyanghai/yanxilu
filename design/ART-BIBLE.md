# 风格圣经 · 第一个风格包「现代书房」

阶段 1 的交付物。门：用户看主视觉说"就是这个"，对照墙六项每项 4 分以上。本页写满即阶段 1 完成。

状态：骨架（2026-10-30）。第 1 节的出图方案等用户看提示词；第 2 到 5 节是草稿，可以直接改。

## 1. 主视觉（待出图）

一张图定下整个包的样子，后面所有家具、角色、卡片都对着它打分。

**出图方案**（等用户点头）：
- 模型：gpt-image-2，中档，3:2 横幅，走 fal。
- 张数：先两张同一提示词（约 0.76 元），选一张或都不要；两轮不像就换方向或换模型（Grok 免费可作备选）。
- 画面要有的东西，按范围定：剖切开的一间现代书房、整面书墙、一个放六本笔记本的架子（各有题签）、案桌上一张牌和一盏灯、读书椅、左侧窗的日光、一个游戏式三维角色站在桌边看书、一盆植物和一只睡着的猫当商店物件、暖白墙 + 浅橡木 + 墨青点缀 + 一点黄铜。
- 不要的：文字、真实品牌、kriss 的粉彩黏土感、杂乱。

英文提示词：

> High-angle three-quarter view of a single modern study room cut open like a diorama: a thick floor slab with softly rounded edges and two walls, ceiling removed, seen from outside through a long telephoto lens with almost no perspective distortion. Inside: a full-height bookshelf wall densely filled with books; a separate low shelf holding six notebooks of different muted colors, each with a small label tag; a pale oak desk with one single card lying on it and a slim lamp; a reading armchair; a window on the left letting in soft daylight. A stylized 3D game character, young adult with simple clean proportions and matte materials, stands beside the desk reading. One potted plant and one sleeping cat on a shelf as collectible items. Materials: warm white matte walls, pale oak wood, deep ink-teal accents, a touch of brass. Soft studio lighting, no harsh shadows, clean and minimal with a little playfulness, premium architectural visualization render, plain light-grey background, no text.

中文意思：长焦高角度三分之一俯视，一间剖开的现代书房像个模型摆在手里，厚楼板圆边、两面墙、没有天花板。里面：整面书墙、六本不同颜色带题签的笔记本、浅橡木桌上一张牌和一盏灯、读书椅、左窗日光、一个干净比例的三维游戏角色站在桌边看书、一盆植物和一只睡猫当收藏品。材质：暖白哑光墙、浅橡木、墨青点缀、一点黄铜。柔和棚光无硬影，干净极简带一点俏皮，高级建筑可视化渲染，浅灰底，无文字。

**第一轮（2026-10-30）**：同一提示词两张，`concepts/keyart_modern_01.jpg`、`concepts/keyart_modern_02.jpg`，共 0.75 元。

这两张图用了什么：gpt-image-2 文生图，没有参考图；提示词里"长焦、几乎没有透视"换来了近似轴测的构图，"厚楼板圆边、没天花板"换来了捧在手里的模型感；材质和颜色是提示词里点名的四样，模型没有加第五种。

Claude 的对照墙打分（形体 / 材质 / 光 / 密度 / 生命 / 整体感，满分 5）：
- 01：4 / 4 / 4 / 3.5 / 3.5 / 4。右墙大片空白，左墙是一块悬着的薄板不像房间的角；笔记本架做成了斜面展示架，这个意外好，值得采纳；猫窝在书墙格子里。
- 02：4.5 / 4 / 4 / 4 / 4 / 4.5。两面墙的厚度与圆角读得出"一件物品"；桌靠窗、读书椅配壁灯、笔记本架居中、猫在架子下层的窝里，密度与生命都够。推荐 02。
- 两张共同的问题：和 kriss 比还是"微缩模型"而不是"剖开的房间"，墙再厚一倍、楼板剖切面再明显一点会更像；角色偏写实，阶段 2 要往更简的比例走。

等用户：选一张说"就是这个"进第 5 节抽材质和色板，或说要改什么再出第二轮。

## 2. 风格包的边界（跨包不变 / 随包变）

跨包不变（这些是"研习录"本身）：
- 房间结构与槽位名：书墙、笔记本架、案桌（牌位、灯位）、读书椅、窗、商店槽位若干（地面两个、架上三个、桌上一个，数量阶段 2 定）、门。
- 镜头：四景别（院子 5 度、整间 8 度、案头 12 度、卡片特写）、路由即镜头、过渡时长与呼吸。
- 交互：取书、翻牌、开笔记本、买东西放槽位、参观与留言。
- 数据：书、笔记本、牌、商品、库存、摆放，与版本 1 共用。
- 界面布局：卡片贴屏幕边，不进三维；面包屑与后退。

随包变：
- 壳模型（墙、地、梁、窗）与房型比例（在同一组槽位约束内）。
- 家具集（每个槽位一件对应的家具）。
- 材质与贴图、三种光的烘焙。
- 界面色表、可选字体。
- 角色的服装（身体与骨骼不变）。
- 商店物件的"皮"（同一只猫在中式包里是同一只猫，但陶盆换成瓷盆）。

目录约定：`world/packs/<包名>/`，里面 `shell.glb`、`furniture/`、`tex/`、`pack.json`（色表、槽位到家具的映射）。阶段 3 落实。

## 3. 十条验收单（草稿）

每条 1 到 5 分，阶段 3 的门是过 7 条（4 分以上算过）。

1. 第一眼知道这是一间书房，不用解释。
2. 认得出这是"我的"：书是我的书，笔记本是我的笔记本，牌是今天的牌。
3. 手机上 3 秒内看到房间，滑动不卡。
4. 房间像一件被捧在手里的物品：有厚度、有剖切面、有圆角。
5. 没有一件纯装饰：每件东西能点、装东西或显示状态。
6. 光干净，墙是亮的，没有脏影。
7. 镜头切换不晕，待机时有呼吸。
8. 从看见一本书到读到正文不超过两步。
9. 角色在场但不抢戏。
10. 和 kriss 并排放不丢人，也不像抄。

## 4. 禁止项（草稿）

- 不用 kriss 的模型、贴图、配色表、房型、字体。
- 不用暴雪或任何 IP 的美术。
- 不引 Google Fonts，不走 CDN。
- 不出现第六种颜色、第六种材质（材质板和色板定稿后生效）。
- 不加填不出功能表的家具。
- 不用红绿对比表达状态（用户色弱）。

## 5. 材质板与色板（待主视觉定稿后抽取）

从定稿主视觉里取：材质不超过五种，各一块真实样块图；颜色不超过六个，写十六进制值，标明用在哪（墙、木、点缀、金属、纸、界面）。三种光（晴窗、夜读、雨天）各出一张同机位图。

## 6. 零件表（待定）

现代书房包的重复出现的小造型：圆角半径、题签形状、书口、灯罩、把手。主视觉定稿后列。
