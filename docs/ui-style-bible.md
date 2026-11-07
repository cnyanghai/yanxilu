# 邮差奇幻界面 · 风格圣经（第四稿：青橙墓园）

一页纸，全站所有零件、场景和生图提示词都从这里取词。蓝图见 `ui-system-plan.md`，进场与交互动效见 `ui-scene-motion.md`，工具见 `tools/ui/`，提示词登记在 `ui-prompts.md`。

稿子的来历：第一稿是书房旧纸橄榄一路；第二稿按"墓地一套"写成温和的蓝夜；第三稿按用户三张图改成紫夜毒绿哥特，出了两轮试笔；2026-11-06 深夜用户发来第四张图（Sleepy Hollow 铁门）说**整体就要这个风格**，量过差距后改写成本稿，又经四场英雄图、书脊零件和三件交互样稿（书、卡、本）过门校正。软件同日改名**「邮差」**。第三稿的色板和提示词前导移到末尾「对照」里，不再使用。

## 一、一句话

青橙的墓园。冷青的风暴夜空占八成，火橙的光只在主角背后和灯火处占两成；门、柜、碑是黑剪影，边缘被暖光勾出来；中景雾青，远景更浅更灰。画法是**厚涂**：笔触密、细节实、有体积，石头铁木有暗线但不描硬边。**阴森但不血腥、不恐怖**：没有血、没有伤，不用魔鬼脸，骷髅只有手臂，一切干净、可读。界面上所有的字都是我们叠上去的"画出来的光"，图里不准有字。

## 二、色板（2026-11-06 深夜从提亮后的四张英雄图取色）

取法：四张英雄图（P017 到 P020）先按定稿曲线提亮（gamma 0.85，最暗档从 51 到 74% 降到 33 到 46%，参考是 45%），再按色相分冷暖两家、按明度取暗中亮三档中位色。

| 角色 | 暗 | 中 | 亮 | 用在 |
|---|---|---|---|---|
| 冷青（八成） | `#1A2730` | `#324D5B` | `#5593A4` | 天、雾、石、铁的冷面、背景大面积、页面底 |
| 火橙（两成，只在光处） | `#3A2A22` | `#7A5142` | `#B76F49` | 画里的火光与受光面 |
| 界面光源 | `#E8762B` | `#F4A742` | `#FFD48A` | 牌字、路牌字、石尺进度、主按钮、在读的光——界面上唯一的暖色 |
| 铁黑 | `#0D141A` | `#1C2029` | | 门、柜、碑的剪影，描边，夜读纸 |
| 雾青白 | `#647277` | `#A9C6CC` | | 远景、次要文字、分隔线、石尺上的字 |
| 锈褐 | `#5C4334` | `#B04E1E` | | 铁件锈、日期印（朱文用亮档） |
| 纸与墨 | 纸纹图中位 `#B5B19E` | 阅读页 `#EFE8D6` | 字 `#1C1A17` | 单页阅读、对开、牌面、本子页；对比约 12:1；夜读纸 `#16141A` 字 `#CFC8B6` |

规矩：
- 冷青占八成、火橙占两成，没有第三种颜色；紫、绿、红不进画面。
- **色弱规则**（用户重度色弱，这条压过一切审美）：青对橙是蓝橙轴，对红绿色弱最稳；但意义仍不放在颜色上——状态、对错、开关一律靠形状、明暗、文字与印来分（第八节）。
- 暖色只出现在光处：天上的火、灯、牌、进度、主按钮。任何大面积的暖色都是错。

## 三、光与明度

- **一张图一个主光**，放在主角背后（天上的火、门后的光）；主角是黑剪影，边缘被暖光勾出来；牌、灯、窗是暖光芯。碎光（烛、月）至多一处。
- **明度三层**：前景黑剪影，中景雾青，远景更浅更灰；暖光芯最亮。出图后量明度五档，最暗档 35 到 50%、中间三档合计 ≥ 45%，不够就套定稿曲线（gamma 0.85 到 0.9）而不是重出。
- 投影融进雾里，不画长影。

## 四、构图与尺寸

- **一屏一主角**：提示词里点名的东西不超过五样；主角占画面一半以上；对称或近对称；一条路、一条石尺把眼睛引进去。
- **竖幅优先**：手机是主战场，先出 2:3 竖图；桌面用横图或竖图加两侧延展，不另起一套构图。
- **首页**：墓园大门三层——前景门（石柱、铁花拱托空牌、门扇半开、藤）、中景石板路与三块空路牌、远景林与宅；主字是牌上的站名「邮差」。
- **书架场**：一座黑哥特宽柜横跨整屏，五层长格贯通，每层左端一块空木牌写领域；手机按格层切开竖排、一屏一到两层。书脊宽 ≥ 16 像素才点得中。
- **档案场**：四座大碑一排，碑面空板刻夹名与篇数，后排小碑在雾里；手机一屏一座，碑宽占屏七成以上、刻名 ≥ 22 像素。
- **笔记场**：六只骨臂两排错落、各举一本；手机一屏一臂，本子宽占屏六成以上。
- **错落**（用户看灰盒时定）：同类物件三种变体轮用，高矮宽窄不同，间距差 20 到 40%；前后两排，后排缩到 0.75 到 0.8、压暗一档、脚下雾浓；每件歪 3 到 8 度左右交替；主角站最前最大最亮；位置由编号做种子，每次进来都在同一处。
- **字永远在空板上**：牌、碑面、题签板都是平的浅板，不压雕饰。

## 五、字：画出来的光，一律由我们叠

- 生图提示词里牌、碑、路牌、封面一律写 blank，图里不准出现任何字；模型自己画了字的图用 edit 端点擦空再用。这样换字、换语言、换名字都不用重出图。
- **标题与牌名**：隶书（本机 SIMLI.TTF，上线前换可分发的隶书字体文件进 vendor/fonts），做成发光锈铁字——牌后透光、外发光两层、锈纹字芯、暗边、顶部一点高光；字芯比光晕亮一档（`tools/ui/glow_text.py`）。路牌、领域牌、夹名、题签同法缩小，小于 40 像素时只留一层光。
- **书脊题签**：隶书竖排，按格层高截断（`tools/ui/shelf_books.py`）。
- **正文**：阅读页霞鹜文楷或 Noto Serif SC（待定），18 像素可调 16 到 22，行高 1.75；手写（随手本）用 Ma Shan Zheng 20 像素、行高 1.8。
- **日期印**：锈橙朱文方印，双框，印里两行隶书（月、日），代码画。
- 暗底上的小字用骨白加铁黑描边，≥ 14 像素；雾和云上不放字。

## 六、材质与物件语言

| 材质 | 画法要点 | 用在 |
|---|---|---|
| 铁 | 黑铁、锈、铆钉、铁花、烛台、包角 | 大门、牌框、柜的铁件、牌的四角、状态印的框 |
| 风化石 | 冷青灰、裂、苔、刻字面是平的浅板 | 碑、门柱、石台、石尺 |
| 哥特木 | 黑、尖拱、窗花格、雕饰 | 宽柜、框 |
| 皮与布 | 栗皮、青布、黑皮铁箍、骨白犊皮、锈橙皮，凸棱、压线、搭扣、蜡封 | 书脊、书封面、本子封面（零件表） |
| 旧纸 | 骨白、极淡纸纹、毛边；阅读区去暗角只用中间 | 阅读页、对开、牌面、本子页 |
| 骨 | 骨白加冷灰暗部，只有手臂 | 笔记场 |
| 蜡 | 厚、有指压痕 | 蜡封、状态印 |
| 雾 | 贴地带状、半透明、青灰、慢 | 地面、进场、投影替身 |

饰物词汇：烛台与烛、乌鸦、绶带、搭扣、蜡封、小碑。不用：魔鬼脸、血、伤、整只骷髅。

## 七、零件的生产方式

- **英雄图**（首页、三场、石台对开、单页纸纹）：gpt-image-2 高档（约 1.5 元一张），edit 端点带用户图四当风格锚，前导段见第十节；每件至少两张挑一；出图后套定稿曲线提亮，不重出。
- **零件表**（书脊、书封面、本子封面、牌正反面、状态印）：同上，洋红底 `#FF00FF`，`tools/ui/cut.py --split` 拆单件；书脊宽高 ≥ 1:6；每本书、每个本子按编号稳定挑一件。
- **书不用代码画**：书脊、封面、本子封面都是零件，题签与状态由代码叠。
- **nano-banana-pro** 偏平、偏卡通，退为备用；Midjourney 无接口，只能人工出图。
- 给人看的一律先贴到场景底上再看，不看抠底原图。
- 每件东西的小循环：样式图 → 生成 → 抠底切片 → 叠字进页 → 并排参考过门。

## 八、状态语言（不靠颜色）

| 状态 | 形 | 字 |
|---|---|---|
| 没读 | 书脊半透明青色幽灵；牌上空圈印 | 未 |
| 在读 | 书口一线橙光；旁边的烛点着 | 读 |
| 读完 | 书口一线金；牌上实心印 | 完 |
| 写了批注 | 牌上羽毛印；纸条从书口伸出 | 批 |
| 结卷引用 | 方印「引」 | 引 |
| 封存 | 铁锁加蜡封，碑面合上 | 封 |
| 待归位 | 沙漏，碑面敞开纸角伸出 | 待 |

状态印四枚是零件（P027）：石圈、实心、羽毛、方印，形状各不同，颜色只是附带。

## 九、手机以用为先

- **阅读页**：单页骨白纸铺满屏，只有上下两条细石尺和极淡纸纹，不画场景；正文 18 像素、行高 1.75、对比 ≥ 9:1；夜读换墨黑纸；点两侧翻页、点中间收尺、长按划线。墓园只出现在架上与封面两屏。桌面 ≥ 1100 像素才用对开（石台上左目录右正文）。
- **牌背即文章**：卡片翻面直接用阅读页模板，顶尺写夹名·标题，底尺「放回」。
- **本子页**：同阅读页，加页角日期印、手写字、底部「记一笔」写入条；左右滑翻天。
- **入口**：首页路牌三块、碑列一屏一碑、笔记场一屏一臂，都靠左右滑换。
- 首屏图量 ≤ 1.5 MB，阅读页 ≤ 300 KB。

## 十、动效词汇

进场三段与三件交互的分镜见 `ui-scene-motion.md`。时长 180 到 420 毫秒，缓出；全长 3.5 秒、短版 0.8 秒、点一下跳过；雾流是仅有的常驻动效；`prefers-reduced-motion` 时全部关掉只留状态变化。
常用词汇：门开、牌亮、钻出、长出、伸出、幽灵汇聚、烛点亮、弹出、递上、翻开、卡片圆弧摆开、翻面、盖印、落笔墨点、放回。

## 十一、生图提示词前导（每次调用都带上，再接零件各自的后缀）

带锚（默认，edit 端点，`-i tools/out/ui/refs/user-gate-sleepy-hollow.jpg`）：

```
Use the reference image only as a style reference: copy its painting style, its color grading (cold teal-blue
night with warm orange candlelight), its brushwork and its level of detail, but do not copy its content or its
text.
```

不带锚时用文字版：

```
Dark gothic fantasy game concept art, dense painterly brushwork with real volume and texture, cold teal-blue
stormy night with a fiery orange glow behind the main subject, black iron, weathered stone and dark wood as
sharp silhouettes rimmed by warm light, misty middle ground, pale far background. Palette: teal night, iron
black, bone white paper, fire orange only in the light. Moody but clean and readable, not gory. No text, no
letters, no watermark, no flat vector, no pixel art.
```

后缀按零件类型：
- 场景：`… Front view. No text or letters anywhere, no watermark.`，手机 2:3、桌面 3:2。
- 零件表：`A reference sheet of N different <零件> … front orthographic view, same warm candlelight from the upper left … each with a smooth blank label plate, no text or letters anywhere. Isolated on a solid flat magenta #FF00FF background, nothing touching the edges, no watermark.`
- 擦改：`Edit this image: … Keep everything else in the picture exactly the same … No text or letters anywhere.`，输入图走 `-i`。

## 十二、命名与登记

`vendor/ui/scenes/`、`spines/`、`covers/`、`notebooks/`、`cards/`、`seals/`、`paper/`、`kit.json`（字段：`file`、`w`、`h`、`slice`、`anchor`、`plate`（题签板矩形）、`prompt`、`date`）。每件零件的题签板坐标登记在 `ui-prompts.md` 的结果列里。

## 对照（已退役）

### 第三稿色板（2026-11-06 晚，紫夜毒绿）

| 名 | 中 | 浅 | 深 |
|---|---|---|---|
| 紫夜 | `#4A2E6B` | `#7A4FA6` | `#2A1840` |
| 墨黑 | `#120C1A` | `#241A30` | `#07040B` |
| 碑灰蓝 | `#5C6382` | `#8C93AE` | `#3A3F58` |
| 骨白 | `#E6DFC8` | `#F2EDDC` | `#C7BFA4` |
| 毒绿幽光 | `#5CF08E` | `#B8FFCC` | `#2E9E5A` |
| 烛光琥珀 | `#F0B54A` | `#FFD98D` | `#B07D2A` |

### 第三稿提示词前导（P004 到 P011 用过）

```
Dark gothic fantasy game concept art, stylized digital painting with bold hard-edged brush shapes and ink-dark
outlines on stone, wood and trees, strong silhouettes, subtle paper grain. Night graveyard: deep violet-purple
storm sky with swirling painted clouds, black bare twisted tree branches framing the top, low toxic-green fog on
the ground, weathered grey-blue tombstones, black gothic ironwork and wood. Only two light sources: eerie green
ghost-glow (from tombstone eyes, fog and spirits) and warm amber candlelight. Palette: violet night, black,
grey-blue stone, bone white, ghost green, candle amber; no red. Moody and mysterious but clean and readable,
not gory. No text, no letters, no watermark, no photorealism, no 3D render look, no flat vector, no pixel art.
```

### 试笔史

第一轮 P001 到 P003（温和蓝夜）、第二轮 P004 到 P009（紫夜毒绿）、第三轮 P012 到 P016（nano 青橙，偏平）都留作对照；第四轮 P017 起（gpt-image-2 高档带锚）为定稿线。为什么第四张图比我们的好，量化的三条在 STATUS 2026-11-06 深夜与 `ui-prompts.md` 里：两家色对三家色、有中间调对压在暗部、一屏一主角对塞八样东西。
