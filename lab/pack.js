/* 拆包样机。只回答一件事：拆包的手感对不对。
 * 2026-11-12 用户在手机上试过，开法定「热闹」；「安静」那一套参数留着备查，地址加 ?mode=quiet 才进。
 * 2026-11-13 用户选定外观旧书房：这页的颜色、光、桌面、包和牌的画法接到 kit.js 的外观表上（每种外观的 pk 一栏），
 *   做了旧书房（默认）和灰盒（过门时的样子，?look=grey）两种；动作、节拍、声音一点没动。
 *
 * 节拍（两种开法共用，强弱不同，差别全在下面 MODES 一张表里）：
 *   1 送到   一包牌从上面落到眼前，轻轻浮着；手指碰它它会偏一下
 *   2 撕开   沿封口横着划，封条跟着手指一格格撕开卷起来（每格一声、一下震动）；没划到七成松手会弹回去
 *   3 开了   热闹：一顿、一闪、火星、镜头一震；安静：封条落下，包往下退
 *   4 发牌   五张牌背朝上落到桌上；点一下屏幕可以快进
 *   5 翻牌   一张张自己点开，牌底下的光晕提示这张有多长；翻开的牌再点一下拿到眼前看
 *   6 收下   向上划或点「收下」，牌收走，下一包送到
 *
 * 结构：three.js 只画物件（桌面、包、牌、光），字用网页排；声音是 WebAudio 现场合成的，没有音频文件。
 * 调试：地址加 ?dev 显示帧率与状态；window.__lab 给测试脚本用。 */
import * as THREE from "../vendor/three/three.module.min.js";   // 直接按相对路径引，不用 importmap（旧一点的手机浏览器不认）
import { LOOK, patternTex, grainOver, texReady, whenReady, woodOn, makeEnv, foil, weave, MASK, chamferBox } from "./kit.js";       // 外观表、花纹。引进来的同时 kit.js 会把网页上那层字的颜色和顶栏的「外观」按钮接好

const Q = new URLSearchParams(location.search), DEV = Q.has("dev");
const $ = (s) => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const rad = THREE.MathUtils.degToRad;
const E = {
  lin: (k) => k,
  out3: (k) => 1 - Math.pow(1 - k, 3),
  out5: (k) => 1 - Math.pow(1 - k, 5),
  in3: (k) => k * k * k,
  io3: (k) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  back: (k) => { const s = 1.9, t = k - 1; return 1 + (s + 1) * t * t * t + s * t * t; },
};

/* ---------- 两种开法 ---------- */
const MODES = {
  loud:  { hitStop: .09, flash: 1, shake: .28, sparks: 1, charge: 1, dealStagger: .075, dealDur: .6,  dealArc: 3.4, spin: 1, bounce: .2, flipDur: .42, flipLift: 1.3, flipEase: "back", flipFlash: 1, glow: 1,   collectStagger: .05 },
  quiet: { hitStop: 0,   flash: 0, shake: 0,   sparks: 0, charge: 0, dealStagger: .15,  dealDur: .85, dealArc: .8,  spin: 0, bounce: 0,  flipDur: .62, flipLift: .8,  flipEase: "io3",  flipFlash: 0, glow: .4,  collectStagger: .09 },
};

/* ---------- 牌（标题是编的） ---------- */
const DECK = [
  { g: "周", no: "F0 · 01", title: "中国家庭的钱花在哪、存在哪", src: "专栏", min: 12, tier: 2 },
  { g: "金", no: "F8 · 30", title: "如何计算凯利公式的仓位系数", src: "问答", min: 6, tier: 1 },
  { g: "金", no: "F8 · 31", title: "波动率为什么会聚在一起出现", src: "问答", min: 9, tier: 1 },
  { g: "货", no: "F7 · 24", title: "做市商靠什么赚钱", src: "长文", min: 21, tier: 3 },
  { g: "债", no: "F5 · 02", title: "久期：利率动一点，债券动多少", src: "笔记", min: 4, tier: 0 },
];
const N = DECK.length;

/* ---------- 尺寸（一个单位约 2.5 厘米） ---------- */
const CW = 2.5, CH = 3.5, CT = .035, CR = .16;          // 牌：宽、高、厚、圆角
const PW = 2.95, PT = .46, STRIP = .62, BH = 3.75, PH = BH + STRIP;   // 包：宽、厚、封条高、身高、总高
const K = 16, SEG = PW / K;                               // 封条分成十六格
const ELEV = rad(66);                                     // 镜头俯角

/* ---------- 渲染器、镜头、光 ---------- */
const canvas = $("#gl");
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); }
catch (e) {
  const d = document.createElement("div"); d.className = "nogl"; d.textContent = "这台设备的浏览器打不开三维画面（WebGL 不可用），样机看不了。换一个浏览器试试。";
  document.body.appendChild(d); throw e;
}
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const PK = LOOK.pk, STUDY = PK.style === "study";
const scene = new THREE.Scene(); scene.background = new THREE.Color(PK.bg);
const camera = new THREE.PerspectiveCamera(50, 1, .1, 200);
const view = { dist: 14, tanV: 1, aspect: 1, portrait: true, target: new THREE.Vector3(0, 0, .25) };
const camDir = new THREE.Vector3(0, Math.sin(ELEV), Math.cos(ELEV));       // 从目标指向镜头
const scrUp = new THREE.Vector3(0, Math.cos(ELEV), -Math.sin(ELEV));        // 屏幕上的「上」在世界里的方向
const camBase = new THREE.Vector3(), fitCam = new THREE.PerspectiveCamera();
const qFace = new THREE.Quaternion().setFromEuler(new THREE.Euler(-ELEV, 0, 0));       // 正对镜头
const qLay = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)); // 平放在桌上
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
const qTmp = new THREE.Quaternion(), qTmp2 = new THREE.Quaternion(), vTmp = new THREE.Vector3(), vTmp2 = new THREE.Vector3();

scene.add(new THREE.HemisphereLight(PK.hemi[0], PK.hemi[1], PK.hemi[2]));
const key = new THREE.DirectionalLight(PK.key[0], PK.key[1]); key.position.set(-6, 15, 6); key.castShadow = true;
{ const sm = innerWidth * Math.min(devicePixelRatio || 1, 2) < 1500 ? 1024 : 2048; key.shadow.mapSize.set(sm, sm); } key.shadow.bias = -.0004; key.shadow.normalBias = .03; key.shadow.radius = 5;
Object.assign(key.shadow.camera, { left: -11, right: 11, top: 13, bottom: -11, near: 1, far: 50 });
scene.add(key, key.target);
const burstLight = new THREE.PointLight(0xffd9a0, 0, 30, 1.6); scene.add(burstLight);
const ENV = makeEnv(renderer);                             // 旧书房：环境光，牌背的烫金和牌的金边反它
const lamp = PK.lamp ? new THREE.PointLight(PK.lamp[0], PK.lamp[1], 60, 1.5) : null; if (lamp) scene.add(lamp);   // 旧书房：桌子上方一盏灯，中间亮四周暗；位置在 fit() 里跟着镜头对准的地方走

/* ---------- 画布贴图 ---------- */
const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
function tex(w, h, draw, data) {                           // data：不是颜色，是数（「哪里是金」那张图）
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); if (!data) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const SERIF = '"Noto Serif SC","Songti SC",serif', MONO = '"IBM Plex Mono",ui-monospace,monospace', SANS = '"Noto Sans SC","PingFang SC",sans-serif';
const COCOA = PK.cardBack, COPPER = PK.cardLine, CREAM = PK.cardFace, INK = PK.ink, KRAFT = PK.kraft, ACCENT = PK.accent;
const inkA = (a) => { const n = parseInt(INK.slice(1), 16); return "rgba(" + (n >> 16) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")"; };   // 墨色带透明度
function drawBack(g, w, h, c) {
  if (STUDY) return drawBackStudy(g, w, h, c);
  g.fillStyle = COCOA; g.fillRect(0, 0, w, h);
  g.strokeStyle = COPPER; g.lineWidth = 5; rr(g, 36, 36, w - 72, h - 72, 22); g.stroke();
  g.lineWidth = 2.5; g.setLineDash([3, 10]); rr(g, 56, 56, w - 112, h - 112, 14); g.stroke(); g.setLineDash([]);
  g.fillStyle = COPPER; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "900 300px " + SERIF; g.fillText(c.g, w / 2, h / 2 + 8);
  g.font = "600 32px " + MONO; g.textAlign = "left"; g.fillText(c.no, 84, 104);
  g.save(); g.translate(w - 84, h - 104); g.rotate(Math.PI); g.fillText(c.no, 0, 0); g.restore();
}
function drawFront(g, w, h, c) {
  g.fillStyle = CREAM; g.fillRect(0, 0, w, h); grainOver(g, 0, 0, w, h, true);
  g.strokeStyle = inkA(.55); g.lineWidth = 3; rr(g, 34, 34, w - 68, h - 68, 20); g.stroke();
  if (STUDY) { g.lineWidth = 1.5; rr(g, 44, 44, w - 88, h - 88, 13); g.stroke(); }
  g.fillStyle = ACCENT; g.textAlign = "left"; g.textBaseline = "middle"; g.font = "600 30px " + MONO; g.fillText(c.no, 70, 96);
  g.textAlign = "right"; g.font = "500 30px " + (STUDY ? SERIF : SANS); g.fillText(c.src, w - 70, 96);
  g.fillStyle = inkA(.35); g.fillRect(70, 132, w - 140, 2);
  // 标题：按字数折行，最多五行
  const per = 6, lines = []; let t = c.title;
  while (t.length && lines.length < 5) { let n = Math.min(per, t.length); if (t.length > n && /[，。：、？]/.test(t[n])) n++; lines.push(t.slice(0, n)); t = t.slice(n); }
  g.fillStyle = INK; g.textAlign = "left"; g.font = "700 82px " + SERIF;
  lines.forEach((ln, i) => g.fillText(ln, 70, 236 + i * 108));
  g.fillStyle = inkA(.35); g.fillRect(70, h - 150, w - 140, 2);
  g.fillStyle = INK; g.font = "500 32px " + (STUDY ? SERIF : SANS); g.fillText("读完约 " + c.min + " 分钟", 70, h - 98);
  // 篇幅用格子数表示（实心格越多越长），不靠颜色
  for (let i = 0; i < 4; i++) { g.beginPath(); g.rect(w - 70 - (4 - i) * 30, h - 112, 22, 28); if (i <= c.tier) g.fill(); else { g.lineWidth = 2; g.strokeStyle = INK; g.stroke(); } }
}
// 旧书房的牌背：藏青布面，烫金的两道框、四角的小菱花、当中一个圆章里一个大字。mask：只画「哪里是金」那张图
function drawBackStudy(g, w, h, c, mask) {
  g.fillStyle = mask ? MASK.cloth : COCOA; g.fillRect(0, 0, w, h); if (!mask) grainOver(g, 0, 0, w, h, false);
  g.strokeStyle = g.fillStyle = mask ? MASK.gilt : COPPER; g.lineWidth = 7; rr(g, 30, 30, w - 60, h - 60, 20); g.stroke();
  g.lineWidth = 2; rr(g, 48, 48, w - 96, h - 96, 10); g.stroke();
  const dia = (x, y, d) => { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-d / 2, -d / 2, d, d); g.restore(); };
  [[78, 78], [w - 78, 78], [78, h - 78], [w - 78, h - 78]].forEach(([x, y]) => dia(x, y, 20));
  const cx = w / 2, cy = h / 2; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, 196, 0, 7); g.stroke(); g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 214, 0, 7); g.stroke();
  for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(a) * 180, cy + Math.sin(a) * 180, 2.2, 0, 7); g.fill(); }   // 圆章里一圈小点
  g.textAlign = "center"; g.textBaseline = "middle"; g.font = "900 250px " + SERIF; g.fillText(c.g, cx, cy + 8);
  [cy - 290, cy + 290].forEach((y) => { dia(cx, y, 16); g.fillRect(cx - 120, y - 1, 92, 2); g.fillRect(cx + 28, y - 1, 92, 2); });
  g.font = "600 30px " + MONO; g.textAlign = "left"; g.fillText(c.no, 104, 112);
  g.save(); g.translate(w - 104, h - 112); g.rotate(Math.PI); g.fillText(c.no, 0, 0); g.restore();
}
// 旧书房的包：牛皮纸，当中贴一张米色的签，右下盖一枚邮戳；两道麻绳是真的两圈（见下面「包」那一节），不画在这里
function drawPackFrontStudy(g, w, h) {
  g.fillStyle = KRAFT; g.fillRect(0, 0, w, h);
  g.strokeStyle = inkA(.5); g.lineWidth = 4; g.setLineDash([14, 12]); g.beginPath(); g.moveTo(0, 5); g.lineTo(w, 5); g.stroke(); g.setLineDash([]);
  g.fillStyle = inkA(.66); g.textAlign = "center"; g.textBaseline = "middle"; g.font = "500 30px " + SANS; g.fillText("‹ ‹ ‹   沿 这 条 边 划 开   › › ›", w / 2, 50);
  g.fillStyle = "rgba(60,34,10,.1)"; g.beginPath(); g.moveTo(0, h); g.lineTo(0, h - 120); g.lineTo(96, h); g.fill(); g.beginPath(); g.moveTo(w, h); g.lineTo(w, h - 120); g.lineTo(w - 96, h); g.fill();   // 包角的折痕
  const lx = 64, ly = 176, lw = w - 128, lh = 330;                       // 签
  g.fillStyle = "rgba(40,20,5,.28)"; g.fillRect(lx + 4, ly + 6, lw, lh); g.fillStyle = CREAM; g.fillRect(lx, ly, lw, lh);
  g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(lx + 14, ly + 14, lw - 28, lh - 28); g.lineWidth = 1.5; g.strokeRect(lx + 24, ly + 24, lw - 48, lh - 48);
  g.fillStyle = INK; g.font = "900 168px " + SERIF; g.fillText("剪报", w / 2, ly + 128);
  g.fillRect(w / 2 - 110, ly + 226, 220, 3);
  g.font = "500 38px " + SERIF; g.fillText("本周收件 · " + N + " 件", w / 2, ly + 272);
  g.save(); g.translate(w - 150, 586); g.rotate(-.2); g.strokeStyle = g.fillStyle = inkA(.5);     // 邮戳
  g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 66, 0, 7); g.stroke(); g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 54, 0, 7); g.stroke();
  g.font = "700 40px " + SERIF; g.fillText("邮差", 0, -4); g.font = "600 17px " + MONO; g.fillText("NO. " + String(S.packNo).padStart(3, "0"), 0, 30);
  g.lineWidth = 3; for (let k = -2; k <= 2; k++) { g.beginPath(); for (let x = -240; x <= -78; x += 6) g.lineTo(x, k * 15 + Math.sin(x / 14) * 4); g.stroke(); }
  g.restore();
  grainOver(g, 0, 0, w, h, true);
}
function drawPackFront(g, w, h) {
  if (STUDY) return drawPackFrontStudy(g, w, h);
  g.fillStyle = KRAFT; g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(62,29,0,.5)"; g.lineWidth = 4; g.setLineDash([14, 12]); g.beginPath(); g.moveTo(0, 5); g.lineTo(w, 5); g.stroke(); g.setLineDash([]);
  g.fillStyle = "rgba(62,29,0,.62)"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "500 30px " + SANS; g.fillText("‹ ‹ ‹   沿 这 条 边 划 开   › › ›", w / 2, 50);
  g.strokeStyle = INK; g.lineWidth = 5; rr(g, 42, 104, w - 84, h - 150, 18); g.stroke();
  g.fillStyle = INK; g.font = "900 200px " + SERIF; g.fillText("剪报", w / 2, h * .44);
  g.fillRect(w / 2 - 120, h * .62, 240, 3);
  g.font = "500 40px " + SANS; g.fillText("本周收件 · " + N + " 件", w / 2, h * .7);
  g.font = "600 30px " + MONO; g.fillStyle = "rgba(62,29,0,.7)"; g.fillText("NO. " + String(S.packNo).padStart(3, "0"), w / 2, h * .8);
}
function glowTex() {
  return tex(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(.35, "rgba(255,255,255,.55)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, w, w); });
}

/* ---------- 状态 ---------- */
const S = {
  mode: "loud", state: "boot", p: 0, pShown: 0, dir: 1, packNo: 1, taken: 0, inspect: -1,
  freeze: 0, shake: 0, fast: false, manual: false, stripFly: 0, t: 0, par: { x: 0, y: 0, tx: 0, ty: 0 }, poke: 0,
};
try { if (matchMedia("(prefers-reduced-motion: reduce)").matches) S.mode = "quiet"; } catch (e) { /* 系统设了「减少动态效果」的才默认安静 */ }
if (Q.get("mode") && MODES[Q.get("mode")]) S.mode = Q.get("mode");
const M = () => MODES[S.mode];

/* ---------- 小动画轨 ---------- */
const tracks = new Set();
function play(dur, fn, o = {}) { const tr = { t: -(o.delay || 0), dur: Math.max(dur, 1e-4), fn, ease: o.ease || E.out3, done: o.done }; tracks.add(tr); return tr; }
function wait(sec, done) { return play(sec, () => {}, { done }); }
function stepTracks(dt) {
  for (const tr of [...tracks]) {
    tr.t += dt; if (tr.t < 0) continue;
    const k = Math.min(1, tr.t / tr.dur); tr.fn(tr.ease(k), k);
    if (k >= 1) { tracks.delete(tr); if (tr.done) tr.done(); }
  }
}

/* ---------- 声音（现场合成） ---------- */
const AU = { ctx: null, master: null, on: true, buf: null, tear: null };
try { if (localStorage.getItem("lab-pack-snd") === "0") AU.on = false; } catch (e) { /* 忽略 */ }
function au() {
  if (!AU.on) return null;
  if (!AU.ctx) {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    AU.ctx = new C(); AU.master = AU.ctx.createGain(); AU.master.gain.value = .6; AU.master.connect(AU.ctx.destination);
    const n = Math.floor(AU.ctx.sampleRate * 1.5); AU.buf = AU.ctx.createBuffer(1, n, AU.ctx.sampleRate);
    const d = AU.buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  if (AU.ctx.state === "suspended") AU.ctx.resume();
  return AU.ctx;
}
function noise(o) {
  const c = au(); if (!c) return; const t = c.currentTime + (o.when || 0), dur = o.dur || .1;
  const s = c.createBufferSource(); s.buffer = AU.buf; s.loop = true;
  const f = c.createBiquadFilter(); f.type = o.type || "bandpass"; f.frequency.setValueAtTime(o.f || 2000, t); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur); f.Q.value = o.q || 1;
  const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(o.gain || .2, t + (o.attack || .004)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(AU.master); s.start(t, Math.random()); s.stop(t + dur + .05);
}
function tone(o) {
  const c = au(); if (!c) return; const t = c.currentTime + (o.when || 0), dur = o.dur || .2;
  const s = c.createOscillator(); s.type = o.type || "sine"; s.frequency.setValueAtTime(o.f || 440, t); if (o.f2) s.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(o.gain || .15, t + (o.attack || .005)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(g); g.connect(AU.master); s.start(t); s.stop(t + dur + .05);
}
const SFX = {
  tick() { noise({ dur: .035, type: "highpass", f: 3200, gain: .22 }); },
  snap() {
    if (S.mode === "loud") { tone({ f: 150, f2: 42, dur: .26, gain: .7 }); noise({ dur: .2, f: 1400, f2: 300, q: .6, gain: .5 }); [880, 1320, 1760, 2640].forEach((f, i) => tone({ f, dur: .9, gain: .08, when: .04 + i * .035 })); }
    else { noise({ dur: .18, f: 2600, f2: 900, q: .8, gain: .28 }); tone({ f: 110, f2: 70, dur: .12, gain: .16 }); }
  },
  out() { if (S.mode === "loud") noise({ dur: .26, f: 500, f2: 2600, q: 1.2, gain: .15 }); else noise({ dur: .24, type: "lowpass", f: 1800, f2: 700, gain: .08 }); },
  land() { if (S.mode === "loud") { tone({ f: 96, f2: 46, dur: .1, gain: .42 }); noise({ dur: .04, type: "lowpass", f: 900, gain: .2 }); } else tone({ f: 180, f2: 120, dur: .05, gain: .07, type: "triangle" }); },
  flip() { noise({ dur: .09, type: "highpass", f: 2200, gain: .13 }); },
  shown(tier) { if (S.mode === "loud") { const b = [523, 659, 784, 1047][tier]; [1, 1.5, 2].forEach((m, i) => tone({ f: b * m, dur: .5, gain: .1 / (i + 1), when: i * .02 })); } else tone({ f: 300, dur: .06, gain: .07, type: "triangle" }); },
  take() { if (S.mode === "loud") [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: .25, gain: .1, when: i * .06 })); else { noise({ dur: .25, type: "lowpass", f: 1500, f2: 500, gain: .1 }); tone({ f: 120, f2: 80, dur: .12, gain: .14, when: .2 }); } },
  arrive() { noise({ dur: .22, type: "lowpass", f: 1200, f2: 400, gain: .12 }); tone({ f: 86, f2: 50, dur: .12, gain: .3, when: .2 }); },
};
function tearSoundStart() {
  const c = au(); if (!c || AU.tear) return;
  const s = c.createBufferSource(); s.buffer = AU.buf; s.loop = true;
  const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2400; f.Q.value = .7;
  const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(AU.master); s.start();
  let o = null, og = null;
  if (M().charge) { o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = 160; og = c.createGain(); og.gain.value = 0; const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; o.connect(lp); lp.connect(og); og.connect(AU.master); o.start(); }
  AU.tear = { s, g, f, o, og };
}
function tearSoundSet(speed, p) {
  const T = AU.tear; if (!T) return; const t = AU.ctx.currentTime;
  T.g.gain.setTargetAtTime(clamp(speed * .5, 0, .4), t, .03); T.f.frequency.setTargetAtTime(1800 + p * 2200, t, .05);
  if (T.o) { T.o.frequency.setTargetAtTime(150 + p * 520, t, .04); T.og.gain.setTargetAtTime(p * .07, t, .05); }
}
function tearSoundStop() {
  const T = AU.tear; if (!T) return; AU.tear = null; const t = AU.ctx.currentTime;
  T.g.gain.setTargetAtTime(0, t, .03); T.s.stop(t + .25); if (T.o) { T.og.gain.setTargetAtTime(0, t, .03); T.o.stop(t + .25); }
}
const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* 忽略 */ } };

/* ---------- 桌面 ---------- */
function tableMat() {
  if (STUDY) {                                             // 胡桃木：木纹横着走
    const t = patternTex("wood"); t.rotation = Math.PI / 2; t.repeat.set(13, 5); t.anisotropy = maxAniso;   // 转了九十度以后，前一个数管横纹有多密，后一个数管顺着纹的方向
    const m = new THREE.MeshStandardMaterial({ roughness: .62, map: t, color: new THREE.Color(PK.table).multiplyScalar(t.userData.gain) });
    texReady.then(() => { const made = woodOn(m, "table", 90, 90, true, 3, PK.tableTile); if (made) { made.forEach((x) => { x.anisotropy = maxAniso; }); t.dispose(); } });   // 真木纹的图到了就换上（代码画的那张是垫底的）
    return m;
  }
  const [c0, c1, c2] = PK.table;
  return new THREE.MeshStandardMaterial({ roughness: 1, map: tex(256, 256, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, c0); r.addColorStop(.28, c1); r.addColorStop(1, c2); g.fillStyle = r; g.fillRect(0, 0, w, w); }) });
}
const table = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), tableMat());
table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);

/* ---------- 牌 ---------- */
function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
const cardShape = rrShape(CW, CH, CR);
const cardBody = new THREE.ExtrudeGeometry(cardShape, { depth: CT, bevelEnabled: false, curveSegments: 5 }); cardBody.translate(0, 0, -CT / 2);
const cardFace = new THREE.ShapeGeometry(cardShape, 5);
{ const p = cardFace.attributes.position, uv = cardFace.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / CW + .5, p.getY(i) / CH + .5); uv.needsUpdate = true; }
const edgeMat = ENV ? new THREE.MeshStandardMaterial({ color: PK.edge, roughness: .36, metalness: .8, envMap: ENV }) : new THREE.MeshStandardMaterial({ color: PK.edge, roughness: .9 });   // 旧书房：牌的四边刷金
const glowMap = glowTex();
const cards = [];
function buildCards() {
  for (let i = 0; i < N; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(cardBody, edgeMat); body.castShadow = true; body.userData.card = i;
    const front = new THREE.Mesh(cardFace, new THREE.MeshStandardMaterial({ roughness: .85 })); front.position.z = CT / 2 + .0015;
    const back = new THREE.Mesh(cardFace, new THREE.MeshStandardMaterial({ roughness: .8 })); back.position.z = -(CT / 2 + .0015); back.rotation.y = Math.PI;
    g.add(body, front, back); scene.add(g);
    // 牌底下的光晕：平铺在桌上，亮度和大小按篇幅给，不靠颜色
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowMap, color: 0xffe2b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.renderOrder = 1; scene.add(glow);
    cards.push({ i, g, body, front, back, glow, data: null, pos: new THREE.Vector3(), base: new THREE.Quaternion(), flip: 0, spin: 0, roll: 0, lift: 0, scale: 1, where: "pack", up: false, busy: false, slot: null });
  }
}
function dressCards() {
  const order = DECK.map((_, i) => i).sort((a, b) => ((a * 7 + S.packNo * 3) % N) - ((b * 7 + S.packNo * 3) % N));
  cards.forEach((c, i) => {
    c.data = DECK[order[i]];
    if (c.front.material.map) c.front.material.map.dispose(); if (c.back.material.map) c.back.material.map.dispose();
    c.front.material.map = tex(640, 896, (g, w, h) => drawFront(g, w, h, c.data)); c.back.material.map = tex(640, 896, (g, w, h) => drawBack(g, w, h, c.data));
    if (STUDY) {                                           // 牌背：烫金的地方反环境光，布面加布纹的凹凸
      if (c.back.material.metalnessMap) c.back.material.metalnessMap.dispose();
      foil(c.back.material, tex(640, 896, (g, w, h) => drawBackStudy(g, w, h, c.data, true), true)); weave(c.back.material, CW, CH, true, PK.clothTile);
    }
    c.front.material.needsUpdate = c.back.material.needsUpdate = true;
  });
}
function applyCard(c) {
  c.g.position.copy(c.pos); c.g.position.y += c.lift;
  qTmp.setFromAxisAngle(AY, Math.PI * (1 - c.flip) + c.spin); qTmp2.setFromAxisAngle(AZ, c.roll);
  c.g.quaternion.copy(c.base).multiply(qTmp2).multiply(qTmp); c.g.scale.setScalar(c.scale);
}

/* ---------- 包 ---------- */
const pack = new THREE.Group(); scene.add(pack);
const packMat = { side: new THREE.MeshStandardMaterial({ color: PK.side, roughness: .9 }), mouth: new THREE.MeshStandardMaterial({ color: PK.mouth, roughness: 1 }), front: new THREE.MeshStandardMaterial({ roughness: .9 }), back: new THREE.MeshStandardMaterial({ color: PK.rear, roughness: .9 }) };
const bodyMats = [packMat.side, packMat.side, packMat.mouth, packMat.side, packMat.front, packMat.back, packMat.side];
// 旧书房：包身的棱切掉一条斜面（折出来的纸包，棱上有一道亮线）；灰盒还是方盒子
const body = new THREE.Mesh(STUDY ? chamferBox(PW, BH, PT, .035) : new THREE.BoxGeometry(PW, BH, PT), bodyMats); body.position.y = -STRIP / 2; body.castShadow = true; pack.add(body);
if (PK.twine) {                                            // 旧书房：包身上捆两道麻绳，圆的，绕包一圈；每道在正面右边打一个结，垂下两截绳头
  const tm = new THREE.MeshStandardMaterial({ color: PK.twine, roughness: 1 }), R = .03, a = PW / 2 + R * .7, b = PT / 2 + R * .7, rc = .06, pts = [];
  [[a - rc, b - rc, 0], [-(a - rc), b - rc, 90], [-(a - rc), -(b - rc), 180], [a - rc, -(b - rc), 270]].forEach(([cx, cz, a0]) => { for (let k = 0; k <= 4; k++) { const t = rad(a0 + k * 22.5); pts.push(new THREE.Vector3(cx + rc * Math.cos(t), 0, cz + rc * Math.sin(t))); } });
  const loop = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, "catmullrom", .05), 96, R, 6, true);
  const knot = new THREE.IcosahedronGeometry(R * 2.1, 1), tail = new THREE.CylinderGeometry(R * .7, R * .85, 1, 6); tail.translate(0, -.5, 0);
  [.365, -.4].forEach((f, k) => {
    const g = new THREE.Group(); g.position.y = -STRIP / 2 + f * BH; pack.add(g);
    const add = (geo) => { const m = new THREE.Mesh(geo, tm); m.castShadow = true; g.add(m); return m; };
    add(loop); const kx = PW * (.3 - k * .06), kn = add(knot); kn.position.set(kx, 0, b + R * .6); kn.scale.set(1.25, .9, .8);
    [[-.5, .34], [.42, .26]].forEach(([rz, len]) => { const t = add(tail); t.position.set(kx, -.01, b + R * .9); t.rotation.z = rz; t.scale.set(1, len, 1); });
  });
}
const stripMat = new THREE.MeshStandardMaterial({ color: PK.strip, roughness: .9, transparent: true });
const segGeo = new THREE.BoxGeometry(SEG, STRIP, PT);
const segs = []; for (let i = 0; i < K; i++) { const m = new THREE.Mesh(segGeo, stripMat); m.castShadow = true; pack.add(m); segs.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3() }); }
const mouthGlow = new THREE.Mesh(new THREE.PlaneGeometry(PW * 1.5, PT * 5), new THREE.MeshBasicMaterial({ map: glowMap, color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
mouthGlow.position.set(0, PH / 2 - STRIP, PT / 2 + .02); pack.add(mouthGlow);
const P = { pos: new THREE.Vector3(), home: new THREE.Vector3(), press: 0, tpress: 0, drop: 0, tilt: 0, swayX: 0, swayY: 0, tswayX: 0, tswayY: 0, open: 0, away: 0, visible: true, shakeAmt: 0 };
const yStrip = PH / 2 - STRIP / 2;
function layoutStrip(p) {
  const n = p * K, m = Math.floor(n + 1e-6), d = S.dir, x0 = -d * PW / 2;
  for (let i = m; i < K; i++) { const s = segs[i].m; s.position.set(x0 + d * (i + .5) * SEG, yStrip, 0); s.rotation.set(0, 0, 0); }
  // 撕下来的那几格从撕口往回卷，越早撕下的卷得越开
  let x = x0 + d * m * SEG, z = 0, ang = 0;
  for (let j = m - 1; j >= 0; j--) {
    const age = n - j; ang = Math.min(2.7, ang + .2 * Math.min(1, age * .5));
    const hx = -d * Math.cos(ang), hz = Math.sin(ang), s = segs[j].m;
    s.position.set(x + hx * SEG / 2, yStrip + Math.min(.3, age * .022), z + hz * SEG / 2 + .03); s.rotation.set(0, d > 0 ? ang : -ang, 0);
    x += hx * SEG; z += hz * SEG;
  }
}
function packPose() {
  // 浮在眼前：离镜头一段固定的屏幕占比
  const frac = view.portrait ? .6 : .2;
  const D = Math.max(PW / (frac * 2 * view.tanV * view.aspect), PH / (.56 * 2 * view.tanV));
  P.home.copy(camBase).addScaledVector(camDir, -D).addScaledVector(scrUp, view.portrait ? .15 : .1);
}
function applyPack() {
  pack.visible = P.visible; if (!P.visible) return;
  const bob = Math.sin(S.t * 1.6) * .05, sh = P.shakeAmt;
  pack.position.copy(P.home).addScaledVector(scrUp, P.drop + bob - P.away * 9);
  if (sh) pack.position.x += (Math.random() - .5) * sh, pack.position.y += (Math.random() - .5) * sh;
  P.swayX = lerp(P.swayX, P.tswayX, .12); P.swayY = lerp(P.swayY, P.tswayY, .12);
  const e = new THREE.Euler(.2 + P.swayX + Math.sin(S.t * 1.1) * .02 + P.away * .9, P.swayY + Math.sin(S.t * .8) * .035 + S.poke * Math.sin(S.t * 30) * .05, Math.sin(S.t * .9) * .012);
  pack.quaternion.copy(qFace).multiply(qTmp.setFromEuler(e));
  P.press = lerp(P.press, P.tpress, .3); pack.scale.setScalar(1 - P.press * .035);
}
// 包身四角在屏幕上的位置（判断手指落没落在包上、封口在哪）
function packRect() {
  pack.updateMatrixWorld();
  const pts = [[-PW / 2, PH / 2], [PW / 2, PH / 2], [-PW / 2, -PH / 2], [PW / 2, -PH / 2]].map(([x, y]) => { vTmp.set(x, y, PT / 2).applyMatrix4(pack.matrixWorld).project(camera); return [(vTmp.x * .5 + .5) * innerWidth, (-vTmp.y * .5 + .5) * innerHeight]; });
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
}

/* ---------- 火星、闪光、桌上的一圈 ---------- */
const PN = 180, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN), pCol = new Float32Array(PN * 3);
pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
const sparks = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .22, map: glowMap, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
sparks.frustumCulled = false; scene.add(sparks); let pNext = 0;
function emit(n, at, speed, up, life) {
  for (let k = 0; k < n; k++) {
    const i = pNext; pNext = (pNext + 1) % PN; const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u), v = speed * (.4 + Math.random() * .6);
    pPos[i * 3] = at.x; pPos[i * 3 + 1] = at.y; pPos[i * 3 + 2] = at.z;
    pVel[i * 3] = Math.cos(a) * r * v; pVel[i * 3 + 1] = u * v + up; pVel[i * 3 + 2] = Math.sin(a) * r * v; pLife[i] = life * (.5 + Math.random() * .5);
  }
}
function stepSparks(dt) {
  for (let i = 0; i < PN; i++) {
    if (pLife[i] <= 0) { pCol[i * 3] = pCol[i * 3 + 1] = pCol[i * 3 + 2] = 0; continue; }
    pLife[i] -= dt; pVel[i * 3 + 1] -= 9 * dt; const dr = Math.exp(-1.6 * dt);
    for (let a = 0; a < 3; a++) { pVel[i * 3 + a] *= dr; pPos[i * 3 + a] += pVel[i * 3 + a] * dt; }
    if (pPos[i * 3 + 1] < .03) { pPos[i * 3 + 1] = .03; pVel[i * 3 + 1] *= -.35; }
    const b = clamp(pLife[i] * 2.2); pCol[i * 3] = b; pCol[i * 3 + 1] = b * .78; pCol[i * 3 + 2] = b * .45;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}
const flashes = [], rings = []; let fNext = 0, rNext = 0;
for (let i = 0; i < 4; i++) { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: 0xffe9c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })); f.renderOrder = 5; scene.add(f); flashes.push(f); }
const ringGeo = new THREE.RingGeometry(.86, 1, 48);
for (let i = 0; i < N; i++) { const r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); r.rotation.x = -Math.PI / 2; scene.add(r); rings.push(r); }
function doFlash(at, size, dur) { const f = flashes[fNext]; fNext = (fNext + 1) % flashes.length; f.position.copy(at); play(dur, (e) => { f.scale.setScalar(lerp(size * .25, size, e)); f.material.opacity = (1 - e) * .95; }, { ease: E.out3 }); }
function doRing(x, z, size, dur, op) { const r = rings[rNext]; rNext = (rNext + 1) % rings.length; r.position.set(x, .02, z); play(dur, (e) => { r.scale.setScalar(lerp(.4, size, e)); r.material.opacity = (1 - e) * op; }, { ease: E.out3 }); }

/* ---------- 镜头与版面 ---------- */
let slots = [];
function fit() {
  const w = innerWidth, h = innerHeight; view.aspect = w / h; view.portrait = view.aspect < .9;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
  camera.fov = view.portrait ? 42 : 36; view.tanV = Math.tan(rad(camera.fov / 2));
  camera.aspect = view.aspect; camera.updateProjectionMatrix();
  const L = view.portrait ? [[-1.45, -3.9], [1.45, -3.9], [0, 0], [-1.45, 3.9], [1.45, 3.9]] : [[-5.6, .3], [-2.8, -.05], [0, -.2], [2.8, -.05], [5.6, .3]];
  const yHi = 1 - 2 * (view.portrait ? 78 : 70) / h, yLo = -1 + 2 * (view.portrait ? 150 : 120) / h, xMax = 1 - 2 * 10 / w;
  fitCam.fov = camera.fov; fitCam.aspect = view.aspect; fitCam.updateProjectionMatrix();
  const tryDist = (dist) => {
    let z = 0, x1 = 0, y0 = 0, y1 = 0;
    for (let it = 0; it < 8; it++) {
      vTmp2.set(0, 0, z); fitCam.position.copy(vTmp2).addScaledVector(camDir, dist); fitCam.lookAt(vTmp2); fitCam.updateMatrixWorld();
      x1 = 0; y0 = 1e9; y1 = -1e9;
      for (const [cx, cz] of L) for (const sx of [-1, 1]) for (const sz of [-1, 1]) { vTmp.set(cx + sx * CW / 2, 0, cz + sz * CH / 2).project(fitCam); x1 = Math.max(x1, Math.abs(vTmp.x)); y0 = Math.min(y0, vTmp.y); y1 = Math.max(y1, vTmp.y); }
      z += ((yHi + yLo) / 2 - (y0 + y1) / 2) * dist * view.tanV / Math.sin(ELEV);
    }
    return { z, ok: x1 <= xMax && y1 - y0 <= yHi - yLo };
  };
  let lo = 5, hi = 90, best = { z: 0 };
  for (let it = 0; it < 20; it++) { const mid = (lo + hi) / 2, r = tryDist(mid); if (r.ok) { hi = mid; best = r; } else lo = mid; }
  view.dist = hi; view.target.set(0, 0, best.z);
  camBase.copy(view.target).addScaledVector(camDir, view.dist);
  slots = L.map(([x, z], i) => ({ pos: new THREE.Vector3(x, CT / 2 + .003 + i * .001, z), roll: ((i * 37) % 9 - 4) * .009 + (view.portrait ? 0 : -x * .012) }));
  packPose(); if (lamp) lamp.position.set(-1.2, 9.5, view.target.z - 1.5);
  cards.forEach((c) => { if (c.where === "table" && !c.busy) { c.pos.copy(slots[c.i].pos); c.roll = slots[c.i].roll; } });
}
function placeCamera() {
  S.par.x = lerp(S.par.x, S.par.tx, .06); S.par.y = lerp(S.par.y, S.par.ty, .06);
  camera.position.copy(camBase); camera.position.x += S.par.x * .55; camera.position.addScaledVector(scrUp, S.par.y * .35);
  if (S.shake > .001) { camera.position.x += (Math.random() - .5) * S.shake; camera.position.y += (Math.random() - .5) * S.shake; }
  camera.lookAt(view.target);
}

/* ---------- 界面 ---------- */
const hint = $("#hint"), bAll = $("#b-all"), bTake = $("#b-take");
const HINTS = { boot: "正在送来…", arrive: "来了一包", idle: "沿着封口，横着划开", tear: "继续划，划到头", burst: "", deal: "点一下可以快进", reveal: "点牌翻面", revealUp: "翻开的牌再点一下，拿到眼前看", done: "向上划，或点「收下」", inspect: "点任意处放回去", collect: "" };
function ui() {
  const allUp = cards.every((c) => c.up), anyUp = cards.some((c) => c.up);
  let key = S.state; if (S.state === "reveal") key = S.inspect >= 0 ? "inspect" : allUp ? "done" : anyUp ? "revealUp" : "reveal";
  hint.textContent = HINTS[key] || "";
  bAll.hidden = !(S.state === "reveal" && !allUp && S.inspect < 0); bTake.hidden = !(S.state === "reveal" && allUp && S.inspect < 0);
  $("#snd").setAttribute("aria-pressed", String(AU.on));
}
function setState(s) { S.state = s; ui(); }

/* ---------- 一包的一生 ---------- */
function arrive() {
  tracks.clear(); tearSoundStop(); S.stripFly = 0; flashes.forEach((f) => { f.material.opacity = 0; }); rings.forEach((r) => { r.material.opacity = 0; }); S.p = S.pShown = 0; S.fast = false; S.inspect = -1; S.shake = 0; S.freeze = 0; P.visible = true; P.away = 0; P.open = 0; P.shakeAmt = 0; mouthGlow.material.opacity = 0; burstLight.intensity = 0;
  stripMat.opacity = 1; segs.forEach((s) => { s.m.visible = true; s.m.scale.setScalar(1); }); S.dir = 1; layoutStrip(0);
  if (packMat.front.map) packMat.front.map.dispose(); packMat.front.map = tex(590, 750, drawPackFront); packMat.front.needsUpdate = true;
  dressCards(); cards.forEach((c) => { c.where = "pack"; c.flip = 0; c.spin = 0; c.roll = 0; c.lift = 0; c.scale = 1; c.up = false; c.busy = false; c.g.visible = true; c.glow.material.opacity = 0; });
  setState("arrive"); P.drop = 9;
  play(.55, (e) => { P.drop = lerp(9, 0, e); }, { ease: E.out5, done() { SFX.arrive(); play(.3, (e, k) => { P.drop = -Math.sin(k * Math.PI) * .12; }, { ease: E.lin, done() { P.drop = 0; setState("idle"); } }); } });
}
function cardInPack(c) {
  // 牌叠在包身里：位置跟着包走，背朝外
  vTmp.set(0, -STRIP / 2 - .02, (c.i - (N - 1) / 2) * .05); pack.updateMatrixWorld(); c.pos.copy(vTmp.applyMatrix4(pack.matrixWorld)); c.base.copy(pack.quaternion);
}
function burst() {
  setState("burst"); tearSoundStop(); S.p = S.pShown = 1; P.shakeAmt = 0; const m = M();
  SFX.snap(); buzz(m.flash ? 28 : 10);
  // 封条整条飞出去
  pack.updateMatrixWorld();
  segs.forEach((s, j) => { s.v.set(S.dir * (1.5 + Math.random() * 2) * (m.flash ? 1.6 : .5), (m.flash ? 4 : .6) + Math.random() * 1.5, 2 + Math.random() * 2); s.w.set(Math.random() * 6 - 3, Math.random() * 8 - 4, Math.random() * 6 - 3).multiplyScalar(m.flash ? 1 : .35); });
  play(.9, (e, k) => { stripMat.opacity = 1 - k; }, { ease: E.lin, done() { segs.forEach((s) => { s.m.visible = false; }); } });
  S.stripFly = .9;
  const mouth = new THREE.Vector3(0, PH / 2 - STRIP, 0).applyMatrix4(pack.matrixWorld);
  if (m.flash) {
    S.freeze = m.hitStop; S.shake = m.shake; doFlash(mouth, 9, .45); emit(110, mouth, 7, 3.5, 1.1);
    burstLight.position.copy(mouth); play(.5, (e) => { burstLight.intensity = (1 - e) * 60; }, { ease: E.out3 });
    play(.5, (e) => { mouthGlow.material.opacity = (1 - e) * .9; }, { ease: E.lin });
  } else play(.4, (e) => { mouthGlow.material.opacity = 0; }, { ease: E.lin });
  wait(m.flash ? .05 : .28, deal);
}
function deal() {
  setState("deal"); const m = M(); let landed = 0;
  pack.updateMatrixWorld(); const up = new THREE.Vector3(0, 1, 0).applyQuaternion(pack.quaternion);
  // 最上面那张先出来
  cards.forEach((c, order) => {
    cardInPack(c); c.where = "air"; c.busy = true;
    const p0 = c.pos.clone(), p1 = p0.clone().addScaledVector(up, 2.6), s = slots[c.i], p3 = s.pos.clone(), p2 = p3.clone(); p2.y += m.dealArc + 2.2;
    const q0 = c.base.clone();
    play(m.dealDur, (e, k) => {
      const a = 1 - e, b = e; // 三次贝塞尔
      c.pos.set(0, 0, 0).addScaledVector(p0, a * a * a).addScaledVector(p1, 3 * a * a * b).addScaledVector(p2, 3 * a * b * b).addScaledVector(p3, b * b * b);
      c.base.copy(q0).slerp(qLay, E.io3(clamp(k * 1.25))); c.roll = s.roll * e + (m.spin ? (1 - e) * Math.PI * 2 * (order % 2 ? 1 : -1) : 0);
      if (k < .05 && !c._out) { c._out = true; SFX.out(); }
    }, {
      delay: order * m.dealStagger, ease: m.spin ? E.out3 : E.io3,
      done() {
        c._out = false; c.pos.copy(p3); c.base.copy(qLay); c.roll = s.roll; c.where = "table"; SFX.land(); buzz(8);
        if (m.bounce) { doRing(p3.x, p3.z, 2.6, .35, .35); emit(8, p3, 2.2, 1.2, .5); play(.28, (e, k) => { c.lift = Math.sin(k * Math.PI) * m.bounce * (1 - k); }, { ease: E.lin, done() { c.lift = 0; } }); }
        play(.5, (e) => { c.glow.material.opacity = e * glowOf(c); }, { ease: E.out3 });
        c.busy = false; if (++landed === N) { S.fast = false; setState("reveal"); }
      },
    });
  });
  // 空包退场
  if (m.flash) play(.7, (e) => { P.away = e; }, { delay: .12, ease: E.in3, done() { P.visible = false; } });
  else play(.9, (e) => { P.away = e * .8; }, { delay: .3, ease: E.io3, done() { P.visible = false; } });
}
function glowOf(c) { return M().glow * (.1 + c.data.tier * .09); }
function flipCard(c, delay = 0) {
  if (c.up || c.busy || c.where !== "table") return; c.busy = true; c.up = true; const m = M();
  play(m.flipDur, (e, k) => {
    c.flip = E[m.flipEase](k); c.lift = Math.sin(k * Math.PI) * m.flipLift; c.scale = 1 + Math.sin(k * Math.PI) * .08;
    if (k > .45 && !c._f) { c._f = true; SFX.flip(); }
  }, {
    delay, ease: E.lin,
    done() {
      c._f = false; c.flip = 1; c.lift = 0; c.scale = 1; c.busy = false; SFX.shown(c.data.tier); buzz(6);
      play(.3, (e) => { c.glow.material.opacity = (1 - e) * glowOf(c); }, { ease: E.lin });
      if (m.flipFlash) { vTmp2.copy(c.pos); vTmp2.y += .3; doFlash(vTmp2.clone(), 3.2 + c.data.tier * 1.1, .32); emit(6 + c.data.tier * 8, vTmp2, 3, 2, .6); if (c.data.tier >= 3) S.shake = .1; }
      ui();
    },
  });
  ui();
}
function flipAll() { let d = 0; cards.forEach((c) => { if (!c.up) { flipCard(c, d); d += .11; } }); }
function inspectPose(c) {
  const D = Math.max(CW / (.8 * 2 * view.tanV * view.aspect), CH / (.72 * 2 * view.tanV));
  return camBase.clone().addScaledVector(camDir, -D).addScaledVector(scrUp, view.portrait ? .2 : 0);
}
function inspect(c) {
  if (!c.up || c.busy) return; c.busy = true; S.inspect = c.i; c.where = "hand"; const p0 = c.pos.clone(), p1 = inspectPose(c), r0 = c.roll; SFX.flip();
  play(.36, (e) => { c.pos.lerpVectors(p0, p1, e); c.base.copy(qLay).slerp(qFace, e); c.roll = r0 * (1 - e); }, { ease: E.out5, done() { c.busy = false; } }); ui();
}
function putBack() {
  const c = cards[S.inspect]; if (!c || c.busy) return; c.busy = true; const p0 = c.pos.clone(), s = slots[c.i];
  play(.3, (e) => { c.pos.lerpVectors(p0, s.pos, e); c.base.copy(qFace).slerp(qLay, e); c.roll = s.roll * e; }, { ease: E.io3, done() { c.busy = false; c.where = "table"; S.inspect = -1; SFX.land(); ui(); } });
}
function collect() {
  if (S.state !== "reveal" || !cards.every((c) => c.up) || cards.some((c) => c.busy)) return; setState("collect"); const m = M(); SFX.take(); buzz(12);
  const stack = new THREE.Vector3(0, .5, view.target.z); let gone = 0;
  cards.forEach((c, k) => {
    const p0 = c.pos.clone(), p1 = stack.clone(); p1.y += k * .05; const r0 = c.roll;
    play(.3, (e) => { c.pos.lerpVectors(p0, p1, e); c.roll = r0 * (1 - e); }, {
      delay: k * m.collectStagger * .6, ease: E.io3,
      done() {
        const a = c.pos.clone(), b = a.clone().addScaledVector(scrUp, -view.dist * view.tanV * 2.4).addScaledVector(camDir, 2);
        play(.34, (e) => { c.pos.lerpVectors(a, b, e); c.scale = 1 - e * .25; }, { delay: .12 + (N - k) * m.collectStagger, ease: E.in3, done() { c.g.visible = false; if (++gone === N) { S.taken += N; S.packNo++; wait(.25, arrive); } } });
      },
    });
  });
}

/* ---------- 手指 ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const G = { id: -1, x0: 0, y0: 0, x: 0, y: 0, t0: 0, moved: 0, mode: "", pw: 1, lastX: 0, lastT: 0, speed: 0, lastSeg: 0 };
function hitCard(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const h = ray.intersectObjects(cards.filter((c) => c.g.visible).map((c) => c.body), false)[0]; return h ? cards[h.object.userData.card] : null;
}
canvas.addEventListener("pointerdown", (ev) => {
  au(); if (G.id !== -1) return; G.id = ev.pointerId; G.x0 = G.x = G.lastX = ev.clientX; G.y0 = G.y = ev.clientY; G.t0 = G.lastT = performance.now(); G.moved = 0; G.mode = ""; G.speed = 0;
  try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
  if (S.state === "idle") {
    const r = packRect(), pad = 26;
    if (ev.clientX > r.l - pad && ev.clientX < r.r + pad && ev.clientY > r.t - pad && ev.clientY < r.b + pad) { G.mode = ev.clientY < r.t + (r.b - r.t) * .5 ? "tear?" : "poke"; G.pw = r.r - r.l; P.tpress = 1; }
  } else if (S.state === "deal") { S.fast = true; }
});
canvas.addEventListener("pointermove", (ev) => {
  S.par.tx = (ev.clientX / innerWidth - .5) * 2; S.par.ty = -(ev.clientY / innerHeight - .5) * 2;
  if (S.state === "idle" || S.state === "arrive") { P.tswayY = S.par.tx * .16; P.tswayX = -S.par.ty * .08; }
  else if (S.state !== "tear") P.tswayY = P.tswayX = 0;
  if (ev.pointerId !== G.id) return;
  const dx = ev.clientX - G.x0, dy = ev.clientY - G.y0; G.x = ev.clientX; G.y = ev.clientY; G.moved = Math.max(G.moved, Math.hypot(dx, dy));
  if (G.mode === "tear?" && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { G.mode = "tear"; S.dir = dx > 0 ? 1 : -1; G.x0 = ev.clientX - S.dir * 10; G.lastSeg = 0; setState("tear"); tearSoundStart(); }
  if (G.mode === "tear" && S.state === "tear") {
    const now = performance.now(), p = clamp((ev.clientX - G.x0) * S.dir / (G.pw * .82));
    G.speed = lerp(G.speed, Math.abs(ev.clientX - G.lastX) / Math.max(1, now - G.lastT) , .4); G.lastX = ev.clientX; G.lastT = now;
    S.p = p; tearSoundSet(G.speed, p); P.tswayY = S.dir * (.05 + p * .12);
    const seg = Math.floor(p * K); if (seg !== G.lastSeg) { if (seg > G.lastSeg) { SFX.tick(); buzz(4); if (M().sparks) { pack.updateMatrixWorld(); vTmp.set(-S.dir * PW / 2 + S.dir * p * PW, PH / 2 - STRIP, PT / 2).applyMatrix4(pack.matrixWorld); emit(5, vTmp.clone(), 2.6, 1.5, .45); } } G.lastSeg = seg; }
    if (p >= .985) { G.mode = "done"; burst(); }
  }
});
function endPointer(ev) {
  if (ev.pointerId !== G.id) return; G.id = -1; P.tpress = 0; const dt = performance.now() - G.t0, tap = G.moved < 12 && dt < 450, dx = G.x - G.x0, dy = G.y - G.y0;
  if (G.mode === "tear" && S.state === "tear") {
    tearSoundSet(0, S.p);
    if (S.p >= .7) { const from = S.p; play(.12 + (1 - from) * .2, (e) => { S.p = lerp(from, 1, e); }, { ease: E.in3, done: burst }); }
    else { const from = S.p; tearSoundStop(); setState("idle"); play(.28, (e) => { S.p = lerp(from, 0, e); }, { ease: E.out3 }); }
  } else if ((G.mode === "poke" || G.mode === "tear?") && S.state === "idle" && tap) { S.poke = 1; SFX.land(); play(.5, (e) => { S.poke = 1 - e; }, { ease: E.out3 }); hint.textContent = "沿着上边的封口，横着划开"; }
  else if (S.state === "reveal") {
    if (S.inspect >= 0) { if (tap) putBack(); }
    else if (dy < -70 && Math.abs(dy) > Math.abs(dx) * 1.3 && cards.every((c) => c.up)) collect();
    else if (tap) { const c = hitCard(G.x, G.y); if (c) { if (!c.up) flipCard(c); else inspect(c); } }
  }
  G.mode = "";
}
canvas.addEventListener("pointerup", endPointer); canvas.addEventListener("pointercancel", endPointer);
$("#snd").addEventListener("click", () => { AU.on = !AU.on; try { localStorage.setItem("lab-pack-snd", AU.on ? "1" : "0"); } catch (e) { /* 忽略 */ } if (!AU.on) tearSoundStop(); else { au(); SFX.tick(); } ui(); });
bAll.addEventListener("click", () => { au(); flipAll(); }); bTake.addEventListener("click", () => { au(); collect(); });
addEventListener("resize", fit);
if (window.DeviceOrientationEvent && "ontouchstart" in window) addEventListener("deviceorientation", (ev) => { if (ev.gamma == null) return; S.par.tx = clamp(ev.gamma / 30, -1, 1); S.par.ty = clamp((ev.beta - 45) / 40, -1, 1) * .6; });

/* ---------- 每一帧 ---------- */
let last = performance.now(), fps = 60, devEl = null;
if (DEV) { devEl = document.createElement("div"); devEl.className = "dev"; document.body.appendChild(devEl); }
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(.05, (now - last) / 1000); last = now; fps = lerp(fps, 1 / Math.max(raw, 1e-3), .05);
  if (!S.manual) tick(raw);
}
function tick(raw) {
  let dt = raw; if (S.freeze > 0) { S.freeze -= raw; dt = 0; } else if (S.fast && S.state === "deal") dt *= 6;
  S.t += dt ? raw : 0; S.shake *= Math.exp(-9 * raw);
  stepTracks(dt);
  // 撕口：显示的进度追着手指走，稍带一点惯性
  S.pShown = lerp(S.pShown, S.p, 1 - Math.exp(-28 * raw));
  if (S.state === "idle" || S.state === "tear" || S.state === "arrive") {
    layoutStrip(S.pShown);
    const ch = M().charge * S.pShown; mouthGlow.material.opacity = ch * .75; P.shakeAmt = S.state === "tear" ? ch * .05 : 0;
  } else if (S.stripFly > 0) {
    S.stripFly -= dt; segs.forEach((s) => { s.v.y -= 12 * dt; s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt; s.m.rotation.z += s.w.z * dt; });
  }
  placeCamera(); applyPack();
  cards.forEach((c) => {
    if (c.where === "pack") { cardInPack(c); }
    applyCard(c);
    c.glow.position.set(c.pos.x, .012, c.pos.z); const gs = 1 + (c.data ? c.data.tier * .07 : 0) + (M().glow > .5 ? Math.sin(S.t * 3 + c.i) * .04 : 0); c.glow.scale.set((CW + 1.5) * gs, (CH + 1.5) * gs, 1);
    c.glow.visible = c.where === "table" && c.glow.material.opacity > .003;
  });
  stepSparks(dt);
  renderer.render(scene, camera);
  if (devEl) devEl.textContent = S.state + " · " + S.mode + " · p " + S.pShown.toFixed(2) + "\n" + fps.toFixed(0) + " fps · " + renderer.info.render.calls + " calls";
}

/* ---------- 开场 ---------- */
buildCards(); fit();
const texts = DECK.map((c) => c.g + c.title + c.src).join("") + "剪报本周收件件读完约分钟沿这条边划开";
const fontsReady = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('900 100px "Noto Serif SC"', texts), document.fonts.load('700 80px "Noto Serif SC"', texts), document.fonts.load('500 30px "Noto Sans SC"', texts), document.fonts.load('600 30px "IBM Plex Mono"', "F0123456789 NO.")]) : Promise.resolve();
Promise.race([Promise.all([fontsReady, whenReady()]), new Promise((r) => setTimeout(r, 2500))]).catch(() => {}).then(() => { arrive(); requestAnimationFrame(frame); });

window.__lab = {
  S, cards, get state() { return S.state; },
  tearTo(p) { if (S.state !== "idle" && S.state !== "tear") return; S.state = "tear"; S.p = p; if (p >= 1) burst(); },
  flip(i) { flipCard(cards[i]); }, flipAll, collect, inspect(i) { inspect(cards[i]); }, putBack, arrive,
  packRect, mode(m) { S.mode = m; arrive(); },
  manual(on) { S.manual = !!on; }, step(sec) { for (let t = sec; t > 1e-6; t -= 1 / 60) tick(Math.min(1 / 60, t)); },
};
