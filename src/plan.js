/* 研习录 · 每日课表（第一阶段）
 * 课程按顺序推进，不和日期绑死：哪天没学完，下次就接着学这一课。
 * 讲义按课存：一课一个文件 study/lessons/<科目>/<两位序号>.md，第一次排到这一课的那天早上写好，以后不重写。
 * 每天早上 7 点（北京时间）由定时任务按“周几的时段安排 + 各科下一课”写当天的路线单 study/daily/<日期>.md；
 * 晚上 9 点打卡后更新 study/progress.json。
 */
window.YXL_PLAN = {
  phase: "第一阶段",
  prep: "2026-10-11",
  start: "2026-10-12",
  weeks: 12,
  tz: "北京时间",
  push: "07:00",
  checkin: "21:00",
  repo: "https://github.com/cnyanghai/yanxilu/blob/main/",

  subjects: {
    film: { name: "英语·电影", film: "当幸福来敲门", filmEn: "The Pursuit of Happyness", year: 2006, player: true,
      why: "先把一部电影学透：《当幸福来敲门》分成 36 段，每天一段，盲听、精听、跟读、背诵，周日把本周 6 段连起来复习。片源和英文字幕用你自己的，在研习录的跟读播放器里打开，不上传。背完再转 CFA 英文阅读。" },
    en:  { name: "英语（CFA 术语）", why: "10 月 12—14 日的英语时段：跟着 CFA 主题学术语、读短文。从 10 月 15 日起英语改为电影跟读，CFA 术语并进每节 CFA 课的讲义末尾。" },
    sql: { name: "SQL", why: "工作和大数据局都直接用得上：从零学到能独立写交叉比对查询。工具先用 SQLite（DB Browser for SQLite），后期加 DuckDB 直接查 Excel。" },
    py:  { name: "Python", why: "用 pandas 批量清洗、拆分、比对 Excel，为大数据局的数据处理和 AI 应用打底。电脑上已有 Anaconda，直接用 Jupyter。" },
    cfa: { name: "CFA 一级", why: "第一阶段学数量方法和经济学：前者是所有科目的计算工具，后者连着“经济周期”方向。讲义中文讲解、保留英文术语，附练习题。" },
    geo: { name: "地缘政治", why: "精读《大国政治的悲剧》：周六读一章，周日做思考题、用这一章的框架分析一件时事。" },
    rev: { name: "周复盘", why: "本周 SQL、Python、CFA 小测各 5 题，错题回炉，再用本周学的东西处理一份模拟数据。" }
  },

  /* 两种线：
   * 目标线 = 自己定的能力目标，按估算小时排站；每站写清学什么、怎么检验，过了检验才算到站（检验记录写在 progress.json 的 checks 里，如 "ai-0": "2026-12-01"）。
   *   subjs：哪些科目的学习时间算在这条线上；parallel：前几站是并行的几条轨道（交替学，都过检验后并成一条线）。
   *   station.subj：这一站对应的课表科目；station.lessons：[从第几课, 到第几课之前]（从 0 起）。
   * 自选线 = 单独挑出来学的一门课或一本书（电影、地缘、涛动周期录、做市商研习），一课一站，不算晚点。
   * 小时数是粗估，开线学到那一站时再细化。 */
  goals: [
    { id: "ai", name: "AI 研发", end: "能训练、研究模型", color: "--ln-py", subjs: ["py", "sql"], parallel: 2,
      stations: [
        { name: "Python", hours: 100, subj: "py", learn: "语法、函数、文件、pandas", check: "不查资料写出批量清洗 Excel 的脚本" },
        { name: "SQL 与 pandas", hours: 60, subj: "sql", learn: "查询、连接、窗口函数、清洗", check: "两份名单交叉比对，SQL 和 pandas 各做一遍" },
        { name: "线性代数", hours: 80, learn: "向量、矩阵、特征值、SVD", check: "手推 PCA，并用 numpy 实现" },
        { name: "概率统计", hours: 80, learn: "分布、估计、假设检验、贝叶斯", check: "从零实现朴素贝叶斯和一次 A/B 检验" },
        { name: "微积分与优化", hours: 60, learn: "导数、链式法则、梯度下降", check: "手推一层网络的反向传播" },
        { name: "机器学习", hours: 120, learn: "经典算法、特征、模型评估", check: "用真实数据做分类模型，讲清评估指标" },
        { name: "深度学习", hours: 150, learn: "神经网络、PyTorch、CNN 与 RNN", check: "从零训练一个图像分类网络" },
        { name: "大模型原理", hours: 100, learn: "注意力、Transformer、预训练与微调", check: "从零写一个小 GPT 并训练出能读的文字" },
        { name: "读论文与复现", hours: 150, learn: "精读经典论文，复现关键实验", check: "独立复现一篇论文的主要结果" },
        { name: "训练、改进模型", hours: 120, learn: "设计实验、评测、改进", check: "提出一个改进并用实验证明有效" }
      ] },
    { id: "cfa", name: "CFA 级金融", end: "一级水平", color: "--ln-cfa", subjs: ["cfa", "en"],
      stations: [
        { name: "数量方法", item: "cfa-quant", hours: 30, subj: "cfa", lessons: [0, 36], learn: "收益率、时间价值、统计、回归", check: "做完这一科的模拟题，正确率 70% 以上" },
        { name: "经济学", item: "cfa-econ", hours: 30, subj: "cfa", lessons: [36, 64], learn: "市场结构、经济周期、货币与财政、汇率", check: "做完这一科的模拟题，正确率 70% 以上" },
        { name: "财务报表", item: "cfa-fsa", hours: 30, learn: "三张表、收入确认、存货、长期资产", check: "读懂一份上市公司年报的三张表" },
        { name: "公司发行人", item: "cfa-corp", hours: 30, learn: "公司治理、资本结构、资本预算", check: "做完这一科的模拟题，正确率 70% 以上" },
        { name: "权益投资", item: "cfa-equity", hours: 30, learn: "市场组织、指数、估值模型", check: "用两种模型给一只股票估值" },
        { name: "固定收益", item: "cfa-fi", hours: 30, learn: "债券定价、收益率、久期与凸性", check: "手算一只债券的久期" },
        { name: "衍生品", item: "cfa-deriv", hours: 30, learn: "远期、期货、期权、互换的定价", check: "做完这一科的模拟题，正确率 70% 以上" },
        { name: "另类投资", item: "cfa-alt", hours: 30, learn: "私募、对冲基金、房地产、大宗", check: "做完这一科的模拟题，正确率 70% 以上" },
        { name: "组合管理", item: "cfa-pm", hours: 30, learn: "风险与收益、资本市场线、组合构建", check: "做完这一科的模拟题，正确率 70% 以上" },
        { name: "道德标准", item: "cfa-ethics", hours: 30, learn: "职业行为准则与标准", check: "做完这一科的模拟题，正确率 70% 以上" }
      ] }
  ],

  /* 周几的时段安排：0 = 周日 … 6 = 周六。[科目, 分钟, "review"]；标 review 的时段是复习，不推进进度 */
  week: {
    1: [["film", 90], ["sql", 45], ["cfa", 35]],
    2: [["film", 90], ["py", 45], ["cfa", 35]],
    3: [["film", 90], ["sql", 45], ["cfa", 35]],
    4: [["film", 90], ["py", 45], ["cfa", 35]],
    5: [["film", 90], ["sql", 45], ["cfa", 35]],
    6: [["film", 90], ["geo", 60], ["cfa", 35]],
    0: [["film", 90, "review"], ["geo", 30], ["rev", 50]]
  },

  /* 某一科从哪天起排课（之前的日子不算这一科晚点） */
  since: { film: "2026-10-15" },

  /* 有讲义文件的科目；电影线没有讲义，用跟读播放器 */
  written: ["sql", "py", "cfa", "geo", "rev"],

  prepDay: [
    "装好 DB Browser for SQLite（免费，sqlitebrowser.org），打开能新建一个空数据库即可",
    "打开 Anaconda Navigator → Jupyter Notebook，新建笔记本，运行 print(\"hello\")",
    "备好《大国政治的悲剧》（纸质或电子版均可），先读目录和第一章开头",
    "准备一个英语生词本（纸质、Excel 或手机笔记都行），以后每天的术语都记在这里",
    "通读这一页课表，有想调整的地方今晚打卡时说"
  ],

  /* 各科课程顺序 */
  lessons: {
    /* 电影按字幕分成 36 段，每段约 3 分钟；播放器读你的字幕文件，按同样的规则切段 */
    film: ["第 1 段", "第 2 段", "第 3 段", "第 4 段", "第 5 段", "第 6 段", "第 7 段", "第 8 段", "第 9 段", "第 10 段", "第 11 段", "第 12 段",
      "第 13 段", "第 14 段", "第 15 段", "第 16 段", "第 17 段", "第 18 段", "第 19 段", "第 20 段", "第 21 段", "第 22 段", "第 23 段", "第 24 段",
      "第 25 段", "第 26 段", "第 27 段", "第 28 段", "第 29 段", "第 30 段", "第 31 段", "第 32 段", "第 33 段", "第 34 段", "第 35 段", "第 36 段"],
    sql: [
      "数据库、表、行和列：装好 DB Browser，建第一张表",
      "SELECT 与 FROM：取列、起别名、算新列",
      "WHERE：比较、AND / OR / NOT、BETWEEN、IN",
      "LIKE 模糊匹配与通配符",
      "NULL：空值的坑，IS NULL 与 COALESCE",
      "ORDER BY、LIMIT、DISTINCT",
      "聚合函数：COUNT、SUM、AVG、MAX、MIN",
      "GROUP BY 分组统计",
      "HAVING：分组后再筛选（找同一身份证出现多次）",
      "为什么要拆表：主键与外键",
      "INNER JOIN：两份名单取交集",
      "LEFT JOIN：在 A 名单、不在 B 名单",
      "多表 JOIN 与自连接（同住址、同账户）",
      "UNION、EXCEPT、INTERSECT：集合运算",
      "实战一：公职人员名单 × 补贴发放名单比对（模拟数据）",
      "子查询（一）：写在 WHERE 里",
      "EXISTS 与 NOT EXISTS",
      "子查询（二）：写在 FROM 里的派生表",
      "字符串函数：TRIM、SUBSTR、REPLACE、LENGTH",
      "身份证号解析：出生日期、性别、校验位",
      "日期函数：年龄、区间、任职期间是否重叠",
      "CASE WHEN：分类与打标签",
      "清洗综合：全角半角、空格、大小写、重复记录",
      "实战二：先清洗不规范表，再做比对",
      "窗口函数入门：ROW_NUMBER 去重并保留最新一条",
      "RANK 与分组排名",
      "累计与前后对比：SUM() OVER、LAG、LEAD",
      "CTE（WITH）：把复杂查询拆成几步",
      "建表与改数据：约束、INSERT、UPDATE、DELETE",
      "索引与性能：大表比对为什么慢",
      "导入 Excel / CSV：DB Browser 导入与常见报错",
      "DuckDB：用 SQL 直接查 Excel 文件",
      "视图：把常用筛查规则存起来",
      "筛查规则库：把比对思路写成一组可复用的 SQL",
      "综合项目（上）：多来源数据交叉比对",
      "综合项目（下）：结果整理、复核与复盘"
    ],
    py: [
      "环境：Anaconda 与 Jupyter，第一个程序",
      "变量、数字与字符串",
      "列表与切片",
      "字典：按“键”存数据",
      "if 条件判断",
      "for 与 while 循环",
      "函数：把重复的事写成一个函数",
      "字符串处理：清洗姓名、校验身份证号",
      "读写文件与路径",
      "pathlib：批量处理一个文件夹里的文件",
      "报错怎么读：异常处理与调试",
      "模块与 pip：用别人写好的工具",
      "pandas 入门：读 Excel，看清数据长什么样",
      "pandas 筛选：按条件取行、取列",
      "pandas 清洗：缺失值、重复值、类型转换",
      "groupby 分组统计",
      "merge：两张表比对（对应 SQL 的 JOIN）",
      "合并多个 Excel、拆分多个工作表",
      "不规范表：多行表头、合并单元格",
      "写出 Excel：多个工作表与格式",
      "Python 连接 SQLite / DuckDB",
      "正则表达式入门：从乱文本里提取号码",
      "小项目（上）：一键清洗脚本",
      "小项目（下）：清洗加比对，输出核查清单"
    ],
    /* CFA 一级按模块排，[代号, 中文, 英文, 课数]。以 CFA 协会当年公布的考纲为准。 */
    cfa: [
      ["Q1", "收益率与回报", "Rates and Returns", 4],
      ["Q2", "金融中的货币时间价值", "Time Value of Money in Finance", 4],
      ["Q3", "资产收益的统计度量", "Statistical Measures of Asset Returns", 4],
      ["Q4", "概率树与条件期望", "Probability Trees and Conditional Expectations", 3],
      ["Q5", "组合数学", "Portfolio Mathematics", 3],
      ["Q6", "模拟方法", "Simulation Methods", 2],
      ["Q7", "估计与推断", "Estimation and Inference", 3],
      ["Q8", "假设检验", "Hypothesis Testing", 4],
      ["Q9", "独立性的参数与非参数检验", "Parametric and Non-Parametric Tests of Independence", 2],
      ["Q10", "一元线性回归", "Simple Linear Regression", 4],
      ["Q11", "大数据技术入门", "Introduction to Big Data Techniques", 2],
      ["QR", "数量方法总复习", "Quantitative Methods Review", 1],
      ["E1", "企业与市场结构", "Firms and Market Structures", 4],
      ["E2", "理解经济周期", "Understanding Business Cycles", 4],
      ["E3", "财政政策", "Fiscal Policy", 3],
      ["E4", "货币政策", "Monetary Policy", 4],
      ["E5", "地缘政治入门", "Introduction to Geopolitics", 3],
      ["E6", "国际贸易", "International Trade", 3],
      ["E7", "资本流动与外汇市场", "Capital Flows and the FX Market", 3],
      ["E8", "汇率计算", "Exchange Rate Calculations", 3],
      ["ER", "经济学总复习", "Economics Review", 1]
    ],
    geo: [
      "第一章 导论：读原书与精读页",
      "第一章：思考题与时事应用",
      "第二章 无政府状态与权力竞争：读原书与精读稿",
      "第二章：思考题与时事应用",
      "第三章 财富和权力：读原书与精读页",
      "第三章：思考题与时事应用",
      "第四章 地面力量的首要地位：读原书与精读页",
      "第四章：思考题与时事应用",
      "第五章 生存战略：读原书与精读页",
      "第五章：思考题与时事应用",
      "第六章 行动中的大国：读原书与精读页",
      "第六章：思考题与时事应用",
      "第七章 离岸平衡手：读原书与精读页",
      "第七章：思考题与时事应用",
      "第八章 均势与推卸责任：读原书与精读页",
      "第八章：思考题与时事应用",
      "第九章 大国战争的原因：读原书与精读页",
      "第九章：思考题与时事应用",
      "第十章 中国能不能和平崛起：读原书与精读页",
      "第十章：思考题与时事应用",
      "争鸣：结构现实主义、自由主义与建构主义的批评",
      "回看全书论证地图，补齐概念卡",
      "实战：用进攻性现实主义写一页俄乌冲突分析",
      "实战：换一种理论再写一页，比较两者能解释什么"
    ],
    rev: [
      "第 1 周复盘", "第 2 周复盘", "第 3 周复盘", "第 4 周复盘", "第 5 周复盘", "第 6 周复盘",
      "第 7 周复盘", "第 8 周复盘", "第 9 周复盘", "第 10 周复盘", "第 11 周复盘", "第 12 周复盘：第一阶段总结与下一阶段安排"
    ]
  }
};
