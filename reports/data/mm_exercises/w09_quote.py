"""第 9 周：把 Avellaneda-Stoikov 公式写成函数，和专题页的演示对一下数。"""
import math


def quote(mid, q, sigma, gamma, k, tau):
    """返回 (保留价, 总价差, 买价, 卖价)。价格单位都是“跳”（最小变动价位 = 1）。
    mid 中间价；q 库存（多为正）；sigma 每小时波动的跳数；gamma 风险厌恶；
    k 成交衰减；tau 剩余时间（小时）。买价向下、卖价向上取整到整跳。"""
    risk = gamma * sigma ** 2 * tau
    r = mid - q * risk
    d = risk + (2 / gamma) * math.log(1 + gamma / k)
    bid = math.floor(r - d / 2 + 1e-9)
    ask = math.ceil(r + d / 2 - 1e-9)
    if ask <= bid:
        ask = bid + 1
    return r, d, bid, ask


if __name__ == "__main__":
    gamma = 0.001 * 50 ** 0.35          # 专题页“风险厌恶”滑块默认位置，约 0.0039
    r, d, bid, ask = quote(3450, q=2, sigma=8, gamma=gamma, k=1.0, tau=2)
    print(f"保留价 {r:.1f}  总价差 {d:.1f}  买 {bid}  卖 {ask}")   # 应与专题页默认参数的读数一致

    # 自己试：库存从 -5 到 5，报价怎么移动？
    for q in range(-5, 6):
        print(q, quote(3450, q, 8, gamma, 1.0, 2)[2:])
