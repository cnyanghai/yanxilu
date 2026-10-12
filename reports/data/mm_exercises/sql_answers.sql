-- 做市商研习计划 · SQL 习题参考答案（SQLite / DB Browser for SQLite）
-- 先运行下面的建表语句，再用 DB Browser 把 mm_ticks.csv 导入到这张表。

CREATE TABLE ticks (
    seq           INTEGER PRIMARY KEY,
    trade_date    TEXT,
    time          TEXT,
    bid1          INTEGER,
    bid_vol1      INTEGER,
    ask1          INTEGER,
    ask_vol1      INTEGER,
    last          INTEGER,
    volume        INTEGER,
    trade_vol     INTEGER,
    open_interest INTEGER
);

-- 第 5 周 · 1 数一数：有多少行，从几点到几点
SELECT COUNT(*) AS n, MIN(time) AS first_t, MAX(time) AS last_t FROM ticks;

-- 第 5 周 · 2 价差分布
SELECT ask1 - bid1 AS spread, COUNT(*) AS n, ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM ticks), 1) AS pct FROM ticks GROUP BY spread ORDER BY spread;

-- 第 5 周 · 3 每小时成交量
SELECT SUBSTR(time, 1, 2) AS hour, SUM(trade_vol) AS lots, COUNT(*) AS snaps FROM ticks GROUP BY hour ORDER BY hour;

-- 第 5 周 · 4 开高低收与总成交量
SELECT (SELECT last FROM ticks ORDER BY seq LIMIT 1) AS open, MAX(last) AS high, MIN(last) AS low, (SELECT last FROM ticks ORDER BY seq DESC LIMIT 1) AS close, MAX(volume) AS total_lots FROM ticks;

-- 第 6 周 · 盘口失衡与 5 秒后的价格
SELECT CASE WHEN imb < -0.6 THEN '1 强卖压' WHEN imb < -0.2 THEN '2 卖压' WHEN imb <= 0.2 THEN '3 均衡' WHEN imb <= 0.6 THEN '4 买压' ELSE '5 强买压' END AS grp,
       COUNT(*) AS n, ROUND(AVG(move), 3) AS avg_move
FROM (SELECT a.seq,
             (a.bid_vol1 - a.ask_vol1) * 1.0 / (a.bid_vol1 + a.ask_vol1) AS imb,
             ((b.bid1 + b.ask1) - (a.bid1 + a.ask1)) / 2.0 AS move
      FROM ticks a JOIN ticks b ON b.seq = a.seq + 10)
GROUP BY grp ORDER BY grp;

-- 第 7 周 · 被吃之后 30 秒，做市商赚还是亏
SELECT side, COUNT(*) AS n,
       ROUND(AVG(CASE side WHEN '主动买' THEN last - mid_after ELSE mid_after - last END), 3) AS maker_pnl_30s
FROM (SELECT a.seq, a.last,
             CASE WHEN a.last >= p.ask1 THEN '主动买' WHEN a.last <= p.bid1 THEN '主动卖' END AS side,
             (f.bid1 + f.ask1) / 2.0 AS mid_after
      FROM ticks a
      JOIN ticks p ON p.seq = a.seq - 1
      JOIN ticks f ON f.seq = a.seq + 60
      WHERE a.trade_vol > 0)
WHERE side IS NOT NULL
GROUP BY side;

