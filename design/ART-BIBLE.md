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

2026-10-30 视角与操控定为"在场为底，对焦为点"，第一轮的展柜取景不再是目标画面，两张留作材质与家具的参考（02 的家具组合与笔记本斜面架保留）。

**第二轮出图方案**（等用户点头）：
- 模型：gpt-image-2 中档，3:2，带参考图 `concepts/keyart_modern_02.jpg` 维持材质与家具，两张，约 0.8 元。
- 变化：取景改成游戏画面，跟随镜头约 40 度俯角、长焦压扁透视、没有天花板、靠镜头的两面墙去掉、远侧两面墙完整可见；角色换成皮克斯式卡通（头约占身高四分之一、大眼、圆润、哑光），正在房中朝书墙走；不画界面、不画文字。
- 画面里要有：远墙整面书墙、笔记本斜面架、靠左窗的橡木桌与一张牌和黄铜灯、读书椅与壁灯、格子里睡着的猫、一盆植物、橡木地板上一块地毯。
- 材质色调不变：暖白哑光墙、浅橡木、墨青点缀、一点黄铜。

英文提示词：

> In-game screenshot of a cozy modern study room from a fixed three-quarter top-down game camera at about 40 degrees pitch, long telephoto lens with flattened perspective, no ceiling, the two walls nearest the camera removed, the two far walls fully visible. A stylized Pixar-like cartoon character, young adult, head about one quarter of body height, big friendly eyes, simple rounded shapes, matte skin and fabric, is walking across the room toward a full-height bookshelf wall densely filled with books on the far wall. Also in the room: a low slanted display rack holding six muted-color notebooks with small labels; a pale oak desk with one single card and a slim brass lamp beside a window on the left with soft daylight; a reading armchair with a wall lamp; a sleeping cat in a shelf cubby and one potted plant as collectible items; a soft rug on an oak floor. Materials: warm white matte walls, pale oak wood, deep ink-teal accents, a touch of brass. Soft studio lighting, no harsh shadows, clean and minimal, premium stylized game art render, no UI, no text.

中文意思：游戏截图感，固定的三分之一俯视游戏镜头约 40 度、长焦压扁、没天花板、近处两面墙去掉、远处两面墙完整。皮克斯式卡通青年（头约四分之一身高、大眼、圆润、哑光）正走向远墙的整面书墙。房里还有笔记本斜面架、靠左窗的橡木桌上一张牌和黄铜细灯、读书椅配壁灯、格子里的睡猫和一盆植物、橡木地板上的地毯。材质：暖白哑光墙、浅橡木、墨青点缀、一点黄铜。柔和棚光无硬影，干净极简，高级风格化游戏美术渲染，无界面无文字。

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

## 7. 资产复用规矩（2026-10-30，用户问"物件要复用、要进商店，设计图会不会有问题"）

先说结论：**主视觉不是资产的来源，只是目标。** 没有人从主视觉里抠一张桌子去建模。资产在阶段 2 一件一件单独出图（三视图、素底、统一比例尺），再图生三维。所以第一轮主视觉对复用没有影响，只要阶段 2 按下面的规矩做。

每件可复用的物件（家具、地毯、灯、商店里的植物动物）都要有：
1. **比例尺**：世界单位 1 = 1 米，网格 0.5 米。桌 1.2 × 0.6 × 0.75，椅 0.5 × 0.5 × 0.85，书墙一格 0.3 × 0.3，这张尺寸表在阶段 2 开头定，所有出图提示词都带尺寸。
2. **锚点与朝向**：模型原点在底面中心，正面朝 -Z。
3. **占地与放置类型**：占几格、能放在哪（地面 / 靠墙 / 桌面 / 架上 / 窗台）。房间里的槽位按同样的类型标记，只有类型匹配才能放。
4. **预算**：家具 3000 三角面以内、一张 512 贴图；小道具 500 面以内、进贴图集；角色 8000 面以内。
5. **材质只从材质板取**：同一件物品在不同风格包里是同一个模型换一张皮（pack.json 里映射）。
6. **自己带阴影**：可移动的东西不能吃壳的烘焙光，所以每件物品的贴图里烘自己的环境光遮蔽，脚下一块柔和的接触阴影贴片，再由房间的环境光（从烘焙结果采样的光探针）给颜色。这是"可移动"的代价：家具的光会比全烘焙的 kriss 稍平一点，壳保持全烘焙不受影响。
7. **数据驱动的物件不进商店**：书、笔记本、牌由用户的数据生成，是同一个几何加程序化贴图（版本 2 已经这么做书了）；笔记本只做封面形状一种加颜色与题签，不做成几十个模型。地毯、灯、椅是商店资产。

"自由摆放"还是"预设槽位"：SCOPE 定的是预设槽位、可选不可建。用户 2026-10-30 的提问里出现了"自由摆放"，两者的差别是一套摆放界面、碰撞与吸附、存坐标，约多两周工作量，且光照折衷更明显。Claude 的建议：**第一期槽位制，但 `placements` 从第一天就按网格坐标存**（物品、x、y、朝向、放置面），以后开放自由摆放只是加界面，不用迁数据。要不要改成自由摆放，用户定。

角色：用户 2026-10-30 定为**皮克斯式的卡通人物**（风格类别，不用任何皮克斯角色）：头身比约 1 比 4 到 1 比 5，大眼、圆润简洁的形体、哑光皮肤与布料。一个基础身体加可换的衣服网格，骨骼与动作共用。第一轮主视觉里的角色偏写实，与此不符；建议第二轮主视觉用 02 当参考图、只换角色描述再出两张，让主视觉里的角色就是定稿的角色风格。
