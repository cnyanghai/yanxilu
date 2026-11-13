/* 书架样机（灰盒）。回答一件事：打开书架那一眼，能不能不数就知道有多少书、读过多少；外加手指划过书脊、抽一本出来的手感。
 * 外观是占位的，不在这里讨论。拆包那一轮用户定了「热闹」，这里的节拍照那个力度来。
 *
 * 节拍：
 *   1 上架   空架子先到，书一本本从外面推进去（多少本都是一秒出头），镜头同时往后退到看全；点一下屏幕快进
 *   2 看全   整座架子永远装进一屏：本数多了架子自己加宽加层。读没读只靠物件的样子说：
 *            没读的包着白纸（浅），读过的露出本来的布面（深），在读的探出来一截、顶上露一枚签
 *   3 划过   手指按住在书脊上划，碰到哪本哪本探头（一本一声一震），手指上方的小签报书名
 *   4 抽出   松手，那本滑出来、转过封面飞到眼前；左右拖动转着看；底下可以改「没读 / 在读 / 读过」
 *   5 放回   点「放回去」或点空白：飞回去、推进去一声闷响；按读没读放时，改过状态的书回到新的位置，别的书让位
 *   6 换排法 「按类放 / 按读没读放」：整面书一起飞到新位置
 *
 * 结构：书是一个 InstancedMesh（三百本也只画两三次），书脊的字画在一张图集上；抽出来的那一本换成单独的模型，贴图另画一张清楚的。
 * 动画轨、声音、舞台、书的样子、架子在 kit.js（和进门样机共用）。
 * 字（书名签、层板签、底下的纸）用网页排；声音是 WebAudio 现场合成的，没有音频文件。书名、作者都是编的。
 * 调试：地址加 ?dev 显示帧率与状态，?n=300 直接进三百本；window.__lab 给测试脚本用。 */
import { THREE, clamp, lerp, rad, E, vib, rng, createTracks, createAudio, createStage, lightCase, createBookKit, createCase, drawSpine, grainOver, LOOK, DIM, TONES, PALE, INK_LT, INK_SOFT, CJK, STN, MASK, foil, weave, whenReady } from "./kit.js";   // 公用零件：动画轨、声音、舞台、书的样子、架子

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
  sway: .012,                  // 镜头一直在轻轻左右晃的幅度（弧度），0 是不晃
  shake: .5,                   // 推回去那一下镜头的震（厘米）
};

/* ---------- 尺寸（一个单位是一厘米） ---------- */
const { SH, BT, ST, CD, PL } = DIM;                 // 层高（净）、层板厚、侧板厚、柜深、踢脚高（架子在 kit.js）
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
      title, by: SUR[Math.floor(r() * SUR.length)] + GIV[Math.floor(r() * GIV.length)], pages, cat: c, st: r() < .37 ? "done" : "todo", prog: 0,
      t: clamp(1 + pages * .0062, 1.2, 5.8), h, d: h * (.63 + r() * .06),          // 厚（跟页数走）、高、深
      px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, k: 1, pop: 0, popT: 0, out: 0, outT: 0, hero: false,
    });
  }
  const nd = Math.max(2, Math.round(n * .025));                                    // 在读的只有几本
  for (let k = 0; k < nd; k++) { const b = out[Math.floor(r() * n)]; b.st = "doing"; b.prog = .15 + r() * .7; }
  out.sort((a, b) => a.cat - b.cat); out.forEach((b, i) => { b.i = i; });
  return out;
}

/* ---------- 渲染器、镜头、光（kit.js） ---------- */
const canvas = $("#gl");
const { renderer, scene, camera, key, maxAniso } = createStage(canvas);
const CAM = { dist: 300, y: 80, fov: 34, k: 1, wpp: 1 };

/* ---------- 状态 ---------- */
const S = {
  state: "boot", arr: "topic", W: 80, R: 4, hot: -1, cur: -1, outReady: false, yaw: 0, yawT: 0, fast: false, manual: false,
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
  mark(st) { (st === "done" ? [523, 659, 784, 1047] : st === "doing" ? [523, 784] : [330]).forEach((f, i) => tone({ f, dur: .3, gain: .1, when: i * .06 })); },
};

/* ---------- 书：样子在 kit.js（书脊图集、实例化的盒子），这里只管这一页的这一批 ---------- */
const { paperMat, tabMat, unitBox, makeAtlas, makeMesh } = createBookKit(maxAniso);
let atlas = null, books3d = null, tabs = null;
function buildBooks() {
  if (books3d) { scene.remove(books3d, tabs); books3d.geometry.dispose(); books3d.dispose(); tabs.dispose(); atlas.dispose(); }
  atlas = makeAtlas(books); books3d = makeMesh(books, atlas);
  tabs = new THREE.InstancedMesh(unitBox, tabMat, N); tabs.castShadow = true; tabs.frustumCulled = false;
  scene.add(books3d, tabs);
}

/* ---------- 抽出来的那一本：单独的模型，封面和书脊另画清楚的 ---------- */
const hero = new THREE.Group(); hero.visible = false; scene.add(hero);
const hFrontC = document.createElement("canvas"); hFrontC.width = 384; hFrontC.height = 576;
const hSpineC = document.createElement("canvas"); hSpineC.width = 128; hSpineC.height = 576;
const hFrontT = new THREE.CanvasTexture(hFrontC), hSpineT = new THREE.CanvasTexture(hSpineC);
[hFrontT, hSpineT].forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; });
const hmFront = new THREE.MeshStandardMaterial({ map: hFrontT, roughness: LOOK.bookRough }), hmSpine = new THREE.MeshStandardMaterial({ map: hSpineT, roughness: LOOK.bookRough }), hmBack = new THREE.MeshStandardMaterial({ roughness: LOOK.bookRough });
// 旧书房：封面和书脊各另画一张「哪里是金」的图，金的地方反环境光；布面再加布纹的凹凸。别的外观没有环境光，这几行什么都不做
const hFrontM = document.createElement("canvas"); hFrontM.width = hFrontC.width; hFrontM.height = hFrontC.height;
const hSpineM = document.createElement("canvas"); hSpineM.width = hSpineC.width; hSpineM.height = hSpineC.height;
const hFrontMT = new THREE.CanvasTexture(hFrontM), hSpineMT = new THREE.CanvasTexture(hSpineM);
const GILT = foil(hmFront, hFrontMT) && foil(hmSpine, hSpineMT);
const heroBody = new THREE.Mesh(unitBox, [hmFront, hmBack, paperMat, paperMat, hmSpine, paperMat]); heroBody.castShadow = true; hero.add(heroBody);
const heroTab = new THREE.Mesh(unitBox, tabMat); hero.add(heroTab);
function drawFront(g, w, h, b, mask) {                 // 封面跟着外观走：灰盒和纸模是两道框，玩具盒下面一截换色，旧书房读过的烫金、没读的捆麻绳。mask：只画「哪里是金」
  const todo = b.st === "todo", K = LOOK.spine, F = LOOK.font, ink = mask ? MASK.gilt : todo ? INK_SOFT : (LOOK.gilt || INK_LT), wt = K === "toy" ? "900 " : "700 ";
  g.fillStyle = mask ? (todo ? MASK.paper : MASK.cloth) : todo ? PALE : TONES[b.cat]; g.fillRect(0, 0, w, h);
  if (mask && todo) return;                               // 包着纸的没有金
  if (K === "toy") { g.fillStyle = todo ? LOOK.pale2 : LOOK.tones2[b.cat]; g.fillRect(0, h * .78, w, h * .22); }
  else if (K === "study" && todo) { g.fillStyle = LOOK.twine; g.fillRect(0, h * .2, w, 5); g.fillRect(0, h * .8, w, 5); g.fillRect(w * .3, 0, 5, h); }
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
function heroSetup(b) {
  drawFront(hFrontC.getContext("2d"), hFrontC.width, hFrontC.height, b); hFrontT.needsUpdate = true;
  drawSpine(hSpineC.getContext("2d"), 0, 0, hSpineC.width, hSpineC.height, b); grainOver(hSpineC.getContext("2d"), 0, 0, hSpineC.width, hSpineC.height, b.st === "todo"); hSpineT.needsUpdate = true;
  hmBack.color.set(b.st === "todo" ? PALE : TONES[b.cat]);
  if (GILT) { drawFront(hFrontM.getContext("2d"), hFrontM.width, hFrontM.height, b, true); hFrontMT.needsUpdate = true; drawSpine(hSpineM.getContext("2d"), 0, 0, hSpineM.width, hSpineM.height, b, false, true); hSpineMT.needsUpdate = true; }
  const cloth = b.st !== "todo"; weave(hmFront, b.d, b.h, cloth); weave(hmBack, b.d, b.h, cloth); weave(hmSpine, b.t, b.h, cloth);
  heroBody.scale.set(b.t, b.h, b.d);
  heroTab.visible = b.st === "doing"; heroTab.scale.set(b.t * .62, 2.6, .14); heroTab.position.set(0, b.h / 2 + .55, b.d / 2 + .05);
  hero.visible = true;
}
// 抽出来以后压暗后面的书架
const dim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: LOOK.veil, transparent: true, opacity: 0, depthWrite: false }));
dim.renderOrder = 5; dim.visible = false; scene.add(dim);

/* ---------- 排书：按顺序从左到右、一层放满换下一层 ---------- */
function pack(arr, W) {
  const slots = new Array(N), rows = [[]], divs = [], heads = []; let x = -W / 2 + PAD, r = 0;
  const nl = () => { r++; rows.push([]); x = -W / 2 + PAD; };
  const put = (b) => { if (x + b.t > W / 2 - PAD && rows[r].length) nl(); slots[b.i] = { r, x: x + b.t / 2 }; rows[r].push(b.i); x += b.t + GAPB; };
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
function slotPos(i) { const b = books[i], s = L.slots[i]; return { x: s.x, y: rowY(s.r) + b.h / 2, z: -RECESS - b.d / 2 }; }
function chooseW(aspect) {                                       // 架子的宽和层数跟着屏幕的形状走：两种排法都放得下、整座正好装进一屏；最底下一层别只剩零星几本
  let best = null;
  for (let W = 36; W <= 460; W += 2) {
    const a1 = pack("topic", W), a2 = pack("state", W), big = a2.R > a1.R ? a2 : a1, R = big.R;
    const lastFill = big.rows[R - 1].reduce((sum, bi) => sum + books[bi].t, 0) / W;
    const a = (W + 2 * ST) / (R * (SH + BT) + BT + PL), sc = Math.abs(Math.log(a / aspect)) + .6 * Math.max(0, .5 - lastFill);
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
function avail() {
  const vw = innerWidth, vh = innerHeight, portrait = vh >= vw, top = portrait ? 62 : 58, bot = portrait ? 140 : 124, side = portrait ? 12 : 28;
  return { vw, vh, top, bot, side, w: vw - 2 * side, h: vh - top - bot };
}
function fitCam() {
  const A = avail(), tanH = Math.tan(rad(CAM.fov / 2)), asp = A.vw / A.vh;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(A.vw, A.vh, false);
  camera.fov = CAM.fov; camera.aspect = asp;
  CAM.dist = Math.max(caseH / (2 * tanH * (A.h / A.vh)), caseW / (2 * tanH * asp * (A.w / A.vw)));
  CAM.wpp = 2 * CAM.dist * tanH / A.vh;                              // 架子正面上，屏幕一个像素是多少厘米
  CAM.y = caseH / 2 - ((A.bot - A.top) / 2) * CAM.wpp;               // 底下的按钮比顶上占得多，架子往上让一点
  camera.near = 4; camera.far = CAM.dist + 1200; camera.updateProjectionMatrix();
  lightCase(key, caseW, caseH);
}
function placeCamera(raw) {
  const k = 1 - Math.exp(-6 * raw); S.par.x += (S.par.tx - S.par.x) * k; S.par.y += (S.par.ty - S.par.y) * k;
  const d = CAM.dist * CAM.k, sw = Math.sin(S.t * .45) * P.sway * (S.state === "out" || S.state === "back" ? .3 : 1);
  const sx = S.shake * Math.sin(S.t * 71), sy = S.shake * Math.cos(S.t * 57);
  camera.position.set(Math.sin(sw) * d + S.par.x * d * .035 + sx, CAM.y - S.par.y * d * .02 + sy, Math.cos(sw) * d);
  camera.lookAt(0, CAM.y, 0); camera.updateMatrixWorld();
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
  const b = books[i], z = b.pz + b.d / 2 + b.out * P.doingZ + b.pop * P.popZ, a = screenOf(b.px - b.t / 2, b.py + b.h / 2, z), c = screenOf(b.px + b.t / 2, b.py - b.h / 2, z);
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
    _e.set(b.rx + b.pop * P.popTilt, b.ry, b.rz);
    if (b.hero) {
      if (S.state === "out" && S.outReady) { _e.y += S.yaw; _e.z += Math.sin(S.t * 1.1) * .012; _p.y += Math.sin(S.t * 1.7) * .2; }
      hero.position.copy(_p); hero.quaternion.setFromEuler(_e); hero.scale.setScalar(b.k);
      books3d.setMatrixAt(b.i, _zero); tabs.setMatrixAt(b.i, _zero); continue;
    }
    _q.setFromEuler(_e); _m.compose(_p, _q, _s.set(b.k, b.k, b.k));
    _m2.copy(_m).scale(_s.set(b.t, b.h, b.d)); books3d.setMatrixAt(b.i, _m2);
    if (b.st === "doing") { _m2.copy(_m).multiply(_t.makeTranslation(0, b.h / 2 + .55, b.d / 2 + .05)).scale(_s.set(b.t * .62, 2.6, .14)); tabs.setMatrixAt(b.i, _m2); }
    else tabs.setMatrixAt(b.i, _zero);
  }
  books3d.instanceMatrix.needsUpdate = true; tabs.instanceMatrix.needsUpdate = true;
}
function snapToSlots() { books.forEach((b) => { const sp = slotPos(b.i); b.px = sp.x; b.py = sp.y; b.pz = sp.z; b.rx = b.ry = b.rz = 0; b.k = 1; b.outT = b.st === "doing" ? 1 : 0; }); }

/* ---------- 界面 ---------- */
const hint = $("#hint"), foot = $("#foot"), sheet = $("#sheet"), tip = $("#tip"), labs = $("#labs");
function ui() {
  const c = counts(), out = S.state === "out" || S.state === "back";
  hint.innerHTML = S.state === "enter" || S.state === "boot" ? "正在上架…"
    : "共 <b>" + N + "</b> 本：深的读过 <b>" + c.done + "</b> · 探出来的在读 <b>" + c.doing + "</b> · 浅的没读 <b>" + c.todo + "</b><br>手指按在书脊上划，松手就抽出那一本";
  foot.classList.toggle("off", out); sheet.classList.toggle("on", S.state === "out");
  document.querySelectorAll("#seg-arr button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.arr === S.arr)));
  document.querySelectorAll("#seg-n button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.n === N)));
  const cur = books[S.cur];
  if (cur) {
    $("#s-title").textContent = cur.title;
    $("#s-meta").textContent = cur.by + " · " + cur.pages + " 页 · " + CATS[cur.cat] + (cur.st === "doing" ? " · 读到 " + Math.round(cur.prog * 100) + "%" : "");
    document.querySelectorAll("#seg-st button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.st === cur.st)));
  }
  $("#snd").setAttribute("aria-pressed", String(AU.on));
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
  tip.firstElementChild.textContent = b.title; tip.lastElementChild.textContent = b.by + " · " + STN[b.st];
  tip.classList.add("on"); moveTip(x, y);
}
function moveTip(x, y) {
  const w = tip.offsetWidth, h = tip.offsetHeight, tx = clamp(x - w / 2, 8, innerWidth - w - 8), ty = y - h - 46 < 56 ? y + 36 : y - h - 46;
  tip.style.transform = "translate(" + Math.round(tx) + "px," + Math.round(ty) + "px)";
}

/* ---------- 节拍 ---------- */
function layoutFit() { const A = avail(), best = chooseW(A.w / A.h); S.W = best.W; S.R = best.R; L = pack(S.arr, S.W); buildCase(S.W, S.R); fitCam(); }
function rebuild(n) {
  clearTracks(); N = n; books = makeBooks(n); S.hot = S.cur = -1; S.outReady = false; S.yaw = S.yawT = 0; hero.visible = false; dim.visible = false; tip.classList.remove("on");
  buildBooks(); layoutFit(); setDividers(false); setLabels(false); enter();
}
function enter() {
  S.state = "enter"; S.fast = false;
  books.forEach((b) => { const sp = slotPos(b.i); b.px = sp.x; b.py = sp.y; b.pz = sp.z + P.enterZ; b.k = 0; b.rx = b.ry = b.rz = 0; b.pop = b.popT = b.out = b.outT = 0; b.hero = false; });
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
  if (S.state !== "idle" || a === S.arr) return;
  setHot(-1); S.arr = a; S.state = "sort"; L = pack(a, S.W); setDividers(false); setLabels(false); SFX.sort(); ui();
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
  b.pz += b.out * P.doingZ + b.pop * P.popZ; b.rx = b.pop * P.popTilt; b.py += b.pop * .35; b.pop = b.popT = b.out = b.outT = 0;
  heroSetup(b); b.hero = true;
  const I = inspectPose(b), x0 = b.px, y0 = b.py, z0 = b.pz, rx0 = b.rx, zs = -RECESS + b.d / 2 + 2.5;
  dim.position.set(0, CAM.y, I.z - 16); { const hh = 2 * (I.di + 16) * Math.tan(rad(CAM.fov / 2)) * 1.7; dim.scale.set(hh * Math.max(1, innerWidth / innerHeight) * 1.4, hh, 1); }
  dim.material.opacity = 0; dim.visible = true;
  SFX.out(); vib(8); ui();
  play(P.outSlide, (e) => { b.pz = lerp(z0, zs, e); b.rx = lerp(rx0, 0, e); }, { ease: E.in2, done() {
    play(.3, (e) => { dim.material.opacity = .62 * e; }, { ease: E.lin });
    play(P.outFly, (e, kk) => { b.px = lerp(x0, I.x, e); b.py = lerp(y0, I.y, e); b.pz = lerp(zs, I.z, e); b.ry = lerp(0, I.ry, E.out3(kk)); }, { ease: E.back, done() { S.outReady = true; SFX.shown(); } });
  } });
}
function setStatus(st) {
  const b = books[S.cur]; if (S.state !== "out" || !b || b.st === st) return;
  b.st = st; if (st === "doing" && !(b.prog > 0 && b.prog < 1)) b.prog = .08; if (st === "done") b.prog = 1; if (st === "todo") b.prog = 0;
  atlas.redraw(b); heroSetup(b);
  play(.3, (e, kk) => { b.k = 1 + Math.sin(Math.PI * kk) * .07; }, { ease: E.lin });
  SFX.mark(st); vib(8); ui();
}
function putBack() {
  if (S.state !== "out" || !S.outReady) return;
  const b = books[S.cur]; S.state = "back"; S.outReady = false; ui();
  let pending = 2, refit = false;
  const fin = () => { if (--pending) return; if (refit) { layoutFit(); snapToSlots(); } S.state = "idle"; setDividers(true); setLabels(true); ui(); };
  // 状态改过、又是按读没读放：这本要去新的位置，别的书先让位
  if (S.arr === "state" && b.st !== b.st0) { L = pack("state", S.W); refit = L.R > S.R; setDividers(false); setLabels(false); if (refit) fin(); else flyToSlots(fin, b.i, true); }
  else fin();
  const sp = refit ? { x: b.px, y: b.py - 40, z: b.pz - 60 } : slotPos(b.i), x0 = b.px, y0 = b.py, z0 = b.pz, ry0 = b.ry + S.yaw, zf = sp.z + b.d + 3.5;
  S.yaw = S.yawT = 0; b.ry = ry0; b.outT = b.st === "doing" ? 1 : 0;
  SFX.back(); play(.25, (e) => { dim.material.opacity = .62 * (1 - e); }, { ease: E.lin, done() { dim.visible = false; } });
  play(P.backFly, (e) => { b.px = lerp(x0, sp.x, e); b.py = lerp(y0, sp.y, e); b.pz = lerp(z0, zf, e); b.ry = lerp(ry0, 0, e); }, { ease: E.io3, done() {
    play(P.backPush, (e) => { b.pz = lerp(zf, sp.z, e); }, { ease: E.in2, done() {
      b.hero = false; hero.visible = false; b.ry = 0; S.cur = -1; SFX.thud(); vib(12); S.shake = P.shake;
      const row = L.rows[L.slots[b.i].r], k = row.indexOf(b.i); [k - 1, k + 1].forEach((j) => { const nb = books[row[j]]; if (nb) nb.pop = .3; });   // 左右两本跟着顿一下
      fin();
    } });
  } });
}

/* ---------- 手指 ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(cx, cy) {                                        // 手指底下是哪一本：先落到书脊那个平面上，再按层、按左右找最近的
  ndc.set(cx / innerWidth * 2 - 1, 1 - cy / innerHeight * 2); ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction; if (Math.abs(d.z) < 1e-6) return -1;
  const t = (-RECESS - o.z) / d.z, x = o.x + d.x * t, y = o.y + d.y * t;
  const r = S.R - 1 - Math.floor((y - PL) / (SH + BT)), row = L.rows[r]; if (!row) return -1;
  let best = -1, bd = Math.max(.8, 7 * CAM.wpp);
  for (const bi of row) { const dd = Math.abs(x - L.slots[bi].x) - books[bi].t / 2; if (dd < bd) { bd = dd; best = bi; } }
  return best;
}
const G = { id: -1, x0: 0, y0: 0, t0: 0, moved: 0, mode: "" };
canvas.addEventListener("pointerdown", (ev) => {
  au(true); if (G.id !== -1) return;
  G.id = ev.pointerId; G.x0 = ev.clientX; G.y0 = ev.clientY; G.t0 = performance.now(); G.moved = 0; G.mode = "";
  try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
  if (S.state === "enter") S.fast = true;
  else if (S.state === "idle") { S.state = "scrub"; G.mode = "scrub"; setHot(pick(ev.clientX, ev.clientY), ev.clientX, ev.clientY); }
  else if (S.state === "out") G.mode = "spin";
});
canvas.addEventListener("pointermove", (ev) => {
  if (ev.pointerType === "mouse") { S.par.tx = ev.clientX / innerWidth * 2 - 1; S.par.ty = ev.clientY / innerHeight * 2 - 1; }
  if (G.id === -1) { if (ev.pointerType === "mouse" && S.state === "idle") setHot(pick(ev.clientX, ev.clientY), ev.clientX, ev.clientY); return; }   // 鼠标不用按住，移过去就探头
  if (ev.pointerId !== G.id) return;
  G.moved = Math.max(G.moved, Math.hypot(ev.clientX - G.x0, ev.clientY - G.y0));
  if (G.mode === "scrub" && S.state === "scrub") setHot(pick(ev.clientX, ev.clientY), ev.clientX, ev.clientY);
  else if (G.mode === "spin" && S.state === "out") S.yawT = clamp((ev.clientX - G.x0) * .012, -2.6, 2.6);
});
function endPointer(ev) {
  if (ev.pointerId !== G.id) return; G.id = -1;
  const cancel = ev.type === "pointercancel";
  if (G.mode === "scrub" && S.state === "scrub") { const i = S.hot; S.state = "idle"; if (i >= 0 && !cancel) pullOut(i); else setHot(-1); }
  else if (G.mode === "spin" && S.state === "out") { S.yawT = 0; if (!cancel && G.moved < 8 && performance.now() - G.t0 < 450) putBack(); }
  G.mode = "";
}
canvas.addEventListener("pointerup", endPointer); canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerleave", (ev) => { if (ev.pointerType === "mouse" && G.id === -1 && S.state === "idle") setHot(-1); });
document.querySelectorAll("#seg-arr button").forEach((b) => b.addEventListener("click", () => { au(true); arrange(b.dataset.arr); }));
document.querySelectorAll("#seg-n button").forEach((b) => b.addEventListener("click", () => { au(true); if (S.state === "idle" && +b.dataset.n !== N) rebuild(+b.dataset.n); }));
document.querySelectorAll("#seg-st button").forEach((b) => b.addEventListener("click", () => { au(true); setStatus(b.dataset.st); }));
$("#b-back").addEventListener("click", () => { au(true); putBack(); });
$("#snd").addEventListener("click", () => { AU.on = !AU.on; try { localStorage.setItem("lab-pack-snd", AU.on ? "1" : "0"); } catch (e) { /* 忽略 */ } if (AU.on) { au(true); SFX.tick({ t: 2.5 }); } ui(); });
function onResize() {
  if (S.state !== "idle") { S.needFit = true; const A = avail(); renderer.setSize(A.vw, A.vh, false); camera.aspect = A.vw / A.vh; camera.updateProjectionMatrix(); return; }
  S.needFit = false; layoutFit(); snapToSlots(); setDividers(true); setLabels(true); ui();
}
addEventListener("resize", onResize);

/* ---------- 帧 ---------- */
let devEl = null; if (DEV) { devEl = document.createElement("div"); devEl.className = "dev"; document.body.appendChild(devEl); }
let last = performance.now(), fps = 60;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(.05, (now - last) / 1000); last = now; fps = lerp(fps, 1 / Math.max(raw, 1e-3), .05);
  if (!S.manual) tick(raw);
}
function tick(raw) {
  const dt = S.fast && S.state === "enter" ? raw * 6 : raw;
  S.t += raw; S.shake *= Math.exp(-10 * raw); S.yaw += (S.yawT - S.yaw) * (1 - Math.exp(-14 * raw));
  if (S.needFit && S.state === "idle") onResize();          // 转屏、改窗口大小要是赶上动画，等回到看全再重排
  stepTracks(dt); placeCamera(raw); applyBooks(raw); placeLabels();
  renderer.render(scene, camera);
  if (devEl) devEl.textContent = S.state + " · " + N + " 本 · " + S.W + "cm × " + S.R + " 层\n" + fps.toFixed(0) + " fps · " + renderer.info.render.calls + " calls";
}

/* ---------- 开场 ---------- */
window.__lab = {
  S, P, get state() { return S.state; }, get books() { return books; }, get L() { return L; }, counts, rectOf,
  hot: setHot, pull: pullOut, back: putBack, mark: setStatus, arrange, count: rebuild,
  manual(on) { S.manual = !!on; }, step(sec) { let t = sec; while (t > 1e-6) { const d = Math.min(1 / 60, t); tick(d); t -= d; } },
};
whenReady().then(() => { rebuild([40, 120, 300].includes(+Q.get("n")) ? +Q.get("n") : 120); requestAnimationFrame(frame); });   // 等木纹布纹的图到了再上架（最多等一秒半）
