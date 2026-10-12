#!/usr/bin/env python3
"""生成做市研习用的模拟 tick 数据：reports/data/mm_ticks.csv

这是模拟数据，不是任何真实合约的行情。它按国内商品期货的日盘时段（9:00—10:15、10:30—11:30、
13:30—15:00）和每秒两次的快照频率生成一天的一档盘口，最小变动价位 1 元。

模拟规则（故意留给学习者自己去“发现”的几个现象）：
- 市价单按泊松过程到达，逐笔吃掉对手方的一档挂单；一档吃光，价格就跳一格。
- 隐藏一个“知情资金”状态：每隔几分钟随机切换为偏买、中性或偏卖，偏买时主动买单更多，反之亦然。
- 挂单会随机增加和撤销；价差偶尔变成两跳，随后有人挂进中间把它补上。

用法：python3 make_mm_ticks.py（固定随机种子，每次生成的数据相同）
"""
import csv, math, pathlib, random

random.seed(20261012)
OUT = pathlib.Path(__file__).parent / "mm_ticks.csv"
SESSIONS = [("09:00:00", "10:15:00"), ("10:30:00", "11:30:00"), ("13:30:00", "15:00:00")]
STEP = 0.5            # 秒
BASE_RATE = 0.30      # 每半秒主动买 / 主动卖单的平均到达数（中性状态）
TILT = 0.85           # 知情资金偏向的强度
SWITCH = 1 / 700      # 每半秒切换资金状态的概率（平均约 6 分钟）


def poisson(lam):
    l, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= random.random()
        if p <= l:
            return k
        k += 1


def order_size():
    n = 1
    while random.random() > 0.38:
        n += 1
    return min(n, 30)


def secs(t):
    h, m, s = map(int, t.split(":"))
    return h * 3600 + m * 60 + s


def fmt(x):
    ms = int(round(x * 1000))
    h, rem = divmod(ms, 3600_000)
    m, rem = divmod(rem, 60_000)
    s, ms = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


bid, ask = 3449, 3450
bq, aq = 18, 15
last, volume, oi = 3450, 0, 412_360
regime = 0
rows, seq = [], 0

for start, end in SESSIONS:
    t = secs(start)
    while t < secs(end):
        if random.random() < SWITCH:
            regime = random.choices([-1, 0, 1], weights=[0.3, 0.4, 0.3])[0]
        lam_buy = BASE_RATE * (1 + TILT * regime)
        lam_sell = BASE_RATE * (1 - TILT * regime)

        # 挂单的增加与撤销
        bq += sum(order_size() for _ in range(poisson(0.55)))
        aq += sum(order_size() for _ in range(poisson(0.55)))
        bq -= sum(1 for _ in range(bq) if random.random() < 0.012)
        aq -= sum(1 for _ in range(aq) if random.random() < 0.012)

        # 两跳价差时，有人挂进中间
        if ask - bid >= 2 and random.random() < 0.15:
            if random.random() < 0.5 + 0.25 * regime:
                bid += 1; bq = random.randint(1, 6)
            else:
                ask -= 1; aq = random.randint(1, 6)

        traded, trades = 0, []
        orders = ["B"] * poisson(lam_buy) + ["S"] * poisson(lam_sell)
        random.shuffle(orders)
        for side in orders:
            size = order_size()
            while size > 0:
                if side == "B":
                    fill = min(size, aq)
                    if fill:
                        trades.append(ask); traded += fill; aq -= fill; size -= fill
                    if aq <= 0:                       # 卖一被吃光，价格上跳
                        ask += 1; aq = random.randint(4, 26)
                        if random.random() < 0.6:      # 多数时候有人跟着把买一抬上来
                            bid = ask - 1; bq = random.randint(2, 14)
                        if size > 0 and random.random() < 0.5:
                            size = 0                    # 剩余部分没追价
                else:
                    fill = min(size, bq)
                    if fill:
                        trades.append(bid); traded += fill; bq -= fill; size -= fill
                    if bq <= 0:
                        bid -= 1; bq = random.randint(4, 26)
                        if random.random() < 0.6:
                            ask = bid + 1; aq = random.randint(2, 14)
                        if size > 0 and random.random() < 0.5:
                            size = 0

        # 撤单把一档撤空时，价格退到下一档
        if bq <= 0:
            bid -= 1; bq = random.randint(5, 30)
        if aq <= 0:
            ask += 1; aq = random.randint(5, 30)
        if ask <= bid:
            ask = bid + 1

        if trades:
            last = trades[-1]
        volume += traded
        oi = max(0, oi + int(round(traded * random.uniform(-0.45, 0.45))))
        seq += 1
        rows.append([seq, "2026-10-12", fmt(t), bid, bq, ask, aq, last, volume, traded, oi])
        t += STEP

with OUT.open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["seq", "trade_date", "time", "bid1", "bid_vol1", "ask1", "ask_vol1", "last", "volume", "trade_vol", "open_interest"])
    w.writerows(rows)
print(OUT.name, len(rows), "rows")
