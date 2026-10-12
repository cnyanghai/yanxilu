"""第 8 周：用 pandas 重做第 6、7 周的分析，并画出“成交后走势”曲线。
把本文件和 mm_ticks.csv 放在同一个文件夹，在 Jupyter 里逐段运行。"""
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv("mm_ticks.csv")
df["mid"] = (df.bid1 + df.ask1) / 2
df["imb"] = (df.bid_vol1 - df.ask_vol1) / (df.bid_vol1 + df.ask_vol1)

# 1. 盘口失衡分五组，看 5 秒（10 个快照）后中间价平均变动多少跳
df["move_5s"] = df.mid.shift(-10) - df.mid
df["grp"] = pd.cut(df.imb, [-1, -0.6, -0.2, 0.2, 0.6, 1], include_lowest=True,
                   labels=["强卖压", "卖压", "均衡", "买压", "强买压"])
print(df.groupby("grp", observed=True).move_5s.agg(["count", "mean"]).round(3))

# 2. 判断每个快照的主动方向：成交价碰到上一快照的卖一 = 主动买，碰到买一 = 主动卖
prev = df.shift(1)
df["side"] = None
df.loc[(df.trade_vol > 0) & (df["last"] >= prev.ask1), "side"] = "主动买"
df.loc[(df.trade_vol > 0) & (df["last"] <= prev.bid1), "side"] = "主动卖"

# 3. 成交后走势：被吃的做市商，这一手在 h 个快照之后盯市赚几跳
curve = {}
for h in [1, 2, 5, 10, 20, 60, 120]:
    fut = df.mid.shift(-h)
    pnl = (df["last"] - fut).where(df.side == "主动买", fut - df["last"])
    curve[h / 2] = pnl[df.side.notna()].mean()
curve = pd.Series(curve)
print(curve.round(3))

curve.plot(marker="o")
plt.axhline(0, color="gray", lw=0.8)
plt.xlabel("seconds after fill")
plt.ylabel("maker P&L per lot (ticks)")
plt.title("Markout")
plt.show()
