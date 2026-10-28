/* 灰盒阶段的样例数据。第 2 步接上 S.data（公开版 localStorage / 服务器版 /api/yxl/state）后，这个文件只在没有数据时兜底。
   书：title 书名，dom 领域（决定底色），state 没读 / 在读 / 读完，shelf 第几层（0 在最上）。
   盒：title 盒名，dom 领域，n 件数，sealed 是否已结卷。袋：剪报夹，n 篇，unseen 没拆的篇数。 */

/* 领域底色：名色，一个领域一个经典色系。不靠红绿区分，旁边总有字 */
export const DOMAINS = {
  geo:  { name: "地缘与战争", color: 0x7A2E2B },   /* 勃艮第红 */
  cfa:  { name: "金融", color: 0x2B3E66 },         /* 普鲁士蓝 */
  firm: { name: "公司与行业", color: 0x1F6E6B },   /* 孔雀绿 */
  cycle:{ name: "经济周期", color: 0xC8651B },     /* 爱马仕橙 */
  comm: { name: "期货与大宗", color: 0x5B4A7A },   /* 青莲 */
  misc: { name: "杂览", color: 0x6B5B4A },         /* 布面棕 */
};

const T = `大国政治的悲剧:geo:在读 涛动周期录:cycle:在读 证券分析:firm 伯罗奔尼撒战争史:geo 周期:cycle:读完 论战争:geo 金融炼金术:cfa 期货市场:comm 通往奴役之路:misc 大繁荣:cycle 国富论:misc 债务危机:cycle:读完 大博弈:geo 货币金融学:cfa 地缘政治学:geo 商品投资:comm 公司财务:cfa 枪炮病菌与钢铁:misc 财报分析:firm 长期资本:cfa 战争论:geo 大国的兴衰:geo:读完 周期与定价:cycle 衍生品:cfa 石油战争:comm 利率史:cfa 美国货币史:cfa 公司之道:firm 炼金术士:cfa 萧条经济学:cycle 资本市场:cfa 中东史:geo 农产品期货:comm 大衰退:cycle 海权论:geo 制度经济学:misc 估值:firm 库存周期:cycle 三联周刊合订:misc 美国世纪:geo 大宗商品:comm 欧洲史:geo 信用周期:cycle 风险:cfa 冷战:geo 投资组合:cfa 金融史:cfa 油价:comm 产业史:firm 战略:geo 航运史:comm 棉花帝国:misc 央行:cfa 现代世界体系:misc 财政史:cfa 期权:cfa 经济学人合订:misc`;

export const BOOKS = T.trim().split(/\s+/).map((s, i) => {
  const [title, dom, state] = s.split(":");
  return { id: "b" + i, title, dom, state: state || "没读" };
});

export const BOXES = [
  { id: "ab1", title: "俄乌战争的三个阶段", dom: "geo", n: 8, sealed: false },
  { id: "ab2", title: "仓位管理", dom: "comm", n: 11, sealed: false },
  { id: "ab3", title: "居民部门资产负债", dom: "cycle", n: 5, sealed: true },
  { id: "ab4", title: "做市商靠什么", dom: "comm", n: 9, sealed: false },
  { id: "ab5", title: "基差与套保", dom: "comm", n: 4, sealed: true },
  { id: "ab6", title: "康波与利率", dom: "cycle", n: 7, sealed: false },
  { id: "ab7", title: "海湾产油国", dom: "geo", n: 3, sealed: false },
];
export const BAGS = [
  { id: "bg1", title: "剪报·金融", dom: "cfa", n: 5, unseen: 2 },
  { id: "bg2", title: "剪报·周期", dom: "cycle", n: 1, unseen: 0 },
];

/* 今天的牌 */
export const TODAY = { title: "如何计算凯利公式的仓位系数", source: "知乎回答 · 仓位管理", minutes: 40, gem: "灰" };

/* 看板与文竹：以后从学习记录算；现在给个样子 */
export const STATS = { date: "十月廿七", unread: 3, sealedWeek: 1, streak: 12 };
export const PLANT = { grow: 0.55, newLeaves: 2 };
