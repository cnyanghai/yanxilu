/* 研习录 · 线网图布局
 * 坐标系 1344 × 1024（SVG viewBox）。线路只走横竖两个方向。
 * 两种线：
 *   目标线（goals）：自己定的能力目标，站点和小时数在 plan.js 的 goals 里；这里只给走向。按估算小时排站，站距越长要学越久。
 *   自选线（free）：一门课或一本书，一课一站，站点从课表（subj）、书的章节（book）或 mmWeeks 读取。
 * 底色区域是学习方向（track 对应 data.js 里 tracks 的 id，点区域名进入该方向）。
 * 新增地标：在 data.js 的 topics 里立一个研究课题，再在下面 landmarks 里给它一个位置。
 */
window.YXL_METRO = {
  w: 1344,
  h: 1024,

  zones: [
    { name: "", x: 20, y: 18, w: 1304, h: 104, fill: "--z-en", ink: "--zi-en" },
    { track: "cycle", name: "经济周期", x: 20, y: 140, w: 310, h: 290, fill: "--z-cycle", ink: "--zi-cycle" },
    { track: "geo", name: "地缘与战争", x: 342, y: 140, w: 428, h: 290, fill: "--z-geo", ink: "--zi-geo" },
    { track: "fut", name: "期货与商品", x: 786, y: 140, w: 538, h: 290, fill: "--z-fut", ink: "--zi-fut" },
    { track: "fin", name: "", x: 20, y: 444, w: 1304, h: 92, fill: "--z-fin", ink: "--zi-fin" },
    { name: "数据与 AI", x: 20, y: 552, w: 984, h: 452, fill: "--z-data", ink: "--zi-data", bottom: true },
    { track: "co", name: "公司与行业", sub: "规划中 · 以后可以开成目标线", x: 1020, y: 552, w: 304, h: 226, dashed: true, ink: "--zi-co" }
  ],

  /* 目标线的走向。plate：线名牌位置；gap：并行轨道离主线的距离 */
  goals: {
    ai: { pts: [[60, 672], [900, 672], [900, 958]], gap: 22, plate: [34, 552], endSide: "right" },
    cfa: { pts: [[196, 490], [1150, 490]], plate: [34, 467], endBox: true }
  },

  /* 自选线。title：线名的位置；after：线尾的虚线延伸 */
  free: [
    { id: "film", subj: "film", color: "--ln-en", pts: [[214, 76], [1150, 76]], plate: [34, 54], ticks: 6,
      after: { to: [1296, 76], label: "背完以后：CFA 英文阅读，并进 CFA 线" } },
    { id: "tao", book: "zhoulu", color: "--ln-tao", pts: [[52, 214], [315, 214], [315, 490]], title: [52, 192] },
    { id: "geo", subj: "geo", book: "tragedy", color: "--ln-geo", pts: [[357, 490], [357, 214], [744, 214]], title: [384, 192] },
    { id: "mm", report: "futures-mm-plan", name: "做市商研习", color: "--ln-mm", pts: [[812, 226], [1290, 226], [1290, 380]], title: [812, 204] }
  ],

  /* 换乘站：两条线在这里讲同一件事。at = [线 id, 站序号]；"cfa:经济学" 指 CFA 目标线上的“经济学”那一站 */
  hubs: [
    { x: 315, y: 490, name: "经济周期", sub: "CFA 经济学里的“理解经济周期”和《涛动周期录》第七章“周期真实义”都在讲经济周期怎样运行，可以对照着读。", at: [["tao", 6], ["cfa", 1]] },
    { x: 357, y: 490, name: "地缘政治", sub: "CFA 经济学里的“地缘政治入门”与《大国政治的悲剧》第一章相互补充。", at: [["geo", 0], ["cfa", 1]] },
    { ai: true, name: "表比对", sub: "SQL 第 11 课 INNER JOIN 和 Python 第 17 课 merge 是同一种操作：两张表按关键字对上。", at: [["sql", 10], ["py", 16]] }
  ],

  /* 线尾的说明文字 */
  labels: [
    { x: 305, y: 418, t: "第七章 · 换乘 CFA 经济学", anchor: "end", ink: "--zi-cycle" },
    { x: 369, y: 418, t: "第一章 · 换乘 CFA 经济学", ink: "--zi-geo" }
  ],

  /* 地标：研究课题，一个课题一个（data.js 的 topics）。topic = 课题 id，地标下面自动写件数和状态。
   * 还没立课题的单件资料也可以用 report = 专题 id 单独放一个地标。 */
  landmarks: [
    { topic: "household", x: 58, y: 318 },
    { topic: "mm", x: 1110, y: 380 }
  ],

  /* 规划中的线 */
  planned: [{ track: "co", pts: [[1050, 690], [1290, 690]], stops: 3, label: "财务报表分析、公司估值", lx: 1050, ly: 722 }],

  legend: { x: 1020, y: 800 },

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
