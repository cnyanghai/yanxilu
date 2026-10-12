"""第 10—11 周：在练习数据上做最简单的做市回测，并拆分盈亏。

假设（都很粗，正是要讨论的地方）：
- 每个快照重新挂单，每次 1 手，库存上下限 ±5 手；收盘按中间价盯市。
- 乐观成交：下一个快照有成交、成交价碰到我们的价位，就算我们成交（相当于排在队首）。
- 保守成交：成交价必须越过我们的价位才算（相当于排在队尾）。真实结果在两者之间。
- 盈亏单位是“跳/手”，乘以合约乘数（比如 10 吨/手 × 1 元/吨）就是元。
"""
import math
import pandas as pd
from w09_quote import quote

df = pd.read_csv("mm_ticks.csv")
df["mid"] = (df.bid1 + df.ask1) / 2
SIGMA = df.mid.diff().std() * math.sqrt(7200)       # 每小时波动多少跳（一小时 7200 个快照）
COLS = ["bid1", "ask1", "bid_vol1", "ask_vol1", "last", "trade_vol", "mid"]


def backtest(df, mode="touch", skew=False, imb_filter=0.0, fill="optimistic",
             cap=5, fee=0.0, gamma=0.01, k=1.5, tau=1.0):
    q, cash, spread_pnl, fills = 0, 0.0, 0.0, 0
    rows = df[COLS].to_numpy()
    for i in range(len(rows) - 1):
        bid1, ask1, bv, av, _, _, mid = rows[i]
        if mode == "as":                                  # 第 10 周：照搬 A-S 公式
            _, _, b, a = quote(mid, q, SIGMA, gamma, k, tau)
            b, a = min(b, ask1 - 1), max(a, bid1 + 1)       # 不越过对手价
        else:                                             # 挂在买一、卖一
            b, a = bid1, ask1
            if skew:                                      # 第 11 周：按库存后撤
                if q > 0: b = bid1 - min(q, 3)
                if q < 0: a = ask1 + min(-q, 3)
        quote_b, quote_a = q < cap, q > -cap
        if imb_filter:                                    # 第 11 周：盘口失衡过滤
            imb = (bv - av) / (bv + av)
            if imb < -imb_filter: quote_b = False
            if imb > imb_filter: quote_a = False
        last, vol = rows[i + 1][4], rows[i + 1][5]
        if vol > 0:
            hit_b = last <= b if fill == "optimistic" else last < b
            hit_a = last >= a if fill == "optimistic" else last > a
            if hit_b and quote_b:
                q += 1; cash -= b; spread_pnl += mid - b; fills += 1
            if hit_a and quote_a:
                q -= 1; cash += a; spread_pnl += a - mid; fills += 1
    total = float(cash + q * rows[-1][6])
    spread_pnl = float(spread_pnl)
    return {"成交手数": fills, "价差捕获": round(spread_pnl, 1), "库存损益": round(total - spread_pnl, 1),
            "合计": round(total, 1), "扣费后": round(total - fee * fills, 1)}


if __name__ == "__main__":
    print("波动率 σ ≈", round(SIGMA, 2), "跳/√小时")
    print("第 10 周 · 固定挂买一卖一：", backtest(df))
    print("第 10 周 · 照搬 A-S：     ", backtest(df, mode="as"))
    for fill in ["optimistic", "conservative"]:
        print(f"\n第 11 周 · {'乐观' if fill == 'optimistic' else '保守'}成交，手续费 0.2 跳/手")
        for name, kw in [("固定挂买一卖一", {}), ("+ 按库存后撤", {"skew": True}),
                         ("+ 盘口失衡过滤", {"imb_filter": 0.6}), ("两者都加", {"skew": True, "imb_filter": 0.6})]:
            print(f"  {name:<10}", backtest(df, fill=fill, fee=0.2, **kw))
