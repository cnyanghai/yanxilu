"""中美日财富存量：数据整理与交叉核对。
所有原始数字手工从官方或公开来源录入（来源见 CSV 的 source 列与报告页“口径与来源”），
脚本统一换算口径，并用 assert 核对加总、换算和占比。
运行：python3 reports/data/make_wealth.py  →  生成同目录下的 wealth.json 与 wealth.csv。

换算约定
- 占 GDP 比重一律用本币计算：存量（本币，年末）÷ 当年 GDP（本币）。
- GDP 本币值 = 世界银行美元 GDP × 当年平均汇率（与各国官方公布值相差不到 1%）。
- 年末存量折美元用当年 12 月平均汇率（FRED EXCHUS / EXJPUS）。
"""
import csv, json, pathlib

OUT = pathlib.Path(__file__).parent
YEARS = [2000, 2005, 2010, 2015, 2020, 2025]
OZ_PER_T = 32150.7466

# ---------- 宏观底数 ----------
gdp_usd = {  # 世界银行 NY.GDP.MKTP.CD，万亿美元
    "CN": {2000: 1.223754919971, 2005: 2.317551298052, 2010: 6.192564874453, 2015: 11.280814787469, 2020: 14.996414166715, 2025: 19.498039388043},
    "US": {2000: 10.250952, 2005: 13.039197, 2010: 15.048971, 2015: 18.295019, 2020: 21.375281, 2025: 30.7697},
    "JP": {2000: 5.042381838343, 2005: 4.875648486366, 2010: 5.811578109447, 2015: 4.534438580495, 2020: 5.189197543645, 2025: 4.435162999977},
}
fx_avg = {"CN": {2000: 8.2784, 2005: 8.1936, 2010: 6.7696, 2015: 6.2827, 2020: 6.9042, 2025: 7.1875},
          "JP": {2000: 107.8040, 2005: 110.1069, 2010: 87.7817, 2015: 121.0491, 2020: 106.7754, 2025: 149.5686},
          "US": {y: 1.0 for y in YEARS}}
fx_dec = {"CN": {2000: 8.2771, 2005: 8.0755, 2010: 6.6497, 2015: 6.4491, 2020: 6.5393, 2025: 7.0432},
          "JP": {2000: 112.2090, 2005: 118.4624, 2010: 83.3376, 2015: 121.6350, 2020: 103.7952, 2025: 155.9150},
          "US": {y: 1.0 for y in YEARS}}
FX_SEP26 = {"CN": 6.7084, "JP": 156.4171}
gdp_local = {c: {y: gdp_usd[c][y] * fx_avg[c][y] for y in YEARS} for c in gdp_usd}  # 万亿本币
assert abs(gdp_local["CN"][2025] - 140.19) < 0.2, gdp_local["CN"][2025]      # 国家统计局 1401879 亿元
assert abs(gdp_local["JP"][2025] - 662.8) < 2, gdp_local["JP"][2025]         # 内閣府 662.8 兆円
pop = {"CN": 1404.89, "US": 341.784857, "JP": 123.366734}  # 百万人，2025：国家统计局年末 / 世界银行

def ratio(c, y, local_trn):
    return local_trn / gdp_local[c][y] * 100
def usd(c, y, local_trn):
    return local_trn / fx_dec[c][y]

# ---------- 2025 年末快照 ----------
snap = {}
# 居民存款（万亿本币）
dep = {"CN": 165.8935,                       # 国家统计局 2025 年统计公报：人民币住户存款 1658935 亿元
       "US": (5934.9 + 9208.9 + 68.3) / 1000,  # 美联储 Z.1 B.101：支票存款与现金+定期储蓄+其他存款
       "JP": 1140.0}                          # 日本银行资金循环 2025 年 12 月末速报：现金・存款
# 股票总市值
stk = {"CN": 108.86,      # 中国上市公司协会：2025 年末 A 股 5477 家
       "US": 68.963,      # Siblis Research：美国本土上市公司（NYSE/Nasdaq/OTCQX）
       "JP": (1150906655 + 32609926 + 8836989) / 1e6}  # JPX：Prime+Standard+Growth（百万日元→兆円）
assert abs(stk["JP"] - 1192.35) < 0.01
# 债券余额：BIS 债务证券统计（本国居民发行，名义值，十亿美元，季末）
bond_usd = {"CN": {2000: 214.6169, 2005: 912.2521, 2010: 3065.3442, 2015: 7752.5028, 2020: 18555.5739, 2025: 28737.4405},
            "US": {2000: 14536.239, 2005: 22107.612, 2010: 29678.566, 2015: 34864.321, 2020: 46656.576, 2025: 61130.116},
            "JP": {2000: 6676.7656, 2005: 9162.1413, 2010: 14604.1396, 2015: 10635.8440, 2020: 14672.0967, 2025: 10820.4148}}
bond = {c: bond_usd[c][2025] / 1000 * fx_dec[c][2025] for c in bond_usd}
# 住房市值：泽平宏观《中国住房市值报告：2024》（2023 年数据，统一方法）
house23 = {"CN": dict(ratio=343.1, pc_usd=44000, note="432.5 万亿元"),
           "US": dict(ratio=155.0, pc_usd=126000, note="42.4 万亿美元"),
           "JP": dict(ratio=300.0, pc_usd=103000, note="12.7 万亿美元")}
us_house_fed = 47.9156  # 美联储 Z.1 B.101：2025 年末居民自有住房市值（万亿美元）
# 黄金：2025 年末持有量与金价
gold_t25 = {"CN": 7415e4 / OZ_PER_T, "US": 8133.5, "JP": 845.9}
GOLD_P25, GOLD_PSEP26 = 4323.0, 4196.89
for c in ["CN", "US", "JP"]:
    loc = lambda v: v  # noqa
    d = dict(
        dep=dep[c], dep_usd=usd(c, 2025, dep[c]), dep_gdp=ratio(c, 2025, dep[c]), dep_pc_usd=usd(c, 2025, dep[c]) * 1e12 / (pop[c] * 1e6),
        stk=stk[c], stk_usd=usd(c, 2025, stk[c]), stk_gdp=ratio(c, 2025, stk[c]), stk_pc_usd=usd(c, 2025, stk[c]) * 1e12 / (pop[c] * 1e6),
        bond=bond[c], bond_usd=bond_usd[c][2025] / 1000, bond_gdp=ratio(c, 2025, bond[c]), bond_pc_usd=bond_usd[c][2025] * 1e9 / (pop[c] * 1e6),
        gold_t=gold_t25[c], gold_usd=gold_t25[c] * OZ_PER_T * GOLD_P25 / 1e12,
    )
    d["gold_gdp"] = d["gold_usd"] / gdp_usd[c][2025] * 100 * (fx_avg[c][2025] / fx_dec[c][2025])
    d["gold_g_pc"] = gold_t25[c] * 1e6 / (pop[c] * 1e6)
    d["gold_pc_usd"] = d["gold_usd"] * 1e12 / (pop[c] * 1e6)
    d["house_gdp23"] = house23[c]["ratio"]; d["house_pc_usd23"] = house23[c]["pc_usd"]; d["house_note"] = house23[c]["note"]
    snap[c] = {k: (round(v, 4) if isinstance(v, float) else v) for k, v in d.items()}
assert abs(snap["CN"]["gold_t"] - 2306.3) < 0.1
assert abs(snap["US"]["gold_usd"] - 1.1305) < 0.002, snap["US"]["gold_usd"]

# ---------- 时间序列（五年节点） ----------
mc_usd = {  # 世界银行 CM.MKT.LCAP.CD，万亿美元；中国 2000 年取国家统计局 48091 亿元
    "CN": {2005: 0.40185225, 2010: 4.0278403, 2015: 8.18801932, 2020: 12.27676627},
    "US": {2000: 15.107751, 2005: 17.00086447, 2010: 17.28345168, 2015: 25.0675396, 2020: 41.56986177},
    "JP": {2000: 3.15722178, 2005: 4.57290103, 2010: 3.8277742, 2015: 4.89491912, 2020: 6.71821955},
}
series = {"stk_gdp": {}, "bond_gdp": {}}
for c in ["CN", "US", "JP"]:
    s, b = [], []
    for y in YEARS:
        if y == 2025:
            mc_local = stk[c]
        elif c == "CN" and y == 2000:
            mc_local = 4.8091
        else:
            mc_local = mc_usd[c][y] * fx_dec[c][y]
        s.append(round(ratio(c, y, mc_local), 1))
        b.append(round(ratio(c, y, bond_usd[c][y] / 1000 * fx_dec[c][y]), 1))
    series["stk_gdp"][c], series["bond_gdp"][c] = s, b
# 中国居民存款（万亿元）：2000—2010 城乡居民人民币储蓄存款；2015 个人存款；2020、2025 住户存款
cn_dep = {2000: 6.43324, 2005: 14.1051, 2010: 30.33025, 2015: 55.207348, 2020: 93.4383, 2025: 165.8935}
series["cn_dep_gdp"] = [round(ratio("CN", y, cn_dep[y]), 1) for y in YEARS]
series["cn_dep"] = [cn_dep[y] for y in YEARS]
series["cn_stk"] = [round(4.8091 if y == 2000 else (stk["CN"] if y == 2025 else mc_usd["CN"][y] * fx_dec["CN"][y]), 2) for y in YEARS]
# 中国黄金储备（万盎司 → 吨）
cn_gold_oz = [(2000, 1267), (2005, 1929), (2010, 3389), (2015, 5666), (2020, 6264), (2025, 7415), ("2026.9", 7747)]
series["cn_gold"] = [dict(y=y, oz=oz, t=round(oz * 1e4 / OZ_PER_T, 1)) for y, oz in cn_gold_oz]

# ---------- 居民金融资产结构（%） ----------
us_fa = 143865.9
us_parts = {"现金与存款": 5934.9 + 9208.9 + 68.3, "基金（含货币基金）": 5320.6 + 13680.2, "股票及其他股权": 47185.8 + 16001.1,
            "保险与养老金": 2201.2 + 34591.6, "债券": 6147.4, "其他": 1245.7 + 487.1 + 1793.1}
assert abs(sum(us_parts.values()) - us_fa) < 0.2
jp_fa = 2519.0
jp_parts = {"现金与存款": 1132, "基金（含货币基金）": 193, "股票及其他股权": 486, "保险与养老金": 586, "债券": 38, "其他": 85}
assert abs(sum(jp_parts.values()) - jp_fa) <= 1
fa_struct = [dict(name=k, us=round(us_parts[k] / us_fa * 100, 1), jp=round(jp_parts[k] / jp_fa * 100, 1)) for k in us_parts]

# ---------- 储蓄率（%） ----------
saving = {"CN": round((1 - 29476 / 43377) * 100, 1), "CN_oecd": 34.92, "US": 5.4, "JP": round(13.2 / (324.7 + 13.2) * 100, 1)}

# ---------- 黄金储备排名（WGC 2026 年 5 月版）与按 2026-09-30 金价估值 ----------
gold_rank = [("美国", 8133.5, 83.3, 341.784857), ("德国", 3350.3, 84.0, 83.491249), ("意大利", 2451.8, 80.6, 58.915656),
             ("法国", 2437.0, 81.8, 68.720337), ("中国", 2313.4, 9.1, 1404.89), ("俄罗斯", 2304.7, 40.6, 143.513328),
             ("瑞士", 1039.9, 15.2, 9.092436), ("印度", 880.5, 18.5, 1463.865525), ("日本", 845.9, 9.1, 123.366734),
             ("荷兰", 612.5, 74.2, 18.087633), ("波兰", 581.6, 29.5, 36.435861), ("土耳其", 534.8, 61.6, 85.878556)]
gold_table = [dict(name=n, t=t, share=sh, usd_bn=round(t * OZ_PER_T * GOLD_PSEP26 / 1e9, 1), g_pc=round(t * 1e6 / (p * 1e6), 2))
              for n, t, sh, p in gold_rank]
us_gold_book_bn = round(8133.5 * OZ_PER_T * 42.2222 / 1e9, 2)   # 美国财政部法定价 42.2222 美元/盎司
cn_gold_sep26 = dict(oz=7747, t=round(7747e4 / OZ_PER_T, 1), usd_bn=round(7747e4 * GOLD_PSEP26 / 1e9, 1))
cn_gold_sep26["cny_trn"] = round(cn_gold_sep26["usd_bn"] * FX_SEP26["CN"] / 1000, 2)

# ---------- 住房与汽车保有量 ----------
stock = {
    "CN": dict(units="3.77 亿套（城镇）", per1000=round(3.77e8 / 9.538e8 * 1000), area="37.0（城镇，2025）", own="96.0%（城镇家庭，2019）", vacancy="—"),
    "US": dict(units="1.495 亿套", per1000=round(149.454e6 / 341.784857e6 * 1000), area="72.6", own="65.0%（2026 年二季度）", vacancy="出租 7.3% / 自住 1.2%"),
    "JP": dict(units="6502 万套", per1000=round(65.02e6 / 124.35e6 * 1000), area="约 40.7", own="60.9%（2023）", vacancy="13.8%"),
}
cars = {"CN": dict(total=366.11, per1000=round(366.11e6 / 1404.89e6 * 1000), pass_=197.73, pass1000=round(197.73e6 / 1404.89e6 * 1000)),
        "US": dict(total=298.0, per1000=880, pass_=None, pass1000=None),
        "JP": dict(total=78.62, per1000=round(78.62e6 / 123.366734e6 * 1000), pass_=61.84, pass1000=round(61.84e6 / 123.366734e6 * 1000))}

# ---------- 期货 ----------
fut = dict(cn_vol=90.74, cn_turn=766.25, cn_turn_gdp=round(766.25 / gdp_local["CN"][2025], 2), cn_funds=2.15,
           cn_funds_usd_bn=round(2.15e12 / 7.0432 / 1e9, 1), cme_adv=28.1, cme_year=round(28.1e6 * 251 / 1e9, 2),
           us_fcm_bn=round(417.4 / 1.049, 1), us_fcm_jan26=417.4, jpx=4.1875, world_fut=30.64, world_fo=119.29)

# BIS 名义住宅价格指数（2010=100），以 2021 年三季度为 100 重新定基
bis_q = ["2021Q1","2021Q2","2021Q3","2021Q4","2022Q1","2022Q2","2022Q3","2022Q4","2023Q1","2023Q2","2023Q3","2023Q4",
         "2024Q1","2024Q2","2024Q3","2024Q4","2025Q1","2025Q2","2025Q3","2025Q4","2026Q1","2026Q2"]
bis_raw = {"CN": [143.7231,145.402,145.9129,144.745,143.5042,142.2268,141.1319,139.3801,138.6866,138.4311,136.6428,134.1976,
                  131.5333,128.2121,124.9274,122.7012,121.6428,120.0004,118.0296,115.6573,113.9785,112.9201],
           "US": [176.4162,184.6949,192.4299,199.8409,208.2058,213.9605,212.8297,213.5082,215.7915,218.6257,222.6153,225.0175,
                  227.1965,228.9564,230.8991,232.7997,233.4622,233.5267,234.1899,235.1402,235.0402,236.2362],
           "JP": [118.4765,119.5766,122.6102,122.1102,129.2108,130.5775,132.2444,131.3109,135.3446,134.8112,135.0779,133.9778,
                  138.7116,138.5449,139.445,137.7115,145.2121,143.612,145.4788,144.6454,None,None]}
bis = {c: [None if v is None else round(v / bis_raw[c][2] * 100, 1) for v in bis_raw[c]] for c in bis_raw}
cn_house_25_rough = round(432.5 * bis_raw["CN"][19] / bis_raw["CN"][11], 0)

D = dict(years=YEARS, snap=snap, series=series, fa_struct=fa_struct, saving=saving, gold_table=gold_table,
         us_gold_book_bn=us_gold_book_bn, cn_gold_sep26=cn_gold_sep26, gold_price=dict(p25=GOLD_P25, psep26=GOLD_PSEP26),
         stock=stock, cars=cars, fut=fut, bis_q=bis_q, bis=bis, cn_house_25_rough=cn_house_25_rough, us_house_fed=us_house_fed,
         us_house_fed_gdp=round(us_house_fed / gdp_usd["US"][2025] * 100, 1),
         pop=pop, gdp_local={c: round(gdp_local[c][2025], 2) for c in gdp_local})
json.dump(D, open(OUT / "wealth.json", "w", encoding="utf-8"), ensure_ascii=False)

# ---------- 长表 CSV ----------
SRC = dict(dep_CN="国家统计局 2025 年统计公报（人民币住户存款）", dep_US="美联储 Z.1 B.101", dep_JP="日本银行资金循环统计",
           stk_CN="中国上市公司协会", stk_US="Siblis Research", stk_JP="日本交易所集团", bond="BIS 债务证券统计（名义值）",
           gold="世界黄金协会 / 国家外汇管理局", wb="世界银行 WDI")
rows = []
NAME = {"CN": "中国", "US": "美国", "JP": "日本"}
for c in ["CN", "US", "JP"]:
    s = snap[c]
    for key, nm, unit, src in [("dep", "居民存款", "万亿本币", SRC["dep_" + c]), ("dep_gdp", "居民存款占GDP", "%", SRC["dep_" + c]),
                               ("dep_pc_usd", "人均居民存款", "美元", SRC["dep_" + c]),
                               ("stk", "股票总市值", "万亿本币", SRC["stk_" + c]), ("stk_gdp", "股票总市值占GDP", "%", SRC["stk_" + c]),
                               ("stk_pc_usd", "人均股票市值", "美元", SRC["stk_" + c]),
                               ("bond", "债券余额", "万亿本币", SRC["bond"]), ("bond_gdp", "债券余额占GDP", "%", SRC["bond"]),
                               ("gold_t", "黄金储备", "吨", SRC["gold"]), ("gold_usd", "黄金储备市值（4323美元/盎司）", "万亿美元", SRC["gold"]),
                               ("gold_g_pc", "人均黄金储备", "克", SRC["gold"]), ("house_gdp23", "住房市值占GDP（2023）", "%", "泽平宏观")]:
        rows.append(["snapshot_" + key, nm, NAME[c], 2023 if key == "house_gdp23" else 2025, "", s[key], unit, src])
    for i, y in enumerate(YEARS):
        rows.append(["stk_gdp", "股票总市值占GDP", NAME[c], y, "", series["stk_gdp"][c][i], "%", SRC["wb"] + "；" + SRC["stk_" + c]])
        rows.append(["bond_gdp", "债券余额占GDP", NAME[c], y, "", series["bond_gdp"][c][i], "%", SRC["bond"]])
for i, y in enumerate(YEARS):
    rows.append(["cn_dep", "中国居民存款", "中国", y, "", series["cn_dep"][i], "万亿元", "国家统计局 / 中国人民银行"])
    rows.append(["cn_dep_gdp", "中国居民存款占GDP", "中国", y, "", series["cn_dep_gdp"][i], "%", "国家统计局 / 中国人民银行"])
    rows.append(["cn_stk", "A股总市值", "中国", y, "", series["cn_stk"][i], "万亿元", "国家统计局 / 世界银行 / 中上协"])
for g in series["cn_gold"]:
    rows.append(["cn_gold", "中国黄金储备", "中国", g["y"], "", g["t"], "吨", "国家统计局 / 国家外汇管理局"])
for g in gold_table:
    rows.append(["gold_rank", "官方黄金储备", g["name"], "2026-05", "", g["t"], "吨", "世界黄金协会 2026 年 5 月版"])
    rows.append(["gold_rank_usd", "黄金储备市值（2026-09-30 金价）", g["name"], "2026-09", "", g["usd_bn"], "十亿美元", "世界黄金协会；金价 pricegold.net"])
for r in fa_struct:
    rows.append(["fa_struct", "居民金融资产结构", "美国", "2025-12", r["name"], r["us"], "%", "美联储 Z.1 B.101"])
    rows.append(["fa_struct", "居民金融资产结构", "日本", "2026-06", r["name"], r["jp"], "%", "日本银行资金循环统计"])
for c in ["CN", "US", "JP"]:
    for i, q in enumerate(bis_q):
        if bis[c][i] is not None:
            rows.append(["house_price_idx", "名义住宅价格指数（2021Q3=100）", NAME[c], q, "", bis[c][i], "指数", "BIS 住宅价格统计"])
with open(OUT / "wealth.csv", "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f); w.writerow(["series_id", "series_name", "country", "period", "category", "value", "unit", "source"]); w.writerows(rows)

if __name__ == "__main__":
    for c in snap: print(c, {k: snap[c][k] for k in ("dep_gdp", "dep_pc_usd", "stk_gdp", "stk_pc_usd", "bond_gdp", "gold_t", "gold_usd", "gold_gdp", "gold_g_pc")})
    print("stk", series["stk_gdp"]); print("bond", series["bond_gdp"]); print("cn dep/gdp", series["cn_dep_gdp"], "cn stk", series["cn_stk"])
    print("gold cn", series["cn_gold"], cn_gold_sep26, "us book", us_gold_book_bn)
    print("fa", fa_struct); print("saving", saving); print("cars", cars); print("stock", stock); print("fut", fut)
    print("cn house 2025 rough", cn_house_25_rough, "us fed gdp", D["us_house_fed_gdp"]); print("CSV rows", len(rows))
