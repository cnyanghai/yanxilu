/* 书架样机。回答一件事：打开书架那一眼，能不能不数就知道有多少书、读过多少；外加手指划过书脊、抽一本出来的手感。
 * 拆包那一轮用户定了「热闹」，这里的节拍照那个力度来。外观在 kit.js 的外观表里（2026-11-13 定旧书房）。
 *
 * 2026-11-13 夜里用户在手机上看过以后改的三件事：
 *   一 屏幕上只有书架。原来顶栏、底栏上的字和按钮都收进底下一张工具纸，平时只留一道小把手（点它或者往上划）
 *   二 书要清楚：书脊的字按书在屏上的大小画（原来固定 48×192 一格，四十本时是放大三倍贴上去的），画布按屏幕的真实像素出（最多三倍，跑不动自己退）
 *   三 读没读不用手标：打开读了就自己变成在读，读完自己变成读过；在别处读完的才用小字补标。在读的记号多做了一种「丝带」和原来的「白签」换着看
 *
 * 2026-11-14 这一页里有三件家具（只有旧书房做了后两件）：书架、档案架（牌盒和没拆的邮包）、笔记本架（封面朝外的本子）。一次只摆一件，
 *   底下一排三个记号换（点，或者按在那一排上左右划），换的时候镜头顺着墙横着走。牌盒和本子都当成「一件立在架上的东西」，和书共用下面这套节拍；
 *   配置在 KINDS 一张表里，样子在 kit.js（drawBoxEnd / drawBoxFace / drawNote）。地址加 ?f=rack、?f=notes 直接进那一件。牌盒抽出来再点它一下就打开（牌排成扇形，在 box.js；这里的 openBox / closeBox / flipCard 管盒子和状态）；翻开本子还没做
 *
 * 节拍：
 *   1 上架   空架子先到，书一本本从外面推进去（多少本都是一秒出头），镜头同时往后退到看全；点一下屏幕快进
 *   2 看全   整座架子永远装进一屏：本数多了架子自己加宽加层。读没读只靠物件的样子说：
 *            书的颜色是书自己的（一类一个色系，款式几种）；没读的腰封还在，读过的摘了，在读的探出来一截、脚下垂一条丝带（或者顶上露一枚签）
 *   3 划过   手指按住在书脊上划，碰到哪本哪本探头（一本一声一震），手指上方的小签报书名
 *   4 抽出   松手，那本滑出来、转过封面飞到眼前；左右拖动转着看；底下「打开读」（样机里没有阅读器，点一下算读了一段）
 *   5 放回   点「放回去」或点空白：飞回去、推进去一声闷响；按读没读放时，改过状态的书回到新的位置，别的书让位
 *   6 换排法 「按类放 / 按读没读放」：整面书一起飞到新位置
 *
 * 结构：书是一个 InstancedMesh（三百本也只画两三次），书脊的字画在一张图集上；抽出来的那一本换成单独的模型，贴图另画一张清楚的。
 * 动画轨、声音、舞台、书的样子、架子在 kit.js（和进门样机共用）。
 * 字（书名签、层板签、底下的纸）用网页排；声音是 WebAudio 现场合成的，没有音频文件。书名、作者都是编的。
 * 调试：地址加 ?dev 显示帧率与状态，?n=300 直接进三百本，?pr=2 把画布倍率钉死，?mark=tab 换在读的记号；window.__lab 给测试脚本用。 */
import { THREE, clamp, lerp, rad, E, vib, rng, createTracks, createAudio, createStage, lightCase, createBookKit, createCase, drawSpine, drawBand, drawBoxEnd, drawBoxFace, drawNote, grainOver, bindOf, clothOf, clothFill, LOOK, DIM, INK_LT, INK_SOFT, CJK, STN, MASK, foil, weave, whenReady, bakeBook } from "./kit.js";   // 公用零件：动画轨、声音、舞台、书的样子、架子
import { createBoxView, makeCards } from "./box.js";             // 开盒：牌盒打开以后里面的牌（2026-11-14）

const Q = new URLSearchParams(location.search), DEV = Q.has("dev");
const $ = (s) => document.querySelector(s);

/* ---------- 手感参数（要调就调这张表） ---------- */
const P = {
  enterDur: 1.15,              // 上架：全部书推进去一共多久（和本数无关）
  enterEach: .32,              // 每本推进去多久
  enterZ: 22,                  // 从多远推进来（厘米）
  popZ: 3.4, popTilt: .09,     // 手指碰到的那本：探出来多少、书顶朝外倾多少
  popUp: 30, popDown: 13,      // 探出、缩回的快慢（越大越快）
  doingZ: 2.4,                 // 在读的书常驻探出多少
  outSlide: .15, outFly: .44,  // 抽出：滑出来、飞到眼前
  backFly: .38, backPush: .13, // 放回：飞回去、推进去
  sortDur: .62, sortSpread: .55, sortArc: 20,   // 换排法：每本飞多久、先后错开的总时长、往外绕多远
  swapOut: .3, swapIn: .42,    // 换家具：镜头横着走出去、走进来各多久
  openFly: .34,                // 开盒：盒子落到屏幕底下多久
  openSheet: 100, openBox: 96, openBoxPx: 84, openK: .6, openTilt: .5,   // 开盒时底下让给那张纸、盒子各多少像素；盒子在屏上多宽、缩到几成（缩小了才能既显得小又离镜头近，不掉到架子里去）；盒口朝人倾多少（弧度）
  sway: .012,                  // 镜头一直在轻轻左右晃的幅度（弧度），0 是不晃
  shake: .5,                   // 推回去那一下镜头的震（厘米）
};

/* ---------- 尺寸（一个单位是一厘米） ---------- */
let SH = DIM.SH; const { BT, ST, CD, PL } = DIM;    // 层高（净；三件家具各不一样，换家具时跟着换）、层板厚、侧板厚、柜深、踢脚高（架子在 kit.js）
const PAD = .7, GAPB = .06, RECESS = 1;              // 每层两头留空、书与书的缝、书脊比层板前沿缩进多少
const DIVW = .9, DIVGAP = .5;                        // 分隔板的厚度与两边的空

/* ---------- 书（编的） ---------- */
const CATS = ["金融", "历史", "地缘", "数学", "语言", "杂书"], CATW = [.24, .2, .14, .14, .12, .16];
const HEADS = [
  ["利率", "久期", "做市", "波动", "信用", "账本", "复利", "杠杆", "票据", "汇兑"],
  ["漕运", "驿站", "盐铁", "市舶", "科举", "边镇", "里甲", "钱庄", "书院", "行会"],
  ["海峡", "陆桥", "港口", "航线", "边疆", "河谷", "走廊", "半岛", "群岛", "隘口"],
  ["概率", "矩阵", "级数", "拓扑", "博弈", "估计", "随机", "最优", "测度", "图论"],
  ["语法", "词源", "句读", "修辞", "音韵", "翻译", "方言", "语感", "文体", "训诂"],
  ["散步", "厨房", "木工", "观鸟", "围棋", "喝茶", "地图", "钟表", "园艺", "登山"],
];
const TAILS = ["简史", "的逻辑", "十二讲", "笔记", "导论", "与秩序", "手册", "之外", "原理", "札记", "三十年", "入门", "的边界", "考", "讲义", "漫谈", "小史", "问答", "读本", "图说"];
const SUR = "陈林周吴郑冯沈韩秦许何吕施张孔曹严华金魏陶姜".split(""), GIV = ["明远", "一苇", "知白", "守拙", "子衿", "怀瑾", "望舒", "清和", "行之", "若水", "景行", "思齐", "牧之", "云帆"];
function makeBooks(n) {
  const r = rng(20261112 + n), out = [], seen = new Set();
  for (let i = 0; i < n; i++) {
    let c = 0, u = r(); while (c < 5 && u > CATW[c]) { u -= CATW[c]; c++; }
    let title; do { title = HEADS[c][Math.floor(r() * 10)] + TAILS[Math.floor(r() * TAILS.length)]; } while (seen.has(title)); seen.add(title);
    const pages = 120 + Math.floor(Math.pow(r(), 1.7) * 720), h = [18.5, 21, 21, 23, 23, 24, 26][Math.floor(r() * 7)];
    out.push({
      title, by: SUR[Math.floor(r() * SUR.length)] + GIV[Math.floor(r() * GIV.length)], pages, cat: c, st: r() < .37 ? "done" : "todo", prog: 0,          // prog 读到哪了（0 到 1），下面按读没读补上
      t: clamp(1 + pages * .0062, 1.2, 5.8), h, d: h * (.63 + r() * .06),          // 厚（跟页数走）、高、深
      px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, k: 1, pop: 0, popT: 0, out: 0, outT: 0, hero: false,
    });
  }
  const nd = Math.max(2, Math.round(n * .025));                                    // 在读的只有几本
  for (let k = 0; k < nd; k++) { const b = out[Math.floor(r() * n)]; b.st = "doing"; b.prog = .15 + r() * .7; }
  out.sort((a, b) => a.cat - b.cat); out.forEach((b, i) => { b.i = i; if (b.st === "done") b.prog = 1; });
  return out;
}

/* ---------- 档案架上的牌盒、笔记本架上的本子（也是编的） ----------
 * 都当成「一件立在架上的东西」，和书用同一套摆法、划过、抽出、放回：t 是它在架上占的宽里薄的那一边（牌盒的厚、本子的厚），h 高，d 深。
 *   牌盒：一个课题一盒，厚跟着牌数走；n 张牌，u 张没读（有没读的就探出来一点、顶上露一枚签）；最后几件是没拆的邮包
 *   本子：封面朝外放（face），页越多越厚；ago 是几天前写过，今天写过的垂着丝带 */
const item = (o) => ({ by: "", pages: 0, prog: 0, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, k: 1, pop: 0, popT: 0, out: 0, outT: 0, hero: false, ...o });
const BOXT = ["怎么看", "的来龙去脉", "为什么", "时间线", "案例", "之争", "备忘", "剪报", "十问", "的几种说法"];
function makeBoxes() {
  const X = LOOK.bind.box, r = rng(20261114), out = [], seen = new Set();
  [5, 4, 4, 3, 3, 3].forEach((k, c) => { for (let j = 0; j < k; j++) {
    let title; do { title = HEADS[c][Math.floor(r() * 10)] + BOXT[Math.floor(r() * BOXT.length)]; } while (seen.has(title)); seen.add(title);
    const n = 3 + Math.floor(Math.pow(r(), 1.5) * 38), u = r() < .36 ? 1 + Math.floor(r() * Math.min(5, n - 1)) : 0;
    out.push(item({ title, cat: c, vol: "FHGMLZ"[c] + String(j + 1).padStart(2, "0"), n, u, st: u ? "doing" : "done", t: clamp(1.5 + n * .15, 1.9, 7.6), h: X.h, d: X.d }));
  } });
  for (let k = 0; k < 3; k++) out.push(item({ title: "没拆的邮包", cat: 5, pack: true, n: 5, u: 5, st: "done", t: 3.4, h: 11.5, d: 8.6 }));
  out.forEach((b, i) => { b.i = i; });
  return out;
}
function makeNotes() {
  const list = [["随手本", 5, 212, "一天一页", 0], ["做市笔记", 0, 96, "主题本", 2], ["读史札记", 1, 64, "主题本", 9], ["地图边上", 2, 38, "主题本", 30], ["错题本", 3, 120, "主题本", 4], ["语感练习", 4, 52, "主题本", 1], ["摘抄册", 0, 148, "划线与批注", 3], ["散步记", 2, 24, "主题本", 16]];
  return list.map(([title, cat, pages, kindName, ago], i) => { const h = i % 3 === 2 ? 17.6 : 21; return item({ title, cat, pages, kindName, ago, sub: pages + " 页", st: ago === 0 ? "doing" : "done", t: clamp(.9 + pages * .011, 1.1, 3.3), h, d: h * .705, face: true, i }); });
}
/* 三件家具（2026-11-14）。同一页里一次只摆一件，底下一排记号换；换的时候镜头顺着墙横着走过去。只有旧书房做了后两件。
 *   SH 层高；gap、pad 东西之间的缝和每层两头的空；aspect 图集里一格的高比宽；draw 一格怎么画；box 方盒子；cover 封面朝外；mark 探出来的那些带什么记号（书架的可以换，另两件定死） */
const KINDS = {
  shelf: { name: "书架", unit: "本", SH: DIM.SH, gap: GAPB, pad: PAD, aspect: 4 },
  rack: { name: "档案架", unit: "盒", SH: 17.5, gap: .45, pad: 1.2, aspect: 2.5, draw: drawBoxEnd, box: true, mark: "tab" },
  notes: { name: "笔记本架", unit: "本", SH: 25.5, gap: 2.4, pad: 2.6, aspect: 1 / .705, draw: drawNote, cover: true, mark: "ribbon" },
}, ORDER = ["shelf", "rack", "notes"], MULTI = !!LOOK.bind, STORE = {};
let K = KINDS.shelf, NB = 40;
const WX = (b) => (b.face ? b.d : b.t), WZ = (b) => (b.face ? b.t : b.d);     // 在架上横着占多宽、往里占多深（封面朝外的本子反过来）

/* ---------- 渲染器、镜头、光（kit.js） ---------- */
const canvas = $("#gl");
const { renderer, scene, camera, key, maxAniso } = createStage(canvas);
const CAM = { dist: 300, y: 80, fov: 34, k: 1, wpp: 1 };
// 画布按屏幕的真实像素出，最多三倍（原来封在两倍，三倍屏上是放大一倍半显示的，字发虚）。跑不动（连着一秒多每帧超过 26 毫秒）就退一档，只退不进
const PR = { cur: +Q.get("pr") > 0 ? +Q.get("pr") : Math.min(devicePixelRatio || 1, 3), pin: +Q.get("pr") > 0, slow: 0 };

/* ---------- 状态 ---------- */
const S = {
  state: "boot", kind: "shelf", arr: "topic", arrBook: "topic", pan: 0, swayK: 1, W: 80, R: 4, hot: -1, cur: -1, outReady: false, yaw: 0, yawT: 0, fast: false, manual: false, tools: false, mark: "ribbon",
  t: 0, shake: 0, par: { x: 0, y: 0, tx: 0, ty: 0 }, needFit: false,
};
let N = 0, books = [], L = null;

/* ---------- 小动画轨、声音（kit.js） ---------- */
const { play, wait, step: stepTracks, clear: clearTracks } = createTracks();
const { AU, au, noise, tone } = createAudio();
const SFX = {
  tick(b) { const f = 1500 - b.t * 165; tone({ f, f2: f * .82, dur: .07, gain: .13, type: "triangle" }); noise({ dur: .018, type: "highpass", f: 3000, gain: .06 }); },   // 划过一本：越厚的书声音越低
  shelve(k) { const f = 420 + k * 380 + Math.random() * 60; tone({ f, f2: f * .7, dur: .06, gain: .07, type: "triangle" }); noise({ dur: .03, type: "lowpass", f: 1200, gain: .06 }); },
  thud() { tone({ f: 120, f2: 52, dur: .16, gain: .4 }); noise({ dur: .05, type: "lowpass", f: 700, gain: .16 }); },
  out() { noise({ dur: .2, f: 700, f2: 2600, q: 1.1, gain: .16 }); },
  shown() { [392, 587, 784].forEach((f, i) => tone({ f, dur: .45, gain: .07 / (i + 1), when: i * .025 })); },
  back() { noise({ dur: .22, f: 2200, f2: 600, q: 1.1, gain: .13 }); },
  sort() { for (let i = 0; i < 16; i++) { const f = 500 + Math.random() * 700; tone({ f, f2: f * .75, dur: .05, gain: .05, type: "triangle", when: i * (P.sortSpread + .3) / 16 }); } noise({ dur: P.sortSpread + .5, f: 900, f2: 1800, q: .7, gain: .07, attack: .15 }); },
  page() { noise({ dur: .13, f: 2000, f2: 900, q: .8, gain: .09 }); },
  swap() { noise({ dur: P.swapOut + P.swapIn, f: 500, f2: 1500, q: .7, gain: .08, attack: .12 }); },
  lid() { tone({ f: 180, f2: 90, dur: .12, gain: .22 }); noise({ dur: .16, f: 900, f2: 2400, q: 1.2, gain: .1 }); },
  card(k) { const f = 620 + k * 520; tone({ f, f2: f * .8, dur: .05, gain: .09, type: "triangle" }); noise({ dur: .02, type: "highpass", f: 3200, gain: .05 }); },   // 一张牌一声，越靠前越高
  flip() { noise({ dur: .16, f: 1400, f2: 3200, q: .9, gain: .12 }); [659, 988].forEach((f, i) => tone({ f, dur: .3, gain: .09, when: .08 + i * .07 })); },
  mark(st) { (st === "done" ? [523, 659, 784, 1047] : st === "doing" ? [523, 784] : [330]).forEach((f, i) => tone({ f, dur: .3, gain: .1, when: i * .06 })); },
};

/* ---------- 书：样子在 kit.js（书脊图集、实例化的盒子），这里只管这一页的这一批 ---------- */
const { paperMat, tabMat, unitBox, makeAtlas, makeMesh, shape: bookShape } = createBookKit(maxAniso);
let atlas = null, books3d = null, tabs = null;
// 书脊一格画多高：最高的那本在屏上有多少像素就画多少（再留一点余量）；本数多了按总面积封顶，三百本也不超过七百万像素
function cellPx() { let hm = 0; for (const b of books) hm = Math.max(hm, b.h); return Math.min(hm / CAM.wpp * PR.cur * 1.05, Math.sqrt(7e6 * K.aspect / N)); }
function buildBooks() {
  if (books3d) { scene.remove(books3d); books3d.geometry.dispose(); books3d.dispose(); atlas.dispose(); }
  atlas = makeAtlas(books, false, cellPx(), { aspect: K.aspect, draw: K.draw, flat: K.box }); books3d = makeMesh(books, atlas, { box: K.box, cover: K.cover });
  scene.add(books3d); buildMarks();
}
/* 在读的记号（2026-11-13 夜里用户问白签有没有更好的选择，做了一种换着看）：
 *   丝带 ribbon：书脚下垂一条书签带，搭过层板的前沿，尾巴剪成燕尾。真书的书签带就是从书脚垂出来的；它落在层板那道暗边上，浅色的一条很显眼
 *   白签 tab：原来的做法，书顶露一枚签
 * 都只靠形状和明暗，不靠颜色。选哪种记在设备上，工具纸里换 */
const MARKS = ["ribbon", "tab"], RIB = { len: BT + 3, k: .36, wMin: .5, wMax: 1.15, z: BT / 2 + .2 };   // 丝带：多长、占书厚的几成、最窄最宽、离层板前沿（半圆，半径是板厚的一半）多远
function pickMark() { let m = Q.get("mark"); try { if (MARKS.includes(m)) localStorage.setItem("lab-mark", m); else m = localStorage.getItem("lab-mark"); } catch (e) { /* 存不了就只认地址 */ } return MARKS.includes(m) ? m : "ribbon"; }
S.mark = pickMark();
const ribbonGeo = (() => { const sh = new THREE.Shape(); sh.moveTo(-.5, 0); sh.lineTo(-.5, -1); sh.lineTo(0, -.84); sh.lineTo(.5, -1); sh.lineTo(.5, 0); sh.closePath(); return new THREE.ShapeGeometry(sh); })();   // 上沿在 0，往下垂一个单位，底下一个燕尾
const ribMat = tabMat.clone(); ribMat.side = THREE.DoubleSide;
let MK = "ribbon";                                           // 现在这件家具上探出来的东西带什么记号（书架的跟着 S.mark，另两件定死）
function buildMarks() {
  if (tabs) { scene.remove(tabs); tabs.dispose(); }
  MK = K.mark || S.mark; const rib = MK === "ribbon"; tabs = new THREE.InstancedMesh(rib ? ribbonGeo : unitBox, rib ? ribMat : tabMat, N); tabs.castShadow = !rib; tabs.frustumCulled = false;
  scene.add(tabs);
}
function setMark(m) {
  if (!MARKS.includes(m) || m === S.mark) return;
  S.mark = m; try { localStorage.setItem("lab-mark", m); } catch (e) { /* 忽略 */ }
  buildMarks(); if (books[S.cur] && books[S.cur].hero) heroSetup(books[S.cur]); ui();
}

/* ---------- 抽出来的那一本：单独的模型，封面和书脊另画清楚的 ---------- */
const hero = new THREE.Group(); hero.visible = false; scene.add(hero);
const hFrontC = document.createElement("canvas"); hFrontC.width = 384; hFrontC.height = 576;
const hSpineC = document.createElement("canvas"); hSpineC.width = 128; hSpineC.height = 576;
const hFrontT = new THREE.CanvasTexture(hFrontC), hSpineT = new THREE.CanvasTexture(hSpineC);
[hFrontT, hSpineT].forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; });
const hmFront = new THREE.MeshStandardMaterial({ map: hFrontT, roughness: LOOK.bookRough }), hmSpine = new THREE.MeshStandardMaterial({ map: hSpineT, roughness: LOOK.bookRough }), hmBack = new THREE.MeshStandardMaterial({ roughness: LOOK.bookRough });
// 有装帧的外观（旧书房）：封底也画一张（布面，没读的腰封围到背面）；封面板的边和里子取这张图左上角的布色
const hBackC = LOOK.bind ? document.createElement("canvas") : null, hBackT = hBackC ? new THREE.CanvasTexture(hBackC) : null;
if (hBackC) { hBackC.width = 192; hBackC.height = 288; hBackT.colorSpace = THREE.SRGBColorSpace; hBackT.anisotropy = maxAniso; hmBack.map = hBackT; }
// 旧书房：封面和书脊各另画一张「哪里是金」的图，金的地方反环境光；布面再加布纹的凹凸。别的外观没有环境光，这几行什么都不做
const hFrontM = document.createElement("canvas"); hFrontM.width = hFrontC.width; hFrontM.height = hFrontC.height;
const hSpineM = document.createElement("canvas"); hSpineM.width = hSpineC.width; hSpineM.height = hSpineC.height;
const hFrontMT = new THREE.CanvasTexture(hFrontM), hSpineMT = new THREE.CanvasTexture(hSpineM);
const GILT = foil(hmFront, hFrontMT) && foil(hmSpine, hSpineMT);
// 旧书房的书有封面板、飘口和圆脊（kit.js 的 bookGeo）：抽出来的这一本按它自己的大小摆好；别的外观还是一个盒子
const heroBody = bookShape ? new THREE.Mesh(bookShape, [hmSpine, hmFront, hmBack, hmBack, paperMat]) : new THREE.Mesh(unitBox, [hmFront, hmBack, paperMat, paperMat, hmSpine, paperMat]);
heroBody.castShadow = true; hero.add(heroBody);
// 牌盒和邮包是方盒子：另备一个，大面和朝外的那一头用上面两张图，顶和底只要布色
const hmCloth = new THREE.MeshStandardMaterial({ roughness: LOOK.bookRough });
const heroBox = new THREE.Mesh(unitBox, [hmFront, hmBack, hmCloth, hmCloth, hmSpine, hmBack]); heroBox.castShadow = true; heroBox.visible = false; hero.add(heroBox);
const heroTab = new THREE.Mesh(unitBox, tabMat); hero.add(heroTab);
const heroRib = new THREE.Mesh(ribbonGeo, ribMat); heroRib.rotation.y = Math.PI / 2; hero.add(heroRib);   // 丝带转个面：封面朝着人的时候它也朝着人
/* 旧书房的封面：和书脊同一块布、同一个款式（kit.js 的 bindOf）。压在布上的先画（框、书名、作者；深布烫金、浅布印墨），压完布纹再画贴在外面的纸（题签、腰封）。
 *   rule / bars：两道框，书名居中；label：书名在一格深色皮签里；slip：左上角一张竖的纸题签，墨字，别的地方留白（线装书的做法）
 *   没读的腰封围在书脚，上面印一行小字（分类和页数）。mask：只画「哪里是金、纸、皮」 */
function drawFrontBound(g, w, h, b, mask) {
  const B = LOOK.bind, bd = bindOf(b), todo = b.st === "todo", F = LOOK.font, gold = mask ? MASK.gilt : bd.gold, stamp = bd.gilt ? gold : mask ? null : B.ink;
  clothFill(g, 0, 0, w, h, b, false, mask);
  const lines = (() => { const chars = [...b.title], per = chars.length > 4 ? 3 : 2, out = []; for (let k = 0; k < chars.length; k += per) out.push(chars.slice(k, k + per).join("")); return out; })();
  const text = (c, font, str, x, y, align = "center") => { if (!c) return; g.fillStyle = c; g.font = font; g.textAlign = align; g.textBaseline = "middle"; g.fillText(str, x, y); };
  const frame = (inset, lw, c = stamp) => { if (!c) return; g.strokeStyle = c; g.lineWidth = lw; g.strokeRect(inset, inset, w - 2 * inset, h - 2 * inset); };
  const title = (c, cy, fs) => lines.forEach((ln, k) => text(c, "700 " + fs + "px " + F, ln, w / 2, cy + (k - (lines.length - 1) / 2) * fs * 1.2));
  if (bd.style === "slip") {
    frame(24, 1.5); text(stamp, "500 22px " + F, CATS[b.cat], w - 54, h * .62, "right"); text(stamp, "500 26px " + F, b.by, w - 54, h * .68, "right");
  } else if (bd.style === "label") {
    frame(26, 2.5); text(stamp, "500 22px " + F, CATS[b.cat], w / 2, 72);
    g.fillStyle = mask ? MASK.leather : bd.label; g.fillRect(w * .19, h * .17, w * .62, h * .36);
    g.strokeStyle = gold; g.lineWidth = 2; g.strokeRect(w * .19 + 9, h * .17 + 9, w * .62 - 18, h * .36 - 18);
    title(gold, h * .35, lines.length > 2 ? 54 : 68);
    if (stamp) { g.fillStyle = stamp; g.fillRect(w / 2 - 34, h * .6, 68, 2); } text(stamp, "500 26px " + F, b.by, w / 2, h * .655);
  } else {
    if (bd.style === "bars") { frame(26, 6); frame(42, 1.5); } else { frame(26, 3); frame(36, 1.5); }
    text(stamp, "500 22px " + F, CATS[b.cat], w / 2, 86); title(stamp, h * .37, lines.length > 2 ? 70 : 86);
    if (stamp) { g.fillStyle = stamp; g.fillRect(w / 2 - 40, h * .6, 80, 2); } text(stamp, "500 26px " + F, b.by, w / 2, h * .655);
  }
  if (!mask) grainOver(g, 0, 0, w, h, false);
  const papers = [];
  if (bd.style === "slip") {                               // 题签：竖着的一张纸，书名竖排
    const x0 = w * .11, sw = w * .25, y0 = h * .07, sh = h * .62, chars = [...b.title], fs = Math.min(sw * .62, (sh - 44) / chars.length / 1.12);
    if (mask) { g.fillStyle = MASK.paper; g.fillRect(x0, y0, sw, sh); }
    else {
      g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(x0 - 2, y0 - 2, sw + 4, sh + 5); g.fillStyle = B.slip; g.fillRect(x0, y0, sw, sh);
      g.strokeStyle = B.ink; g.globalAlpha = .7; g.lineWidth = 1.5; g.strokeRect(x0 + 8, y0 + 8, sw - 16, sh - 16); g.globalAlpha = 1;
      chars.forEach((c, k) => text(B.ink, "700 " + fs.toFixed(1) + "px " + F, c, x0 + sw / 2, y0 + sh / 2 + (k - (chars.length - 1) / 2) * fs * 1.12));
      papers.push([x0, y0, sw, sh]);
    }
  }
  if (todo) {
    const r = drawBand(g, 0, 0, w, h, b, mask); papers.push(r);
    if (!mask) { g.globalAlpha = .85; text(B.bandInk, "500 21px " + F, CATS[b.cat] + " · " + b.pages + " 页", w / 2, r[1] + r[3] * .56); g.globalAlpha = 1; }
  }
  if (!mask) papers.forEach((r) => grainOver(g, r[0], r[1], r[2], r[3], true));
}
function drawBackBound(g, w, h, b) {                   // 封底：布面，没读的腰封围过来
  clothFill(g, 0, 0, w, h, b, false); grainOver(g, 0, 0, w, h, false);
  if (b.st === "todo") { const r = drawBand(g, 0, 0, w, h, b); grainOver(g, r[0], r[1], r[2], r[3], true); }
}
function drawFront(g, w, h, b, mask) {                 // 封面跟着外观走：灰盒和纸模是两道框，玩具盒下面一截换色，旧书房另画（上面）。mask：只画「哪里是金」
  if (LOOK.bind) return drawFrontBound(g, w, h, b, mask);
  const todo = b.st === "todo", K = LOOK.spine, F = LOOK.font, ink = mask ? MASK.gilt : todo ? INK_SOFT : (LOOK.gilt || INK_LT), wt = K === "toy" ? "900 " : "700 ";
  g.fillStyle = mask ? (todo ? MASK.paper : MASK.cloth) : clothOf(b); g.fillRect(0, 0, w, h);
  if (mask && todo) return;                               // 包着纸的没有金
  if (K === "toy") { g.fillStyle = todo ? LOOK.pale2 : LOOK.tones2[b.cat]; g.fillRect(0, h * .78, w, h * .22); }
  else { g.strokeStyle = ink; g.globalAlpha = mask ? 1 : todo ? .5 : .75; g.lineWidth = 3; g.strokeRect(26, 26, w - 52, h - 52); g.lineWidth = 1.5; g.strokeRect(36, 36, w - 72, h - 72); g.globalAlpha = 1; }
  g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "500 22px " + F; g.fillText(CATS[b.cat], w / 2, 84);
  const chars = [...b.title], per = chars.length > 4 ? 3 : 2, lines = []; for (let k = 0; k < chars.length; k += per) lines.push(chars.slice(k, k + per).join(""));
  const fs = lines.length > 2 ? 72 : 88; g.font = wt + fs + "px " + F;
  lines.forEach((ln, k) => g.fillText(ln, w / 2, h * .4 + (k - (lines.length - 1) / 2) * fs * 1.22));
  g.fillRect(w / 2 - 40, h * .7, 80, 2);
  g.font = "500 26px " + F; g.fillText(b.by, w / 2, h * .76);
  if (todo) { g.font = "500 20px " + F; g.globalAlpha = .8; g.fillText("还包着纸，没读", w / 2, h - 70); g.globalAlpha = 1; }
  if (!mask) grainOver(g, 0, 0, w, h, todo);
}
// 牌盒大面那张签上的字、底下那张纸上的一行说明
const boxLines = (b) => (b.pack ? ["", "一包剪报", b.n + " 张 · 还没拆"] : [CATS[b.cat], ...(b.title.length > 4 ? [b.title.slice(0, Math.ceil(b.title.length / 2)), b.title.slice(Math.ceil(b.title.length / 2))] : [b.title]), b.n + " 张" + (b.u ? " · " + b.u + " 张没读" : "")]);
function drawPlainBack(g, w, h, b) {                   // 牌盒、邮包、本子的背面：牌盒一道盖缝；本子包脊的布在右边、松紧带在左边
  if (b.pack) { g.fillStyle = LOOK.bind.box.kraft; g.fillRect(0, 0, w, h); grainOver(g, 0, 0, w, h, true); return; }
  clothFill(g, 0, 0, w, h, b, false);
  if (b.face) { const T = LOOK.bind.note; g.fillStyle = T.tape; g.fillRect(w * (1 - T.tapeW), 0, w * T.tapeW, h); g.fillStyle = T.strap; g.fillRect(w * .115, 0, w * .04, h); }
  else { g.fillStyle = "rgba(0,0,0,.42)"; g.fillRect(0, h * .2, w, 3); }
  grainOver(g, 0, 0, w, h, false);
}
function heroSetup(b) {
  const fw = S.kind === "shelf" ? 384 : Math.round(576 * b.d / b.h / 8) * 8;                 // 封面那张图的宽跟着这件东西的宽高比走（书一律 384）
  if (hFrontC.width !== fw) { hFrontC.width = hFrontM.width = fw; hFrontT.dispose(); hFrontMT.dispose(); }
  const gf = hFrontC.getContext("2d"), gs = hSpineC.getContext("2d"), fh = hFrontC.height, sw = hSpineC.width, sh = hSpineC.height, box = S.kind === "rack", note = S.kind === "notes";
  if (box) { drawBoxFace(gf, fw, fh, b, false, boxLines(b)); drawBoxEnd(gs, 0, 0, sw, sh, b); }
  else if (note) { drawNote(gf, 0, 0, fw, fh, b); gs.fillStyle = LOOK.bind.note.tape; gs.fillRect(0, 0, sw, sh); gs.fillStyle = LOOK.gilt; gs.fillRect(0, sh * .06, sw, 3); gs.fillRect(0, sh * .94, sw, 3); grainOver(gs, 0, 0, sw, sh, false); }
  else { drawFront(gf, fw, fh, b); drawSpine(gs, 0, 0, sw, sh, b); if (!LOOK.bind) grainOver(gs, 0, 0, sw, sh, b.st === "todo"); }
  hFrontT.needsUpdate = true; hSpineT.needsUpdate = true;
  if (hBackC) { if (box || note) drawPlainBack(hBackC.getContext("2d"), hBackC.width, hBackC.height, b); else drawBackBound(hBackC.getContext("2d"), hBackC.width, hBackC.height, b); hBackT.needsUpdate = true; } else hmBack.color.set(clothOf(b));
  if (GILT) {
    const mf = hFrontM.getContext("2d"), ms = hSpineM.getContext("2d");
    if (box) { drawBoxFace(mf, fw, fh, b, true, boxLines(b)); drawBoxEnd(ms, 0, 0, sw, sh, b, false, true); }
    else if (note) { drawNote(mf, 0, 0, fw, fh, b, false, true); ms.fillStyle = MASK.cloth; ms.fillRect(0, 0, sw, sh); ms.fillStyle = MASK.gilt; ms.fillRect(0, sh * .06, sw, 3); ms.fillRect(0, sh * .94, sw, 3); }
    else { drawFront(mf, fw, fh, b, true); drawSpine(ms, 0, 0, sw, sh, b, false, true); }
    hFrontMT.needsUpdate = true; hSpineMT.needsUpdate = true;
  }
  const cloth = b.pack ? false : !!LOOK.bind || b.st !== "todo"; weave(hmFront, b.d, b.h, cloth); weave(hmBack, b.d, b.h, cloth); weave(hmSpine, b.t, b.h, cloth);
  heroBox.visible = box; heroBody.visible = !box;
  if (box) { hmCloth.color.set(b.pack ? LOOK.bind.box.kraft : clothOf(b)); heroBox.scale.set(b.t, b.h, b.d); }
  else if (bookShape) { if (heroBody.geometry !== bookShape) heroBody.geometry.dispose(); heroBody.geometry = bakeBook(bookShape, b.t, b.h, b.d); }
  heroBody.scale.set(b.t, b.h, b.d);
  heroTab.visible = b.st === "doing" && MK === "tab"; if (box) { heroTab.scale.set(b.t * .56, 1.7, .12); heroTab.position.set(0, b.h / 2 + .45, b.d / 2 - .5); } else { heroTab.scale.set(b.t * .62, 2.6, .14); heroTab.position.set(0, b.h / 2 + .55, b.d / 2 + .05); }
  heroRib.visible = b.st === "doing" && MK === "ribbon"; heroRib.scale.set(clamp(b.t * RIB.k, RIB.wMin, RIB.wMax) * 1.6, RIB.len * .8, 1); heroRib.position.set(0, -b.h / 2 + .4, b.d / 2 - 2.2);
  hero.visible = true;
}
// 抽出来以后压暗后面的书架
const dim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: LOOK.veil, transparent: true, opacity: 0, depthWrite: false }));
dim.renderOrder = 5; dim.visible = false; scene.add(dim);

function placeDim(far) { const hh = 2 * far * Math.tan(rad(CAM.fov / 2)) * 1.7; dim.position.set(0, CAM.y, CAM.dist - far); dim.scale.set(hh * Math.max(1, innerWidth / innerHeight) * 1.4, hh, 1); }   // far：离镜头多远

/* ---------- 排书：按顺序从左到右、一层放满换下一层 ---------- */
function pack(arr, W) {
  const slots = new Array(N), rows = [[]], divs = [], heads = [], pad = K.pad, gap = K.gap; let x = -W / 2 + pad, r = 0, wasPack = false;
  const nl = () => { r++; rows.push([]); x = -W / 2 + pad; };
  const put = (b) => { const w = WX(b); if (b.pack && !wasPack && rows[r].length) x += 2.2; wasPack = !!b.pack;      // 邮包和牌盒之间空开一点
    if (x + w > W / 2 - pad && rows[r].length) nl(); slots[b.i] = { r, x: x + w / 2 }; rows[r].push(b.i); x += w + gap; };
  if (arr === "topic") books.forEach(put);
  else ["done", "doing", "todo"].forEach((st) => {          // 读过的站在最前面，接着是在读的、没读的；两组之间立一块分隔板
    const g = books.filter((b) => b.st === st); if (!g.length) return;
    if (heads.length && rows[r].length) {
      if (x + DIVW + DIVGAP * 2 + g[0].t > W / 2 - PAD) nl(); else { divs.push({ r, x: x + DIVGAP + DIVW / 2 }); x += DIVW + DIVGAP * 2; }
    }
    heads.push({ st, bi: g[0].i, n: g.length }); g.forEach(put);
  });
  return { arr, W, slots, rows, divs, heads, R: rows.length };
}
const rowY = (r) => PL + BT + (S.R - 1 - r) * (SH + BT);       // 第 r 层（从上往下数）层板的上表面
function slotPos(i) {                                             // 一件东西在架上的位置和朝向。封面朝外的本子转过来、往后仰一点靠着
  const b = books[i], s = L.slots[i];
  return b.face ? { x: s.x, y: rowY(s.r) + b.h / 2, z: -RECESS - 2.4 - b.t / 2, ry: -Math.PI / 2, rz: LEAN } : { x: s.x, y: rowY(s.r) + b.h / 2, z: -RECESS - b.d / 2, ry: 0, rz: 0 };
}
const LEAN = .13;
function chooseW(aspect) {                                       // 架子的宽和层数跟着屏幕的形状走：两种排法都放得下、整座正好装进一屏；最底下一层别只剩零星几本
  let best = null;
  for (let W = 36; W <= 460; W += 2) {
    const a1 = pack("topic", W), a2 = S.kind === "shelf" ? pack("state", W) : a1, big = a2.R > a1.R ? a2 : a1, R = big.R;
    const lastFill = big.rows[R - 1].reduce((sum, bi) => sum + WX(books[bi]), 0) / W;
    // 牌盒和本子件数少、一件又宽：每层右边空出一大截就像没摆满的书架，所以空得多的宽度扣分（最后一层不算）
    const slack = S.kind === "shelf" || R < 2 ? 0 : big.rows.slice(0, -1).reduce((sum, row) => sum + 1 - (row.reduce((u, bi) => u + WX(books[bi]) + K.gap, 0) + 2 * K.pad) / W, 0) / (R - 1);
    const a = (W + 2 * ST) / (R * (SH + BT) + BT + PL), sc = Math.abs(Math.log(a / aspect)) * (a > aspect ? 1.3 : 1) + .6 * Math.max(0, .5 - lastFill) + 2.5 * Math.max(0, slack - .06);   // 比屏幕扁的多扣一点：宁可瘦高、把屏幕的高用满，上下不留一大片墙
    if (!best || sc < best.sc - 1e-6) best = { W, R, sc };
  }
  return best;
}
function counts() { const c = { todo: 0, doing: 0, done: 0 }; books.forEach((b) => { c[b.st]++; }); return c; }

/* ---------- 架子（灰盒：几块板） ---------- */
const caseKit = createCase(scene, unitBox);
const divMat = new THREE.MeshStandardMaterial({ color: LOOK.cs.div, roughness: .8 });
const divs3d = [0, 1].map(() => { const m = new THREE.Mesh(unitBox, divMat); m.castShadow = m.receiveShadow = true; m.scale.set(0, 0, 0); scene.add(m); return m; });
let caseW = 100, caseH = 150;
function buildCase(W, R) { const s = caseKit.build(W, R); caseW = s.w; caseH = s.h; }
function setDividers(show) {
  divs3d.forEach((m, k) => {
    const d = show && L.arr === "state" ? L.divs[k] : null;
    if (!d) { m.scale.set(0, 0, 0); return; }
    m.position.set(d.x, rowY(d.r) + 12.5, -RECESS - 7.5);
    play(.2, (e) => { m.scale.set(DIVW * e, 25 * e, 15); }, { ease: E.back });
  });
}

/* ---------- 镜头：整座架子装进一屏 ---------- */
const safeEl = document.createElement("div");                        // 量刘海和底下横条占掉多少
safeEl.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)"; document.body.appendChild(safeEl);
function avail() {                                                   // 整屏都给书架：上面只让开刘海，下面让开那道小把手
  const vw = innerWidth, vh = innerHeight, portrait = vh >= vw, cs = getComputedStyle(safeEl);
  const top = 8 + (parseFloat(cs.paddingTop) || 0), bot = (MULTI ? 60 : 26) + (parseFloat(cs.paddingBottom) || 0), side = portrait ? 6 : 24;   // 底下：一道把手，旧书房上面还有换家具的一排记号
  return { vw, vh, top, bot, side, w: vw - 2 * side, h: vh - top - bot };
}
function fitCam() {
  const A = avail(), tanH = Math.tan(rad(CAM.fov / 2)), asp = A.vw / A.vh;
  renderer.setPixelRatio(PR.cur); renderer.setSize(A.vw, A.vh, false);
  camera.fov = CAM.fov; camera.aspect = asp;
  CAM.dist = Math.max(caseH / (2 * tanH * (A.h / A.vh)), caseW / (2 * tanH * asp * (A.w / A.vw)));
  CAM.wpp = 2 * CAM.dist * tanH / A.vh;                              // 架子正面上，屏幕一个像素是多少厘米
  CAM.y = caseH / 2 - ((A.bot - A.top) / 2) * CAM.wpp;               // 底下那道把手比顶上占得多，架子往上让一点
  camera.near = 4; camera.far = CAM.dist + 1200; camera.updateProjectionMatrix();
  lightCase(key, caseW, caseH);
}
function placeCamera(raw) {
  const k = 1 - Math.exp(-6 * raw); S.par.x += (S.par.tx - S.par.x) * k; S.par.y += (S.par.ty - S.par.y) * k;
  // 镜头一直轻轻左右晃；抽出一件的时候晃得小；开着盒的时候不晃（牌是按「镜头正对着」摆到屏幕上的，一晃就整片偏到一边去）
  const still = S.state === "opening" || S.state === "open" || S.state === "closing", want = still ? 0 : S.state === "out" || S.state === "back" ? .3 : 1;
  S.swayK += (want - S.swayK) * (1 - Math.exp(-(still ? 14 : 4) * raw));
  const d = CAM.dist * CAM.k, sw = Math.sin(S.t * .45) * P.sway * S.swayK, pk = Math.min(1, S.swayK * 3.4);
  const sx = S.shake * Math.sin(S.t * 71), sy = S.shake * Math.cos(S.t * 57);
  camera.position.set(Math.sin(sw) * d + S.par.x * pk * d * .035 + sx + S.pan, CAM.y - S.par.y * pk * d * .02 + sy, Math.cos(sw) * d);   // pan：换家具时镜头顺着墙横着走
  camera.lookAt(S.pan, CAM.y, 0); camera.updateMatrixWorld();
}
function inspectPose(b) {                                            // 抽出来的书停在哪：眼前、偏上（底下留给那张纸）
  const A = avail(), tanH = Math.tan(rad(CAM.fov / 2)), asp = A.vw / A.vh, sheetPx = Math.min(230, A.vh * .34);
  const freeH = (A.vh - A.top - sheetPx) / A.vh;
  const di = Math.max(b.h / (2 * tanH * freeH * .78), b.d / (2 * tanH * asp * .6)), wpp = 2 * di * tanH / A.vh;
  return { x: 0, y: CAM.y + ((sheetPx - A.top) / 2) * wpp, z: CAM.dist - di, ry: -Math.PI / 2 + .22, di };
}
const _v = new THREE.Vector3();
function screenOf(x, y, z) { _v.set(x, y, z).project(camera); return { x: (_v.x + 1) / 2 * innerWidth, y: (1 - _v.y) / 2 * innerHeight }; }
function rectOf(i) {
  const b = books[i], wx = WX(b), z = b.pz + WZ(b) / 2 + b.out * P.doingZ + b.pop * P.popZ, a = screenOf(b.px - wx / 2, b.py + b.h / 2, z), c = screenOf(b.px + wx / 2, b.py - b.h / 2, z);
  return { l: a.x, t: a.y, r: c.x, b: c.y, cx: (a.x + c.x) / 2, cy: (a.y + c.y) / 2 };
}

/* ---------- 每帧把书摆到位 ---------- */
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(0, 0, 0, "YXZ");
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _t = new THREE.Matrix4(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);
function applyBooks(raw) {
  for (const b of books) {
    b.pop += (b.popT - b.pop) * (1 - Math.exp(-(b.popT > b.pop ? P.popUp : P.popDown) * raw));
    b.out += (b.outT - b.out) * (1 - Math.exp(-10 * raw));
    _p.set(b.px, b.py + b.pop * .35, b.pz + b.out * P.doingZ + b.pop * P.popZ);
    if (b.face) _e.set(b.rx, b.ry, b.rz - b.pop * LEAN * .7); else _e.set(b.rx + b.pop * P.popTilt, b.ry, b.rz);   // 手指碰到：书是书顶往外倾，封面朝外的本子是立直一点
    if (b.hero) {
      if (S.state === "out" && S.outReady) { _e.y += S.yaw; _e.z += Math.sin(S.t * 1.1) * .012; _p.y += Math.sin(S.t * 1.7) * .2; }
      hero.position.copy(_p); hero.quaternion.setFromEuler(_e); hero.scale.setScalar(b.k);
      books3d.setMatrixAt(b.i, _zero); tabs.setMatrixAt(b.i, _zero); continue;
    }
    _q.setFromEuler(_e); _m.compose(_p, _q, _s.set(b.k, b.k, b.k));
    _m2.copy(_m).scale(_s.set(b.t, b.h, b.d)); books3d.setMatrixAt(b.i, _m2);
    if (b.st !== "doing") tabs.setMatrixAt(b.i, _zero);
    else if (MK === "ribbon") {                                        // 丝带不跟着书歪：从书脚垂下来，至少在层板前沿的外面
      _m2.makeTranslation(_p.x, _p.y - b.h / 2 * b.k + .3, Math.max(_p.z + WZ(b) / 2 - .3, RIB.z)).scale(_s.set(clamp(WX(b) * RIB.k, RIB.wMin, RIB.wMax) * b.k, RIB.len * b.k, 1)); tabs.setMatrixAt(b.i, _m2);
    } else if (K.box) { _m2.copy(_m).multiply(_t.makeTranslation(0, b.h / 2 + .45, b.d / 2 - .5)).scale(_s.set(b.t * .56, 1.7, .12)); tabs.setMatrixAt(b.i, _m2); }   // 牌盒：顶上露一枚签
    else { _m2.copy(_m).multiply(_t.makeTranslation(0, b.h / 2 + .55, b.d / 2 + .05)).scale(_s.set(b.t * .62, 2.6, .14)); tabs.setMatrixAt(b.i, _m2); }
  }
  books3d.instanceMatrix.needsUpdate = true; tabs.instanceMatrix.needsUpdate = true;
}
function snapToSlots() { books.forEach((b) => { const sp = slotPos(b.i); b.px = sp.x; b.py = sp.y; b.pz = sp.z; b.rx = 0; b.ry = sp.ry; b.rz = sp.rz; b.k = 1; b.outT = b.st === "doing" ? 1 : 0; }); }

/* ---------- 界面 ---------- */
const hint = $("#hint"), grab = $("#grab"), tools = $("#tools"), veil = $("#veil"), sheet = $("#sheet"), tip = $("#tip"), labs = $("#labs"), marks = $("#marks");
marks.hidden = !MULTI;
function ui() {
  const c = counts(), out = S.cur >= 0 || S.state === "back", opened = S.state === "open";
  const mk = S.mark === "ribbon" ? "垂着丝带的" : "顶上带签的";
  if (S.kind === "rack") { const bx = books.filter((b) => !b.pack); hint.innerHTML = "共 <b>" + bx.length + "</b> 盒 · <b>" + bx.reduce((n, b) => n + b.n, 0) + "</b> 张牌：顶上露着签的有没读的 <b>" + bx.filter((b) => b.u).length + "</b> 盒 · 没拆的邮包 <b>" + (N - bx.length) + "</b> 包<small>盒子越厚牌越多。手指按在盒子上划，松手就抽出那一盒</small>"; }
  else if (S.kind === "notes") hint.innerHTML = "共 <b>" + N + "</b> 本：垂着丝带的今天写过 <b>" + c.doing + "</b> 本<small>本子越厚页越多。手指按在本子上划，松手就抽出那一本</small>";
  else hint.innerHTML = "共 <b>" + N + "</b> 本：" + (LOOK.bind ? "带腰封的没读 <b>" + c.todo + "</b> · " + mk + "在读 <b>" + c.doing + "</b> · 摘了腰封的读过 <b>" + c.done + "</b>" : "深的读过 <b>" + c.done + "</b> · " + mk + "在读 <b>" + c.doing + "</b> · 浅的没读 <b>" + c.todo + "</b>") + "<small>手指按在书脊上划，松手就抽出那一本</small>";
  grab.classList.toggle("off", out); sheet.classList.toggle("on", S.state === "out" || opened); sheet.classList.toggle("slim", opened);
  marks.classList.toggle("off", out || S.tools || S.state === "enter");
  marks.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === S.kind)));
  document.querySelectorAll("#tools [data-only]").forEach((el) => { el.hidden = el.dataset.only !== S.kind; });      // 排法、在读的记号、本数只有书架有
  document.querySelectorAll("#seg-arr button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.arr === S.arr)));
  document.querySelectorAll("#seg-n button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.n === N)));
  document.querySelectorAll("#seg-mark button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mark === S.mark)));
  const cur = books[S.cur];
  if (cur) {
    const pct = Math.round(cur.prog * 100), book = S.kind === "shelf";
    $("#s-title").textContent = cur.title;
    $("#s-meta").textContent = book ? cur.by + " · " + cur.pages + " 页 · " + CATS[cur.cat] + " · " + (cur.st === "todo" ? "还没打开过" : cur.st === "done" ? "读完了" : "读到 " + pct + "%")
      : S.kind === "rack" ? (cur.pack ? "邮差送来的一包剪报 · " + cur.n + " 张 · 还没拆" : cur.vol + " · " + CATS[cur.cat] + " · " + cur.n + " 张牌 · " + (cur.u ? cur.u + " 张没读" : "都读过") + " · 再点一下盒子打开")
        : cur.kindName + " · " + cur.pages + " 页 · " + (cur.ago === 0 ? "今天写过" : cur.ago + " 天前写过");
    $("#s-prog").hidden = !book; $("#s-prog").firstElementChild.style.width = pct + "%"; $("#s-prog").setAttribute("aria-valuenow", pct);
    $("#b-read").hidden = !book || cur.st === "done"; $("#b-read").textContent = cur.st === "doing" ? "接着读" : "打开读";
    $("#b-done").hidden = !book || cur.st === "done"; $("#b-todo").hidden = !book || cur.st === "todo";
    $("#b-go").hidden = !cur.pack;                                     // 没拆的邮包：去拆包那一页拆
    // 牌盒：抽出来再点它一下就打开（没有「打开」的按钮）；打开以后底下只剩一行字和「合上」，那行字跟着正中那张牌换
    $("#b-back").hidden = opened; $("#b-close").hidden = !opened;
    if (opened) uiCard();
  }
  $("#snd").setAttribute("aria-pressed", String(AU.on));
}
// 开着盒的时候底下那一行：转到第几张、这张读没读。转一张换一次，所以只动这一行字
function uiCard() {
  const b = books[S.cur]; if (!b || !boxView || S.state !== "open") return;
  const i = boxView.focus, cd = boxView.cards[i]; if (!cd) return;
  $("#s-meta").textContent = "第 " + (i + 1) + " / " + b.n + " 张 · " + (cd.c.read ? (b.u ? b.u + " 张没读（背面朝上）" : "都读过") + " · 左右划着翻" : "这张还没读，点它一下翻开");
}
// 工具纸：平时收着，点把手或者在把手上往上划才出来；点外面收回去
function toolsOpen(on) {
  on = !!on && S.state === "idle"; if (on === S.tools) return;
  S.tools = on; tools.classList.toggle("on", on); veil.classList.toggle("on", on); grab.setAttribute("aria-expanded", String(on)); if (on) setHot(-1);
}
// 层板边上的小签（按读没读放时）：读过 46 / 在读 3 / 没读 71，贴在每一组开头上方的层板边上，当这一组的题头
let labEls = [];
function setLabels(show) {
  labs.textContent = ""; labEls = [];
  if (!show || L.arr !== "state") return;
  L.heads.forEach((h) => { const el = document.createElement("div"); el.className = "lab"; el.textContent = STN[h.st] + " " + h.n; labs.appendChild(el); labEls.push({ el, h }); });
  requestAnimationFrame(() => labEls.forEach((o) => o.el.classList.add("on")));
}
function placeLabels() {
  labEls.forEach(({ el, h }) => { const b = books[h.bi], s = L.slots[h.bi], p = screenOf(s.x - b.t / 2, rowY(s.r) + SH + BT / 2, 0); el.style.transform = "translate(" + Math.round(p.x) + "px," + Math.round(p.y) + "px) translateY(-50%)"; });
}
function showTip(b, x, y) {
  tip.firstElementChild.textContent = b.title;
  tip.lastElementChild.textContent = S.kind === "rack" ? (b.pack ? b.n + " 张 · 还没拆" : b.n + " 张" + (b.u ? " · " + b.u + " 张没读" : "")) : S.kind === "notes" ? b.pages + " 页 · " + (b.ago === 0 ? "今天写过" : b.ago + " 天前") : b.by + " · " + STN[b.st];
  tip.classList.add("on"); moveTip(x, y);
}
function moveTip(x, y) {
  const w = tip.offsetWidth, h = tip.offsetHeight, tx = clamp(x - w / 2, 8, innerWidth - w - 8), ty = y - h - 46 < 56 ? y + 36 : y - h - 46;
  tip.style.transform = "translate(" + Math.round(tx) + "px," + Math.round(ty) + "px)";
}

/* ---------- 节拍 ---------- */
function layoutFit() { const A = avail(), best = chooseW(A.w / A.h); S.W = best.W; S.R = best.R; L = pack(S.arr, S.W); buildCase(S.W, S.R); fitCam(); }
// 换到某一件家具：架上的东西从各自那一批里拿（改过的读没读留着），层高换掉，架子重搭，东西重画
function setKind(kind) {
  S.kind = kind; K = KINDS[kind]; SH = DIM.SH = K.SH;
  books = STORE[kind] || (STORE[kind] = kind === "rack" ? makeBoxes() : kind === "notes" ? makeNotes() : makeBooks(NB)); N = books.length;
  books.forEach((b) => { b.pop = b.popT = 0; b.hero = false; });
  S.hot = S.cur = -1; S.outReady = false; S.yaw = S.yawT = 0; hero.visible = false; dim.visible = false; tip.classList.remove("on");
  S.arr = kind === "shelf" ? S.arrBook : "topic";
  layoutFit(); buildBooks(); setDividers(false); setLabels(false);
}
function rebuild(n) { clearTracks(); NB = n; STORE.shelf = null; setKind("shelf"); enter(); }      // 换本数（只有书架有）
// 换家具：镜头顺着墙横着走。先走到看不见这一件，架子在镜头外换好，再从另一头走进来
const panDist = () => caseW / 2 + CAM.dist * Math.tan(rad(CAM.fov / 2)) * camera.aspect + 8;      // 刚好走到这一件出了屏幕：中间只看见墙的那一下越短越好
function goto(kind) {
  if (!MULTI || S.state !== "idle" || kind === S.kind || !KINDS[kind]) return;
  toolsOpen(false); setHot(-1); S.state = "swap"; setDividers(false); setLabels(false);
  const dir = ORDER.indexOf(kind) > ORDER.indexOf(S.kind) ? 1 : -1, d0 = panDist();
  SFX.swap(); ui();
  play(P.swapOut, (e) => { S.pan = dir * d0 * e; }, { ease: E.in2, done() {
    setKind(kind); snapToSlots(); const d1 = panDist(); S.pan = -dir * d1; ui();
    play(P.swapIn, (e) => { S.pan = -dir * d1 * (1 - e); }, { ease: E.out3, done() { S.pan = 0; S.state = "idle"; SFX.thud(); vib(10); S.shake = P.shake * .6; setDividers(true); setLabels(true); ui(); } });
  } });
}
const step = (d) => goto(ORDER[ORDER.indexOf(S.kind) + d]);             // 往左、往右换一件
function enter() {
  S.state = "enter"; S.fast = false;
  books.forEach((b) => { const sp = slotPos(b.i); b.px = sp.x; b.py = sp.y; b.pz = sp.z + P.enterZ; b.k = 0; b.rx = 0; b.ry = sp.ry; b.rz = sp.rz; b.pop = b.popT = b.out = b.outT = 0; b.hero = false; });
  const seq = L.rows.flat();                                       // 一层一层、从左到右推进去；推过头一点再弹回来
  seq.forEach((bi, k) => {
    const b = books[bi], z1 = slotPos(bi).z;
    play(P.enterEach, (e, kk) => { b.pz = z1 + P.enterZ * (1 - e); b.k = Math.min(1, kk * 4); }, { delay: .25 + (k / N) * P.enterDur, ease: E.back, done: k === N - 1 ? enterDone : null });
  });
  CAM.k = .84; play(.25 + P.enterDur + P.enterEach, (e) => { CAM.k = lerp(.84, 1, e); }, { ease: E.io3 });   // 镜头同时往后退到看全
  const ticks = Math.min(N, 26); for (let i = 0; i < ticks; i++) wait(.25 + (i / ticks) * P.enterDur + P.enterEach * .7, () => SFX.shelve(i / ticks));
  ui();
}
function enterDone() { books.forEach((b) => { b.outT = b.st === "doing" ? 1 : 0; }); SFX.thud(); vib(10); S.shake = P.shake * .6; S.state = "idle"; setDividers(true); setLabels(true); ui(); }

// 一批书飞到各自的新位置：先退出来、绕到架子外面、再推进去
function flyToSlots(done, skip, quick) {
  const seq = L.rows.flat(); let n = 0;
  const fin = () => { if (--n === 0) done(); };
  seq.forEach((bi, k) => {
    if (bi === skip) return;
    const b = books[bi], sp = slotPos(bi), x0 = b.px, y0 = b.py, z0 = b.pz, dx = sp.x - x0, dy = sp.y - y0, dist = Math.hypot(dx, dy);
    if (dist < .02) return;
    const arc = dist < 7 && Math.abs(dy) < 1 ? 0 : P.sortArc, dir = Math.sign(dx) || 1; n++;
    play((quick ? .34 : P.sortDur) + Math.min(.25, dist * .0012), (e, kk) => { const s = Math.sin(Math.PI * kk); b.px = x0 + dx * e; b.py = y0 + dy * e; b.pz = lerp(z0, sp.z, e) + s * arc; b.rz = arc ? -dir * s * .16 : 0; },
      { delay: (k / seq.length) * (quick ? .12 : P.sortSpread), ease: E.io3, done: fin });
  });
  if (!n) done();
}
function arrange(a) {
  if (S.state !== "idle" || a === S.arr || S.kind !== "shelf") return;
  setHot(-1); S.arr = S.arrBook = a; S.state = "sort"; L = pack(a, S.W); setDividers(false); setLabels(false); SFX.sort(); ui();
  flyToSlots(() => { S.state = "idle"; SFX.thud(); vib(10); S.shake = P.shake * .6; setDividers(true); setLabels(true); ui(); });
}

function setHot(i, x, y) {
  if (i === S.hot) { if (i >= 0 && x != null) moveTip(x, y); return; }
  if (S.hot >= 0) books[S.hot].popT = 0;
  S.hot = i;
  if (i >= 0) { books[i].popT = 1; SFX.tick(books[i]); vib(4); showTip(books[i], x == null ? innerWidth / 2 : x, y == null ? innerHeight / 2 : y); }
  else tip.classList.remove("on");
}
function pullOut(i) {
  if (S.state !== "idle" && S.state !== "scrub") return;
  const b = books[i]; if (!b) return;
  if (S.hot >= 0 && S.hot !== i) books[S.hot].popT = 0;
  S.hot = -1; tip.classList.remove("on"); S.state = "out"; S.cur = i; S.outReady = false; S.yaw = S.yawT = 0; b.st0 = b.st;
  // 接着当前探出来的姿态往外走，换成单独那本
  b.pz += b.out * P.doingZ + b.pop * P.popZ; b.rx = b.face ? 0 : b.pop * P.popTilt; b.py += b.pop * .35; b.pop = b.popT = b.out = b.outT = 0;
  heroSetup(b); b.hero = true;
  const I = inspectPose(b), x0 = b.px, y0 = b.py, z0 = b.pz, rx0 = b.rx, ry0 = b.ry, rz0 = b.rz, zs = -RECESS + WZ(b) / 2 + 2.5;
  placeDim(I.di + 16); dim.material.opacity = 0; dim.visible = true;
  SFX.out(); vib(8); ui();
  play(P.outSlide, (e) => { b.pz = lerp(z0, zs, e); b.rx = lerp(rx0, 0, e); }, { ease: E.in2, done() {
    play(.3, (e) => { dim.material.opacity = .62 * e; }, { ease: E.lin });
    play(P.outFly, (e, kk) => { b.px = lerp(x0, I.x, e); b.py = lerp(y0, I.y, e); b.pz = lerp(zs, I.z, e); b.ry = lerp(ry0, I.ry, E.out3(kk)); b.rz = lerp(rz0, 0, E.out3(kk)); }, { ease: E.back, done() { S.outReady = true; SFX.shown(); } });
  } });
}
// 读没读不用手标，跟着读到哪走：一点没读是没读，读完是读过，中间都是在读（2026-11-13 夜里用户提的：打开读了百分之一二，它应该自己变）
function setProg(p) {
  const b = books[S.cur]; if (S.state !== "out" || !b) return;
  p = clamp(p, 0, 1); const st = p <= 0 ? "todo" : p >= 1 ? "done" : "doing", same = st === b.st; if (same && p === b.prog) return;
  b.prog = p;
  if (same) { SFX.page(); vib(4); ui(); return; }
  b.st = st; atlas.redraw(b); heroSetup(b);                            // 没读变在读：腰封摘了（灰盒：包的白纸拆了）
  play(.3, (e, kk) => { b.k = 1 + Math.sin(Math.PI * kk) * .07; }, { ease: E.lin });
  SFX.mark(st); vib(8); ui();
}
function readOn() { const b = books[S.cur]; if (!b || b.prog >= 1) return; setProg(b.prog <= 0 ? .02 : Math.min(1, b.prog + .2)); }   // 样机里没有阅读器：点一下算读了一段，头一下只算百分之二
function setStatus(st) {                                               // 补标（在别处读完的、想重来的）；测试脚本也用
  const b = books[S.cur]; if (S.state !== "out" || !b || b.st === st) return;
  setProg(st === "todo" ? 0 : st === "done" ? 1 : b.prog > 0 && b.prog < 1 ? b.prog : .08);
}
function putBack() {
  if (S.state !== "out" || !S.outReady) return;
  const b = books[S.cur]; S.state = "back"; S.outReady = false; ui();
  let pending = 2, refit = false;
  const fin = () => { if (--pending) return; if (refit) { layoutFit(); snapToSlots(); } S.state = "idle"; setDividers(true); setLabels(true); ui(); };
  // 状态改过、又是按读没读放：这本要去新的位置，别的书先让位
  if (S.arr === "state" && b.st !== b.st0) { L = pack("state", S.W); refit = L.R > S.R; setDividers(false); setLabels(false); if (refit) fin(); else flyToSlots(fin, b.i, true); }
  else fin();
  const sp = refit ? { x: b.px, y: b.py - 40, z: b.pz - 60, ry: 0, rz: 0 } : slotPos(b.i), x0 = b.px, y0 = b.py, z0 = b.pz, ry0 = b.ry + S.yaw, zf = sp.z + WZ(b) + 3.5;
  S.yaw = S.yawT = 0; b.ry = ry0; b.outT = b.st === "doing" ? 1 : 0;
  SFX.back(); play(.25, (e) => { dim.material.opacity = .62 * (1 - e); }, { ease: E.lin, done() { dim.visible = false; } });
  play(P.backFly, (e) => { b.px = lerp(x0, sp.x, e); b.py = lerp(y0, sp.y, e); b.pz = lerp(z0, zf, e); b.ry = lerp(ry0, sp.ry, e); b.rz = lerp(0, sp.rz, e); }, { ease: E.io3, done() {
    play(P.backPush, (e) => { b.pz = lerp(zf, sp.z, e); }, { ease: E.in2, done() {
      b.hero = false; hero.visible = false; b.ry = sp.ry; b.rz = sp.rz; S.cur = -1; SFX.thud(); vib(12); S.shake = P.shake;
      const row = L.rows[L.slots[b.i].r], k = row.indexOf(b.i); [k - 1, k + 1].forEach((j) => { const nb = books[row[j]]; if (nb) nb.pop = .3; });   // 左右两本跟着顿一下
      fin();
    } });
  } });
}

/* ---------- 开盒（牌在 box.js）：盒子落到屏幕底下、盒口朝人，牌排成一把扇子；左右转、点一下翻开没读的；合上，盒子回到眼前 ---------- */
let OB = { x: 0, y: 0, z: 0, tilt: 0, k: 1, px: 0, py: 0 };               // 打开的盒子在哪、缩到几成；px、py 是它在屏上的位置
const boxView = MULTI ? createBoxView({
  scene, hero, play, maxAniso,
  view: () => { const A = avail(); return { vw: A.vw, vh: A.vh, tanH: Math.tan(rad(CAM.fov / 2)), camY: CAM.y, camZ: CAM.dist, top: A.top, bottom: A.bot - 60 + P.openSheet + P.openBox, pr: PR.cur }; },
  boxPose: () => OB, glyph: (b) => CATS[b.cat][0],
  tick: (i, n) => { SFX.card(n > 1 ? i / (n - 1) : 0); vib(3); }, flipSnd: () => { SFX.flip(); vib(10); }, focus: () => uiCard(),
}) : null;
const isBox = (b) => !!boxView && S.kind === "rack" && !!b && !b.pack;
function heroRect() {                                                     // 抽出来的那一件在屏上占的方块（点在它上面是「打开」，点在外面是「放回去」）
  const b = books[S.cur]; if (!b) return null;
  const wpp = 2 * (CAM.dist - b.pz) * Math.tan(rad(CAM.fov / 2)) / innerHeight, c = screenOf(b.px, b.py, b.pz), hw = (WZ(b) + WX(b) * .3) / 2 / wpp + 10, hh = b.h / 2 / wpp + 10;
  return { l: c.x - hw, r: c.x + hw, t: c.y - hh, b: c.y + hh, cx: c.x, cy: c.y };
}
function openBox() {
  const b = books[S.cur]; if (S.state !== "out" || !S.outReady || !isBox(b)) return;
  S.state = "opening"; S.outReady = false; b.cards = b.cards || makeCards(b, HEADS[b.cat]);
  const A = avail(), py = A.vh - (A.bot - 60) - P.openSheet - P.openBox * .5, tanH = Math.tan(rad(CAM.fov / 2));
  const D = Math.min(b.d * P.openK / P.openBoxPx * A.vh / (2 * tanH), CAM.dist - 60), wpp = 2 * D * tanH / A.vh;      // 盒子离镜头多远：照「缩小以后在屏上这么宽」算，但一定在架子前面
  OB = { x: 0, y: CAM.y + (A.vh / 2 - py) * wpp, z: CAM.dist - D, tilt: P.openTilt, k: P.openK, px: A.vw / 2, py };
  const x0 = b.px, y0 = b.py, z0 = b.pz, ry0 = b.ry + S.yaw, o0 = dim.material.opacity; S.yaw = S.yawT = 0; b.ry = ry0;
  placeDim(Math.min(Math.max(D + 26, CAM.dist - dim.position.z), CAM.dist - 10)); SFX.out(); ui();
  play(P.openFly, (e) => { b.px = lerp(x0, OB.x, e); b.py = lerp(y0, OB.y, e); b.pz = lerp(z0, OB.z, e); b.ry = lerp(ry0, -Math.PI / 2, e); b.rz = -P.openTilt * e; b.k = lerp(1, OB.k, e); dim.material.opacity = lerp(o0, .8, e); }, { ease: E.io3, done() {
    heroBox.visible = false; heroTab.visible = false; SFX.lid(); vib(8);
    boxView.open(b, b.cards, { front: hFrontT, back: hBackT, end: hSpineT }, clothOf(b), () => { S.state = "open"; S.shake = P.shake * .4; ui(); });
  } });
}
function closeBox() {
  const b = books[S.cur]; if (!boxView || S.state !== "open" || boxView.busy || !b) return;
  S.state = "closing"; ui(); SFX.back();
  boxView.close(() => {
    b.u = b.cards.filter((c) => !c.read).length; b.st = b.u ? "doing" : "done"; atlas.redraw(b); heroSetup(b); SFX.lid();      // 读过几张，盒面上的数和顶上那枚签跟着变
    const I = inspectPose(b), x0 = b.px, y0 = b.py, z0 = b.pz, ry0 = b.ry, rz0 = b.rz, k0 = b.k;
    play(P.openFly, (e) => { b.px = lerp(x0, I.x, e); b.py = lerp(y0, I.y, e); b.pz = lerp(z0, I.z, e); b.ry = lerp(ry0, I.ry, e); b.rz = lerp(rz0, 0, e); b.k = lerp(k0, 1, e); dim.material.opacity = lerp(.8, .62, e); }, { ease: E.io3, done() { placeDim(I.di + 16); S.state = "out"; S.outReady = true; ui(); } });
  });
}
function flipCard() {                                                     // 立着的那张背面朝上：翻过来，翻过来就算读了
  const b = books[S.cur]; if (!boxView || S.state !== "open" || !b) return false;
  return boxView.flip(() => { b.u = b.cards.filter((c) => !c.read).length; uiCard(); });
}
// 开着盒的时候点了一下：点在立着的那张上是翻开（读过的没有反应，正文还没接）；点在扇面的某一张上是转到它；点在底下的盒子上是合上
function tapOpen(x, y) {
  const h = boxView.hit(x, y);
  if (h && h.big) flipCard();
  else if (h) boxView.go(h.i);
  else if (Math.abs(x - OB.px) <= 62 && Math.abs(y - OB.py) <= P.openBox * .7) closeBox();
}

/* ---------- 手指 ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(cx, cy) {                                        // 手指底下是哪一本：先落到书脊那个平面上，再按层、按左右找最近的
  ndc.set(cx / innerWidth * 2 - 1, 1 - cy / innerHeight * 2); ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction; if (Math.abs(d.z) < 1e-6) return -1;
  const t = (-RECESS - o.z) / d.z, x = o.x + d.x * t, y = o.y + d.y * t;
  const r = S.R - 1 - Math.floor((y - PL) / (SH + BT)), row = L.rows[r]; if (!row) return -1;
  let best = -1, bd = Math.max(.8, 7 * CAM.wpp);
  for (const bi of row) { const dd = Math.abs(x - L.slots[bi].x) - WX(books[bi]) / 2; if (dd < bd) { bd = dd; best = bi; } }
  return best;
}
const G = { id: -1, x0: 0, y0: 0, t0: 0, moved: 0, mode: "", turn: false };
canvas.addEventListener("pointerdown", (ev) => {
  au(true); if (G.id !== -1) return;
  G.id = ev.pointerId; G.x0 = ev.clientX; G.y0 = ev.clientY; G.t0 = ev.timeStamp; G.moved = 0; G.mode = "";      // 按了多久照事件自己带的时刻算，不照处理它的时刻：卡了一帧不该把「点一下」算成长按
  try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
  if (S.state === "enter") S.fast = true;
  else if (S.state === "idle") { S.state = "scrub"; G.mode = "scrub"; setHot(pick(ev.clientX, ev.clientY), ev.clientX, ev.clientY); }
  else if (S.state === "out") G.mode = "spin";
  else if (S.state === "open") { G.mode = boxView.grab(ev.clientX) ? "fan" : ""; G.turn = false; }       // 开着盒：按着左右划，整把扇子跟着转（转着的时候按住就停）
});
canvas.addEventListener("pointermove", (ev) => {
  if (ev.pointerType === "mouse") { S.par.tx = ev.clientX / innerWidth * 2 - 1; S.par.ty = ev.clientY / innerHeight * 2 - 1; }
  if (G.id === -1) { if (ev.pointerType === "mouse" && S.state === "idle") setHot(pick(ev.clientX, ev.clientY), ev.clientX, ev.clientY); return; }   // 鼠标不用按住，移过去就探头
  if (ev.pointerId !== G.id) return;
  G.moved = Math.max(G.moved, Math.hypot(ev.clientX - G.x0, ev.clientY - G.y0));
  if (G.mode === "scrub" && S.state === "scrub") setHot(pick(ev.clientX, ev.clientY), ev.clientX, ev.clientY);
  else if (G.mode === "spin" && S.state === "out") S.yawT = clamp((ev.clientX - G.x0) * .012, -2.6, 2.6);
  else if (G.mode === "fan" && S.state === "open") { if (!G.turn && G.moved > 6) { G.turn = true; boxView.grab(ev.clientX); } if (G.turn) boxView.dragTo(ev.clientX); }   // 动了六像素才算在转，从这一下起跟手
});
function endPointer(ev) {
  if (ev.pointerId !== G.id) return; G.id = -1;
  const cancel = ev.type === "pointercancel";
  if (G.mode === "scrub" && S.state === "scrub") { const i = S.hot; S.state = "idle"; if (i >= 0 && !cancel) pullOut(i); else setHot(-1); }
  else if (G.mode === "spin" && S.state === "out") {                  // 点一下：点在牌盒上是打开它，别的（点在外面，或者抽出来的是书、本子、邮包）是放回去
    S.yawT = 0;
    if (!cancel && G.moved < 8 && ev.timeStamp - G.t0 < 450) { const r = isBox(books[S.cur]) && S.outReady ? heroRect() : null; if (r && ev.clientX >= r.l && ev.clientX <= r.r && ev.clientY >= r.t && ev.clientY <= r.b) openBox(); else putBack(); }
  }
  else if (G.mode === "fan" && S.state === "open") { boxView.release(); if (!cancel && !G.turn && ev.timeStamp - G.t0 < 450) tapOpen(ev.clientX, ev.clientY); }
  G.mode = "";
}
canvas.addEventListener("pointerup", endPointer); canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerleave", (ev) => { if (ev.pointerType === "mouse" && G.id === -1 && S.state === "idle") setHot(-1); });
{ let acc = 0;                                                         // 鼠标滚轮、触控板：开着盒的时候一格转一张
  canvas.addEventListener("wheel", (ev) => { if (S.state !== "open") return; ev.preventDefault(); acc += Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY; if (Math.abs(acc) >= 40) { boxView.nudge(acc > 0 ? 1 : -1); acc = 0; } }, { passive: false });
}
// 工具纸里的按钮：点了就收起纸，好看见架子上变了什么
document.querySelectorAll("#seg-arr button").forEach((b) => b.addEventListener("click", () => { au(true); toolsOpen(false); arrange(b.dataset.arr); }));
document.querySelectorAll("#seg-n button").forEach((b) => b.addEventListener("click", () => { au(true); toolsOpen(false); if (S.state === "idle" && +b.dataset.n !== N) rebuild(+b.dataset.n); }));
document.querySelectorAll("#seg-mark button").forEach((b) => b.addEventListener("click", () => { au(true); toolsOpen(false); setMark(b.dataset.mark); }));
{ let y0 = null, swiped = false;                                       // 把手：点一下开合，按住往上划也开（划开以后松手的那一下点击不算，不然又关上了）
  grab.addEventListener("pointerdown", (ev) => { y0 = ev.clientY; swiped = false; try { grab.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ } });   // 鼠标划出把手也接着收得到（手指本来就会）
  grab.addEventListener("pointermove", (ev) => { if (y0 != null && y0 - ev.clientY > 12) { y0 = null; swiped = true; au(true); toolsOpen(true); } });
  ["pointerup", "pointercancel"].forEach((t) => grab.addEventListener(t, () => { y0 = null; }));
  grab.addEventListener("click", () => { if (swiped) { swiped = false; return; } au(true); toolsOpen(!S.tools); });
}
// 底下那排记号：点哪个去哪个；按在这一排上左右划也行（往左划去右边那件）。不做整屏左右滑：手指在书脊上左右划已经是「划过书脊」了
{ let x0 = null, btn = null;                                           // 手指按下时记住按的是哪个记号：这一排接管了手指（划出去也收得到），松手时点击就落不到按钮自己身上了
  marks.addEventListener("pointerdown", (ev) => { x0 = ev.clientX; btn = ev.target.closest("button"); try { marks.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ } });
  marks.addEventListener("pointermove", (ev) => { if (x0 != null && Math.abs(ev.clientX - x0) > 26) { const d = ev.clientX < x0 ? 1 : -1; x0 = null; btn = null; au(true); step(d); } });
  marks.addEventListener("pointerup", () => { if (x0 != null && btn) { au(true); goto(btn.dataset.f); } x0 = null; btn = null; });
  marks.addEventListener("pointercancel", () => { x0 = null; btn = null; });
  marks.querySelectorAll("button").forEach((b) => b.addEventListener("click", (ev) => { if (ev.detail === 0) goto(b.dataset.f); }));   // 键盘上按回车、空格
}
veil.addEventListener("click", () => toolsOpen(false));
tools.querySelector(".grip").addEventListener("click", () => toolsOpen(false));
addEventListener("keydown", (ev) => {                                  // 键盘：左右箭头换家具，开着盒的时候是转扇子；回车打开抽出来的牌盒、翻开立着的那张；Esc 合上
  const open = S.state === "open", tag = document.activeElement && document.activeElement.tagName;
  if (ev.key === "Escape") { if (open) closeBox(); else toolsOpen(false); }
  else if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") { const d = ev.key === "ArrowRight" ? 1 : -1; if (open) boxView.nudge(d); else step(d); }
  else if (ev.key === "Enter" && tag !== "BUTTON" && tag !== "A") { if (open) flipCard(); else if (S.state === "out") openBox(); }
});
$("#b-read").addEventListener("click", () => { au(true); readOn(); });
$("#b-done").addEventListener("click", () => { au(true); setStatus("done"); });
$("#b-todo").addEventListener("click", () => { au(true); setStatus("todo"); });
$("#b-back").addEventListener("click", () => { au(true); putBack(); });
$("#b-close").addEventListener("click", () => { au(true); closeBox(); });
$("#snd").addEventListener("click", () => { AU.on = !AU.on; try { localStorage.setItem("lab-pack-snd", AU.on ? "1" : "0"); } catch (e) { /* 忽略 */ } if (AU.on) { au(true); SFX.tick({ t: 2.5 }); } ui(); });
function onResize() {
  if (S.state !== "idle") { S.needFit = true; const A = avail(); renderer.setSize(A.vw, A.vh, false); camera.aspect = A.vw / A.vh; camera.updateProjectionMatrix(); if (S.state === "open") boxView.relayout(); return; }
  S.needFit = false; layoutFit(); { const want = cellPx(); if (want > atlas.ch * 1.25 || want < atlas.ch * .6) buildBooks(); }   // 书在屏上的大小变了不少（转屏），书脊按新的大小重画
  snapToSlots(); setDividers(true); setLabels(true); ui();
}
addEventListener("resize", onResize);

/* ---------- 帧 ---------- */
let devEl = null; if (DEV) { devEl = document.createElement("div"); devEl.className = "dev"; document.body.appendChild(devEl); }
let last = performance.now(), fps = 60;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(.05, (now - last) / 1000); last = now; fps = lerp(fps, 1 / Math.max(raw, 1e-3), .05);
  if (!S.manual) tick(raw);
  if (!PR.pin && PR.cur > 1.5 && S.t > 2) {                       // 开头两秒在编译、传图，不算
    PR.slow = raw > 1 / 38 ? PR.slow + raw : Math.max(0, PR.slow - raw * 2);
    if (PR.slow > 1.2) { PR.cur = PR.cur > 2 ? 2 : 1.5; PR.slow = 0; renderer.setPixelRatio(PR.cur); renderer.setSize(innerWidth, innerHeight, false); }
  }
}
function tick(raw) {
  const dt = S.fast && S.state === "enter" ? raw * 6 : raw;
  S.t += raw; S.shake *= Math.exp(-10 * raw); S.yaw += (S.yawT - S.yaw) * (1 - Math.exp(-14 * raw));
  if (S.needFit && S.state === "idle") onResize();          // 转屏、改窗口大小要是赶上动画，等回到看全再重排
  stepTracks(dt); placeCamera(raw); applyBooks(raw); if (boxView) boxView.step(raw); placeLabels();
  renderer.render(scene, camera);
  if (devEl) devEl.textContent = S.state + " · " + K.name + " " + N + " " + K.unit + " · " + S.W + "cm × " + S.R + " 层\n" + fps.toFixed(0) + " fps · " + renderer.info.render.calls + " calls · 画布 ×" + PR.cur + " · 书脊格 " + atlas.cw + "×" + atlas.ch;
}

/* ---------- 开场 ---------- */
window.__lab = {
  S, P, get state() { return S.state; }, get books() { return books; }, get L() { return L; }, counts, rectOf,
  hot: setHot, pull: pullOut, back: putBack, mark: setStatus, read: readOn, arrange, count: rebuild, tools: toolsOpen, setMark, PR, get atlas() { return atlas; },
  get kind() { return S.kind; }, goto, KINDS, openBox, closeBox, flipCard, heroRect, get box() { return boxView; }, get OB() { return OB; },
  manual(on) { S.manual = !!on; }, step(sec) { let t = sec; while (t > 1e-6) { const d = Math.min(1 / 60, t); tick(d); t -= d; } },
};
whenReady().then(() => { NB = [40, 120, 300].includes(+Q.get("n")) ? +Q.get("n") : 40; setKind(MULTI && KINDS[Q.get("f")] ? Q.get("f") : "shelf"); enter(); requestAnimationFrame(frame); });   // 等木纹布纹的图到了再上架（最多等一秒半）
