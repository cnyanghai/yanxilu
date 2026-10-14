/* 研习录 · 线网图布局
 * 坐标系 1360 × 900（SVG viewBox）。线路只走横竖两个方向，拐角由页面画成圆角。
 * 一条线上的站点均匀排在相邻两个“锚点”之间：anchors 里的 [站序号, pts 下标] 把某一站钉在某个拐点或换乘点上。
 * 站点内容不写在这里，由页面从课表（src/plan.js）、书（data.js）和下面的 mmWeeks 读取。
 * 新增地标：在 data.js 的 reports 里加专题（写清出处 origin、用途 uses），再在下面 landmarks 里给它一个位置。
 * 地标放在它所属的方向区域里；“可以拿来做练习数据”这类用途不画线，显示在对应那一站的详情里。
 * 没给位置的专题也会出现在首页“地标”列表里。
 */
window.YXL_METRO = {
  w: 1360,
  h: 1030,

  /* 区域 = 学习方向（track 对应 data.js 里 tracks 的 id；点区域名进入该方向） */
  zones: [
    { track: "", name: "", x: 40, y: 24, w: 1280, h: 120, fill: "--z-en", ink: "--zi-en" },
    { track: "cycle", name: "经济周期", x: 540, y: 200, w: 340, h: 225, fill: "--z-cycle", ink: "--zi-cycle", lx: 554, ly: 222 },
    { track: "geo", name: "地缘与战争", x: 920, y: 186, w: 400, h: 238, fill: "--z-geo", ink: "--zi-geo", lx: 934, ly: 208 },
    { track: "fin", name: "", x: 150, y: 430, w: 1070, h: 80, fill: "--z-fin", ink: "--zi-fin" },
    { track: "", name: "数据技能 · SQL 与 Python", x: 60, y: 534, w: 960, h: 400, fill: "--z-data", ink: "--zi-data", lx: 74, ly: 922 },
    { track: "fut", name: "期货与商品", x: 1040, y: 830, w: 290, h: 186, fill: "--z-fut", ink: "--zi-fut", lx: 1054, ly: 852 },
    { track: "co", name: "公司与行业 · 第二阶段", x: 1060, y: 550, w: 270, h: 240, dashed: true, ink: "--zi-co", lx: 1074, ly: 572 }
  ],

  /* 线路。src：plan:<科目> 读课表，book:<书 id> 读章节，mm 读下面的 mmWeeks；没有 src 的只画线 */
  lines: [
    { id: "film", subj: "film", name: "英语·电影", color: "--ln-en", src: "plan:film", pts: [[110, 88], [1170, 88]], anchors: [[0, 0], [35, 1]], small: true,
      ticks: [[0, "第 1 周"], [6, "第 2 周"], [12, "第 3 周"], [18, "第 4 周"], [24, "第 5 周"], [30, "第 6 周"]] },
    { id: "enx", name: "之后：CFA 英文阅读（规划中）", color: "--ln-en", dash: true, r: 3, pts: [[1170, 88], [1296, 88]] },
    { id: "cfa", subj: "cfa", name: "CFA 一级", color: "--ln-cfa", src: "plan:cfa", pts: [[180, 460], [820, 460], [980, 460], [1180, 460]], anchors: [[0, 0], [40, 1], [51, 2], [63, 3]], hubs: [40, 51], small: true },
    { id: "p2", name: "第二阶段（规划中）", color: "--ln-cfa", dash: true, r: 3, pts: [[1180, 460], [1290, 460], [1290, 690]] },
    { id: "tao", book: "zhoulu", name: "涛动周期录", color: "--ln-tao", src: "book:zhoulu", free: true, pts: [[600, 290], [820, 290], [820, 460]], anchors: [[0, 0], [6, 2]], hubs: [6] },
    { id: "geo", subj: "geo", book: "tragedy", name: "地缘 · 大国政治的悲剧", color: "--ln-geo", src: "plan:geo", pts: [[980, 460], [980, 240], [1290, 240]], anchors: [[0, 0], [23, 2]], hubs: [0] },
    { id: "sql", subj: "sql", name: "SQL", color: "--ln-sql", src: "plan:sql", pts: [[120, 750], [302, 750], [380, 750], [960, 750]], anchors: [[0, 0], [7, 1], [10, 2], [35, 3]], hubs: [7, 10] },
    { id: "py", subj: "py", name: "Python", color: "--ln-py", src: "plan:py", pts: [[120, 580], [380, 580], [380, 650], [380, 750], [380, 890], [700, 890]], anchors: [[0, 0], [12, 2], [16, 3], [23, 5]], hubs: [12, 16] },
    { id: "mm", report: "futures-mm-plan", name: "做市商研习", color: "--ln-mm", src: "mm", pts: [[1220, 970], [302, 970], [302, 750], [302, 650], [380, 650], [700, 650]], anchors: [[0, 0], [4, 2], [7, 4], [11, 5]], hubs: [4, 7] }
  ],

  /* 换乘站：两条线在这里用到同一块知识。at = [线 id, 站序号] */
  hubs: [
    { x: 820, y: 469, cap: true, name: "经济周期", sub: "CFA E2「理解经济周期」和《涛动周期录》第七章「周期真实义」都在讲经济周期怎样运行，可以对照着读。", at: [["cfa", 40], ["tao", 6]] },
    { x: 980, y: 469, cap: true, name: "地缘政治", sub: "CFA E5「地缘政治入门」与地缘线的起点《大国政治的悲剧》第一章相互补充。", at: [["cfa", 51], ["geo", 0]] },
    { x: 302, y: 750, name: "GROUP BY", sub: "做市商第 5 周用 SQL 统计盘口数据，前置是 SQL 第 8 课 GROUP BY。", at: [["sql", 7], ["mm", 4]] },
    { x: 380, y: 750, name: "表比对", sub: "SQL 第 11 课 INNER JOIN 和 Python 第 17 课 merge 是同一种操作：两张表按关键字对上。", at: [["sql", 10], ["py", 16]] },
    { x: 380, y: 650, name: "pandas 入门", sub: "做市商第 8 周用 pandas 重做分析，前置是 Python 第 13 课 pandas 入门。", at: [["py", 12], ["mm", 7]] }
  ],

  /* 线名牌 */
  badges: [
    { line: "cfa", x: 70, y: 434, t: "CFA 一级" },
    { line: "film", x: 56, y: 40, t: "英语 · 电影跟读《当幸福来敲门》· 36 段", dark: true },
    { line: "sql", x: 40, y: 741, t: "SQL" },
    { line: "py", x: 40, y: 571, t: "Python" },
    { line: "tao", x: 600, y: 256, t: "涛动周期录 · 自由线" },
    { line: "geo", x: 996, y: 352, t: "地缘 · 大国政治的悲剧" },
    { line: "mm", x: 1100, y: 990, t: "做市商研习 · 12 周", dark: true }
  ],

  /* 固定文字。b 粗体在前，t 常规在后；anchor: "end" 右对齐 */
  labels: [
    { x: 1300, y: 52, b: "", t: "每天一段，周日复习本周 6 段", anchor: "end", muted: true },
    { x: 1300, y: 70, b: "", t: "之后：CFA 英文阅读", anchor: "end", muted: true },
    { x: 460, y: 448, b: "", t: "数量方法 · 36 讲", anchor: "middle", muted: true },
    { x: 1080, y: 448, b: "", t: "经济学 · 28 讲", anchor: "middle", muted: true },
    { x: 776, y: 507, b: "经济周期", t: " E2 与第七章" },
    { x: 958, y: 507, b: "地缘政治", t: " E5 与第一章" },
    { x: 1150, y: 448, b: "", t: "ER 总复习" },
    { x: 1074, y: 718, b: "", t: "规划中：第二阶段", muted: true },
    { x: 1074, y: 736, b: "", t: "财务报表分析、公司估值", muted: true },
    { x: 580, y: 317, b: "", t: "第一章 走向成熟" },
    { x: 966, y: 418, b: "", t: "第二章 · 已有精读稿", anchor: "end" },
    { x: 1300, y: 224, b: "", t: "实战：两种理论各写一页", anchor: "end" },
    { x: 392, y: 634, b: "pandas 入门", t: " 做市商第 8 周" },
    { x: 714, y: 895, b: "", t: "小项目：清洗加比对" },
    { x: 714, y: 655, b: "", t: "第 12 周 · 一页总结" },
    { x: 288, y: 716, b: "GROUP BY", t: "", anchor: "end" },
    { x: 288, y: 733, b: "", t: "做市商第 5 周", anchor: "end" },
    { x: 392, y: 780, b: "表比对", t: " SQL JOIN 与 Python merge" },
    { x: 446, y: 736, b: "", t: "实战一：名单比对" },
    { x: 650, y: 736, b: "", t: "实战二：清洗后比对" },
    { x: 816, y: 736, b: "", t: "导入 CSV" },
    { x: 974, y: 754, b: "", t: "综合项目" }
  ],

  /* 地标：讨论和查到的资料，不在任何线上，不算进度。report = data.js 里专题的 id */
  landmarks: [
    { report: "futures-market-making", x: 1290, y: 970, walk: [[1232, 970], [1282, 970]], lx: 1250, ly: 1004, sub: "" },
    { report: "cn-us-jp-wealth", x: 600, y: 362, lx: 616, ly: 367, sub: "" },
    { report: "cn-us-consumption", x: 600, y: 398, lx: 616, ly: 403, sub: "" }
  ],

  /* 做市商研习计划：12 周，每周一站（详见专题页“十二周安排”） */
  mmWeeks: [
    "读 Harris“Dealers”，报价演示五组实验",
    "读 Harris“Bid/Ask Spreads”，纸上做市（一）",
    "读 Harris“Informed Traders”，纸上做市（二）",
    "读交易所做市规则，整理一个品种的做市义务表",
    "读 O'Hara 第 1—2 章，导入练习数据，SQL 四题",
    "读 O'Hara 第 3 章，SQL：盘口失衡能不能预测下一跳",
    "读 O'Hara 第 4 章，SQL：被吃之后 30 秒的盈亏",
    "读 Cartea 第 1—4 章，用 pandas 重做并画成交后走势",
    "读 Avellaneda、Stoikov 原论文，写 quote() 函数",
    "读 Cartea 第 10.1—10.3 节，第一个回测与盈亏拆分",
    "读 Cartea 第 10.4 节与第 12 章，库存后撤与失衡过滤",
    "回看笔记，写一页总结，定下一阶段"
  ]
};
