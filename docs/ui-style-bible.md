# 研习录奇幻界面 · 风格圣经（阶段 0 草稿）

一页纸，全站所有零件和生图提示词都从这里取词。总计划见 `ui-system-plan.md`，工具见 `tools/ui/README.md`。
标「待校正」的条目等用户的 Pinterest 风格板到了再按图定；其余是从四张风格图和已有决定里定下的，已经可用。

## 一、一句话

一间可以养的书房，画成绘本厚涂：旧纸、皮、木、黄铜，深褐描边，暖灯单光源，整张有纸纹。像一本手绘的奇幻游戏设定集，不像写实照片，也不像扁平图标。

## 二、色板（待校正：十六进制等风格板到了对图取色）

| 名 | 用处 | 中 | 浅 | 深 |
|---|---|---|---|---|
| 旧纸米 | 页面底、纸面板、卡 | `#E8DCC0` | `#F3EBD6` | `#D4C4A0` |
| 橄榄绿 | 墙布、呢面、书皮之一、领域色 | `#5E6B3A` | `#7C8A4E` | `#3F4A26` |
| 栗红 | 皮面、丝带、书皮之一、印泥 | `#7A2E2A` | `#9A4038` | `#561E1C` |
| 黄铜 | 包角、铆钉、搭扣、徽章、高亮 | `#B8923E` | `#D4B261` | `#8A6A28` |
| 墨褐 | 描边、字、木的暗部、阴影 | `#3B2A1E` | `#5A4334` | `#241810` |

- 描边色统一用墨褐深档 `#241810`，不透明度 85%，不用纯黑。
- 阴影偏栗红或墨褐，不偏灰黑；高光偏旧纸米，不偏纯白。
- 色弱规则：状态永远不靠红和绿区分，用形状、印章、文字和明暗。橄榄绿与栗红可以同屏，但不能承担"对与错、开与关"的意义。

## 三、线

- 深褐描边，外轮廓粗、内部结构线细，大约是物件边长的 1.5% 到 2%，在 1x 下约 2 到 3 像素。
- 描边不必闭合，暗部可以用色块代替线；线的粗细有呼吸，转角略粗。
- 不用矢量感的均匀线，不用像素风，不用写实无线。

## 四、光

- 全站单一暖光源，左上 45 度，油灯色温。所有英雄物件按同一方向打光，这样它们放在一个房间里才像一家的。
- 厚涂三档：固有色、暗部、高光，外加一道黄铜或皮面的小反光。不画渐变过渡，用笔触衔接。
- 投影短、软、偏暖，物件底下一道就够，不做长影。

## 五、材质与物件语言

| 材质 | 画法要点 | 用在 |
|---|---|---|
| 纸 | 纸纹、毛边、淡折痕、边角微黄 | 页面、卡、纸条、卷轴 |
| 皮 | 鞣纹、磨白的棱、缝线 | 书皮、夹子、笔记本、搭扣带 |
| 木 | 直纹、刀痕、油亮的边 | 书柜、抽屉、书桌、木牌 |
| 黄铜 | 包角、铆钉、搭扣、锁片、一点磨亮高光 | 五金件、徽章、HUD 四件 |
| 蜡 | 厚、有指压痕、一枚印 | 封印、状态印 |
| 墨 | 手写、略晕 | 题签、批注、数字 |
| 布 | 呢面、织纹 | 墙面、书签带、丝带 |

五金词汇来自宝箱概念表：每一件大物件都要有皮、木、黄铜中的至少两种，用黄铜小件做视觉锚点。

## 六、纸纹与正文可读性

- 全站一张纸纹叠加图，4% 到 6% 不透明度，正文区也有，但正文下面是平纸：不画厚涂笔触、不放花饰、不放材质。
- 正文字色墨褐中档以深，对正文底的对比不低于 7:1；正文字号不小于 16 像素；行长 32 到 40 个汉字。
- 花饰只在边角和标题下，不进正文；文字永远不压在厚涂纹理上，要压就先垫一张纸。

## 七、字

- 现有三款自带：Noto Serif SC（标题）、Noto Sans SC（正文）、Barlow 与 Barlow Condensed（界面与数字）；手写味的 Ma Shan Zheng 已在库里，可做题签和印。
- 待定：正文换不换霞鹜文楷。原则：标题可以有书卷气，正文要好读，数字要等宽对齐。

## 八、状态语言（不靠颜色）

| 状态 | 形 | 字 |
|---|---|---|
| 没读 | 空槽、虚线框 | 未 |
| 读了 | 一枚墨点或一道折角 | 读 |
| 写了批注 | 批注角上的小纸条 | 批 |
| 结卷引用 | 蜡封 | 引 |
| 封存 | 整只夹子打蜡封、带子扣上 | 封 |
| 待归位 | 夹子敞口、纸角伸出 | 待 |

## 九、动效词汇（八个，够用就不再加）

翻页、拆封（蜡裂开）、抽屉拉出、牌翻面、蜡烛呼吸、墨迹晕开、丝带滑动、尘光漂浮。
时长 180 到 420 毫秒，缓出；呼吸与尘光是唯一的常驻动效，各一处；`prefers-reduced-motion` 时全部关掉，只留状态变化。

## 十、生图提示词前导（每次调用都原样带上，再接零件各自的后缀）

```
Storybook fantasy UI asset, thick gouache / impasto painterly style, warm single key light from upper-left (oil lamp),
dark umber outlines (not black), paper grain over everything, muted palette: old-paper cream, olive green, chestnut red,
brass gold, ink brown. Materials: aged paper, worn leather, oak wood, brass corners and rivets, wax seals.
Hand-painted concept-art sheet look, no photorealism, no 3D render look, no flat vector, no pixel art, no text, no watermark.
Isolated on a solid flat magenta #FF00FF background, nothing touching the edges.
```

后缀按零件类型：
- 材质瓷砖：`seamless texture swatch of <材质>, fills the whole frame, even lighting`（不要洋红底）。
- 框与角花：`one ornamental corner piece / one panel frame, front view, symmetric, resting flat`。
- 小件与图标表：`a sheet of N <小件> in a neat grid, same scale, same lighting, generous spacing`。
- 英雄物件：带本机的概念表和两到三张参考图走 edit 端点：`front three-quarter view, matches the attached style sheet exactly, single object`。

## 十一、命名与登记

`vendor/ui/tiles/<材质>.webp`、`vendor/ui/frames/<框名>.png`、`vendor/ui/icons/<名>.svg`、`vendor/ui/props/<物件>@1x.webp` 与 `@2x.webp`。
`vendor/ui/kit.json` 每件一条：`file`、`w`、`h`、`slice`（九宫格四边）、`anchor`（物件落地点）、`prompt`（提示词编号，正文在 `docs/ui-prompts.md`）、`date`。

## 十二、阶段 0 的门

三件试笔：一块纸面板（九宫格）、一只档案夹（英雄物件）、一组五个图标（零件表）。
通过条件：`tools/ui/wall.py` 把三件混进风格板的图里，明度、彩度、描边密度、饱和四项都落在参考范围内；用户看墙猜不出哪几张是我们的。
