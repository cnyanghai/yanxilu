---
type: references
project: yanxilu
last_scan: 2026-11-13
---

# 已有方案与参考

## 结论（先看这里）

- 可直接复用：Three.js（引擎，自带进 vendor）；gltf-transform 做 Draco / KTX2 压缩；Kenney、Kay Lousberg 的 CC0 低多边形家具包做灰盒；版本 1 已有的 canvas 书脊 / 盒面 / 牌背绘制逻辑直接当三维贴图。
- 值得借鉴：kriss.ai 的"一个 URL 一间房、总览是剖面"的结构和"说明卡片贴在屏幕边上不进三维"；Bruno Simon 的"光照烘焙进贴图、场景里不放实时光"；igloo.inc 的"一种材质、UI 画在场景里、装饰承担信息"。
- 我们的差异点：参考站的房间内容是写死的，我们的每间房由个人数据生成并每天变化（几百本书、几十个盒、几百张牌、会长的植物）；参考站是看一次的展示页，我们是每天用的工具；材质宇宙是纸木墨铜而不是黏土或冰。
- 是否应该放弃自研：不放弃。没有现成产品同时满足"数据驱动的房间 + 可换风格 + 自托管 + 国内可用"。但三维资产不自研：建筑和家具用 CC0 套件起步，再决定是 Blender 手工还是 AI 生成。

## 检索记录

| 日期 | 渠道 | 查询词 | 结果概述 |
|---|---|---|---|
| 2026-10-28 | 实地（Chrome） | igloo.inc 首页；kriss.ai 首页、/home/overview、三间房 | 两站都看完整，截图在会话里，不入库 |
| 2026-10-28 | WebFetch | Awwwards 两篇案例研究 | 拿到两站技术栈和制作流程 |
| 2026-10-28 | GitHub | three.js room portfolio / isometric room threejs / react-three-fiber room / my-room-in-3d / threlte / needle-engine / babylon.js / awesome threejs / gaussian splatting web viewer / 3d-portfolio topic | 房间类成品多是作品集，可用的只有 Bruno Simon 和 flo-bit 两个；引擎层 three.js 一家独大 |
| 2026-10-28 | WebSearch | kriss.ai case study；3D room scroll-driven websites；Rooms.xyz；Bruno Simon baked lighting；three.js 国内移动端 glTF Draco KTX2；AI 3D 生成 Tripo Meshy Hunyuan3D | 国内微信浏览器 WebGL 的专项资料没搜到，要自己实测 |
| 2026-10-28 | brain 查重 | three.js / webgl / spline | 只有 3DGS 商业图景对话和微缩IP的 Godot 丹房原型沾边，没有重复项目 |
| 2026-11-04 | WebSearch + GitHub | 最受欢迎的笔记产品与设计模式：Notion / Obsidian / OneNote / Apple Notes / Bear / Capacities / Tana / Heptabase / Logseq / flomo / 语雀 / 思源 / memos；Goodnotes / Notability 拟物笔记本；每日笔记与快速捕捉模式 | 结论归成五种流派，见下面「笔记本设计调研」一节 |
| 2026-11-05 | Commons API + Poly Haven API | 笔记本架与展台的参考墙：分类 Bookrests、Qur'an stands、Bookstands、Lecterns、Analogions、Bookwheel、Writing slopes、Display stands、Magazine stands、Chinese furniture in the MET；Poly Haven 模型 chinese_console_table、chinese_cabinet、painted_wooden_shelves、katana_stand_01、modern_wooden_cabinet、drawer_cabinet、brass_candleholders、mantel_clock_01 | 拼成 30 张的参考墙（本机 tools/out/refwall.jpg，不入库），四个方向：中式条案与柜 / 书托与经架 / 西式读经台与读写台 / 现代陈列架；等用户圈方向 |
| 2026-11-06 | Commons 分类 + WebSearch | 档案架与档案盒参考：Card catalogs、Pigeonholes、Document boxes、Scroll cases、Archive boxes、Hollinger box、Archives storage、Type cases、Filing cabinets、China cabinets；Hollinger / Solander 盒与档案馆上架方式；Zotero / DEVONthink / Are.na / Obsidian canvas 的集合界面 | 27 张参考墙（本机 tools/out/refwall-archive.jpg），结论在 docs/archive-design.md 第三节 |
| 2026-11-06 | WebSearch | 卡怎么存放：mymind（无文件夹只搜索）、Raindrop（收藏夹加标签）、Are.na（block 多 channel）、Milanote / Kosmik / Muse（空间板）、Luhmann 卡片盒（文献卡与想法卡两盒、固定编号加索引） | 结论在 docs/archive-design.md 第五节第 2 小节：借 Are.na 的引卡、Luhmann 的两盒分工、空间板做工作面；mymind 与 Raindrop 排除 |
| 2026-11-06 | 用户给的三张图 + Pinterest + WebSearch + Steam | 奇幻风 UI：魔法觉醒日记本、ROVAI 使命板、挂夹抽屉；Pinterest「游戏ui」搜索页；图书管理员整理游戏；UI 生产流水线（手绘 / AI 辅助 / 九宫格 / border-image） | 结论在 docs/archive-design.md 第六节：形式定为挂夹抽屉 → 夹子 → 活页对开；生产用生图加切片，不用 Blender |
| 2026-11-06 | 用户给的四张风格图 + Pinterest「游戏 书架」 | 绘本厚涂的定调图：Legendary Journey 海报、永恒之柱式日志界面、Cresendo 宝箱概念表、皮面魔法书；Pinterest 书架搜索页 | 结论在 docs/ui-system-plan.md 第一节：色板五色、书即界面、概念表当样式图、写实物只取形制 |
| 2026-11-08 | 用户给的两张图 | 纸艺界面（Planfix CRM 概念）与 MYTHOS 扑克牌盒 | 量色相与明度（都在暖棕一族、靠明度分层）；结论进条目两条与审视稿六之三 |
| 2026-11-11 | 另一个会话「Igloo 网站动效分析」 + WebSearch | igloo.inc 动效实测结论；炉石界面与开包的设计讲座；边专注边布置房间的游戏；Are.na；Anki 共享牌组 | 用户重述产品目的、问怎样做到惊艳之后做的查证；五条进条目，两条待看 |
| 2026-11-11 | gh search + WebSearch | card pack opening three.js / booster pack opening animation / hearthstone pack opening；宝可梦卡牌口袋版与炉石的开包设计 | GitHub 上没有能直接用的三维开包实现（只有文字模拟器和一个零星的网页组件），自己做；两款游戏的做法三条进条目 |
| 2026-11-12 | gh search + WebSearch | 3d bookshelf / bookshelf threejs / virtual bookshelf 3d；3D bookshelf web UI book spines pull out；reading app spine view unread vs read at a glance | 有一个同类的开源整机（KoreShelf）和一个七本书的展示页（complete-shelf），都不是能嵌进来的部件，也都不回答「一眼看出读过多少」；自己做灰盒，四条进条目 |
| 2026-11-12 | WebSearch | Letterboxd four favourites profile；Sims 4 Gallery download rooms save to my library；Notion duplicate public page | 「三秒看懂一个人」和「一个动作带走一整套」各有成熟做法，都是平面界面里的按钮和列表，没有能直接用的部件；三条做法进条目，进门样机自己做 |
| 2026-11-13 | WebSearch | image to 3D model generator comparison 2026；three.js baked lighting mobile lightmap vs realtime；Book of Hours library art style；CC0 3D models books bookshelf；TCG Pocket pack opening foil shader three.js；Tiny Bookshop art style；three.js clay toy miniature look | 选外观前查生产方式与现成素材。没有能直接拿来当外观的现成整套：书、架子、牌都是规则形体，而且书是每个人自己的几百本，书脊只能现场排；图生三维各家评测互相打架，这一步用不上；材质贴图和环境光图有全 CC0 的来源（Poly Haven），旧书房方向用得上；光的做法有共识（静的烘、动的留一盏实时光）。七条进条目 |
| 2026-11-13 | Poly Haven API（只读清单，没下载） | 贴图类别 wood（138 个）、fabric（43 个）、leather（6 个）、paper（0 个）；逐个查了 dark_wood、rosewood_veneer1、fine_grained_wood、wood_table_001、book_pattern、rough_linen、brown_leather 的文件与大小 | 用户定外观旧书房以后，为「材质」这一门找木纹与布纹。有合用的：两种深色木头、一张书布的布纹；牛皮纸没有（纸类是空的），继续用代码画的纸浆。一条进条目，等用户点头再下载 |
| 2026-11-13 | WebSearch；本仓库 `docs/bookcase-production.md` | bookcase crown molding proportions cornice height projection classical furniture face frame plinth base dimensions；hardcover book anatomy dimensions squares 3mm board thickness rounded spine shoulder joint bookbinding | 旧书房「造型」一门的量尺。书柜线脚没有现成的一张尺寸表，查到的是比例上的规矩；书的构造有常规数字。两条进条目。没有下载参考照片（下载要先问用户），并排照片对形这一步留着 |
| 2026-11-14 | 本仓库 `docs/cover-masters.md` + WebSearch | bookbinding spine anatomy raised bands compartments lettering piece contrasting label gilt tooling；汉译世界学术名著丛书 书脊颜色 分类；color blind safe categorical palette deuteranopia vary lightness blue yellow axis；Japanese book obi band | 用户说书架上的书只有两个颜色、不好看，重新定书的颜色和款式之前查的。仓库里 11-03 已经查过「书皮跟谁学」，结论还作数（私人书房美在每本不同、一本不超过两色加一种金、平的不假装浮雕、状态长在书上不另加零件）；这次补了四件事：书脊的构造和皮签、按类分色的丛书、红绿色弱下怎么配色、腰封。四条进条目 |
| 2026-11-14 | WebSearch；本仓库 `docs/notebook-design.md`、README | solander box clamshell box archival anatomy spine label holder；quarter bound notebook ledger cloth spine paper label cover elastic band | 做档案架、笔记本架的旧书房版之前查的：牌盒和本子在一间旧书房里该是什么东西。牌盒取「书形的函盒，朝外一头装金属签框」，本子取「布脊纸面的硬皮本，封面贴签、带松紧带和书签带」；摆法照仓库里 11-04 的笔记本设计稿（封面朝外）和主站档案架（盒厚等于件数）。两条进条目 |

## 条目

| 来源 | 是什么 | 可借鉴 | 不适用的原因 | 结论 |
|---|---|---|---|---|
| 书形的函盒：维基百科《Solander box》 https://en.wikipedia.com/wiki/Solander_box ；美国档案工作者协会词典《clamshell box》 https://dictionary.archivists.org/entry/clamshell-box.html ；Gaylord 的 Solander Museum Case 商品页 https://www.gaylord.com/Preservation/Document-Preservation/Storage-Boxes/Solander-Museum-Case/p/HYB02362 | 图书馆、档案馆装手稿、版画、珍本的盒子：做成一本书的样子立在架上，书脊那一面是活的，打开能摊平；朝外的一面装一只金属签框，插一张纸签，摞起来、排起来都认得出是哪一盒 | 旧书房里的牌盒就做成这个：布面的函盒，朝外一头装铜签框写盒名，一道盒盖的缝，一个拉环；颜色用书的那六个色系，一类一个 | 真的函盒是平放、摞着的；我们立着排，厚度跟着牌数走，才能一眼看出哪盒多 | 采纳（2026-11-14 档案架第一版） |
| 布脊纸面的本子：ABAA 词汇表《Quarter binding》 https://abaa.org/glossary/entry/quarter-binding ；Friesens《Quarter binding》 https://www.friesens.com/books/binding/quarter-binding-2/ ；Clairefontaine 1951 布脊本商品页 https://www.goldspot.com/products/clairefontaine-1951-cloth-lined-black-5-x-8 | 四分之一装：书脊用一种料（布或皮），只包到封面上五分之一左右，封面其余部分是另一种料；老式笔记本、账簿常这么做，封面上留一块写名字的签，另有松紧带和书签带 | 旧书房里的笔记本：深色布脊包到封面五分之一，封面是那六个色系里的一种，贴一张纸签写本名和页数，右边一道松紧带；今天写过的垂着书签带。和书一眼分得开（书是整面一种布、书脊朝外） | 无 | 采纳（2026-11-14 笔记本架第一版） |
| 书脊的构造与皮签：State Library of NSW《Book spines》 https://www.sl.nsw.gov.au/node/206256 ；iBookBinding《Book Anatomy》 https://ibookbinding.com/blog/book-anatomy-parts-book ；Etherington & Roberts《Bookbinding and the Conservation of Books》 https://cool.culturalheritage.org/don/dt/dt0226.html | 老书的书脊怎么分格：缝书的绳在皮面下鼓成几道竹节，把书脊分成几格，书名放在其中一格；十八世纪起书名常烫在另贴的一小块异色皮上（皮签）；线可以烫金也可以只压不上金 | 旧书房书脊的四种款式里「皮签加竹节」的依据：书名在一格异色的皮签里烫金，上下几道竹节；其余款式（两道线、宽带、纸题签）是同一套零件的减法 | 西文书名横排，皮签是扁的一格；中文竖排，签要竖长 | 采纳（2026-11-14 书脊款式之一） |
| 按类分色的丛书：商务印书馆「汉译世界学术名著丛书」（豆瓣整理的总目录 https://book.douban.com/subject/1604570/discussion/15260865 、分类书单 https://www.douban.com/doulist/41598/ ） | 一套书按学科分色，书脊一个颜色一类（查到的两条：哲学类桔黄、政治法律社会类绿），摆在一起是一面按颜色分块的墙 | 颜色是书自己的属性（哪一类），不是读没读；按类放的时候一类一块颜色，一眼看出哪类多 | 它是一套书，每本一模一样；我们是私人书房，同一类里要有深浅和款式的差别，不能像一套 | 借鉴（2026-11-14：一类一个色系，每个色系三个深浅、四种款式） |
| 红绿色弱下怎么配色：欧盟数据可视化指南《Accessible colour palettes》 https://data.europa.eu/apps/data-visualisation-guide/accessible-colour-palettes ；Adobe《Color choices that are accessible》 https://blog.adobe.com/en/publish/2020/09/16/color-choices-that-are-accessible ；Martin Krzywinski 的色盲调色板页 https://mk.bcgsc.ca/colorblind/palettes.mhtml | 共识：明度的差别最靠得住；红绿色弱的人蓝黄这条轴基本完好；类别不要超过六到八个，再多就要加形状或文字；配完要用模拟器按红色盲、绿色盲各看一遍 | 六个色系按「明度 × 蓝黄」排开，不靠红绿；在屏上实际显示的颜色上跑两种色盲的模拟（Machado 2009 的矩阵），色系两两之间都要分得开 | 讲的是图表；书布还要好看、要和木头架子分得开，这些它不管 | 采纳（2026-11-14，数字见 lab/README.md） |
| 腰封：维基百科《Obi (publishing)》 https://en.wikipedia.org/wiki/Obi_(publishing) | 围在书下半截的一圈纸，套在封面或护封外面；日本的新书几乎都有，中文书也常见 | 「买来还没读的书，腰封还在」是人人认得的样子：没读的书脚围一圈浅色的纸，读起来就摘了；每本一样高，一排书的腰封齐成一条线 | 真的腰封印满广告语；我们只印两道细线，抽出来时印分类和页数 | 采纳（2026-11-14，代替原来「没读的整本包牛皮纸」） |
| 线脚的比例：Fine Homebuilding《Classical Proportions Make Attractive Trim》 https://www.finehomebuilding.com/project-guides/finish-trim-carpentry/classical-proportions-make-attractive-trim ；Woodsmith《Making a Built-Up Crown Molding》 https://www.woodsmith.com/article/making-a-built-up-crown-molding/ ；WoodWeb《Stating Dimensions for Crown Moulding》 https://woodweb.com/knowledge_base/Stating_Dimensions.html | 木工杂志讲压顶线怎么定大小：按古典柱式的比例走，组合压顶线里凹弧、平带、反曲线几段大小相近；说尺寸时把高和出挑分开说；先按原大画出来看 | 压顶线做成三段相近的组合（凹弧 1.2、平带 1.6、反曲线 1.9，另加几道小平线），高 5.9 出 4.6 厘米为原大，再整体缩到七成五给书让地方；底座用一段立面上收一道反曲线 | 讲的是房间里的顶角线，不是书柜；书柜专用的尺寸表没查到，壁柱宽、底座高是按整座的比例自己定的 | 借鉴（比例与分段） |
| 书的构造尺寸：zxcprint《Common types of hardcover books and cover size calculation》 https://www.zxcprint.com/printing-knowledge/common-types-of-hardcover-books-and-cover-size-calculation.html ；iBookBinding《Book Anatomy》 https://ibookbinding.com/blog/book-anatomy-parts-book ；PRC《Hardcover Square Back vs. Round Back》 https://prcbookprinting.com/square-back-vs-round-back/ | 精装书各部分叫什么、常规多大：封面板（灰板）厚 2 到 3 毫米；封面比书芯多出一圈（飘口）2 到 3 毫米；圆脊常见是 130 度的一段弧 | 板厚取 2.5 毫米、飘口 3 毫米；圆脊做成鼓出来的弧，书芯只做看得见的三面 | 130 度的弧鼓出书厚的三成二，厚书会伸出层板前沿，取 0.22（约 95 度）；书脊与封面之间的沟（书槽）太细，手机上看不见，没做 | 采纳（板厚、飘口）、借鉴（圆脊取浅一点） |
| Poly Haven 贴图（CC0）：dark_wood https://polyhaven.com/a/dark_wood 、rosewood_veneer1 https://polyhaven.com/a/rosewood_veneer1 、book_pattern https://polyhaven.com/a/book_pattern | 扫描的材质，每种有颜色、凹凸（法线）、反光（粗糙度）几张图。dark_wood 实物两米见方，rosewood_veneer1 两米四见方，book_pattern 是三十厘米见方的书布纹（只有凹凸和反光，没有颜色图） | 旧书房「材质」一门的候选：两种木头下回来在架子和桌面上并排比，留一种；书布的凹凸叠在读过的书和牌背上，颜色仍由外观表给。1k 的 JPG 就够（手机上一厘米约七个像素，1k 铺一米是十个像素）：dark_wood 三张 1.66 兆（diff 0.75、nor_gl 0.34、rough 0.57），rosewood_veneer1 三张 1.40 兆（0.84、0.33、0.23），book_pattern 两张 0.73 兆（nor_gl 0.18、rough 0.55），合计八个文件约 3.8 兆，放 `vendor/tex/` | fine_grained_wood 只有六十厘米见方、偏生木；wood_table_001 偏浅偏新；rough_linen 是麻袋布太粗；brown_leather 留给以后的皮面书；牛皮纸 Poly Haven 没有 | 采纳一部分（2026-11-13 用户点头后下载八张）：用上 dark_wood 的颜色与反光、book_pattern 的凹凸，转成 WebP 共 0.44 兆放 `vendor/tex/`；dark_wood 的凹凸图几乎是平的、book_pattern 的反光图半兆只换一点不匀，都没用；rosewood_veneer1 并排比过，对称的大卷纹铺在桌面上太花，落选。没用上的留在 `tools/out/tex-dl/` 不入库 |
| 用户给的图（本机 tools/out/ref/planfix-papercraft.webp） | Planfix CRM 的纸艺界面概念图：牛皮纸底、压痕纸片、半圆表盘、四块硬纸统计牌、撕边任务纸；全图一个暖棕色相、四层明度 | 材质体系（四种纸、一种压痕、左上一盏灯）、靠明度不靠色相、衬线大写拉字距；全部可用 CSS 做 | 表盘、统计牌与状态签不要（用户 11-08 夜定：使用频率上是无效单位）；要学的是厚度（仿立体）与纹理 | 采纳为邮差全站质感锚（2026-11-08，用户看过第一稿后纠正五条，第二稿三页在 docs/ui-paper-trial.jpg），分析在 docs/shelf-design-review.md 六之三，量出来的色板、纹理 σ、边缘剖面在六之四 |
| 用户给的图（本机 tools/out/ref/mythos-cards.webp） | MYTHOS 扑克：黑卡铜色线描人物、回纹边、赤陶牌盒、一个巨大的 Ω 当标志 | 档案盒做成 2:3 牌盒，面上一个领域单字；牌背黑卡铜字、点线双框；黑与赤陶两色交替 | 人物线描不做（没有画师），回纹换点线；颜色不是重点 | 借鉴：牌盒**斜立**的造型，一盒一包、一盒盒各歪各的，盒厚即牌数（2026-11-08，用户指明要看的是造型不是颜色） |
| https://www.igloo.inc/ 与 https://awwwards.com/igloo-inc-case-study.html | Pudgy Penguins 母公司落地页，Abeto × Bureaux；Three.js + three-mesh-bvh + Svelte + GSAP + Vite，Houdini / Blender 建模 | 一种材质做到极致；滚动驱动镜头与生长时间线；UI 用 WebGL 画在场景里；低端机持续实测；开场用代码生成不用视频 | 只有三章的展示页，专业图形团队，自研工具链；我们每天用、无美术 | 借鉴 |
| https://kriss.ai/home/overview 与 https://www.awwwards.com/case-study-ai-with-a-human-touch-the-new-face-of-kriss-ai.html | 牙科 AI 助手官网，Studio 28K；OGL + Svelte 5 + Blender + PayloadCMS + Cloudflare。2026-10-28 深拆见 `design/KRISS-ANALYSIS.md`：单文件 29 MB 场景、KTX2 贴图、全烘焙 lightmap 无实时阴影、透光玻璃、长焦 3/4 俯视、2 到 2.8 秒 inOutCubic 镜头、待机呼吸、房色系统 | 房间即单元、楼即总览、一个 URL 一间房；厚度 + 圆角 + 剖切面；烘焙光；镜头在房外看进去；每房一色 UI 跟随；卡片贴边；先草图再三维 | 八间房内容写死；黏土粉彩风与我们材质宇宙不同；29 MB 首包我们不许；OGL 生态薄 | 借鉴（方法样板，不抄风格） |
| https://github.com/brunosimon/my-room-in-3d | Bruno Simon 的个人房间，Blender 建模 + 烘焙光照 + Three.js，4.5k 星，2021 | 烘焙进贴图、场景无实时光是网页上"一间房"好看又跑得动的标准做法 | 单间、静态、无数据 | 借鉴（渲染路线） |
| https://github.com/flo-bit/room | Svelte + Threlte 的小房间编辑器，存到 Bluesky 账号，MIT，89 星 | 用 Kenney / Kay Lousberg CC0 套件快速起步；摆放偏好单独存 | 用 Svelte；功能是自由摆家具，不是数据生成 | 仅参考（资产来源可抄） |
| https://rooms.xyz | 体素风房间搭建 + Lua 小游戏，a16z 投，Apple 设计奖 | "房间是舞台，物件是道具"的定义；每个物件可编程 | 用户生成内容平台，体素风，闭源 | 仅参考 |
| https://github.com/img2threejs/img2threejs | 把参考图重建为纯代码的程序化 Three.js 模型，19.6k 星，Apache-2.0 | 数据驱动的物件（书、盒、牌、叶）走程序化几何而非模型文件 | 面向单件物体重建，不是场景 | 借鉴（程序化思路） |
| https://github.com/mrdoob/three.js | WebGL 引擎，117k 星，MIT | 引擎本体；GLTFLoader / DRACOLoader / KTX2Loader / InstancedMesh | 无 | 采纳 |
| https://github.com/threlte/threlte | Svelte 的 Three.js 框架，3.4k 星 | 无 | 要引入 Svelte 全套 | 排除 |
| https://github.com/pmndrs/react-three-fiber | React 的 Three.js 渲染器，33k 星 | 无 | 要引入 React 全套；现有代码无框架 | 排除 |
| https://github.com/needle-tools/needle-engine-support | Unity / Blender 到网页的引擎，带云部署 | Blender 直出网页的流程值得看一眼 | 绑定 Needle 云与许可证，国内访问不可控 | 排除 |
| https://github.com/BabylonJS/Babylon.js | 全功能网页 3D 引擎，26k 星 | 无 | 体积大，物理 / 多人我们用不上 | 排除 |
| Spline、PlayCanvas、Godot 网页导出 | 云编辑器或重运行时 | 无 | 云依赖或 30 MB 运行时，手机开不动 | 排除 |
| https://kenney.nl/assets 与 https://kaylousberg.itch.io/ | CC0 低多边形家具与房间套件 | 灰盒阶段的建筑与家具 | 风格偏卡通，正式版要替换 | 采纳（灰盒阶段） |
| Tripo / Hunyuan3D 2.1 / TRELLIS.2 / Meshy | AI 文生图生三维，出 glb | 中式家具小件的候选来源 | 拓扑脏，要 Blender 减面展 UV | 待看（第 3 步前试一件） |
| https://threejs-journey.com/ | Bruno Simon 的 Three.js 课程，含 Blender 烘焙章节 | 烘焙流程教材 | 付费课 | 仅参考 |

| 抖音 浩克肥虫《用 Blender 和 Hyper3D 打造你的秋日农场》（aweme 7698717083856669995） | Blender + Hyper3D Rodin Gen-2 Agentic Mode 教程：几张参考图一次生成整个农场并自动拆件，Low Poly 选项，参数化和自然语言改模型，材质命名改色，下载后 Blender 打光绑定动画 | 整场景生成且拆件；材质在生成端定好减少 Blender 重复工作；AI 出资产 Blender 做光的分工 | 室外农场，室内未验证；拆件仍要减面展 UV | 借鉴（下一步拿 B 试一次） |
| https://hyper3d.ai （Rodin，影眸科技）与 https://fal.ai/models/fal-ai/hyper3d/rodin | 图生三维与场景生成；国内可用；fal 上 Gen-2 约 0.4 美元一次、2.5 fast 约 0.1 美元 | 主角家具与整间书房的资产来源候选 | Agentic Mode 大概只在网页版；按下载扣点 | 待看（试用后定） |

| 抖音 -Duduu-《岩洞村落》一些落地思路（note 7696959765440715775，AIGC × Photoshop × Tripo） | 概念到可建造的完整流水线六张图：主视觉 → 沙盘加材质板 → 主体建筑四视图与图生三维 → 构件套件 → 室内一组与墙体模块 → 全套件平铺加地图 | 材质板挂引线；室内按一组出图再拆件；构件零件表统一造型语言；人物是套件；Tripo 四边面低模 | 写实布衣与岩洞风格不是我们的 | 借鉴（方法，见 design/FUNCTION-AND-CHARACTER.md 第 1 节） |
| 抖音 鲍勃列侬《魔兽世界》练级回忆第 177 集（note 7697824398761381160，2026-10-17）"以前练级，走到哪儿都能待半天"：杜隆塔尔、荆齿城、西部荒野、银松森林、暮色森林夜色镇 | 玩家对魔兽各地图的停留感；登录墙挡住了图片，只看到标题与首帧 | 地方感：每图自己的色彩脚本、地标、能停的角落、活物、昼夜（写成 ART-BIBLE 第 8 节）；"待半天"作为验收第 11 条 | 手绘贴图风格生产成本高且 AI 难统一；暴雪美术不能用 | 借鉴（设计规矩，不借画法与素材） |
| 暗黑 2 重制版（用户本机安装 D:\Game\AH2CZB；三张截图 + 2026-10-30 用 CascLib 读封包拆解，见 design/D2R-DISSECTION.md） | 两层结构（原版表与拼块 + HD 实体-组件 JSON 表现层）；364 张数据表；每区域 × 时段一个 vis 光照文件；交互物件 = 模型 + 三态状态机 + 表里函数号；每件 1024 PBR 三件套、5 级 LOD、硬件分档 | 一切是表、vis 光照结构、角色独立布光与光圈、室内主光为零靠局部光、墙段透明、道具调色板、变体、分档 | 写实 PBR 方向、二维网格逻辑、布料物理不采纳；资产只在本机读不入库 | 采纳（结构与流程，第 7 节清单） |
| 抖音 猫猫《恶意不息农舍田园风装修》（aweme 7702484953166138687）；游戏 No Rest for the Wicked（Moon Studios） | 手绘风 + 实时局部光的 ARPG，有农舍装修、自由摆放、种菜养花、舒适度评分换增益 | 手绘风三维的画质范本；舒适度 = 基础 + 种类多样性 + 物品多样性 + 质量，换增益；走近高亮、点拾取 / 放置 / 旋转 | 商业游戏素材不用；暗黑奇幻题材与我们的书房不同 | 借鉴（画法目标与房屋系统机制） |

| https://github.com/WindyYam/Diablo2_Resurrected_Model_Converter | D2R `.model` 直转 `.glb` 与写回、`.texture` 转 DDS 的 Python 工具，MIT，自带 carbon_granny 的 BitKnit2 纯净室解码器；FORMAT_NOTES 把 GR2 容器、顶点布局、CRC、重定位全写清了 | 排练阶段一的模型转换工具；格式笔记并入 D2R-DISSECTION 第 16 节 | 只本机研究用，产物不入库；运行外部代码要用户授权 | 采纳（本机研究） |
| https://github.com/Norbyte/lslib （Divine）与 https://github.com/Norbyte/lslib/issues/67 | 博德之门 3 的资产工具链，GR2 ↔ glTF / DAE；议题 67 里有人用它转过 D2R 模型 | 看过 Reader.cs 的段解压流程 | 解 BitKnit2 要 granny2.dll，D2R 没带（静态链进 exe）；Linux 构建卡在 GpLex / Gppg | 排除 |
| https://docs.rs/crate/maclarian 与 pybg3（rans.h） | BitKnit 的纯净室实现（Rust / C） | 转换器出问题时的备用解码器 | 要自己接 GR2 容器 | 备用 |
| https://github.com/harpoonlobotomy/GR2_importer_for_blender_5 与 https://github.com/carbonenginejs/tools-blender | Blender 5 的 GR2 导入插件（后者面向 EVE，carbon_granny 的出处） | 若要在 Blender 里直接看 D2R 模型 | 面向别的游戏，D2R 专有字段未必认 | 仅参考 |

| 抖音 热可可《Claude帮我做了一面书墙》（aweme 7702823465858420091，2026-10-31，45 秒，182 赞 134 藏）：网页「书脊经典」，30 部中文经典一面书墙，每本封面是一幅公版名画 | 书脊 = 画作竖条 + 纸题签 + 小红章；顶部年代时间轴（前 1100 到 2100）跟着选中的书走，朝代筛选页签；「展卷」页：画作满铺做底、像素马赛克渐显、大字书名、1956 年前的书竖排右翻、一句话 + 简介 + 画作出处题注、背景色随书变、巨大的章节数字淡印；键盘 ← → 翻阅 Enter 展卷 Esc 合上；画廊页复用同一批画；结尾一张产品名片 | 一本书打开要有仪式（我们点书直接跳精读面板，没有「展卷」）；色彩脚本按书变而不是整站一色；年代作为第二维度；题签规则写进细节（右翻左翻）；一个说得清的物件比一套系统好传播 | 30 本写死、无状态无进度无笔记，是展品不是工具；公版名画当封面只对经典成立，我们用户的真书不能这么做（版权） | 借鉴（展卷仪式、色彩脚本、时间轴、键盘与题签细节）；排除（写死数据、名画封面用于现代书） |
| Coralie Bickford-Smith 企鹅布面经典（penguin.co.uk 两篇制作记：`clothbound-classics-little-history-making-of`、`clothbound-classics-kate-middleton-coralie-bickford-smith`） | 2008 起 85 种布面烫金经典：一枚从书里取的图标按网格重复、每本不超过两色、图案铺满整本、封底无简介；起点是维多利亚布面书，图案语法用 Lewis F. Day | 整个方法可搬到我们的"布面精装"：一书一图标、一图标一重复、两色、全包；状态用金的多少表示 | 她的图标是手绘的，我们要先建图标库 | 采纳（第一导师）。详见 docs/cover-masters.md |
| 美国装饰布面书 1880–1920：Margaret Armstrong、Sarah Wyman Whitman、Alice C. Morse（大都会博物馆 *Artists of the Book: Publishers' Bindings*；布鲁克林图书馆 2024；数据库 Publishers' Bindings Online 1815–1930，阿拉巴马与威斯康星大学） | 宝石色布面上金加一两色压印的新艺术风花草与边框，书名手绘成图案一部分，成套书配套装帧 | "华丽而美"的范本：边框 + 中心花草 + 手绘字三件套，满足奇幻感不堆材质；PBO 几千张可当对照墙 | 需逐张看，数据库是否仍在线待确认 | 采纳（华丽版的尺子） |
| Lewis F. Day《Pattern Design》1903（archive.org `PatternDesign.pdf`，公版） | 重复图案语法：方格、三角、八角、圆、落差、翻转、回旋 | 图案生成器照它写 | 无 | 采纳 |
| Paul Bonet / Pierre Legrain / Rose Adler（cool.culturalheritage.org Bonet 词条；纽约公共图书馆 2004 展览图录）；Sangorski & Sutcliffe 的 Great Omar（维基；Smithsonian Libraries 2026-09） | 法国装饰艺术装帧：Bonet 早期纯几何金线放射、后期贴合书的精神；珠宝装帧一张封面一个主题（三只孔雀） | "魔法书"品味的天花板：一束金线比一百个铆钉高级；宝石只服务一个主题 | 实物工艺，只学构图 | 借鉴 |
| David Pearson（企鹅 Great Ideas，Design Week / It's Nice That 访谈）；Peter Mendelsund《Cover》 | 只用字、"管理变量"；封面是归约，从八类素材里选一个 | 书脊题签的变量管理；每本书选一个图标的方法 | 无 | 借鉴 |
| 杉浦康平《亚洲的书籍、文字与设计》；吕敬人；"中国最美的书"评选标准（整体性、内容与形式、功能、手感、技术）；宋版书版式（版框、界行、鱼尾、书耳） | 东方的书：书是时间的建筑；不摹古而有东方品位；题签是书法 | 第三种装帧"线装 / 函套"的依据；中文竖排书名本身是设计对象 | 无 | 借鉴（以后） |
| Pentiment（Obsidian，Hannah Kennedy，Game Developer 2023-01 深度文） | 游戏把书页画得像真的：采用那个时代真实美术的视觉语言、极端扁平、先做四个主角定标准再铺开 157 个角色 | 方法：先定一个时代的真实视觉语言，先做四本标准书过门再铺全墙 | 游戏，不是书皮 | 借鉴（方法） |
| 抖音 猫田柚柚香《美到窒息！！这才是童话书该有的样子》（note 7613731797956181366，十张实拍：维多利亚与爱德华时代的布面装饰书书架、烫金插画封面，含蜘蛛网与蟋蟀、列那狐、肯塔基红雀、傲慢与偏见孔雀、伊索寓言、爱丽丝） | 每本书皮是插画家为这本书画的一幅画，手绘书名与花藤缠在一起，多色印在布上加烫金；书脊是一株从下往上长的植物；整面墙美在每本不同、参差、有旧痕 | 用户心里的目标就是这个；让我们看清三轮都不达标的根本原因（生产方式、图标语言、系列思维、字没画、自评放水），见 docs/cover-masters.md 第七节；1923 年前的同类书多已进入公有领域，可走公版扫描路线 | 图本身是别人拍的收藏，只本机看；单靠代码画不出这种插画 | 采纳为目标与验收标准（混进参考照片认不出才算过） |
| 抖音 北洛绘画社《素材分享｜魔法书》（note 7664913859766173369，九张实物图：压花皮面加金属角包与宝石、象牙星盘铜书带合页搭扣、紫皮炼金阵铆钉、炭化木刻符缠麻绳、蒸汽朋克皮面带药瓶与铭牌、黑皮羊头骨饰牌、铜绿窗饰） | 一本书当作一件器物来做：底材（皮、木、象牙、铜）+ 纹理（压花、木纹、铜绿）+ 五金（角包、铆钉、合页、搭扣）+ 中心物（宝石、法阵、星盘、骨饰、窗）+ 铭牌题签，层层叠出来；封面朝外才成立，书脊只是竹节加包角 | 封面语法可以写成程序化的零件表，按书的领域与状态确定地生成：星盘指针 = 进度、宝石亮暗 = 在读、搭扣开合 = 开没开过、铭牌 = 书名；靠明度与形状表状态不靠色相；可作书墙的一种可选「装帧」，与现在的布面精装并列 | 实物靠真实材质与光影，画布画出来容易像游戏界面，要克制（一件中心物、两种材质、低饱和）；图片本身是别人的手工作品，只学做法不用图 | 仅参考（2026-11-03 做成秘典装帧上线后用户说太丑：实物道具的做法不适合屏幕，见 docs/cover-masters.md；状态映射到图案的想法保留） |

| 维基共享资源 Publishers' bindings 分类、波士顿公共图书馆的惠特曼装帧（Sarah Wyman Whitman Bindings at the Boston Public Library，CC BY 2.0）、大英图书馆与 Michael Twyman 收藏的维多利亚出版商装帧（CC0） https://commons.wikimedia.org/wiki/Category:Publishers%27_bindings | 2500 多张 1840 到 1910 年代出版商装帧的正面照片，大多标了公有领域或 CC0，惠特曼那批 245 张是 CC BY 2.0 | 插画级书皮的现成来源：真书的画质，代码只叠书名与状态；按授权署名、逐张记来源即可放进公开仓库 | 原书名是英文，要抹或用皮签盖；只有封面没有书脊；画的内容和我们的书对不上 | 采纳（2026-11-03 做成「老书皮」装帧，56 张，来源见 vendor/covers/SOURCES.md） |
<!-- 结论四选一：采纳 / 借鉴 / 仅参考 / 排除 -->
| 另一个会话的实测（2026-11-11，igloo.inc 完整滚一遍加资源清单） | 整站一块全屏 WebGL 画布，页面只有 27 个节点，滚轮不滚页面只推进一条时间轴；约 20 个 Draco 模型、40 张 KTX2 贴图、近 20 个音效；文字用 MSDF 画在画布里；冰屋有完整与炸开两套烘焙贴图 | 效果 = 预先烘焙的三维资产 + 自写着色器 + 声音，动画逻辑最简单；光影预先算好、一段演出一条时间轴、画面常有微动与颗粒、每个交互一个音 | 全画布画字（中文阅读差）、接管滚动、几十个模型的体量；它是看一次的两分钟短片，我们每天用 | 借鉴：只用在拆包、进门这类几秒的演出上，日常读写不用 |
| GDC 2015，Derek Sakamoto「Hearthstone: How to Create an Immersive User Interface」 https://gdcvault.com/play/1022036/Hearthstone-How-to-Create-an | 炉石界面的设计过程讲座。团队定下「一个实体盒子」以后，木板、托盘这些界面都从盒子里长出来；开包要用声音和画面复刻拆实体卡包的手感（后半句是二手转述，没看到讲稿） | 先定一个实体隐喻，再让全部界面从它长出来；开包是一段短演出 | 开包的具体节奏没查到文字，要看录像 | 借鉴：做拆包样机之前先看录像 |
| Steam 上「边专注边布置房间」一类：Mini Cozy Room: Lo-Fi（2025-03，评价很好）、Gloria's House（番茄钟挣币买摆设）、Virtual Cottage 2 | 专注计时加一间可布置的小房间 | 说明「学习工具 + 一间自己的房间」有人买账 | 房间与学的内容无关（摆设靠计时挣），都是单机，不能串门、不能带走东西 | 仅参考：我们的差异是房间由真实的书、剪报、笔记长出来，并且给别人看、能拿走一排 |
| Are.na https://www.are.na/about | 块与频道：一块内容能放进任意多个频道；频道默认公开，别人可以把你的块接进他自己的频道 | 「逛别人的收藏 + 拿一块回自己那里」的最小社交；公开是默认 | 是列表与网格，没有空间与物件感 | 借鉴：分享的最小单位怎么定 |
| AnkiWeb 共享牌组（论坛帖 https://forums.ankiweb.net/t/shared-decks-the-current-state-of-ankiweb/45904 ） | 备考的人把做好的牌组传上去，后来的人直接下载用 | 「复用别人的学习成果」有真实需求 | 2024 到 2025 的帖子一直在抱怨难逛、难找；只有牌没有路径 | 仅参考：逛的体验正是它的短板 |
| 宝可梦卡牌口袋版的开包（官方说明 https://corporate.pokemon.co.jp/en/topics/detail/t-28/ ；评测 https://gamesradar.com/games/pokemon/pokemon-tcg-pocket-understands-the-fun-of-collecting-cards-more-than-any-other-digital-card-game 、https://inverse.com/gaming/pokemon-tcg-pocket-collecting-cards ） | 手指横着划开包装，牌一张张自己抽出来看，向上划收进收藏；官方的说法是「重现实体牌的手感，再加上数字才有的表现」；报道说美术总监拆了很多真包去调那一声撕开的声音 | 必须亲手划开（不是点一下）；声音占一半；一张张由人控制着看；最后一个手势把牌收走 | 它的节奏和计时器、付费绑在一起，我们不要 | 采纳为拆包样机的手势骨架（划开、逐张、上划收下） |
| 炉石的开包（美术总监 Ben Thompson 访谈 https://toucharcade.com/2017/04/04/designing-hearthstone-card-packs-animations-iterations-ungoro-and-more-with-art-director-ben-thompson ；PC Gamer https://pcgamer.com/behind-the-addictive-psychology-and-seductive-art-of-loot-boxes ） | 包拖到槽里炸开，五张牌背朝上飞出来，一张张自己翻；翻之前牌底下的光先透露稀有度；每种包的开启动画先画分镜定节拍，包是三维模型；后来加了按住快开，论坛上有人说快开就没了期待 | 先画分镜定节拍；背朝上、自己翻；翻之前给一点预告；快进要有但不是默认 | 稀有度与抽奖的那套心理我们不用，预告改成「这篇有多长」 | 采纳为拆包样机的节拍（顿一下、闪、发牌、逐张翻、牌底光晕） |
| GitHub 检索（2026-11-11）：akio-byte/booster-pack-animation-component 等 | 一个不依赖库的五张牌开包网页组件（零星标）、几个炉石开包的文字或桌面模拟器 | 无 | 没有三维、没有手势跟手、没有声音，量级不够 | 排除：自己做，见 lab/pack.js |
| KoreShelf https://github.com/GabrieleTrovato01/KoreShelf （MIT，68 星，2026-11 还在更新） | 自托管的三维书架加阅读器：上传 EPUB / PDF 等，书立在架上，浏览器里读；Rust 后端加 Vite 与 Three.js 界面，有桌面、手机和 Docker 版 | 证明「三维书架 + 自带阅读器」这个组合有人要；以后做真书皮贴图时可以看它怎么画书 | 是一整套独立应用（自己的后端和数据库），只有书架一件家具，不能嵌进我们三件家具共用的 Baba 数据里 | 借鉴，不直接用 |
| The Complete Shelf https://github.com/MengTo/complete-shelf （716 星，没有许可证） | 单文件 Three.js 展示页：七本布面精装，抽一本到详情、转着看、翻几页，声音是事先生成的 | 抽出与放回用确定的起止姿态、换父节点时不跳帧；布、木、合页各有一声 | 七本书的大片式展示，不是「几百本一眼看全」；没有许可证，代码不能用 | 仅参考（抽出与放回的做法） |
| Shelfieline（iOS 应用，商店页 https://mwm.ai/apps/shelfieline/6767300403 ） | 书脊视图的读书记录应用：书脊有高矮和纹理，四种状态（想读 / 在读 / 读完 / 囤着），另有封面格子视图 | 书脊视图加阅读状态有人做成了产品 | 只看了商店页，没看到它怎么在书脊上区分状态 | 仅参考 |
| Book Riot：把读过的书脊朝里放 https://bookriot.com/how-to-organize-rainbow-bookshelves/ | 实体书架的土办法：读过的书脊朝里、没读的朝外，再把架子分成读过和没读两段 | 人确实会用「摆法」而不是标签来分读没读；分成两段是自然的做法 | 讲的是实体书架 | 采纳为书架样机的两条：读没读靠物件的样子（没读包白纸、读过露布面、在读探出来），另给一种「按读没读放」的排法 |
| Letterboxd 的「四部最爱」（The Spinoff 2025-04 https://thespinoff.co.nz/culture/24-04-2025/how-letterboxds-four-favourites-took-over-the-internet ；Young Hollywood https://younghollywood.com/scene/letterboxd-as-personality-gen-z-film-trend.html ） | 个人页最上面一排四张海报，自己挑的；被当成介绍自己的速记和搭话的由头 | 一眼看懂一个人，靠的是他自己挑出来的少数几样，不是全量清单；是主人摆的，不是系统算的 | 是影迷社区，四张海报是平面的 | 借鉴：进门第一眼是主人自己写的一句话加几排他摆好的科目，不是统计 |
| The Sims 4 的图库（EA 帮助页 https://help.ea.com/en/help/the-sims/the-sims-4/the-sims-4-gallery/ ） | 逛别的玩家传上来的房间、房子、人物，点下载存进「我的收藏」，再放进自己的地块；对方用了你没有的内容时会缺件 | 「带走」分两步：先落进自己的收藏，再摆到自己的地方；缺件要说清楚 | 是游戏里的建造模式，要先开地块才能放 | 借鉴：带走的一排先进邮包，之后才放进自己的书架；带走的是书单和顺序，书的文件不跟着走，要在当场说明 |
| Notion 的「复制公开页面」（官方帮助 https://www.notion.com/help/duplicate-public-pages ） | 公开页面右上角一个 Duplicate 按钮，选一个工作区，整页连子页复制过去，归自己改；页面主人可以关掉「允许复制」 | 一个按钮带走一整套；主人说了算哪些能被带走 | 一下点完没有任何过程，带走的东西去了哪要自己找 | 借鉴：以后每一排要有「许不许带走」的开关；我们把带走做成一个看得见的动作（拉出来、捆好、进包） |
| three.js 论坛「烘焙光照还是实时阴影」（https://discourse.threejs.org/t/why-should-i-use-lightmap-instead-of-draw-shadow-in-diffusemap/46759 ） | 引擎维护者的回答：全烘最省；烘好的光上再叠实时灯会发灰发脏；折中是只烘环境遮蔽（缝里暗下去），直射光留实时 | 架子是静的，缝里的暗可以烘或用假的压暗片；书会动，留一盏实时主光投影 | 我们几百本书会被抽出、换位，没法全烘 | 借鉴（2026-11-13 外观样张里每层后面那片上深下浅的影子就是这个思路的最简版） |
| Babylon.js 论坛「黏土渲染的样子怎么做」（https://forum.babylonjs.com/t/how-to-achieve-a-clay-render-look/19953 ） | 做法的共识：一盏投影的主光、很少的环境光、哑面的材质，缝里靠环境遮蔽压暗 | 玩具盒方向的光与材质配方 | 是别的引擎的帖子，参数要自己调；后处理的环境遮蔽在手机上贵 | 借鉴（玩具盒） |
| 图生三维几家的对比（https://learn.rundiffusion.com/ai-3d-model-generators/ ；https://sorceress.games/blog/rank-the-best-image-to-3d-model-ai-six-model-test ） | Tripo、Meshy、Rodin、Hunyuan3D 等把一张图变成三维模型；各家评测的排名互相打架，版本号对不上，免费档的授权各不相同（有的不能商用、有的要署名） | 以后要做雕花、摆件这类不规则的东西时，拿自己的图各家试一轮再定 | 书、架子、卡包、牌都是规则形体，代码几何就够；几百本书也不可能一本本生成 | 这一步不用；雕花摆件进待办 |
| CC0 素材站：Poly Haven、Kenney、Quaternius（清单 https://www.github.com/madjin/awesome-cc0 ；指南 https://app.cinevva.com/guides/free-3d-model-sites ；一个 CC0 旧书架 https://opengameart.org/content/old-bookshelf-with-books ） | 贴图、环境光图、低多边形家具，CC0 不用署名 | 旧书房方向要的木纹、布纹、环境光图从 Poly Haven 拿（下载前先问用户）；灰盒阶段已经没用外部模型 | 现成的书架模型不拿：我们的架子要跟着本数和屏幕自己变宽变高；现成的书是整排一个模型，抽不出单本 | 借鉴（只拿材质与环境光图，旧书房方向才需要） |
| Tiny Bookshop 的美术（https://www.itsnicethat.com/features/neoludic-games-tiny-bookshop-illustration-spotlight-100226 ；评测 https://www.gamespew.com/2025/08/tiny-bookshop-review/ ） | 开书店的游戏：童书和旧明信片那样的手绘暖色，三维的人走在二维的画里 | 气质对：不正式、暖、和书有关 | 它靠整张手绘背景撑场面；我们 11-08 已经验证过「一张画当场景」在手机上只露一小块、拼不出自适应 | 仅参考气质，不照它的做法 |
| Book of Hours（开发者日志 https://weatherfactory.biz/boh-the-early-draft-edition/ ；评测 https://www.noobfeed.com/reviews/book-of-hours-review ） | 经营一座图书馆的牌类游戏：牌用鲜亮平整的矢量图标，房间用有肌理的插画，两种画法并存；整体像手抄本和博物馆展柜 | 牌和书房可以是两种画法：牌面平整清楚，书房有肌理有光 | 整体偏阴郁神秘、信息很密，和「不正式、有游戏感」只对一半 | 借鉴（旧书房方向：牌面保持清楚，不跟着做旧） |
| 闪卡的箔光（three.js 做法 https://feedbagel.com/post/creating-foil-sticker-effects-with-custom-threejs-shaders ；网页做法 https://hover-tilt.simey.me/bespoke/pokemon-cards/ ；宝可梦卡牌手游保底包的开包表现 https://gamewith.net/pokemon-tcg-pocket/49002 ） | 随角度变色的箔、亮片；保底包开包前包口先透出光 | 拆包换外观时，少数「长文 / 难得」的牌可以加一层随手机倾斜变的光；「包口先透光」样机里已经有 | 箔光是颜色在变，用户色弱，只能当锦上添花，不能拿它表示篇幅或稀有 | 进待办（外观选定、拆包换皮时再看） |

## 笔记本设计调研（2026-11-04，为书架里加笔记本做的查前作业）

用户规模（可信度有限，多是行业博客转述）：Notion 2024 年 9 月官宣 1 亿注册用户；Obsidian 约 150 万用户；Apple Notes 据称月活 3.5 亿但没有一手来源；flomo 自称百万用户。开源星数（2026-11-04 GitHub）：AppFlowy 7.8 万、AFFiNE 7.4 万、memos 6.4 万、Joplin 5.7 万、思源 4.7 万、Logseq 4.5 万、Trilium 3.9 万。

五种流派，每种一个代表：

| 流派 | 代表 | 组织模型 | 为什么受欢迎 | 对研习录 | 结论 |
|---|---|---|---|---|---|
| 本·分区·页（实体笔记本的层级） | OneNote、Goodnotes、Notability、印象笔记 | 笔记本 → 分区 → 页，Goodnotes 连纸张和封面都照实体选 | 和人对纸质笔记本的经验一致，不用学；多本并存，一科一本 | 和书房隐喻、三维版"笔记本架上多本笔记本"的决定天然一致；层级不要超过两层（本、页），分区交给领域和盒 | 采纳骨架 |
| 每日笔记 + 双链（无文件夹） | Obsidian、Logseq、Roam、Reflect | 打开就是今天这一页；页之间用 [[链接]] 和标签，反向链接自动汇总；不建文件夹 | 输入零摩擦，整理推迟到回顾；链接比归类省心（Maggie Appleton 的"每日笔记页"文章把它称为"无摩擦输入 + 日后可寻"问题最流行的解法） | 每日页做随手本的默认页；链接对象不是别的笔记而是书房里已有的实体（书、盒、牌、线网站点），回链显示在展台和桌面上 | 采纳 |
| 卡片流（微博式短记 + 回顾） | flomo、memos、Google Keep | 一条一张卡，无标题、极简格式、多级标签；桌面小组件、微信入口；"每日回顾"把旧卡推回眼前 | 记录门槛最低；"记录更多、轻整理、常回顾"；不做长文 | "记一笔"快捷入口照此做：一个框、回车即存、不离开当前页；回顾机制可接到首页的复习入口 | 借鉴入口与回顾 |
| 块编辑器 + 数据库（全能工作区） | Notion、AppFlowy、AFFiNE、语雀、思源 | 一切是块，页面可当数据库，模板社区大 | 团队知识库与结构化数据强 | 太重：单人学习笔记不需要数据库与多视图；研习录的结构化数据（书、盒、进度）已有自己的集合 | 排除 |
| 卡片 + 白板 / 对象类型 | Heptabase、Capacities、Tana | 卡片铺在无限白板上摆出结构；或先定对象类型（书、人、项目）再填属性 | 研究写作时能"先摊开再看出结构"；对象模型适合有固定实体的领域 | 白板在手机上不可用；对象类型这一点我们已经天然具备（书、盒、牌就是类型），不必再造 | 仅参考 |

两个跨流派的共识：
- 快速捕捉是所有产品的短板（Logseq 社区帖直言"几乎每个笔记产品都忽视了好的快速捕捉，Notion 除外"），做好了就是差异点。
- 整理推迟：先落到一个地方（今天的页或收件匣），周回顾时再归位。研习录已有"零散的先进收件匣"这条归档规矩，笔记照同一条走。

拟物的分寸：Goodnotes 坚持"笔记本 → 纸页"模型并让用户选封面与纸张，被评价为好学；Pratt 的设计评论也指出它的工具栏拟物图标过重、占空间。研习录的做法：外壳（书架上的本子、封面、题签、翻页）拟物，纸面内部是干净的文本编辑器，不画拟物工具栏。

来源：Zapier / ClickUp / Storyflow 等 2026 年榜单（https://zapier.com/blog/best-note-taking-apps/ 、https://storyflow.so/blog/best-note-taking-apps-2026 ）；Notion 1 亿用户公告（https://www.notion.so/blog/100-million-of-you ）；Maggie Appleton「Daily Notes」（https://maggieappleton.com/daily-notes ）；Logseq 快速捕捉讨论（https://discuss.logseq.com/t/native-quick-capture-clipper/4037 ）；flomo App Store 介绍与少数派评测（https://sspai.com/post/64472 ）；Pratt 对 Goodnotes 的设计评论（https://ixd.prattsi.org/2026/02/design-critique-goodnotes-ipad-app-2/ ）；Heptabase 评测（https://dev.to/pickuma/heptabase-review-visual-note-taking-for-thinking-through-problems-5daa ）；Tiago Forte 笔记工具调查（Notion 28% 居首，样本是"第二大脑"实践者）。

| https://polyhaven.com/textures 与 https://ambientcg.com | CC0 实拍材质库（灰泥、橡木、亚麻等，带法线与粗糙度图） | 书墙墙面、书架板、笔记本架的底材：取 512 像素一张做底，CSS 混合叠光，和老书皮同一条路 | 要控制体积与国内可达性，图要自带进 vendor | 采纳（书架光与材质一轮时用） |
| https://github.com/lxgw/LxgwWenKai | 霞鹜文楷，OFL 授权的开源楷体 | 房间里的小字与笔记本正文的手写感；可自带进 vendor/fonts，按用字做子集 | 全字库大，必须子集化 | 借鉴（字体一项时试） |
| 维基共享「Bookrests」「Qur'an stands」「Bookstands」分类 | 各式书托、X 形折叠经架（rehal）、大都会黑漆螺钿书托的实拍 | 斜面书托的结构语言：两片交叉、一道挡条、镂空牙板；展台与笔记本架都可借 | 多是伊斯兰与教堂器物，纹样不能照搬，只取结构与比例 | 借鉴（结构） |
| 维基共享「Analogions」「Adjustable reading and writing table MET 1983.433」「Writing slopes」 | 东正教斜顶诵经台、十八世纪可调读写台、斜面写字匣 | 斜顶箱体的比例、黄铜件与木的搭配 | 过于教堂气，整体不用 | 仅参考 |
| Poly Haven 模型 chinese_console_table / chinese_cabinet / katana_stand_01 / brass_candleholders / mantel_clock_01（CC0） | 高质量扫描模型，可直接进 Blender | 条案与柜的明式线条可作本项目木器的语言；刀架是斜托的现成范本；烛台与座钟可直接当摆件 | 体积大（扫描网格），进网页要减面或只渲成图 | 采纳（摆件直接用；家具借线条） |
| 用户 2026-11-05 发来的五张书房场景图（本机会话图片 10 到 14，不入库） | 1 暗学院拱形书柜加蜡烛窗壁炉（摄影背景布商品图）；2 土墙拱形书柜配秋叶（插画）；3 水晶洞穴图书馆（奇幻插画）；4 深木书柜皮面书黄铜铭牌（摄影背景布）；5 大树书架（概念插画） | 共同点：整个场而非一面墙、低调多点暖光、深色厚重雕木、皮面烫金一族书、有一个锚（拱 / 树 / 壁炉）。研习录借 1 与 4 的深木拱形书柜与烛光，借 2 的暖度 | 1 与 4 的书是画死的，研习录的书要由数据生成；3 是奇幻题材与研习内容冲突；5 的曲枝无法程序化摆书 | 采纳方向（1、4 为主，2 调暖）；做法定为「空书柜的画 + 代码摆的书」，书柜按拱顶 / 格层 / 底座 / 立柱模块化，由 Blender 渲出 |
| 维基共享「Card catalogs」「Archive boxes」「Hollinger box」「Pigeonholes」「Document boxes」 | 卡片目录柜、档案盒上架、霍林格盒、鸽笼格、便携文书匣的实拍 | 档案架的密度与统一（同规格小抽屉加黄铜标牌）、收件匣用鸽笼格、打开一盒像文书匣翻开、盒子形制（灰板、包边、前脸标签、绳扣） | 档案馆是金属货架与灰盒，气质偏库房，只借形制不借材质 | 借鉴（档案架设计研究） |
| Are.na channels / blocks（Pratt 设计评论与官方文档） | 一个 block 可连到多个 channel；卡片按 channel 成列 | "一件两盒"的产品问题；卡片列的排法 | 极简到乏味，我们要的是房间 | 仅参考 |
| mymind（wondertools、fabric.so 对比） | 没有文件夹、标签，一个卡流，自动标注加搜索；免费 50 张 | "不归位也能活"的态度，用于没归位的卡 | 没有课题这个意义，是收藏不是研究 | 排除（只借态度） |
| Raindrop | 收藏夹树加标签，导出开放 | 无 | 就是文件夹，和现在的盒一样 | 排除 |
| Milanote / Kosmik / Muse | 空间板：卡随手摆、位置即意义、板里嵌板；Kosmik 带浏览器与剪藏 | 线索板作为研究册里的一页 | 要用户自己摆，手机难，卡多了乱 | 借鉴（设想丙） |
| Luhmann 卡片盒（ernestchiang 综述、zettelkasten.de 论坛） | 两只独立的盒：文献卡与想法卡；不按主题分格，固定编号加关键词索引 | 存放用一只卡片柜，剪报（文献）与研究（想法）分段；引卡解决一卡多处 | 他的索引靠编号，我们靠搜索与分隔签 | 采纳思路（设想丁） |
| 四张风格图（用户提供：Legendary Journey 海报 / 永恒之柱式日志 / Cresendo 宝箱概念表 / 皮面魔法书） | 米纸橄榄栗红黄铜墨褐五色、深褐描边厚涂、纸纹；翻开的书作界面；概念表格式；皮铜护角搭扣 | 风格圣经的底、七种屏幕模板里的「翻开的书」、英雄物件的样式图格式 | 第四张是写实照片，只取形制不取画法 | 采纳（定调） |
| Pinterest 搜索「游戏 书架」（用户给的链接） | 单件家具画在深底、概念表正交视图、桌面场景一盏暖光、日志对开 | 阶段 0 选图来源；书柜场景重出的画法 | 只在本机看 | 借鉴 |
| 《哈利波特：魔法觉醒》日记本系统（微博 Natas_77 三屏截图，用户提供） | 桌上翻开的活页相册：左页卡袋（编号、日期、空袋虚影）、右页选中卡的详情与蜡封；桌上并排的夹子封面写进度，未解锁的只有描边 | 档案夹与对开页的整个形式；进度写封面；空位画虚影 | 游戏资产有版权，只学形式与做法，不用它的图 | 采纳（形式蓝本） |
| ROVAI 使命板（用户提供） | 木框软木板上九张羊皮纸任务卡：蜡封徽记、编号、标题、一句话、状态章 | 卡要像实物（毛边、污渍、封蜡、章）；一屏九张 | 任务板语义是待办，不是档案 | 借鉴（卡的物件感） |
| 挂夹文件抽屉简笔图（用户提供） | 抽屉里一排挂夹，顶上标签 | 存放单位改为夹；抽屉代替格柜 | 太简，只取结构 | 采纳（结构） |
| Pinterest 搜索「游戏ui」（用户给的链接，Chrome 里看） | 手绘羊皮纸零件表、木框面板、记录员档案卡页、活页相册、任务卡等 | 风格圣经的选图来源；零件表的构成 | 需要登录浏览，WebFetch 不行；图只在本机看 | 借鉴（选十张进风格圣经） |
| Steam《图书管理员：整理魔法图书馆吧！》（ArtRising，2026-04-30） | 第一人称三维，把 3072 本书归位，整排归好解锁能力，特别好评两万五千条 | "归位"本身当玩法；暖木加彩窗的三维图书馆 | 三维实时，不是绘制 UI | 仅参考（三维那边与归位反馈） |
| ZSS Fantasy RPG UI Kit（itch 开发日志） | 自述 AI 生成底纹加大量手工覆盖修瑕分层，交付分层 PSD 与九宫格 PNG | 我们零件表的生产方式与交付物 | 风格偏欧美重彩 | 采纳（流程） |
| LayerDiffuse（runware 博客）、rangy.ai 透明 PNG 指南、leanrada 9-slicer | 直接出透明通道的生图；单色底批量生成再抠；九宫格切片与 CSS 生成器 | 抠底与切片的工具 | 国内可用性待试 | 借鉴（工具） |
| Pinterest 收藏页 https://www.pinterest.com/yanghaihy/_pins/ （用户 2026-11-06 钉的十三张，只在本机看） | 壁炉小屋微缩场景、两张手游书与任务板实机截图、Polycount 书柜灰模、AI 悬赏板、兽人悬赏板三维道具、猴岛传说菜单、树根与葡萄藤书架、三维魔法书、三张 AI 魔法书与概念表 | 逐张的做法判断与用处在 docs/ui-craft-and-pipeline.md 第一节；结论：六张标了 AI、两张疑似、三张游戏截图、两张三维道具，好看在材质、形体、光三件事上 | 文字全是乱码的不能照搬；树根书架不能按数据摆书 | 采纳（第 4 张书封当标签加翻开的书、第 12 / 13 张的概念表版式为阶段 0 样式图格式；第 2 / 7 张任务板与木牌菜单为屏幕参考） |
| GDC 2015《Hearthstone: How to Create an Immersive User Interface》 https://www.gdcvault.com/play/1022036/ | 炉石界面设计演讲：「我们的游戏就是界面」「沉浸先于实用」，界面当桌上实物做，画完切零件进引擎再加粒子与声 | 研习录"一间书房"的根据；每件东西是实物、能戳会响 | 炉石是 Unity 三维场景，我们是网页 | 采纳（原则） |
| Juice it or lose it（Jonasson 与 Purho，2012） https://gamejuice.pages.dev/articles/juice-it-or-lose-it-lessons | 先做静态能玩的版本，再一层层加缓动、粒子、震屏、声音 | 阶段 6 动效的工作方法：一次加一层、真机看一遍 | 游戏的震屏粒子对阅读工具要克制 | 采纳（方法） |
| Duolingo 口型博客 https://blog.duolingo.com/world-character-visemes 与 Rive 角色动画用例 https://rive.app/use-cases/character-animation | 角色在 Rive 里做，一个文件装美术、骨骼、动画、状态机；二十多个通用嘴形拼口型 | 若以后有角色或有状态的动画，走 Rive；运行时要自带进 vendor | 研习录眼下没有角色 | 仅参考 |
| Lottie、Rive、CSS 三选一 https://www.pkgpulse.com/guides/lottie-vs-rive-vs-css-animations-web-animation-formats-2026 | 播放型用 Lottie、状态机型用 Rive、界面过渡用 CSS | 研习录动效首选 CSS 与 Web Animations API，粒子用 canvas | 不引 CDN | 采纳（选型） |
| 用户 2026-11-06 晚发来的三张图（本机 tools/out/ui/refs/，不入库） | 1 紫夜墓场：风暴紫云、黑枯枝压顶、前景墓碑睁绿眼、毒绿雾、山上亮窗的宅子（AI 风格化数字绘）；2 Gothic Bookshelf：黑木尖拱窗花格书架、两侧烛台、挂饰骷髅、乌鸦、皮面旧书（AI 写实摄影风）；3 蓝夜碑林：刻字墓碑、墨线描边、雾、枯树（AI，文字乱码） | 1 定首页的构图与色（紫夜加毒绿光）；2 定书架的形制（尖拱、窗花格、烛台、乌鸦、骷髅饰物）；3 定档案碑的样子（碑面刻夹名、碑林、雾）与墨线描边的画法 | 2 是写实照片风，只取形制按厚涂加墨线重画；3 的文字是乱码不能用；紫与绿对红绿色弱是气氛不是意义 | 采纳（圣经第三稿据此重写；第二轮试笔的蓝本；盲测对照墙用） |
| 用户 2026-11-06 晚发来的第四张图：Welcome to Sleepy Hollow 铁门（本机 tools/out/ui/refs/user-gate-sleepy-hollow.jpg，不入库） | 竖构图：前景一道黑铁墓园大门框住画面，拱上一块发橙光的字牌，门柱顶石像鬼、门上魔鬼脸浮雕、枯藤缠柱，门扇开着；中景裂开的石板路进雾林；远景枯林；红橙加青的风暴天（AI 数字绘，带生图水印） | 首页改成这种构图：门是前景、路和路牌是中景、林与宅是远景，三层对比递减，字牌给站名；用户说三碑首页碑太大太多、层次不够 | 只取构图与层次，不用它的红橙天和魔鬼脸（圣经：紫夜、温和不恐怖，暖光只有烛光琥珀）；有版权与水印，只在本机看 | 采纳（整体风格定调：青橙对撞、背光、一屏一主角、字是画出来的光，圣经第四稿方向；首页 P011 据其构图；之后每件生图拿它当风格锚） |
| Midjourney 接口现状（2026-11 查：apiframe、wireflow、linkmodel 等博客，均为卖替代品的厂商） | Midjourney 仍无官方公开接口；所谓 Midjourney API 全是第三方爬 Discord 或网页的中转；传闻企业版接口无日期。订阅四档每月 10 / 30 / 60 / 120 美元，--sref 带图定风格、--sw 定强度 | 用户要 MJ 的质感：只能人工在 MJ 网页版出图，我写提示词与 --sref，图回到本机后由生产线接手 | 第三方中转有封号与违约风险，不接进脚本 | 采纳（人工出图路线，待用户定） |
| fal 上带风格参考的模型（fal.ai/krea-2、fal learn 的模型对比） | Krea 2 Medium / Large：传一张或几张图当风格参考、每张可调强度、有创意度参数；fal 自评 Nano Banana 2、FLUX.2 pro、Seedream 4.5 质量与性价比领先 | 不走 MJ 时的首选试验对象：Krea 2 带图四当风格参考出首页对比 | 都没有针对厚涂概念图的横评，要自己同题试 | 借鉴（待试） |

## 待看

- 《Choreographed Emotion: How to Create a Legendary Card Pack Opening》（N3TWORK，Medium）https://medium.com/n3twork/choreographed-emotion-6-steps-to-a-great-card-reveal-ux-a6e6bb8487dd ：2026-11-11 抓取返回 403 没读到；做拆包样机前请用户在浏览器里打开，或换来源。
- GDC Vault 上 Sakamoto 那场讲座的录像，看开包一段的节奏。
- 微信内置浏览器（X5 内核）的 WebGL 2 内存上限与 KTX2 支持情况：没搜到资料，第 1 步做完直接在用户手机上实测。
- `1-Projects/微缩IP全生态` 的 Godot 丹房原型：看一眼它的资产怎么做的，有没有能借的建模经验。
- igloo.inc 的 three.js 论坛帖 https://discourse.threejs.org/t/landing-site-igloo-inc/67249 。
