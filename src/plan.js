/* 研习录 · 每日课表（第一阶段）
 * 课程按顺序推进，不和日期绑死：哪天没学完，下次就接着学这一课。
 * 每天早上 7 点（北京时间）由定时任务按“周几的时段安排 + 各科下一课”生成当天讲义，
 * 写到 study/daily/<日期>.md；晚上 9 点打卡后更新 study/progress.json。
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
    en:  { name: "英语", color: "seal", why: "为 CFA 英文教材和考试打底。每天跟着当天的 CFA 主题学 10 个术语、读一篇短文，并复习 1、3、7 天前的词。" },
    sql: { name: "SQL", why: "工作和大数据局都直接用得上：从零学到能独立写交叉比对查询。工具先用 SQLite（DB Browser for SQLite），后期加 DuckDB 直接查 Excel。" },
    py:  { name: "Python", why: "用 pandas 批量清洗、拆分、比对 Excel，为大数据局的数据处理和 AI 应用打底。电脑上已有 Anaconda，直接用 Jupyter。" },
    cfa: { name: "CFA 一级", why: "第一阶段学数量方法和经济学：前者是所有科目的计算工具，后者连着“经济周期”方向。讲义中文讲解、保留英文术语，附练习题。" },
    geo: { name: "地缘政治", why: "精读《大国政治的悲剧》：周六读一章，周日做思考题、用这一章的框架分析一件时事。" },
    rev: { name: "周复盘", why: "本周 SQL、Python、CFA 小测各 5 题，错题回炉，再用本周学的东西处理一份模拟数据。" }
  },

  /* 周几的时段安排：0 = 周日 … 6 = 周六。[科目, 分钟] */
  week: {
    1: [["en", 20], ["sql", 45], ["cfa", 35]],
    2: [["en", 20], ["py", 45], ["cfa", 35]],
    3: [["en", 20], ["sql", 45], ["cfa", 35]],
    4: [["en", 20], ["py", 45], ["cfa", 35]],
    5: [["en", 20], ["sql", 45], ["cfa", 35]],
    6: [["en", 20], ["geo", 60], ["cfa", 35]],
    0: [["en", 20], ["geo", 30], ["rev", 50]]
  },

  prepDay: [
    "装好 DB Browser for SQLite（免费，sqlitebrowser.org），打开能新建一个空数据库即可",
    "打开 Anaconda Navigator → Jupyter Notebook，新建笔记本，运行 print(\"hello\")",
    "备好《大国政治的悲剧》（纸质或电子版均可），先读目录和第一章开头",
    "准备一个英语生词本（纸质、Excel 或手机笔记都行），以后每天的术语都记在这里",
    "通读这一页课表，有想调整的地方今晚打卡时说"
  ],

  /* 各科课程顺序。英语不单列：每天跟着当天 CFA 课的主题走。 */
  lessons: {
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
