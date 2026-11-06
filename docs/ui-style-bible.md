# 研习录奇幻界面 · 风格圣经（第二稿：月夜墓场）

一页纸，全站所有零件、场景和生图提示词都从这里取词。蓝图见 `ui-system-plan.md`，进场动效见 `ui-scene-motion.md`，工具见 `tools/ui/README.md`。
第一稿（2026-11-06 上午）是书房旧纸橄榄栗红一路；同日晚用户定主题为**墓地一套、三区共用、首页是独立的墓场进场页**，本稿按此重写，色板待三件试笔过门后对图校正。

## 一、一句话

月夜墓场里的书房。夜靛的天、一弯残月、贴地的薄雾；碑石、枯木、铁、骨、旧纸；冷的幽灵蓝对暖的灯笼琥珀。画成绘本厚涂：笔触看得见、边缘柔、深靛描边、纸纹。**温和不恐怖**：骷髅是书童，幽灵是书的魂，墓碑是书架和档案柜，一切圆润、安静、可爱。

## 二、色板（待校正：试笔过门后对图取色）

| 名 | 用处 | 中 | 浅 | 深 |
|---|---|---|---|---|
| 夜靛 | 天空、页面底、暗部 | `#1C2347` | `#2A3468` | `#10142B` |
| 碑石灰 | 墓碑、石板、框、底座 | `#6F7388` | `#959AB0` | `#474A5C` |
| 骨白 | 骷髅、纸面、正文底、月 | `#E9E2CC` | `#F4EFE0` | `#CBC3A8` |
| 枯木褐 | 枯树、木件、格层板、书脊之一 | `#5B4836` | `#7C664D` | `#3B2D20` |
| 幽蓝 | 幽灵、未读、冷光、月光边 | `#8FD0FF` | `#C9EBFF` | `#4D9BD1` |
| 灯笼琥珀 | 在读、选中、暖光、黄铜 | `#F0B54A` | `#FFD98D` | `#B07D2A` |
| 幽紫 | 只做点缀：封蜡、符文、魔法书的光 | `#8A6BD0` | `#B79CF0` | `#5C4494` |
| 墨靛 | 描边、字、刻字槽 | `#141A33` | `#2B3356` | `#0B0E1F` |

- 描边统一用墨靛深档 `#0B0E1F`，不透明度 85%，不用纯黑也不用褐。
- 阴影偏夜靛，高光偏骨白；暖光只出现在灯笼照到的地方。
- **色弱规则**：意义只放在「幽蓝对琥珀」这一对冷暖上（红绿色弱分得清蓝黄）；幽紫永远不承担意义；红和绿不进色板。
- 整体是暗底：页面底是夜靛，纸面和正文区是骨白，二者对比 ≥ 12:1。

## 三、线

- 深靛描边，外轮廓粗、内部结构线细，约物件边长的 1.5% 到 2%，1x 下约 2 到 3 像素；转角略粗，线有呼吸，暗部可用色块代替线。
- 幽灵、雾、光不描边，用柔边与叠加。
- 不用均匀的矢量线，不用像素风，不用写实无线。

## 四、光

- **两盏光，各司其职**：月光是环境（冷、从上方来，给石头、骨和雾一道幽蓝的边），灯笼是注意力（暖、近处、一处）。看哪里，灯笼就在哪里：在读的书、选中的碑、递过来的本子。
- 厚涂三档：固有色、暗部、高光，外加月光的一道冷边。不画渐变，用笔触衔接。
- 投影短、软、偏夜靛；地上的物件底下一圈雾代替长影。

## 五、材质与物件语言

| 材质 | 画法要点 | 用在 |
|---|---|---|
| 碑石 | 风化的棱、一两道裂、苔点、刻字槽里更深一档 | 墓碑书架、档案碑、祭坛、框、碑额 |
| 骨 | 圆润无锋、骨白加冷灰暗部 | 骷髅书童、骨质小件（笔架、书立） |
| 枯木 | 扭、裂、无叶或残叶、油亮的棱 | 枯树、格层板、木牌、栅门柱 |
| 铁 | 锈斑、铆钉、链、栅、锁 | 铁门、灯笼架、锁链（封存）、HUD 件 |
| 旧纸 | 纸纹、毛边、淡折痕、边角微黄 | 卡、页面、卷轴、本子纸面 |
| 蜡与符文 | 厚、指压痕、幽紫微光 | 封印、状态印、魔法书 |
| 雾 | 贴地的带状、半透明、慢 | 地面、进场、投影替身 |
| 幽光 | 柔边光点加拖尾 | 幽灵、未读的书、汇聚粒子 |

每件大物件至少有碑石、枯木、铁中的两种，用一处铁件或灯笼做视觉锚点。书皮、卡、本子仍是旧纸与布面，只是放在碑石里、照着冷光。

## 六、纸纹与正文可读性

- 全站一张纸纹叠加图，4% 到 6% 不透明度。正文区（阅读器、翻开的书、本子纸面）一律骨白平纸、墨靛字，对比 ≥ 7:1，字号 ≥ 16 像素，行长 32 到 40 字。
- 花饰、裂纹、苔点只在边角和碑额，不进正文；文字不压厚涂纹理，要压先垫纸。
- 暗底上的小字（碑上的计数、HUD）用骨白，字号 ≥ 14 像素，加一圈夜靛描边保证在雾和光上也读得清。

## 七、字

- 自带三款照旧：Noto Serif SC（标题，加 0.06em 字距有刻字感）、Noto Sans SC（正文）、Barlow 与 Barlow Condensed（界面与数字）；Ma Shan Zheng 做题签与印。
- 待定：正文换不换霞鹜文楷。碑上的刻字可用 SVG 文字加内阴影做出凿痕，不另找字体。

## 八、状态语言（不靠颜色）

| 状态 | 形 | 字 |
|---|---|---|
| 没读 | 幽灵：书脊半透明、微微浮着、一点幽光 | 未 |
| 在读 | 灯笼点在它旁边，暖光圈 | 读 |
| 读完 | 碑石上刻了字（书脊落实、题签刻入） | 完 |
| 写了批注 | 纸条从书口伸出 | 批 |
| 结卷引用 | 链环（一卡多夹的「引」） | 引 |
| 封存 | 铁锁加蜡封，整只夹子合上 | 封 |
| 待归位 | 沙漏，夹子敞口纸角伸出 | 待 |

## 九、动效词汇

进场三段见 `ui-scene-motion.md`（升起 / 长出 / 爬出，汇聚，落定；全长 3.5 秒、短版 0.8 秒、点一下跳过）。
常用词汇八个：幽灵汇聚、灯笼点亮、翻开（书 / 碑面 / 本子）、盖印、落土、雾流、幽光呼吸、递过来。
时长 180 到 420 毫秒，缓出；雾流与幽光呼吸是仅有的常驻动效；`prefers-reduced-motion` 时全部关掉只留状态变化。

## 十、生图提示词前导（每次调用都原样带上，再接零件各自的后缀）

```
Storybook fantasy game UI concept art, thick gouache painterly style with visible brush strokes, soft painted edges,
deep-indigo outlines (never black, never brown), subtle paper grain. Night graveyard theme: deep indigo night sky,
crescent moon, low drifting fog, weathered grey tombstones, bare twisted trees, old iron. Two lights only: cool
moonlight from above (ghost-blue rim light) and one warm amber lantern glow. Muted desaturated palette: night indigo,
tombstone grey, bone white, dead-wood brown, ghost blue, lantern amber; no pure red, no pure green. Gentle and cozy,
not horror: friendly, rounded shapes. No text, no letters, no watermark, no photorealism, no 3D render look,
no flat vector, no pixel art.
```

后缀按零件类型：
- 场景背景：`wide establishing shot …, full-bleed scene`（不要洋红底），桌面 3:2、手机 2:3 各出一张。
- 材质瓷砖：`seamless texture swatch of <材质>, fills the whole frame, even cool lighting`。
- 框与角花：`one ornamental stone corner piece / one carved stone panel frame, front view, symmetric, resting flat`。
- 小件与图标表：`a sheet of N <小件> in a neat grid, same scale, same lighting, generous spacing`。
- 英雄物件与角色：`front view, single object/character, feet on the ground` 加 `Isolated on a solid flat magenta #FF00FF background, nothing touching the edges`；带本机样式图走 edit 端点。

## 十一、命名与登记

`vendor/ui/scenes/<场景>-desk.webp` 与 `-phone.webp`（背景与雾层）、`vendor/ui/tiles/<材质>.webp`、`vendor/ui/frames/<框名>.png`、`vendor/ui/icons/<名>.svg`、`vendor/ui/props/<物件>@1x.webp` 与 `@2x.webp`、`vendor/ui/char/skeleton/<动作>.webp`（雪碧图）。
`vendor/ui/kit.json` 每件一条：`file`、`w`、`h`、`slice`（九宫格四边）、`anchor`（落地点）、`frames`（雪碧图帧数与帧率）、`prompt`（提示词编号，正文在 `docs/ui-prompts.md`）、`date`。

## 十二、阶段 0 的门：三件试笔

| 件 | 定什么 | 比例 | 张数与价 |
|---|---|---|---|
| 甲 首页墓场背景 | 整个主题的气质：天、月、雾、碑、树、铁门、一盏灯笼 | 3:2 | 2 张，中档 0.376 元一张 |
| 乙 墓碑书架 | 英雄家具的形制：碑形、碑额、三层格、土堆底座 | 2:3 洋红底 | 2 张 |
| 丙 骷髅书童 | 角色的样子（之后在 Blender 里照它建模） | 2:3 洋红底 | 2 张 |

六张约 2.3 元；过门后英雄件用高档（1.498 元一张）重出。
通过条件：`tools/ui/wall.py` 把三件混进 Pinterest 收藏里的游戏截图与三维道具图中，明度、彩度、描边密度、饱和四项落在参考范围内；用户看墙猜不出哪几张是我们的；骷髅看着温和不吓人。

提示词（前导之后接）：
- 甲：`Wide establishing shot of a small hillside graveyard at night used as a game title screen: a wrought-iron gate in the foreground left, a bare twisted tree on the right, three large arched tombstones with blank faces standing in a row in the middle ground (left, center, right), a winding path between them, one lit lantern on a wooden post beside the path, fog along the ground, crescent moon upper right, empty sky at the top. 3:2 landscape, full-bleed scene.`
- 乙：`A single bookcase shaped like a tall arched tombstone: weathered grey stone with a carved rounded top and a blank carved band across the top for a name, three open shelves cut into the stone, a mound of earth and grass at the base, a small iron lantern hook on one side, a few cracks and moss spots. Shelves are empty. Front view, resting flat. Isolated on a solid flat magenta #FF00FF background, nothing touching the edges.`
- 丙：`A small friendly skeleton librarian standing and holding a closed notebook with both hands in front of its chest: slightly oversized round skull, soft rounded bones, calm kind expression, a tattered dark-indigo scholar's cloak over the shoulders, bone-white with cool blue shading and a warm amber touch on one side from a lantern. Full body, front view, feet on the ground, neutral idle pose. Isolated on a solid flat magenta #FF00FF background, nothing touching the edges.`
