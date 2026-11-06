# 研习录奇幻界面 · 样图是怎么做的、动效怎么设计、我会怎么做

2026-11-06。回答用户看完 Pinterest 收藏（ https://www.pinterest.com/yanghaihy/_pins/ ，十三张）后的三个问题。配合 docs/ui-system-plan.md（总计划）与 docs/ui-style-bible.md（风格圣经）读；本文不改计划，只把"别人怎么做的"和"我们怎么做"说透。

## 一、十三张收藏各是怎么做出来的

Pinterest 自己会给 AI 图打「由 AI 修改」的标；乱码文字、融化的细节是另一个铁证。逐张：

| 序 | 图 | 来源 | 做法判断 | 证据 | 对我们的用处 |
|---|---|---|---|---|---|
| 1 | 壁炉小屋微缩场景 | de Vaal Els 转钉 | AI 生成，仿微缩实景摄影（isometric diorama 一路） | 标「由 AI 修改」；壶、椅、箱处处合理但细节一放大就糊 | 一盏暖光、木与石的配比、桌上杂物的密度：房间场景的气氛参考 |
| 2 | 「招募冒险者」任务板 | 黄慧玲转钉，某国产手游实机截图 | 二维手绘 UI（Photoshop 厚涂）切成零件进引擎，按钮发光与蓝火是引擎里的粒子与叠加层 | 界面带货币 360 与时间 10:16，是截图不是画 | 任务板屏幕的构成：木框、钉上的羊皮纸、一个发光主按钮 |
| 3 | 死灵法师图书馆书柜 | Polycount 论坛 THRONE ROOM 挑战帖 | 三维灰模（ZBrush 雕刻，木纹与骷髅都是雕出来的，还没上色） | 三视图灰色黏土渲染 | 书柜造型语言；也是「三维高模阶段长什么样」的样板 |
| 4 | 书架前翻开的书，五本书封当标签 | 某韩国手游实机截图 | 二维手绘 UI：画好的书架当背景，书封、翻开的书、左侧章节书签各是零件 | 带玩家名、排名、货币，是截图 | 跟研习录要做的几乎一样：书封当导航、翻开的书当内容页、书签当章节 |
| 5 | 悬赏板 | AiSorcery 账号 | AI 生成 | 文字全是乱码（QEST CARNAVAN） | 板上贴纸的构图与密度；文字一律不能用 |
| 6 | 兽人悬赏板 | Grandal Jose，魔兽风 | 三维手绘贴图道具：建模、展 UV、手绘贴图（3DCoat 或 Substance Painter）、渲染 | 作者标「Refs」，是作品图 | 「板」做成三维资产的样子；绳、布、钉、血手印全是贴图里画的 |
| 7 | 猴岛传说菜单 | Telltale《Tales of Monkey Island》2009 实机截图 | 二维手绘 UI：木牌、羊皮纸、绳、蜡烛各一层，文字是引擎字体叠上去 | 游戏本身 | 木牌菜单、字与羊皮纸的关系、深底上一两处亮 |
| 8 | 树根书架 | 转钉 | AI 生成 | 标「由 AI 修改」 | 有机造型书架的极端，我们不走（书没法按数据摆） |
| 9 | 葡萄藤书架 | Etsy 的 STL 商品图 | 三维打印模型的渲染，再经 AI 修图 | 标「由 AI 修改」；商品页 | 雕花边框的密度与节奏 |
| 10 | 青面金角魔法书 | My Huỳnh，ArtStation 一路 | 三维风格化道具：低模加手绘贴图，宝石发光是材质自发光 | 作品渲染图 | 英雄物件「秘典」的三维做法 |
| 11 | Oderich 之书 | Ramon Rodrigo，桌游道具卡 | AI 生成 | 标「由 AI 修改」 | 暗底、紫光、黑手：发光与暗底的对比度参考 |
| 12 | Enlightenment 紫晶书 | Nelson Gretchen | 概念设计表格式（羊皮纸底、四周手写注释、小草图），极可能 AI | 文字乱码，评论区在骂 | 概念表的版式：每件英雄物件的样式图就该长这样 |
| 13 | 时钟书概念表 | 转钉 | 同上，主图加周围线稿变体，极可能 AI | 文字乱码「Primes Magic」 | 同上 |

合计：六张标了 AI、两张疑似 AI、三张游戏实机截图、两张三维道具作品。所以你喜欢的这个"样子"，外面是三条路做出来的：

1. **二维手绘界面**（2、4、7）：游戏公司的正路。
2. **三维道具再渲成图**（3、6、10）：魔兽、炉石一路的道具做法。
3. **生图**（1、5、8、9、11、12、13）：近两年才有的路，产出最快，但文字与细节靠不住。

三条路做出来的图好看在同样三件事上：**材质**（厚涂的笔触、磨损、污渍）、**形体**（雕出来的繁饰：护角、搭扣、藤蔓、骷髅）、**光**（暗底上一两处暖光或魔法光）。我昨晚的 SVG 滤镜试笔只做到了材质的一半，形体与光都没有。

## 二、二维手绘界面是怎么做的（游戏公司的正路）

以炉石为样板。Derek Sakamoto 在 GDC 2015 的演讲《Hearthstone: How to Create an Immersive User Interface》（ https://www.gdcvault.com/play/1022036/ ）讲的是这套：

- **「我们的游戏就是界面」**，口号是「沉浸先于实用」（但玩法仍第一）。
- 界面不是贴在屏幕上的二维图，而是桌上的实物：棋盘是一块木板，牌是有厚度的卡，按钮是木牌与铜扣，每样都能戳、会响。
- 先做风格圣经，再画，画完切零件，零件进引擎（炉石是 Unity）后再加粒子、光、声音。推倒重来过好几次。

通行的生产流程，一张图从无到进游戏：

1. **参考墙与风格圣经**：PureRef 或 Pinterest 排参考；定色板、线、光、材质语言。
2. **线框**：Figma 或 Penpot 画布局，只管位置与信息。
3. **概念图**：Photoshop 或 Krita 厚涂整屏，像第 12、13 张那样一件物件一张概念表（主图加变体草图加注释）。
4. **切零件**：面板切九宫格（四角不缩放、边拉伸、中心平铺），按钮画三态（常态、按下、禁用），图标统一尺寸与描边，材质做成无缝瓷砖。Photoshop 有九宫格插件，我们有 tools/ui/nine.py 与 tile.py。
5. **打图集**：TexturePacker 之类把零件拼成一张大图减少加载。
6. **进引擎**：Unity 的 uGUI 或 NGUI 拼屏；炉石把棋盘上的东西直接当三维物件放在场景里。
7. **引擎里加的东西**：发光、粒子、拖拽物理、音效。这些不在画里，是运行时算的。

三维道具那条路（第 3、6、10 张）就是 docs/bookcase-production.md 已经在用的专业流程：量尺 → 粗模 → 高模雕刻 → 拓扑低模 → 展 UV → 烘焙 → 手绘贴图 → 渲染。差别只在最后一步：游戏里是实时渲染，我们是渲成透明底的图贴进网页。

生图那条路，外面商用套件的做法（itch 上 ZSS Fantasy RPG UI Kit 的开发日志自述）：AI 出底图，人手大量覆盖修瑕、修光、拆层，再交付分层 PSD 与九宫格 PNG。也就是说生图不是终点，是省掉前两步的起点。

## 三、学习游戏类 App 的动效是怎么设计的

### 它们遵守的几条原则

- **一次加一层**：Martin Jonasson 与 Petri Purho 的《Juice it or lose it》（2012 年北欧游戏节）拿一个打砖块游戏示范：先有能玩的静态版，再逐层加缓动、缩放、粒子、震屏、声音，每加一层看一眼效果。这是动效设计的工作方法，不是堆特效。
- **动画十二原则里的几条**：预备（按下前先缩一下）、挤压拉伸（落下的书弹一下）、缓入缓出（出现的东西减速到位，离开的加速走）、跟随与重叠（夹子停了，上面的签还在晃）。
- **反馈要快、奖励要大**：操作反馈控制在两三百毫秒内，太慢太花会烦；完成一章、打卡这种节点才用大动作（宝箱开、纸屑落）。
- **空间要连续**：东西从哪来、到哪去要看得见。书从墙上取下落到展台，不是淡出再淡入。
- **有闲时的呼吸**：烛光摇、尘埃飘、角色眨眼，让画面"活着"但不抢注意。
- **能关**：系统的减少动态设置要尊重。

### 它们用什么做

- **角色与有状态的动画**：Duolingo 的角色在 Rive 里做（美术、骨骼、动画、状态机在一个文件里），一套动画换角色换表情复用，口型用二十多个通用嘴形拼（Duolingo 博客 https://blog.duolingo.com/world-character-visemes ；Rive 用例页 https://rive.app/use-cases/character-animation ）。
- **只播不互动的动画**：After Effects 做，Bodymovin 导出 Lottie，lottie-web 播放。
- **游戏引擎里**：Unity 的 Animator 加 DOTween 做缓动，Particle System 做粒子，Shader 做发光、溶解、闪卡；二维骨骼用 Spine。
- **网页里**：CSS 过渡与关键帧、Web Animations API、GSAP；粒子用 canvas；要着色器才上 PixiJS 或 three.js。Lottie 适合播放型，Rive 适合状态机型，CSS 适合界面过渡（pkgpulse 2026 年的对比 https://www.pkgpulse.com/guides/lottie-vs-rive-vs-css-animations-web-animation-formats-2026 ）。

### 设计动效的工作流程

1. 先列**动效清单**：每条写触发、时长、曲线、声音、能否跳过。风格圣经第九节已有八个词汇（取下、翻开、落下、盖印、拉抽屉、点灯、翻页、封），就从这八个开始。
2. 先做**没有动效的静态版**，确认布局与读得清。
3. **一次加一层**，每层在真机上看一遍，掉帧就减。
4. 奖励动作单独设计（打卡、读完一本、一章封存），其余一律克制。
5. 加声音最后做，一个动作一个声，CC0 音源（freesound）或 jsfxr 合成。

研习录是单文件原生 JS 网页，不引外部 CDN，所以动效首选 CSS 与 Web Animations API，粒子与火光用 canvas；要用 lottie-web 或 Rive 的运行时就得自带进 vendor。眼下没有角色，用不上 Rive。

## 四、如果我来设计这一套

### 它是什么

一间书房，不是一堆页面。书墙放书、档案柜放夹、桌上放牌与本子、展台放正在读的那本。每样东西是实物：有厚度、有材质、能取下、能翻开、会响。七种屏幕（书墙、展台、档案抽屉、档案夹对开、卡、笔记本、阅读器）都是"走到房间某处、拿起某件东西"的视角，导航就是走动。这部分 docs/ui-system-plan.md 第二节已写，不重复。

### 分工（一个人加我，按工作室的岗位想）

| 岗 | 做什么 | 由谁 | 工具 |
|---|---|---|---|
| 美术总监 | 挑参考、定风格圣经、每道门拍板 | 你 | Pinterest 板、PureRef |
| 概念 | 每件英雄物件一张概念表（主图加变体加注释，第 12、13 张的格式） | 生图加我修 | gpt-image-2（现成）、Midjourney 的 Niji 更贴这路画风、本地 ComfyUI 加 SDXL 加 LayerDiffuse 出透明底 |
| 界面美术 | 框、面板、按钮三态、图标、材质瓷砖 | 生图加覆盖修瑕加切片 | Krita（开源厚涂）或 Photoshop；tools/ui 的 cut / nine / tile |
| 三维道具 | 书柜、档案柜、展台、笔记本架、桌 | 我在你开着的 Blender 里按专业流程做 | Blender（建模、雕刻、烘焙、渲染一把抓）；手绘贴图可用 Blender 自带的纹理绘制，要更好再上 Substance Painter 或 3DCoat |
| 动效 | 八个动效加奖励动作 | 我 | CSS、Web Animations API、canvas |
| 技术美术 | 零件登记 kit.json、九宫格进 CSS、书与字由数据生成叠在图上 | 我 | 现有 src/app.js |
| 音效 | 一动一声 | 我找 CC0 | freesound、jsfxr、Audacity |
| 验收 | 盲测对照墙、真机帧率、色弱可读 | 你裁判、我出墙 | tools/ui/wall.py、手机实测 |

### 三层零件各走哪条路

- **英雄家具**（书柜、档案柜、展台、笔记本架、桌）：三维。已经用书柜验证过这条路能走通（docs/bookcase-production.md），而且三维件可以换角度、换光再渲，改尺寸不用重画。
- **物件与零件**（档案夹、卡、本子封面、框、面板、按钮、印章、图标、材质瓷砖）：生图出底，覆盖修瑕，抠底切片。这是第 2、4、7 张游戏截图里零件的来路，只是把"人画"换成"生图加人修"。
- **由数据长出来的东西**（每本书的书脊与封面、每张卡的字、本子的纸面、进度与状态印）：代码生成，叠在上面两层之上。书的装帧已经是这么做的。

### 流程（按计划的八个阶段，每阶段一道门）

0. **风格圣经**：从这十三张加之前的样张取色校正色板；选三件试笔（一个框、一只档案夹、一本书封）报提示词与价钱；生成后混进参考跑 wall.py 盲测，认不出才过门。
1. **原子**：材质瓷砖六种、框五种九宫格、控件十种三态、图标二十四枚、状态印六枚。
2. **档案夹打样**：抽屉、夹、对开三屏静态样稿，与参考并排过门，再接数据。
3. **房间**：主场景与导航。
4. **书墙**：书柜场景重出，书由数据摆。
5. **笔记本与阅读器**。
6. **动效**：按第三节的流程加。
7. **App 壳**：PWA 与手机布局。

每件东西的小循环都一样：样式图 → 生成或建模 → 抠底切片 → 进页 → 并排参考过门。门不过就不往下走，这是昨天两次自绘失败后定的规矩：方向对了不等于画质到了。

### 一个人做不了的

插画级的手绘覆盖（把生图修到第 7、10 张那种干净）是真功夫。两条出路：你在 Krita 里学最基础的覆盖修瑕（修边、压暗、提亮，不用会画），或者按记忆里的外请触发条件请一位插画师只修英雄物件。生图负责量，人负责最后那一成。

## 五、来源

- GDC 2015 演讲页 https://www.gdcvault.com/play/1022036/ ；Game Developer 的转述 https://gamedeveloper.com/design/video-designing-an-immersive-user-interface-for-i-hearthstone-i-
- Juice it or lose it 的讲解 https://gamejuice.pages.dev/articles/juice-it-or-lose-it-lessons ；界面加 juice 的分寸 https://bugnet.io/blog/how-to-add-juice-to-your-ui
- Duolingo 口型博客 https://blog.duolingo.com/world-character-visemes ；Rive 角色动画用例 https://rive.app/use-cases/character-animation ；Rive 对 Lottie https://rive.app/blog/rive-as-a-lottie-alternative
- Lottie、Rive、CSS 三选一 https://www.pkgpulse.com/guides/lottie-vs-rive-vs-css-animations-web-animation-formats-2026
- 九宫格工具 https://github.com/ScottWoodhams/UI-9-Slicer ；ZSS 套件的生产自述 https://zss-game-lab.itch.io/zss-fantasy-rpg-ui-kit-hand-painted/devlog/1141931/release-fantasy-rpg-ui-kit-is-finally-out-launch-sale-30-rpg-ui-7
- 三维风格化道具流程 https://80.lv/articles/creating-a-stylized-prop-using-zbrush-substance-painter
