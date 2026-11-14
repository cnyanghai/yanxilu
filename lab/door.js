/* 进门样机（灰盒）。回答一件事：点开别人的链接，三秒能不能看懂他在学什么；看中了，一个动作带走一排。
 * 外观是占位的，不在这里讨论。节拍照拆包那一轮定的「热闹」的力度来。人名、那句话、书名都是编的。
 *
 * 节拍：
 *   1 到     点开链接，书架直接在眼前；屏幕顶上是「谁的书房」和他自己写的一句话（从头到尾都在）
 *   2 看懂   一座书架，一排一个科目；层板边上的签一枚枚冒出来（科目、多少本、读过多少），那一排书跟着抖一下。
 *            读没读和书架样机同一套：腰封还在的没读、摘了的读过、探出来带签的在读（灰盒：浅的没读、深的读过）。最下面一层是他的牌盒和本子（样机里只是摆着）
 *   3 划过   手指按在书脊上左右划，碰到哪本哪本探头、报书名（只是看，不抽出来）
 *   4 带走   按住一排往下拉：这一排的一份（都带着腰封，到你手里都是没读的；灰盒是包着白纸）跟着手指一本本从架上出来，一本一声一震；
 *            拉到底就带走，过了六成松手也带走，没到就弹回去。捆成一捆飞进底下的邮包。原来的书还在他的架上。
 *            层板上那枚签点一下，也是带走这一排
 *   5 邮包   点邮包看带走了什么；可以倒回去重来
 *
 * 结构：动画轨、声音、舞台、书的样子、架子都在 kit.js（和书架样机共用）；这里是门、这一位主人的书、带走的手势。
 * 进法：2026-11-12 用户在手机上两种都试过，定「直接到」，不要敲门那一段。敲门进（一扇门、门牌、敲两下、门开、镜头穿过门）
 *   留在代码里对照用，地址加 ?way=knock 才走，页面上不再有切换。
 * 调试：地址加 ?dev 显示帧率与状态；window.__lab 给测试脚本用。 */
import { THREE, clamp, lerp, rad, E, vib, rng, createTracks, createAudio, createStage, lightCase, createBookKit, createCase, DIM, STN, CJK, PAPER, LOOK as SKIN, whenReady, chamferBox } from "./kit.js";

const Q = new URLSearchParams(location.search), DEV = Q.has("dev");
const $ = (s) => document.querySelector(s);

/* ---------- 手感参数（要调就调这张表） ---------- */
const P = {
  directLabels: .15, labelGap: .13,   // 到了以后签从什么时候开始冒、一枚隔多久
  knock1: .28, knock2: .5,       // 以下四行只有 ?way=knock 用：两下敲门各在什么时候
  open: .74, openDur: .42,       // 门什么时候开、开多久
  push: .9, pushDur: .95,        // 镜头什么时候进门、走多久
  labels: 1.5,                   // 敲门进：签从什么时候开始冒
  pullPx: 150,                   // 往下拉多少像素算拉到底
  commit: .6,                    // 拉过这个比例松手就带走，没到弹回去
  outZ: 4, dropMax: 46,          // 带走的那一份：出了书架再往外多少厘米、跟着手指最多往下走多少厘米
  hitStop: .07,                  // 拉到底那一下顿多久
  gather: .2, fly: .5, flyStagger: .09,   // 收拢成一捆、飞进邮包、先后错开
  popZ: 3.4, popTilt: .09, popUp: 30, popDown: 13, doingZ: 2.4,   // 和书架样机一样：探头多少、在读的常驻探出多少
  sway: .012, shake: .5,         // 镜头轻轻晃的幅度、震一下的幅度
};

/* ---------- 这位主人和他的书（编的） ---------- */
const OWNER = { name: "周知白", line: "明年九月上考场，先把刑法啃完。" };
const ROWS = [
  { name: "刑法", n: 22, read: .68, heads: ["总则", "分则", "罪名", "共犯", "量刑", "案例", "真题", "法条"] },
  { name: "民法", n: 25, read: .36, heads: ["物权", "合同", "侵权", "婚姻", "继承", "担保", "真题", "法条"] },
  { name: "诉讼法", n: 18, read: .17, heads: ["管辖", "证据", "程序", "执行", "仲裁", "真题", "法条", "期间"] },
  { name: "理论法", n: 20, read: 0, heads: ["法理", "宪法", "法史", "司法制度", "真题", "法条", "概念", "流派"] },
];
const TAILS = ["精讲", "笔记", "梳理", "三十讲", "背诵版", "错题", "图解", "串讲", "汇编", "百问"];
const PROPS = { packs: 5, notes: 2 };                    // 最下面一层：几包牌、几本笔记
const { SH, BT, ST, CD, PL } = DIM, PAD = .7, GAPB = .06, RECESS = 1;
function makeBooks() {
  const r = rng(20261112), out = [];
  ROWS.forEach((row, ri) => {
    const seen = new Set(); row.books = []; row.taken = false;
    for (let k = 0; k < row.n; k++) {
      let title; do { title = row.heads[Math.floor(r() * row.heads.length)] + TAILS[Math.floor(r() * TAILS.length)]; } while (seen.has(title)); seen.add(title);
      const pages = 140 + Math.floor(Math.pow(r(), 1.6) * 620), h = [21, 21, 23, 23, 24, 26][Math.floor(r() * 6)];
      const b = {
        title, pages, cat: ri, row: ri, st: r() < row.read ? "done" : "todo", t: clamp(1 + pages * .0062, 1.2, 5.4), h, d: h * (.63 + r() * .06),
        sx: 0, sy: 0, sz: 0, pop: 0, popT: 0, out: 0, outT: 0,                // 在架上的位置、探头、在读的探出
        cx: 0, cy: 0, cz: 0, crx: 0, crz: 0, ck: 0, tk: false,                // 带走的那一份：位置、倾斜、大小，这一本响过没有
      };
      row.books.push(b); out.push(b);
    }
  });
  ROWS[0].books[ROWS[0].n - 3].st = "doing"; ROWS[1].books[4].st = "doing";    // 在读的两本
  out.forEach((b, i) => { b.i = i; b.outT = b.st === "doing" ? 1 : 0; });
  return out;
}

/* ---------- 舞台、书、架子（kit.js） ---------- */
const canvas = $("#gl");
const { renderer, scene, camera, key, maxAniso } = createStage(canvas);
const { play, wait, step: stepTracks, clear: clearTracks } = createTracks();
const { AU, au, noise, tone, toggle: sndToggle } = createAudio();
const { tabMat, unitBox, makeAtlas, makeMesh } = createBookKit(maxAniso);
const caseKit = createCase(scene, unitBox);
const books = makeBooks(), N = books.length, R = ROWS.length + 1;
const atlas = makeAtlas(books, false, 256), paleAtlas = makeAtlas(books, true, 256);   // 他架上的样子；带走的那一份（都是没读的样子：旧书房带着腰封，灰盒包着白纸）。一格画 256 高：这一页的书在两倍屏上最高一百七八十像素，原来的 192 贴上去略微放大
const books3d = makeMesh(books, atlas), copies = makeMesh(books, paleAtlas);
const tabs = new THREE.InstancedMesh(unitBox, tabMat, N); tabs.castShadow = true; tabs.frustumCulled = false;
copies.receiveShadow = false; scene.add(books3d, tabs, copies);
// 排书：一排一个科目，从左往右
let W = 0;
ROWS.forEach((row) => { row.w = row.books.reduce((s, b) => s + b.t + GAPB, 0); W = Math.max(W, row.w); });
W = Math.ceil(W + 2 * PAD + 5);
const rowY = (r) => PL + BT + (R - 1 - r) * (SH + BT);                         // 第 r 层（从上往下数）层板的上表面
ROWS.forEach((row, r) => {
  let x = -W / 2 + PAD; row.x0 = x;
  row.books.forEach((b) => { b.sx = x + b.t / 2; b.sy = rowY(r) + b.h / 2; b.sz = -RECESS - b.d / 2; x += b.t + GAPB; });
  row.x1 = x; row.span = Math.max(1, row.x1 - row.x0);
});
const { w: caseW, h: caseH } = caseKit.build(W, R);
// 最下面一层：牌盒和本子，只是摆着
{
  const PR = SKIN.props || { pack: 0x3b2a20, band: 0xc9b089, bandH: 2.2, notes: [0x5e5a48, 0x6a4a3a] };     // 落选的两种样张没配摆设，用灰盒的
  const packMat = new THREE.MeshStandardMaterial({ color: PR.pack, roughness: .8 }), bandMat = new THREE.MeshStandardMaterial({ color: PR.band, roughness: .9 });
  const noteMats = PR.notes.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: .85 }));
  const y0 = rowY(R - 1); let x = -W / 2 + PAD + 1;
  const box = (w, h, d, px, py, pz, mat, rz) => { const m = new THREE.Mesh(unitBox, mat); m.scale.set(w, h, d); m.position.set(px, py, pz); if (rz) m.rotation.z = rz; m.castShadow = m.receiveShadow = true; scene.add(m); };
  const parcel = PR.bandH < 1 ? chamferBox(8.2, 12.4, 3.4, .22) : null;                                    // 旧书房：牌包是切了角的纸包
  for (let k = 0; k < PROPS.packs; k++) { if (parcel) { const m = new THREE.Mesh(parcel, packMat); m.position.set(x + 4.1, y0 + 6.2, -RECESS - 2.2); m.castShadow = m.receiveShadow = true; scene.add(m); } else box(8.2, 12.4, 3.4, x + 4.1, y0 + 6.2, -RECESS - 2.2, packMat); box(8.25, PR.bandH, 3.45, x + 4.1, y0 + 9.4, -RECESS - 2.2, bandMat); if (PR.bandH < 1) box(8.25, PR.bandH, 3.45, x + 4.1, y0 + 3, -RECESS - 2.2, bandMat); x += 8.8; }
  x += 7;
  for (let k = 0; k < PROPS.notes; k++) { box(1.9, 21, 15, x + 1 + (k ? 2.4 : 0), y0 + 10.4, -RECESS - 7.5, noteMats[k], k ? -.16 : 0); x += 2.2; }
}

/* ---------- 门（只有 ?way=knock 用）：一面墙开一个门洞，门扇上钉着门牌 ---------- */
const DW = 86, DH = 204, EYE = 150, LOOK = 110, PLW = 56, PLH = 30;   // 门宽、门高、门牌挂多高、门外镜头看多高、门牌的宽与高
const doorG = new THREE.Group(); scene.add(doorG);
const doorPivot = new THREE.Group(); doorPivot.position.set(-DW / 2, 0, 0); doorG.add(doorPivot);
{
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a3e35, roughness: 1 }), slabMat = new THREE.MeshStandardMaterial({ color: 0x7d6b5a, roughness: .9 }), darkMat = new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: .8 });
  const box = (parent, w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(unitBox, mat); m.scale.set(w, h, d); m.position.set(x, y, z); parent.add(m); return m; };
  [-1, 1].forEach((s) => { box(doorG, 400, 520, 8, s * (DW / 2 + 200), 260, 0, wallMat); box(doorG, 3, DH, 11, s * (DW / 2 + 1.5), DH / 2, 0, darkMat); });   // 门两边的墙、门框
  box(doorG, DW, 520 - DH, 8, 0, DH + (520 - DH) / 2, 0, wallMat); box(doorG, DW + 6, 3, 11, 0, DH + 1.5, 0, darkMat);                                      // 门上面的墙、门楣
  box(doorPivot, DW, DH, 4, DW / 2, DH / 2, 0, slabMat); box(doorPivot, 3, 3, 6, DW - 9, 100, 3, darkMat);                                                 // 门扇、把手
  const c = document.createElement("canvas"); c.width = 640; c.height = 344; const g = c.getContext("2d");      // 门牌上只有名字，那句话用网页排在屏幕顶上（小字画在贴图上看不清）
  g.fillStyle = PAPER; g.fillRect(0, 0, 640, 344); g.strokeStyle = "#3E1D00"; g.globalAlpha = .7; g.lineWidth = 6; g.strokeRect(16, 16, 608, 312); g.lineWidth = 2; g.strokeRect(30, 30, 580, 284); g.globalAlpha = 1;
  g.fillStyle = "#3E1D00"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "700 132px " + CJK; g.fillText(OWNER.name, 320, 150);
  g.fillRect(270, 236, 100, 3); g.font = "500 40px " + CJK; g.fillText("书 房", 320, 278);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(PLW, PLH), new THREE.MeshStandardMaterial({ map: t, roughness: .9 })); plate.position.set(DW / 2, EYE, 2.2); doorPivot.add(plate);
}

/* ---------- 状态 ---------- */
const S = {
  state: "boot", way: Q.get("way") === "knock" ? "knock" : "direct", ent: 0, lean: 0, hot: -1, pull: null, bag: [], fast: false, manual: false,
  t: 0, tEnter: 0, tIdle: 0, shake: 0, freeze: 0, lastTick: 0, par: { x: 0, y: 0, tx: 0, ty: 0 },
};
const CAM = { dist: 300, y: 80, fov: 34, wpp: 1, dz: 400, sd: 200 };
const SFX = {
  tick(b) { const f = 1500 - b.t * 165; tone({ f, f2: f * .82, dur: .07, gain: .13, type: "triangle" }); noise({ dur: .018, type: "highpass", f: 3000, gain: .06 }); },
  knock() { tone({ f: 190, f2: 90, dur: .09, gain: .5 }); noise({ dur: .05, type: "lowpass", f: 900, gain: .25 }); },
  open() { noise({ dur: .4, f: 300, f2: 1400, q: 1.4, gain: .14, attack: .05 }); tone({ f: 220, f2: 330, dur: .35, gain: .05, type: "triangle" }); },
  label(k) { const f = [523, 587, 659, 784, 880][k % 5]; tone({ f, dur: .16, gain: .09, type: "triangle" }); noise({ dur: .02, type: "highpass", f: 3000, gain: .05 }); },
  snap() { tone({ f: 150, f2: 46, dur: .22, gain: .6 }); noise({ dur: .16, f: 1500, f2: 400, q: .7, gain: .4 }); },
  fly() { noise({ dur: .42, f: 500, f2: 2400, q: 1, gain: .15, attack: .06 }); },
  land() { tone({ f: 110, f2: 50, dur: .18, gain: .5 }); [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: .3, gain: .1, when: .04 + i * .055 })); },
  back() { noise({ dur: .18, f: 1800, f2: 500, q: 1, gain: .1 }); },
  no() { tone({ f: 200, f2: 150, dur: .12, gain: .12, type: "triangle" }); },
};

/* ---------- 镜头：整座书架装进一屏（敲门进时先在门外，再走进来） ---------- */
function avail() {
  const vw = innerWidth, vh = innerHeight, portrait = vh >= vw, top = portrait ? 122 : 112, bot = portrait ? 178 : 156, side = portrait ? 12 : 28;
  return { vw, vh, top, bot, side, w: vw - 2 * side, h: vh - top - bot };
}
function fit() {
  const A = avail(), tanH = Math.tan(rad(CAM.fov / 2)), asp = A.vw / A.vh;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(A.vw, A.vh, false);
  camera.fov = CAM.fov; camera.aspect = asp;
  CAM.dist = Math.max(caseH / (2 * tanH * (A.h / A.vh)), caseW / (2 * tanH * asp * (A.w / A.vw)));
  CAM.wpp = 2 * CAM.dist * tanH / A.vh;                              // 架子正面上，屏幕一个像素是多少厘米
  CAM.y = caseH / 2 - ((A.bot - A.top) / 2) * CAM.wpp;
  CAM.dz = CAM.dist + 45;                                            // 门在进门后镜头位置的身后
  CAM.sd = Math.max((DW + 24) / (2 * tanH * asp), (DH + 30) / (2 * tanH));   // 门外站多远：整扇门连门框都在屏幕里，一眼看得出是门
  camera.near = 4; camera.far = CAM.dist + 1400; camera.updateProjectionMatrix();
  doorG.position.z = CAM.dz; lightCase(key, caseW, caseH);
}
function placeCamera(raw) {
  const k = 1 - Math.exp(-6 * raw); S.par.x += (S.par.tx - S.par.x) * k; S.par.y += (S.par.ty - S.par.y) * k;
  const e = S.ent, d = CAM.dist, sw = Math.sin(S.t * .45) * P.sway;
  const fx = Math.sin(sw) * d + S.par.x * d * .035, fy = CAM.y - S.par.y * d * .02, fz = Math.cos(sw) * d;   // 进了门以后站的位置
  const sx = S.shake * Math.sin(S.t * 71), sy = S.shake * Math.cos(S.t * 57);
  camera.position.set(lerp(0, fx, e) + sx, lerp(LOOK, fy, e) + sy, lerp(CAM.dz + CAM.sd - S.lean * 22, fz, e));          // 门外：正对着门，慢慢凑近一点
  camera.lookAt(0, lerp(LOOK, CAM.y, e), lerp(CAM.dz, 0, e)); camera.updateMatrixWorld();
}
const _v = new THREE.Vector3();
function screenOf(x, y, z) { _v.set(x, y, z).project(camera); return { x: (_v.x + 1) / 2 * innerWidth, y: (1 - _v.y) / 2 * innerHeight }; }
function rectOf(i) {
  const b = books[i], z = b.sz + b.d / 2 + b.out * P.doingZ + b.pop * P.popZ, a = screenOf(b.sx - b.t / 2, b.sy + b.h / 2, z), c = screenOf(b.sx + b.t / 2, b.sy - b.h / 2, z);
  return { l: a.x, t: a.y, r: c.x, b: c.y, cx: (a.x + c.x) / 2, cy: (a.y + c.y) / 2 };
}
function rowRect(r) { const row = ROWS[r], a = screenOf(row.x0, rowY(r) + 22, -RECESS), c = screenOf(row.x1, rowY(r), -RECESS); return { l: a.x, t: a.y, r: c.x, b: c.y, cx: (a.x + c.x) / 2, cy: (a.y + c.y) / 2 }; }

/* ---------- 每帧把书摆到位 ---------- */
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(0, 0, 0, "YXZ");
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _t = new THREE.Matrix4(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);
function applyBooks(raw) {
  for (const b of books) {
    b.pop += (b.popT - b.pop) * (1 - Math.exp(-(b.popT > b.pop ? P.popUp : P.popDown) * raw));
    b.out += (b.outT - b.out) * (1 - Math.exp(-10 * raw));
    _p.set(b.sx, b.sy + b.pop * .35, b.sz + b.out * P.doingZ + b.pop * P.popZ); _e.set(b.pop * P.popTilt, 0, 0);
    _q.setFromEuler(_e); _m.compose(_p, _q, _s.set(1, 1, 1));
    _m2.copy(_m).scale(_s.set(b.t, b.h, b.d)); books3d.setMatrixAt(b.i, _m2);
    if (b.st === "doing") { _m2.copy(_m).multiply(_t.makeTranslation(0, b.h / 2 + .55, b.d / 2 + .05)).scale(_s.set(b.t * .62, 2.6, .14)); tabs.setMatrixAt(b.i, _m2); }
    else tabs.setMatrixAt(b.i, _zero);
    copies.setMatrixAt(b.i, _zero);
  }
  // 带走的那一份：还在手里时跟着拉的进度走，离手指近的先出来；拉到底以后交给收拢和飞的动画
  const pl = S.pull;
  if (pl) {
    const row = ROWS[pl.r];
    if (S.state !== "take") {
      pl.p += (pl.pT - pl.p) * (1 - Math.exp(-26 * raw));
      row.books.forEach((b) => {
        const pj = clamp(pl.p * 1.6 - .6 * Math.abs(b.sx - pl.fx) / row.span), e = E.out3(pj);
        if (pj >= .5 && !b.tk) { b.tk = true; if (pl.pT > pl.p - .02 && S.t - S.lastTick > .016) { S.lastTick = S.t; SFX.tick(b); vib(3); } } else if (pj < .4) b.tk = false;
        b.cx = b.sx; b.cy = b.sy - pl.drop * e; b.cz = b.sz + (b.d + P.outZ) * e; b.crx = .1 * e; b.crz = 0; b.ck = pj > .02 ? 1 : 0;
      });
      if (pl.back && pl.p < .01) { S.pull = null; bag.classList.remove("aim"); }
      else if (S.state === "pull" && pl.p >= .985) commit();
    }
    row.books.forEach((b) => {
      if (!b.ck) return;
      _p.set(b.cx, b.cy, b.cz); _e.set(b.crx, 0, b.crz); _q.setFromEuler(_e);
      _m.compose(_p, _q, _s.set(b.t * b.ck, b.h * b.ck, b.d * b.ck)); copies.setMatrixAt(b.i, _m);
    });
  }
  books3d.instanceMatrix.needsUpdate = true; tabs.instanceMatrix.needsUpdate = true; copies.instanceMatrix.needsUpdate = true;
}

/* ---------- 界面 ---------- */
const hint = $("#hint"), owner = $("#owner"), bag = $("#bag"), bagN = $("#bag-n"), sheet = $("#sheet"), tip = $("#tip"), labs = $("#labs");
owner.firstElementChild.textContent = OWNER.name + "的书房"; owner.lastElementChild.textContent = OWNER.line;
const readOf = (row) => row.books.filter((b) => b.st === "done").length;
// 层板边上的签，贴在每一排上方的层板边上：科目、多少本、读过多少、「带走」
const labEls = ROWS.map((row, r) => {
  const el = document.createElement("button"); el.type = "button"; el.className = "lab";
  const nm = document.createElement("b"), tx = document.createElement("span"), go = document.createElement("i"); nm.textContent = row.name; go.textContent = "带走"; el.append(nm, tx, go);
  el.addEventListener("click", () => { au(true); takeRow(r); }); labs.appendChild(el); return { el, tx, r };
});
{ const el = document.createElement("div"); el.className = "lab plain"; el.textContent = "牌 " + PROPS.packs + " 包 · 笔记 " + PROPS.notes + " 本"; labs.appendChild(el); labEls.push({ el, tx: null, r: R - 1 }); }
function placeLabels() {
  labEls.forEach(({ el, r }) => { const p = screenOf(-W / 2 + PAD, rowY(r) + SH + BT / 2, 0); el.style.transform = "translate(" + Math.round(p.x) + "px," + Math.round(p.y) + "px) translateY(-50%)"; });
}
function ui() {
  const booksIn = S.bag.reduce((s, r) => s + ROWS[r].n, 0), pl = S.pull;
  labEls.forEach(({ el, tx, r }) => { if (!tx) return; const row = ROWS[r]; tx.textContent = row.taken ? "已在你包里" : row.n + " 本 · 读过 " + readOf(row); el.classList.toggle("taken", row.taken); });
  bagN.textContent = S.bag.length ? S.bag.length + " 排 · " + booksIn + " 本" : "空的"; bag.classList.toggle("full", S.bag.length > 0);
  hint.textContent = S.state === "door" ? (S.way === "knock" && S.ent < .5 ? "到了：" + OWNER.name + "的书房" : SKIN.bind ? "一排一个科目，腰封还在的是他没读的" : "一排一个科目，深的是他读过的")
    : S.state === "pull" ? (pl && pl.pT >= P.commit ? "松手就带走" : "再往下，拉到底就带走")
      : S.state === "take" ? "捆好，进邮包"
        : S.last != null ? "带走了「" + ROWS[S.last].name + "」" + ROWS[S.last].n + " 本，在你的邮包里" : "按住一排往下拉，整排带走；左右划看书名";
  $("#snd").setAttribute("aria-pressed", String(AU.on));
}
function showTip(b, x, y) {
  tip.firstElementChild.textContent = b.title; tip.lastElementChild.textContent = ROWS[b.row].name + " · 他" + STN[b.st];
  tip.classList.add("on"); moveTip(x, y);
}
function moveTip(x, y) {
  const w = tip.offsetWidth, h = tip.offsetHeight, tx = clamp(x - w / 2, 8, innerWidth - w - 8), ty = y - h - 46 < 56 ? y + 36 : y - h - 46;
  tip.style.transform = "translate(" + Math.round(tx) + "px," + Math.round(ty) + "px)";
}
function setHot(i, x, y) {
  if (i === S.hot) { if (i >= 0 && x != null) moveTip(x, y); return; }
  if (S.hot >= 0) books[S.hot].popT = 0;
  S.hot = i;
  if (i >= 0) { books[i].popT = 1; SFX.tick(books[i]); vib(4); showTip(books[i], x == null ? innerWidth / 2 : x, y == null ? innerHeight / 2 : y); }
  else tip.classList.remove("on");
}
function openSheet() {
  const ul = $("#bag-list"); ul.textContent = "";
  if (!S.bag.length) { const li = document.createElement("li"); li.textContent = "还是空的。按住一排书往下拉，就带走了。"; ul.appendChild(li); }
  S.bag.forEach((r) => { const li = document.createElement("li"); li.textContent = "「" + ROWS[r].name + "」一排 " + ROWS[r].n + " 本，来自" + OWNER.name; ul.appendChild(li); });
  sheet.classList.add("on");
}
const closeSheet = () => sheet.classList.remove("on");

/* ---------- 进门：直接到；敲门进只留作对照 ---------- */
function enter(way) {
  clearTracks(); S.way = way || S.way; S.state = "door"; S.fast = false; S.pull = null; S.last = null; S.tEnter = S.t; S.tIdle = 0; setHot(-1); closeSheet(); bag.classList.remove("aim");
  labEls.forEach((o) => o.el.classList.remove("on")); owner.classList.add("on");          // 谁的书房、那句话：从到门口起就在顶上
  doorPivot.rotation.y = 0; S.lean = 0;
  const knockWay = S.way === "knock"; doorG.visible = knockWay; S.ent = knockWay ? 0 : 1;
  const reveal = (t0) => {                                         // 签一枚枚冒出来，那一排书跟着抖一下
    labEls.forEach((o, k) => wait(t0 + k * P.labelGap, () => {
      o.el.classList.add("on"); SFX.label(k); vib(4);
      if (ROWS[o.r]) ROWS[o.r].books.forEach((b, j) => wait(j * .011, () => { b.pop = Math.max(b.pop, .55); }));
    }));
    wait(t0 + labEls.length * P.labelGap + .2, () => { S.state = "idle"; S.tIdle = S.t - S.tEnter; ui(); });
  };
  if (knockWay) {
    play(P.push, (e) => { S.lean = e; }, { ease: E.lin });
    const knock = () => { SFX.knock(); vib(10); S.shake = P.shake; play(.12, (e, k) => { doorPivot.rotation.y = Math.sin(Math.PI * k) * .015; }, { ease: E.lin }); };
    wait(P.knock1, knock); wait(P.knock2, knock);
    wait(P.open, () => { SFX.open(); play(P.openDur, (e) => { doorPivot.rotation.y = e * 1.78; }, { ease: E.back }); });
    wait(P.push, () => { play(P.pushDur, (e) => { S.ent = e; }, { ease: E.io3, done() { doorG.visible = false; } }); wait(P.pushDur * .62, ui); });   // 走到一半，底下那行字换成怎么看这座书架
    reveal(P.labels);
  } else reveal(P.directLabels);
  ui();
}

/* ---------- 带走一排 ---------- */
function startPull(r, fx, auto) {
  const row = ROWS[r]; if (!row || S.state !== "idle") return false;
  if (row.taken) { SFX.no(); hint.textContent = "「" + row.name + "」这一排已经在你包里了"; return false; }
  setHot(-1); row.books.forEach((b) => { b.tk = false; b.ck = 0; });
  S.pull = { r, p: 0, pT: 0, fx: fx == null ? row.x0 : clamp(fx, row.x0, row.x1), drop: auto ? 26 : 0, auto: !!auto, back: false };
  S.state = "pull"; bag.classList.add("aim"); ui(); return true;
}
function takeRow(r) {                                            // 点层板上的签：自己拉到底
  if (!startPull(r, null, true)) return;
  const pl = S.pull; play(.42, (e) => { pl.pT = e * 1.02; }, { ease: E.lin });
}
function finishPull() { const pl = S.pull, p0 = pl.pT, d0 = pl.drop; pl.auto = true; play(.16, (e) => { pl.pT = lerp(p0, 1.02, e); pl.drop = lerp(d0, Math.max(d0, 26), e); }, { ease: E.lin }); ui(); }
function cancelPull() { const pl = S.pull; pl.pT = 0; pl.back = true; S.state = "idle"; SFX.back(); ui(); }
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function bagWorld() {                                            // 邮包那个按钮在三维里对应的位置（镜头前一半远的地方）
  const r = bag.getBoundingClientRect(); ndc.set((r.left + r.width / 2) / innerWidth * 2 - 1, 1 - (r.top + r.height / 2) / innerHeight * 2); ray.setFromCamera(ndc, camera);
  return ray.ray.origin.clone().addScaledVector(ray.ray.direction, CAM.dist * .5);
}
function commit() {
  const pl = S.pull, row = ROWS[pl.r], n = row.books.length, mid = (row.x0 + row.x1) / 2, B = bagWorld();
  S.state = "take"; S.freeze = P.hitStop; S.shake = P.shake; SFX.snap(); vib(18); ui();
  row.books.forEach((b) => { b.cx = b.sx; b.cy = b.sy - pl.drop; b.cz = b.sz + b.d + P.outZ; b.crx = .1; b.ck = 1; });
  let left = n;
  row.books.forEach((b, j) => {
    const x0 = b.cx, x1 = mid + (b.sx - mid) * .7, y1 = b.cy, z1 = b.cz;
    play(P.gather, (e) => { b.cx = lerp(x0, x1, e); b.crx = .1 * (1 - e); }, { ease: E.out3, done() {                    // 收拢成一捆
      play(P.fly, (e, k) => { const s = Math.sin(Math.PI * k); b.cx = lerp(x1, B.x, e); b.cy = lerp(y1, B.y, e) + s * 6; b.cz = lerp(z1, B.z, e) + s * 16; b.ck = lerp(1, .13, e); b.crz = s * .25 * (j % 2 ? 1 : -1); },
        { delay: (j / n) * P.flyStagger, ease: E.io3, done() { b.ck = 0; if (--left === 0) landed(pl.r); } });           // 飞进邮包
    } });
  });
  wait(P.gather, () => SFX.fly());
}
function landed(r) {
  ROWS[r].taken = true; S.bag.push(r); S.last = r; S.pull = null; S.state = "idle";
  SFX.land(); vib(15); S.shake = P.shake * .5;
  bag.classList.remove("aim", "bump"); void bag.offsetWidth; bag.classList.add("bump");
  const plus = document.createElement("span"); plus.className = "plus"; plus.textContent = "+" + ROWS[r].n; bag.appendChild(plus); setTimeout(() => plus.remove(), 950);
  ui();
}
function resetBag() { ROWS.forEach((row) => { row.taken = false; }); S.bag = []; S.last = null; ui(); }

/* ---------- 手指 ---------- */
function pick(cx, cy) {                                        // 手指底下是哪一排、哪一本：先落到书脊那个平面上，再按层、按左右找最近的
  ndc.set(cx / innerWidth * 2 - 1, 1 - cy / innerHeight * 2); ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction; if (Math.abs(d.z) < 1e-6) return { r: -1, bi: -1, x: 0 };
  const t = (-RECESS - o.z) / d.z, x = o.x + d.x * t, y = o.y + d.y * t;
  const r = R - 1 - Math.floor((y - PL) / (SH + BT)), row = ROWS[r];
  if (!row || Math.abs(x) > W / 2 + ST) return { r: -1, bi: -1, x };
  let best = -1, bd = Math.max(.8, 7 * CAM.wpp);
  for (const b of row.books) { const dd = Math.abs(x - b.sx) - b.t / 2; if (dd < bd) { bd = dd; best = b.i; } }
  return { r, bi: best, x };
}
const G = { id: -1, x0: 0, y0: 0, moved: 0, mode: "", row: -1, fx: 0 };
canvas.addEventListener("pointerdown", (ev) => {
  au(true); if (G.id !== -1) return;
  G.id = ev.pointerId; G.x0 = ev.clientX; G.y0 = ev.clientY; G.moved = 0; G.mode = ""; G.row = -1;
  try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
  if (sheet.classList.contains("on")) { closeSheet(); return; }
  if (S.state === "door") { S.fast = true; return; }
  if (S.state !== "idle") return;
  const pk = pick(ev.clientX, ev.clientY); G.row = pk.r; G.fx = pk.x; G.mode = "?"; setHot(pk.bi, ev.clientX, ev.clientY);
});
canvas.addEventListener("pointermove", (ev) => {
  if (ev.pointerType === "mouse") { S.par.tx = ev.clientX / innerWidth * 2 - 1; S.par.ty = ev.clientY / innerHeight * 2 - 1; }
  if (G.id === -1) { if (ev.pointerType === "mouse" && S.state === "idle" && !S.pull) setHot(pick(ev.clientX, ev.clientY).bi, ev.clientX, ev.clientY); return; }   // 鼠标不用按住，移过去就探头
  if (ev.pointerId !== G.id) return;
  const dx = ev.clientX - G.x0, dy = ev.clientY - G.y0; G.moved = Math.max(G.moved, Math.hypot(dx, dy));
  if (G.mode === "?" && G.moved > 9) {                             // 先看这一下是往下拉（带走一排）还是左右划（看书名）
    if (dy > Math.abs(dx) * 1.1 && G.row >= 0) G.mode = startPull(G.row, G.fx) ? "pull" : "none";
    else G.mode = "scrub";
  }
  if (G.mode === "scrub" && S.state === "idle") setHot(pick(ev.clientX, ev.clientY).bi, ev.clientX, ev.clientY);
  else if (G.mode === "pull" && S.state === "pull" && S.pull && !S.pull.auto) {
    const was = S.pull.pT >= P.commit; S.pull.pT = clamp((dy - 9) / P.pullPx, 0, 1.02); S.pull.drop = clamp(dy * CAM.wpp, 0, P.dropMax);
    if (was !== (S.pull.pT >= P.commit)) { ui(); if (!was) vib(8); }
  }
});
function endPointer(ev) {
  if (ev.pointerId !== G.id) return; G.id = -1;
  if (G.mode === "pull" && S.state === "pull" && S.pull && !S.pull.auto) { if (ev.type !== "pointercancel" && S.pull.pT >= P.commit) finishPull(); else cancelPull(); }
  else if (ev.pointerType !== "mouse" || G.mode === "scrub") setHot(-1);
  G.mode = "";
}
canvas.addEventListener("pointerup", endPointer); canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerleave", (ev) => { if (ev.pointerType === "mouse" && G.id === -1 && S.state === "idle") setHot(-1); });
$("#b-again").addEventListener("click", () => { au(true); enter(S.way); });
bag.addEventListener("click", () => { au(true); if (S.state === "idle") openSheet(); });
$("#b-close").addEventListener("click", closeSheet);
$("#b-reset").addEventListener("click", () => { resetBag(); closeSheet(); });
$("#snd").addEventListener("click", () => { if (sndToggle()) { au(true); SFX.tick({ t: 2.5 }); } ui(); });
addEventListener("resize", fit);

/* ---------- 帧 ---------- */
let devEl = null; if (DEV) { devEl = document.createElement("div"); devEl.className = "dev"; document.body.appendChild(devEl); }
let last = performance.now(), fps = 60;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(.05, (now - last) / 1000); last = now; fps = lerp(fps, 1 / Math.max(raw, 1e-3), .05);
  if (!S.manual) tick(raw);
}
function tick(raw) {
  let dt = raw; if (S.freeze > 0) { S.freeze -= raw; dt = 0; } else if (S.fast && S.state === "door") dt *= 5;
  S.t += dt; S.shake *= Math.exp(-10 * raw);
  stepTracks(dt); placeCamera(raw); applyBooks(dt ? raw : 0); placeLabels();
  renderer.render(scene, camera);
  if (devEl) devEl.textContent = S.state + " · " + S.way + (S.tIdle ? " · 点开到能动 " + S.tIdle.toFixed(2) + " 秒" : "") + "\n" + fps.toFixed(0) + " fps · " + renderer.info.render.calls + " calls";
}

/* ---------- 开场 ---------- */
window.__lab = {
  S, P, ROWS, OWNER, get state() { return S.state; }, get books() { return books; }, rectOf, rowRect, enter, take: takeRow, reset: resetBag,
  pullTo(r, p) { if (!S.pull && !startPull(r, (ROWS[r].x0 + ROWS[r].x1) / 2)) return; S.pull.pT = p; S.pull.drop = p * 30; ui(); },   // 测试截分镜用：把某一排拉到几成
  get doorOn() { return doorG.visible; },
  manual(on) { S.manual = !!on; }, step(sec) { let t = sec; while (t > 1e-6) { const d = Math.min(1 / 60, t); tick(d); t -= d; } },
};
whenReady().then(() => { fit(); enter(S.way); requestAnimationFrame(frame); });   // 等木纹的图到了再开场（最多等一秒半）
