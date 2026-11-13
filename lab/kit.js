/* lab 里样机公用的零件：小工具、动画轨、现场合成的声音、三维舞台（渲染器与光）、书的样子（书脊图集、实例化的盒子）、架子。
 * 2026-11-12 做第三个样机（进门）时从 shelf.js 抽出来，书架和进门两页共用；pack.js 是最早写的，自带一份没有动。
 * 2026-11-13 选外观阶段：三个瞬间都过门了，这里加一张外观表 LOOKS（颜色、材质、光、书脊怎么画、架子的样子、网页上那层字的颜色）。
 *   灰盒是过门时的样子，另外三个是候选的方向样张（纸模、玩具盒、旧书房），只用代码和仓库里已有的纸浆图做，不是成品。
 *   地址加 ?look=paper|toy|study|grey 切换，选过的记在这台设备上，几个样机页一起换；页面顶栏的「外观」按钮也能换。
 *   读没读的区分不变：没读是浅的（包着纸）、读过是深的、在读探出来带签，只靠明暗和形状。
 * 2026-11-13 用户选定旧书房：没选过的设备打开就是它，单子上只列旧书房和灰盒；纸模、玩具盒是落选的样张，留着对照，
 *   只有地址带 ?look=paper|toy 才看得到，不再跟进。拆包页（pack.js）也接到这张表上（每种外观的 pk 一栏），只做了旧书房和灰盒。
 * 2026-11-13「材质」一门（用户点头下载以后）：旧书房的架子、地、拆包页的桌面贴真的木纹，抽出来的那本书和牌背加布纹的凹凸，
 *   烫金反环境光。木纹和布纹是 Poly Haven 的扫描图（CC0），转成 WebP 放在 vendor/tex/；环境光是这里用代码搭的，不是图。
 *   图读不到就退回代码画的花纹，页面照常能用。整面墙上的书脊没有上金属反光（一本只有十几个像素宽，看不出来，反而会让书名发暗）。
 * 2026-11-13「造型」一门：旧书房的架子加线脚（压顶线、平带、壁柱、层板的圆前沿、底座，剖面写在 createCase 里，沿外沿走一圈，
 *   架子多宽多高都跟着长）；书有封面板、飘口和圆脊（bookGeo，架上的书由着色器按每本的大小摆，抽出来的那本用 bakeBook）；
 *   切角的盒子 chamferBox 给纸包用。别的外观还是原来的方板和方盒子。
 * 2026-11-13「看光」一门：旧书房的灯光有一圈（圈心亮、圈外暗），架子里靠上、往里、贴着侧板的地方和墙根地脚暗下去。
 *   都是在材质里按位置算的（aoHook），不换灯、不加贴图，影子不变；抽出来飞到眼前的书不受影响。网页上那层暗角里掺了一点颗粒。 */
import * as THREE from "../vendor/three/three.module.min.js";   // 直接按相对路径引，不用 importmap（旧一点的手机浏览器不认）
export { THREE };

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const rad = THREE.MathUtils.degToRad;
export const E = {
  lin: (k) => k,
  out3: (k) => 1 - Math.pow(1 - k, 3),
  in2: (k) => k * k,
  io3: (k) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  back: (k) => { const s = 1.6, t = k - 1; return 1 + (s + 1) * t * t * t + s * t * t; },
};
export const vib = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* 苹果手机没有 */ } };
const QS = new URLSearchParams(location.search);
export function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- 小动画轨 ---------- */
export function createTracks() {
  const tracks = new Set();
  function play(dur, fn, o = {}) { const tr = { t: -(o.delay || 0), dur: Math.max(dur, 1e-4), fn, ease: o.ease || E.out3, done: o.done }; tracks.add(tr); return tr; }
  function wait(sec, done) { return play(sec, () => {}, { done }); }
  function step(dt) {
    for (const tr of [...tracks]) {
      if (!tracks.has(tr)) continue;
      tr.t += dt; if (tr.t < 0) continue;
      const k = Math.min(1, tr.t / tr.dur); tr.fn(tr.ease(k), k);
      if (k >= 1) { tracks.delete(tr); if (tr.done) tr.done(); }
    }
  }
  return { play, wait, step, clear: () => tracks.clear() };
}

/* ---------- 声音（现场合成，没有音频文件）。开关几个样机共用一个记号 ---------- */
export function createAudio() {
  const AU = { ctx: null, master: null, on: true, buf: null };
  try { if (localStorage.getItem("lab-pack-snd") === "0") AU.on = false; } catch (e) { /* 忽略 */ }
  function au(gesture) {             // gesture：这次是不是手指点出来的。浏览器不许页面一打开就出声，第一次得由手指来建
    if (!AU.on) return null;
    if (!AU.ctx) {
      if (!gesture) return null;
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
  function toggle() { AU.on = !AU.on; try { localStorage.setItem("lab-pack-snd", AU.on ? "1" : "0"); } catch (e) { /* 忽略 */ } return AU.on; }
  return { AU, au, noise, tone, toggle };
}

/* ---------- 外观表 ---------- */
export const CJK = '"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC","SimSun",serif';   // 画布上的字用系统字体：几百个书名要是走自带字体会拉很多分片
const SANS = '"PingFang SC","Noto Sans CJK SC","Source Han Sans SC","Microsoft YaHei",sans-serif';
export const LOOKS = {
  grey: {
    name: "灰盒", bg: 0x2a221c, hemi: [0xfff1dc, 0x4a3c30, 1.55], key: [0xfff4e2, 2.3], sun: [-.5, .75, .8], soft: 3,
    tones: ["#4B4138", "#5C5142", "#3C3D44", "#66574A", "#50433D", "#454F49"], pale: "#D8CEBC", inkLt: "#EADDC4", inkSoft: "#8B7C69", paper: "#E9E0CE", tab: "#FFF3DC", tabGlow: .28,
    spine: "plain", font: CJK, bookRough: .86, grain: null,
    dim: { SH: 29, BT: 2, ST: 2, CD: 21, PL: 5 },
    cs: { frame: 0x8f7d6a, back: 0x51463d, wall: 0x40352e, floor: 0x2c231d, div: 0x2a221c, rough: .9, tex: null, ao: 0 },
    css: { bg: "#2A221C", ink: "#F3E7D3", ink2: "rgba(243,231,211,.72)", pane: "rgba(30,23,18,.78)", line: "rgba(243,231,211,.28)", on: "#2A221C", halo: "rgba(0,0,0,.8)", sheet: "20,15,12", lab: "rgba(24,18,14,.88)", scheme: "dark" }, veil: 0x120d0a,
    props: { pack: 0x3b2a20, band: 0xc9b089, bandH: 2.2, notes: [0x5e5a48, 0x6a4a3a] },                          // 进门页最下面一层摆的牌盒和本子
    // 拆包页：背景、天光、主光、桌面（三圈颜色的渐变）、牌背的底与线、牌面、墨、编号的颜色、包的正面与四周
    pk: { style: "plain", bg: 0x2a221c, hemi: [0xfff1dc, 0x3a2f26, 1.5], key: [0xfff4e2, 2.5], table: ["#9a8b79", "#857665", "#4d4239"],
      cardBack: "#3B2416", cardLine: "#C4763A", cardFace: "#E6D2B0", ink: "#3E1D00", accent: "#8B4319", kraft: "#B98C5E",
      side: 0xa67a4e, rear: 0xb98c5e, strip: 0x9c6f44, mouth: 0x1e150e, edge: 0xd9c7a8 },
  },
  // 纸模：和每天用的纸模版一个色系（奶油、赤陶、可可），亮的桌面上一座卡纸折的架子
  paper: {
    name: "纸模", bg: 0xe3d8c2, hemi: [0xffffff, 0xcabfa8, 1.75], key: [0xfff3e0, 2.15], sun: [-.55, .8, .75], soft: 4,
    tones: ["#4F5330", "#33414F", "#4A2E1E", "#553348", "#2E5550", "#6E5220"], pale: "#F5EFE1", inkLt: "#F6EFE1", inkSoft: "#A09380", paper: "#FBF7EE", tab: "#F0B429", tabGlow: .12,
    spine: "paper", font: SANS, bookRough: .97, grain: "pulp", jit: .09,
    dim: { SH: 29, BT: 1.6, ST: 1.6, CD: 21, PL: 4 },
    cs: { frame: 0xb5532e, back: 0x4a2a1c, wall: 0xe3d8c2, floor: 0xd9cdb5, div: 0x3b2416, rough: 1, tex: "pulp", tile: 26, ao: .34 },
    css: { bg: "#E3D8C2", ink: "#3B2416", ink2: "rgba(59,36,22,.7)", pane: "rgba(248,242,229,.9)", line: "rgba(59,36,22,.24)", on: "#F8F2E5", halo: "rgba(248,242,229,.95)", sheet: "236,227,208", lab: "rgba(248,242,229,.94)", scheme: "light" }, veil: 0xb9ad96,
  },
  // 玩具盒：一块颜色的背景前面一座白漆的厚板架子，书是两截颜色的积木
  toy: {
    name: "玩具盒", bg: 0x4a9a9d, hemi: [0xffffff, 0x8cc4c4, 1.9], key: [0xffffff, 2.2], sun: [-.45, .85, .8], soft: 5,
    tones: ["#22346B", "#6A2C5A", "#A63F28", "#1F6A4A", "#8F6210", "#2E3138"], tones2: ["#5C6FA8", "#A865A0", "#D98468", "#5BA584", "#C99A45", "#6E737D"],
    pale: "#FBF8F1", pale2: "#E1E6EA", inkLt: "#FFFFFF", inkSoft: "#8F99A3", paper: "#FFFDF8", tab: "#FFD23F", tabGlow: .22,
    spine: "toy", font: SANS, bookRough: .5, grain: null,
    dim: { SH: 29, BT: 2.8, ST: 3.2, CD: 21, PL: 5 },
    cs: { frame: 0xfaf4e8, back: 0x1c5a61, wall: 0x4a9a9d, floor: 0x44929a, div: 0xfaf4e8, rough: .55, tex: null, ao: .3 },
    css: { bg: "#4A9A9D", ink: "#FFFFFF", ink2: "rgba(255,255,255,.82)", pane: "rgba(16,62,68,.74)", line: "rgba(255,255,255,.42)", on: "#134A50", halo: "rgba(8,48,54,.7)", sheet: "16,62,68", lab: "rgba(16,62,68,.9)", scheme: "dark" }, veil: 0x0e3a40,
  },
  // 旧书房：暗处一盏暖灯，胡桃木的架子，布面烫金的书；没读的包着牛皮纸捆两道麻绳
  study: {
    name: "旧书房", bg: 0x1c1510, hemi: [0xffdcb0, 0x33241a, 1.05], key: [0xffd29a, 3.5], sun: [-.38, .95, .72], soft: 4,
    tones: ["#5C1F1F", "#1F3B2E", "#1E2A45", "#5A3B1E", "#3F2440", "#2A2420"], pale: "#DCCBA6", inkLt: "#E7D3A0", inkSoft: "#5E4226", paper: "#E6D9BC", tab: "#FFE2A8", tabGlow: .7,
    gilt: "#D9B56A", twine: "#8A6A42",
    spine: "study", font: CJK, bookRough: .82, grain: "cloth", jit: .16,
    dim: { SH: 29, BT: 2.2, ST: 2.6, CD: 21, PL: 8 },
    // 造型（2026-11-13「造型」一门）。mould：架子的线脚，单位厘米。stile 壁柱比侧板往外宽多少、stileT 往前凸多少；frieze 压顶线下面那条平带多高；
    //   k 压顶线和底座线脚整体放大多少（1 是量参考时定的原大：压顶高 5.9 出 4.6，底座线脚出 2.2）
    // aoK：角落里的暗有多重（看光一门；架子里靠上、往里、贴着侧板的地方，墙和地靠近架子的一圈，都是按位置算的，不用贴图）。有了它就不用每层后面那片影子了（ao 归零）
    cs: { frame: 0x6f4526, back: 0x2c1b10, wall: 0x3a2a1d, floor: 0x2a1c12, div: 0x2a1a10, rough: .72, tex: "wood", tile: 64, wallTex: "panel", ao: 0, aoK: .9,
      mould: { stile: 1, stileT: 1, frieze: 2.6, k: .75 } },
    // 看光（2026-11-13「看光」一门）：灯光有一圈，不是到处一样亮。主光还是那盏平行光（影子不变），亮度按位置乘一个数：
    //   x、y 最亮的那一点在架子的哪里（宽、高的比例，中线是 0）；r 光圈多大（按宽高里大的那个算）；hi 圈心亮多少、lo 圈外暗到多少。
    //   只管贴着架子和墙的东西；抽出来飞到眼前的书不受影响
    pool: { x: -.12, y: .7, r: .62, hi: 1.32, lo: .5 },
    film: .035,                                              // 网页上那层暗角里掺的颗粒有多重（暗处的渐变在手机屏上容易看出一道道台阶，颗粒把它打散）
    // 书的样子：board 封面板厚、sq 封面比书芯多出来的一圈（飘口），都是厘米；sag 圆脊鼓出来多少（按书厚的比例）；seg 圆脊分几段
    book: { board: .25, sq: .3, sag: .22, seg: 6 },
    css: { bg: "#1C1510", ink: "#F0DFC0", ink2: "rgba(240,223,192,.76)", pane: "rgba(26,18,12,.8)", line: "rgba(217,181,106,.5)", on: "#1A130E", halo: "rgba(0,0,0,.9)", sheet: "18,13,9", lab: "rgba(22,15,10,.9)", scheme: "dark" }, veil: 0x0b0806,
    props: { pack: 0xc2a06c, band: 0x7a5a36, bandH: .5, notes: [0x3a2618, 0x1e2a45] },                           // 牌包是牛皮纸捆麻绳，和拆包页的那一包一个样
    // 真的材质（2026-11-13「材质」一门）：扫描的木头和书布，图在 vendor/tex/。tile：一张图铺多少厘米；grainX：木纹顺着图的横向走；
    //   tint：乘在木头图上的颜色（线性的三个数，可以大于一），架子、背板、地、拆包页的桌面各一个；depth：布纹凹多深
    real: {
      wood: { map: "dark_wood_diff_1k.webp", rough: "dark_wood_rough_1k.webp", tile: 100, grainX: true, roughK: 1, tint: { frame: [1.45, 2.2, 2], back: [.25, .45, .5], floor: [.24, .5, .62], table: [.95, 1.3, 1.25] } },
      cloth: { nor: "book_pattern_nor_gl_1k.webp", tile: 30, depth: 1.3 },
    },
    // 环境光（用代码搭一间暗屋子烘出来，不是下载的图）：屋子的底色与亮度；几盏灯（位置、大小、颜色、亮度）；k：烫金反多少
    //   屋子要暗、灯要小而亮：金只在对着灯的角度亮起来，布面不会被环境光整片抬亮
    env: { room: [0x8a6a48, .15], lamps: [[-2.4, 3.2, 2.8, 1.5, 0xffd9a8, 3.2], [.6, .3, 4.7, 1.7, 0xffcf9a, 1.5], [0, 4.8, .2, 2.2, 0xffd9a8, 3]], k: 1 },
    // 拆包页：胡桃木的桌面上一盏灯；包是牛皮纸捆两道麻绳、贴一张签、盖一枚邮戳；牌背是藏青的布面烫金，牌面是米色的纸
    pk: { style: "study", bg: 0x1c1510, hemi: [0xffdcb0, 0x33241a, .5], key: [0xffd29a, 1.7], lamp: [0xffc98a, 88], table: 0x5e3d24,
      cardBack: "#1E2A45", cardLine: "#D9B56A", cardFace: "#EDE1C6", ink: "#2B1A0E", accent: "#7A4A1E", kraft: "#C9A877", tableTile: 16, clothTile: 9,   // 桌面的木纹一张图铺十六个单位（再大在高分屏上就糊了）；牌背的布纹一张图铺九个单位
      side: 0xb08f5f, rear: 0xc2a06c, strip: 0xb7996a, mouth: 0x140d08, edge: 0xcfae6a, twine: 0x7a5a36 },
  },
};
const SHOWN = ["study", "grey"], STORE = "lab-skin";      // 单子上列哪几种；记在设备上的名字（定了旧书房以后换过一次名，之前试候选时记下的不算数）
function pickLook() {
  const only = (document.documentElement.dataset.looks || "").split(" ").filter(Boolean);   // 这一页只做了哪几种（写在 <html data-looks> 上；没写就是都有）
  const ok = (k) => !!LOOKS[k] && (!only.length || only.includes(k));
  let k = QS.get("look");
  try { if (ok(k)) { if (SHOWN.includes(k)) localStorage.setItem(STORE, k); } else k = localStorage.getItem(STORE); } catch (e) { /* 存不了就只认地址 */ }
  return ok(k) ? k : "study";
}
export const LOOK_KEY = pickLook(), LOOK = LOOKS[LOOK_KEY];

// 网页上那层字和按钮跟着外观换颜色；顶栏的「外观」按钮点开一张小单子
function applyLook() {
  const st = document.documentElement.style, c = LOOK.css;
  Object.entries({ "--bg": c.bg, "--ink": c.ink, "--ink-2": c.ink2, "--pane": c.pane, "--line": c.line, "--on": c.on, "--halo": c.halo, "--sheet": c.sheet, "--lab": c.lab }).forEach(([k, v]) => st.setProperty(k, v));
  st.colorScheme = c.scheme; document.documentElement.dataset.look = LOOK_KEY;
  const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = c.bg;
  if (LOOK.film) {                                           // 一小块随机的黑白点，平铺在暗角那一层上
    const n = canvasOf(128, 128, (g, w, h) => { const d = g.createImageData(w, h), r = rng(5); for (let i = 0; i < w * h; i++) { const v = r() < .5 ? 0 : 255; d.data.set([v, v, v, Math.round(r() * 255 * LOOK.film)], i * 4); } g.putImageData(d, 0, 0); });
    st.setProperty("--film", "url(" + n.toDataURL("image/png") + ")");
  }
  const css = document.createElement("style");
  css.textContent = `
    .lookmenu{position:fixed;z-index:30;display:none;flex-direction:column;gap:4px;padding:6px;border-radius:14px;background:var(--pane);border:1px solid var(--line);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 10px 28px rgba(0,0,0,.35)}
    .lookmenu.on{display:flex}
    .lookmenu button{appearance:none;border:0;background:none;color:var(--ink);font:500 15px/1 inherit;font-family:inherit;padding:12px 16px;border-radius:10px;text-align:left;cursor:pointer;white-space:nowrap}
    .lookmenu button[aria-pressed="true"]{background:var(--ink);color:var(--on);font-weight:700}
    .lookmenu small{display:block;margin-top:5px;font-size:11.5px;font-weight:400;opacity:.75}
    html[data-look="study"] body::after{content:"";position:fixed;inset:0;pointer-events:none;background-size:64px 64px,auto,auto;background:var(--film,none),radial-gradient(ellipse at 50% 34%,rgba(255,186,104,.09),rgba(255,186,104,0) 58%),radial-gradient(ellipse at 50% 42%,rgba(0,0,0,0) 46%,rgba(0,0,0,.4) 100%)}
    html[data-look="study"] .bar h1,html[data-look="study"] .go,html[data-look="study"] .snd,html[data-look="study"] .seg button,html[data-look="study"] .mini,html[data-look="study"] .bag,html[data-look="study"] .acts button{font-family:"Noto Serif SC","Songti SC",serif}
    html[data-look="paper"] .go,html[data-look="paper"] .snd,html[data-look="paper"] .seg,html[data-look="paper"] .seg button,html[data-look="paper"] .mini,html[data-look="paper"] .bag,html[data-look="paper"] .lab,html[data-look="paper"] .tip,html[data-look="paper"] .sheet .main,html[data-look="paper"] .lookmenu,html[data-look="paper"] .lookmenu button{border-radius:5px}
    html[data-look="paper"] .bar h1,html[data-look="toy"] .bar h1{font-family:"Noto Sans SC","PingFang SC",sans-serif}
    html[data-look="toy"] .go,html[data-look="toy"] .snd,html[data-look="toy"] .seg button,html[data-look="toy"] .mini,html[data-look="toy"] .bag{font-weight:700}
  `;
  document.head.appendChild(css);
  const sub = document.querySelector(".bar h1 small"); if (sub) sub.textContent = LOOK_KEY === "grey" ? "灰盒：只看手感，不看外观" : LOOK.name + "：样张，还没到成品";
  const btn = document.getElementById("look"); if (!btn) return;
  btn.textContent = innerWidth < 430 ? "外观" : "外观：" + LOOK.name;      // 窄屏只写两个字，点开的单子里看得到现在是哪个
  const menu = document.createElement("div"); menu.className = "lookmenu"; menu.setAttribute("role", "menu");
  const NOTE = { grey: "过门时的占位样子", study: "暗处一盏暖灯，布面烫金" };
  SHOWN.forEach((k) => {
    const b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-pressed", String(k === LOOK_KEY)); b.dataset.look = k;
    b.textContent = LOOKS[k].name; const sm = document.createElement("small"); sm.textContent = NOTE[k]; b.appendChild(sm);
    b.addEventListener("click", () => { if (k === LOOK_KEY) { menu.classList.remove("on"); return; } const u = new URL(location.href); u.searchParams.set("look", k); location.href = u.href; });
    menu.appendChild(b);
  });
  document.body.appendChild(menu);
  btn.addEventListener("click", (ev) => {
    ev.stopPropagation(); const r = btn.getBoundingClientRect(); menu.classList.toggle("on");
    menu.style.top = Math.round(r.bottom + 8) + "px"; menu.style.right = Math.max(8, Math.round(innerWidth - r.right)) + "px";
  });
  addEventListener("pointerdown", (ev) => { if (!menu.contains(ev.target) && ev.target !== btn) menu.classList.remove("on"); });
}
applyLook();

// 小块的花纹：纸浆、布纹、木纹、护墙板。都是浅底上压一点深，贴上去再乘面的颜色
function canvasOf(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); return c; }
const PATTERN = {
  pulp: () => canvasOf(96, 96, (g, w, h) => {
    const r = rng(7); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = "rgba(70,48,24," + (r() * .07).toFixed(3) + ")"; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
    for (let i = 0; i < 120; i++) { g.strokeStyle = "rgba(80,56,30," + (.05 + r() * .09).toFixed(3) + ")"; g.lineWidth = .7; const x = r() * w, y = r() * h, a = r() * 6.28, l = 4 + r() * 10; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }),
  cloth: () => canvasOf(8, 8, (g, w, h) => {
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = "rgba(0,0,0,.1)"; g.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 2) { g.fillStyle = "rgba(0,0,0,.07)"; g.fillRect(x, 0, 1, h); }
  }),
  wood: () => canvasOf(256, 512, (g, w, h) => {              // 竖着的木纹：深浅不匀的细条，偶尔一道深的
    const r = rng(11); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 1 + r() * 2.5) { g.fillStyle = "rgba(40,18,4," + (.05 + r() * .22).toFixed(3) + ")"; g.fillRect(x, 0, .6 + r() * 2.2, h); }
    for (let i = 0; i < 9; i++) { const x = r() * w; g.fillStyle = "rgba(30,12,2,.3)"; g.fillRect(x, 0, 1 + r() * 2, h); g.fillStyle = "rgba(255,240,220,.16)"; g.fillRect(x + 3 + r() * 5, 0, 2 + r() * 5, h); }
    for (let i = 0; i < 260; i++) { g.fillStyle = "rgba(30,12,2," + (.05 + r() * .12).toFixed(3) + ")"; g.fillRect(r() * w, r() * h, 1, 8 + r() * 40); }
  }),
  panel: () => canvasOf(256, 256, (g, w, h) => {             // 护墙板：一块块竖板，缝是深的
    const r = rng(13); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 1 + r() * 3) { g.fillStyle = "rgba(20,10,4," + (.04 + r() * .14).toFixed(3) + ")"; g.fillRect(x, 0, 1 + r() * 2, h); }
    g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(0, 0, 3, h); g.fillStyle = "rgba(255,230,200,.14)"; g.fillRect(3, 0, 2, h);
  }),
};
export function patternTex(kind) {                                  // 浅底的花纹平均下来比白暗一点，面色乘回去
  const t = new THREE.CanvasTexture(PATTERN[kind]()); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.center.set(.5, .5); t.userData.gain = kind === "pulp" ? 1.06 : 1.2; return t;
}

/* ---------- 真的材质（旧书房）：扫描的木头和书布，转成 WebP 放在 vendor/tex/（来源见那里的 SOURCES.md） ---------- */
const TEX = { wood: null, cloth: null };
function loadTex() {
  const R = LOOK.real; if (!R) return Promise.resolve(TEX);
  const L = new THREE.TextureLoader(), W = R.wood;
  const one = (f, srgb) => new Promise((res) => {
    if (!f) return res(null);
    L.load(new URL("../vendor/tex/" + f, import.meta.url).href, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.center.set(.5, .5); if (srgb) t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(null));
  });
  return Promise.all([one(W.map, true), one(W.rough), one(R.cloth.nor)]).then(([map, rough, nor]) => {
    if (map) TEX.wood = { ...W, map, rough }; if (nor) TEX.cloth = { ...R.cloth, nor }; return TEX;      // 哪张没读到就退回代码画的花纹
  });
}
export const texReady = loadTex();                           // 图读完（或者读不到）以后才算数；没有真材质的外观马上就好
export const whenReady = (ms = 1500) => Promise.race([texReady, new Promise((r) => setTimeout(r, ms))]);   // 样机页等它再开场，等不到就先开，图到了再换上
// 真木纹的两张图，裁成一块板用的样子。across / along：横着木纹、顺着木纹各有多长（厘米，或者自己给 tile）；turn：木纹顺着这一面的横向走；seed：每块板错开一点，不长得一样
export function woodMaps(across, along, turn, seed = 0, tile) {
  const W = TEX.wood; if (!W) return null; const T = tile || W.tile, a = across / T, b = along / T;
  const cut = (src) => { if (!src) return null; const t = src.clone(); t.repeat.set(W.grainX ? b : a, W.grainX ? a : b); t.rotation = (W.grainX ? !turn : turn) ? Math.PI / 2 : 0; t.offset.set((seed * .37) % 1, (seed * .61) % 1); t.needsUpdate = true; return t; };
  return { map: cut(W.map), roughnessMap: cut(W.rough), cfg: W };
}
export function woodOn(mat, part, across, along, turn, seed, tile) {   // 把真木纹贴到一个材质上；回来的是新做的贴图（用完要自己 dispose），没有真木纹就回空
  const w = woodMaps(across, along, turn, seed, tile); if (!w) return null; const c = w.cfg, t = c.tint[part] || [1, 1, 1];
  mat.map = w.map; mat.roughnessMap = w.roughnessMap; mat.roughness = c.roughK; mat.color.setRGB(t[0], t[1], t[2]);
  mat.needsUpdate = true;                                    // 木头不反环境光：桌面和地是铺满整屏的，每个像素都去查环境光太费，手机吃不消；亮哑靠那张反光图和灯
  return [w.map, w.roughnessMap].filter(Boolean);
}
// 环境光：一间暗屋子加几盏灯，烘成一张模糊的全景，给烫金反光用
let ENV = null;
export function makeEnv(renderer) {
  const e = LOOK.env; if (!e) return null;
  const sc = new THREE.Scene(), junk = [];
  const add = (geo, color, k, side) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side })); junk.push(geo, m.material); sc.add(m); return m; };
  add(new THREE.BoxGeometry(10, 10, 10), e.room[0], e.room[1], THREE.BackSide);
  e.lamps.forEach(([x, y, z, size, color, k]) => { const m = add(new THREE.PlaneGeometry(size, size), color, k, THREE.DoubleSide); m.position.set(x, y, z); m.lookAt(0, 0, 0); });
  const pm = new THREE.PMREMGenerator(renderer); ENV = pm.fromScene(sc, .04).texture; pm.dispose(); junk.forEach((o) => o.dispose());
  return ENV;
}
// 烫金：另画一张图说「哪里是金」（绿管粗糙、蓝管金属），金的地方反环境光。没有环境光的外观什么都不做
export const MASK = { cloth: "rgb(0,214,0)", paper: "rgb(0,235,0)", gilt: "rgb(0,80,196)" };   // 金：比布面光滑得多；金属只给到七成多，留一点漆的底色，背着光的角度书名也还看得见
export function foil(mat, maskTex) {
  if (!ENV) return false; mat.metalnessMap = mat.roughnessMap = maskTex; mat.metalness = 1; mat.roughness = 1; mat.envMap = ENV; mat.envMapIntensity = LOOK.env.k; mat.needsUpdate = true; return true;
}
// 布纹的凹凸：这一面有多宽多高（厘米，或者自己给 tile）；on=false 是包着纸的，不要布纹
export function weave(mat, w, h, on = true, tile) {
  const c = TEX.cloth; if (!c) return;
  if (!mat.normalMap) { mat.normalMap = c.nor.clone(); mat.normalMap.needsUpdate = true; mat.needsUpdate = true; }
  mat.normalMap.repeat.set(w / (tile || c.tile), h / (tile || c.tile)); mat.normalScale.setScalar(on ? c.depth : 0);
}

/* ---------- 造型的零件（旧书房「造型」一门）：切角的盒子、线脚、书 ---------- */
function geoOf(P, N, U, groups, extra) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  if (extra) Object.entries(extra).forEach(([k, a]) => g.setAttribute(k, new THREE.Float32BufferAttribute(a, 3)));
  if (groups) groups.forEach(([start, count, mi]) => g.addGroup(start, count, mi));
  return g;
}
// 切角的盒子：棱上都切掉一条 c 宽的斜面，光打上去棱是一道亮线，看着像折出来的纸包而不是一块砖。
// 六个大面各一个材质号（和 BoxGeometry 一样：+x -x +y -y +z -z），斜面和角是第七个（6）
export function chamferBox(w, h, d, c) {
  const H = [w / 2, h / 2, d / 2], P = [], N = [], U = [], idx = [[], [], [], [], [], [], []];
  const pt = (s, ax) => s.map((sg, k) => sg * (H[k] - (k === ax ? 0 : c)));        // 一个角上、落在 ax 这个面上的那个点
  const poly = (pts, mi, uvs) => {                                                 // 一个平的多边形：法线朝外（按中心方向定），扇形拆成三角
    const a = pts[0], b = pts[1], e = pts[2], n = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(new THREE.Vector3(e[0] - a[0], e[1] - a[1], e[2] - a[2])).normalize();
    const cen = pts.reduce((m, q) => [m[0] + q[0], m[1] + q[1], m[2] + q[2]], [0, 0, 0]); let order = pts.map((_, k) => k);
    if (n.x * cen[0] + n.y * cen[1] + n.z * cen[2] < 0) { n.negate(); order = order.reverse(); }
    for (let k = 1; k + 1 < order.length; k++) [order[0], order[k], order[k + 1]].forEach((o) => { idx[mi].push(P.length / 3); P.push(...pts[o]); N.push(n.x, n.y, n.z); U.push(...(uvs ? uvs[o] : [.5, .5])); });
  };
  const S = [-1, 1];
  [0, 1, 2].forEach((ax) => S.forEach((sg) => {                                     // 六个大面
    const u = (ax + 1) % 3, v = (ax + 2) % 3, pts = [], uvs = [];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([su, sv]) => { const sgn = [0, 0, 0]; sgn[ax] = sg; sgn[u] = su; sgn[v] = sv; pts.push(pt(sgn, ax)); });
    pts.forEach((q) => { uvs.push(ax === 2 ? [sg * q[0] / w + .5, q[1] / h + .5] : ax === 0 ? [-sg * q[2] / d + .5, q[1] / h + .5] : [q[0] / w + .5, -sg * q[2] / d + .5]); });
    poly(pts, ax * 2 + (sg > 0 ? 0 : 1), uvs);
  }));
  [0, 1, 2].forEach((ax) => S.forEach((s1) => S.forEach((s2) => {                   // 十二条棱上的斜面：棱顺着 ax，夹在 u、v 两个面之间
    const u = (ax + 1) % 3, v = (ax + 2) % 3, q = (sa, on) => { const sgn = [0, 0, 0]; sgn[ax] = sa; sgn[u] = s1; sgn[v] = s2; return pt(sgn, on); };
    poly([q(-1, u), q(1, u), q(1, v), q(-1, v)], 6);
  })));
  S.forEach((sx) => S.forEach((sy) => S.forEach((sz) => poly([pt([sx, sy, sz], 0), pt([sx, sy, sz], 1), pt([sx, sy, sz], 2)], 6))));   // 八个角
  const order = [], groups = []; idx.forEach((list, mi) => { groups.push([order.length, list.length, mi]); order.push(...list); });
  const pick = (A, n) => order.flatMap((i) => A.slice(i * n, i * n + n));
  return geoOf(pick(P, 3), pick(N, 3), pick(U, 2), groups);
}
// 线脚的剖面：从下往上画，p 是往外伸多少、y 是高；直线段是平的面，弧是圆的面（法线跟着弧走）
function profile(k = 1) {
  const strips = [], api = {
    strips,
    line(p0, y0, p1, y1) { const dx = p1 - p0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, n = { np: dy / l, ny: -dx / l }; strips.push([{ p: p0 * k, y: y0 * k, ...n }, { p: p1 * k, y: y1 * k, ...n }]); return api; },
    arc(cp, cy, r, a0, a1, n = 6) {                         // 角度从 a0 走到 a1（度）；逆时针是鼓出来的，顺时针是凹进去的
      const sg = a1 > a0 ? 1 : -1, st = [];
      for (let i = 0; i <= n; i++) { const a = rad(a0 + (a1 - a0) * i / n); st.push({ p: (cp + r * Math.cos(a)) * k, y: (cy + r * Math.sin(a)) * k, np: sg * Math.cos(a), ny: sg * Math.sin(a) }); }
      strips.push(st); return api;
    },
  };
  return api;
}
// 把一条剖面沿架子的外沿走一圈（左侧、正面、右侧，转角对缝）。X0：外沿到中线多宽；Z0：外沿的正面在哪；zB：背后到哪；y0：剖面的零点放多高。贴图坐标是厘米
function sweepGeo(strips, X0, Z0, zB, y0) {
  const P = [], N = [], U = [];
  const legs = [(p) => [[-X0 - p, zB], [-X0 - p, Z0 + p], [-1, 0], 0], (p) => [[-X0 - p, Z0 + p], [X0 + p, Z0 + p], [0, 1], Z0 - zB], (p) => [[X0 + p, Z0 + p], [X0 + p, zB], [1, 0], Z0 - zB + 2 * X0]];
  strips.forEach((st) => {
    let v = 0;
    for (let i = 0; i + 1 < st.length; i++) {
      const a = st[i], b = st[i + 1], dv = Math.hypot(b.p - a.p, b.y - a.y);
      legs.forEach((leg) => {
        const [A0, A1, d, u0] = leg(a.p), [B0, B1] = leg(b.p), len = Math.hypot(A1[0] - A0[0], A1[1] - A0[1]);
        const vert = (q, xz, vv, uu) => { P.push(xz[0], y0 + q.y, xz[1]); N.push(d[0] * q.np, q.ny, d[1] * q.np); U.push(uu, vv); };
        vert(a, A0, v, u0); vert(a, A1, v, u0 + len); vert(b, B1, v + dv, u0 + len); vert(a, A0, v, u0); vert(b, B1, v + dv, u0 + len); vert(b, B0, v + dv, u0);
      });
      v += dv;
    }
  });
  return geoOf(P, N, U);
}
// 一本书：两块封面板夹着书芯，书芯比封面小一圈（飘口），书脊是鼓出来的圆脊。坐标是单位盒子（厚、高、深各 1，书脊朝 +z），
// 板厚和飘口是厘米、圆脊按书厚的比例，这些要知道这本书多大才摆得对：ins 记每个点往里收多少厘米，spn 记圆脊上鼓多少、斜多少。
//   架上的书是一个实例化的网格，每本大小不同，由着色器按每本的大小去摆（见 bookHook）；抽出来的那一本用 bakeBook 按它的大小摆好。
// 材质号：0 书脊、1 封面（+x）、2 封底（-x）、3 封面板的边和里子、书脊两头、4 书芯
export function bookGeo() {
  const B = LOOK.book, P = [], N = [], U = [], I = [], S = [], idx = [[], [], [], [], []];
  // 一个四边形：四个点各带 [位置, 往里收的厘米, 圆脊]；先按「一厘米见方的书」摆一下看朝向对不对，不对就反过来
  const quad = (v, n, mi, uvs) => {
    const at = (q) => new THREE.Vector3(q[0][0] + (q[1] ? q[1][0] : 0), q[0][1] + (q[1] ? q[1][1] : 0), q[0][2] + (q[1] ? q[1][2] : 0) + (q[2] ? q[2][0] * .2 : 0));
    const a = at(v[0]), c = new THREE.Vector3().subVectors(at(v[1]), a).cross(new THREE.Vector3().subVectors(at(v[2]), a));
    let o = [0, 1, 2, 0, 2, 3]; if (c.x * n[0] + c.y * n[1] + c.z * n[2] < 0) o = [0, 2, 1, 0, 3, 2];
    o.forEach((k) => { idx[mi].push(P.length / 3); P.push(...v[k][0]); N.push(...n); U.push(...(uvs ? uvs[k] : [.06, .98])); I.push(...(v[k][1] || [0, 0, 0])); S.push(...(v[k][2] || [0, 0, 0])); });
  };
  [1, -1].forEach((sx) => {                                  // 两块封面板：外面、里面、上、下、书口那一边
    const X = sx * .5, inn = [-sx * B.board, 0, 0], c = (y, z, on) => [[X, y, z], on ? inn : null];
    quad([c(-.5, -.5), c(-.5, .5), c(.5, .5), c(.5, -.5)], [sx, 0, 0], sx > 0 ? 1 : 2, [[-.5, -.5], [-.5, .5], [.5, .5], [.5, -.5]].map(([y, z]) => [sx > 0 ? .5 - z : z + .5, y + .5]));
    quad([c(-.5, -.5, 1), c(-.5, .5, 1), c(.5, .5, 1), c(.5, -.5, 1)], [-sx, 0, 0], 3);
    [1, -1].forEach((sy) => quad([c(sy * .5, -.5), c(sy * .5, .5), c(sy * .5, .5, 1), c(sy * .5, -.5, 1)], [0, sy, 0], 3));
    quad([c(-.5, -.5), c(.5, -.5), c(.5, -.5, 1), c(-.5, -.5, 1)], [0, 0, -1], 3);
  });
  for (let i = 0; i < B.seg; i++) {                           // 圆脊：分几段，每个点记鼓多少（抛物线）和这一点的斜率；两头各补一片盖住
    const x0 = -.5 + i / B.seg, x1 = -.5 + (i + 1) / B.seg, sp = (x) => [1 - 4 * x * x, -8 * x, 1], cap = (x) => [1 - 4 * x * x, 0, 0];
    quad([[[x0, -.5, .5], null, sp(x0)], [[x1, -.5, .5], null, sp(x1)], [[x1, .5, .5], null, sp(x1)], [[x0, .5, .5], null, sp(x0)]], [0, 0, 1], 0, [[x0 + .5, 0], [x1 + .5, 0], [x1 + .5, 1], [x0 + .5, 1]]);
    [1, -1].forEach((sy) => quad([[[x0, sy * .5, .5]], [[x1, sy * .5, .5]], [[x1, sy * .5, .5], null, cap(x1)], [[x0, sy * .5, .5], null, cap(x0)]], [0, sy, 0], 3));
  }
  const pg = (x, y, z) => [[x * .5, y * .5, z * .5], [-x * B.board, -y * B.sq, z < 0 ? B.sq : 0]];   // 书芯：比封面板小一圈，只做看得见的三面（上、下、书口）
  [1, -1].forEach((sy) => quad([pg(-1, sy, -1), pg(1, sy, -1), pg(1, sy, 1), pg(-1, sy, 1)], [0, sy, 0], 4));
  quad([pg(-1, -1, -1), pg(1, -1, -1), pg(1, 1, -1), pg(-1, 1, -1)], [0, 0, -1], 4);
  const order = [], groups = []; idx.forEach((list, mi) => { groups.push([order.length, list.length, mi]); order.push(...list); });
  const pick = (A, n) => order.flatMap((i) => A.slice(i * n, i * n + n));
  return geoOf(pick(P, 3), pick(N, 3), pick(U, 2), groups, { ins: pick(I, 3), spn: pick(S, 3) });
}
// 按一本书的厚、高、深把上面那个形状摆好（给抽出来的那一本用；它的网格再按 t、h、d 拉开）
export function bakeBook(geo, t, h, d) {
  const g = geo.clone(), P = g.attributes.position, N = g.attributes.normal, I = g.attributes.ins, S = g.attributes.spn, sag = LOOK.book.sag * t / d;
  for (let i = 0; i < P.count; i++) {
    P.setXYZ(i, P.getX(i) + I.getX(i) / t, P.getY(i) + I.getY(i) / h, P.getZ(i) + I.getZ(i) / d + S.getX(i) * sag);
    if (S.getZ(i) > .5) { const nx = -S.getY(i) * sag, l = Math.hypot(nx, 1); N.setXYZ(i, nx / l, 0, 1 / l); }
  }
  return g;
}
// 架上的书：每本的大小在实例矩阵里，着色器从里面取出厚、高、深，再把板厚、飘口、圆脊摆到位
function bookHook(sh) {
  sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec3 ins;\nattribute vec3 spn;")
    .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n#ifdef USE_INSTANCING\n\tvec3 bsc = vec3( length( instanceMatrix[ 0 ].xyz ), length( instanceMatrix[ 1 ].xyz ), length( instanceMatrix[ 2 ].xyz ) );\n\tfloat bsag = " + LOOK.book.sag.toFixed(4) + " * bsc.x / bsc.z;\n\tif ( spn.z > .5 ) objectNormal = normalize( vec3( - spn.y * bsag, 0., 1. ) );\n#endif")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\n#ifdef USE_INSTANCING\n\ttransformed += ins / bsc; transformed.z += spn.x * bsag;\n#endif");
}

/* ---------- 角落里的暗（旧书房「看光」一门）：不用贴图，按这一点在架子里的位置算 ----------
 * 架子里面：离上面那块层板近、往里深、贴着侧板的地方暗下去；墙和地：靠近架子的一圈暗下去。书探出来、飞出来就离开了暗处，自己会亮。
 * a：里面半宽、第一层层板面的高、层距、层高；b：外沿半宽、里面的顶、柜深、有多重。架子每次重建时更新。
 * 同一段话里顺手把「灯光有一圈」也算了：离圈心近的亮、远的暗，离开架子往镜头来的东西不管 */
const AOU = { a: { value: new THREE.Vector4(50, 10, 31, 29) }, b: { value: new THREE.Vector4(60, 180, 21, 0) }, p: { value: new THREE.Vector4(0, 100, 1e5, 1) }, q: { value: new THREE.Vector4(1, 0, 0, 0) } };   // p：光圈的圆心 x、y，半径，圈外暗到多少；q.x：圈心亮多少
const AO_GLSL = {
  in: `float aoIn = step( abs( vAoP.x ), uAoA.x + .5 ) * step( vAoP.z, .6 ) * step( uAoA.y - .5, vAoP.y ) * step( vAoP.y, uAoB.y );
	float aoT = smoothstep( uAoA.w * .45, uAoA.w, mod( vAoP.y - uAoA.y, uAoA.z ) ) * smoothstep( 1., -7., vAoP.z );
	float aoBk = smoothstep( 0., - uAoB.z, vAoP.z );
	float aoSd = smoothstep( uAoA.x - 9., uAoA.x, abs( vAoP.x ) ) * smoothstep( 1., -5., vAoP.z );
	float aoK = 1. - aoIn * uAoB.w * clamp( .6 * aoT + .32 * aoBk + .25 * aoSd, 0., .92 );`,
  wall: `vec2 aoQ = abs( vAoP.xy - vec2( 0., uAoB.y * .5 ) ) - vec2( uAoB.x, uAoB.y * .5 );
	float aoK = 1. - uAoB.w * .6 * exp( - length( max( aoQ, 0. ) ) / 16. );`,
  floor: `vec2 aoQ = abs( vec2( vAoP.x, vAoP.z + uAoB.z * .5 ) ) - vec2( uAoB.x + 2., uAoB.z * .5 + 3. );
	float aoK = 1. - uAoB.w * .65 * exp( - length( max( aoQ, 0. ) ) / 9. );`,
};
function aoHook(mat, mode, also) {                          // also：这个材质原来就有的那段改着色器的话（书脊图集、书的形状），接着用
  if (!LOOK.cs.aoK) { if (also) mat.onBeforeCompile = also; return; }
  mat.onBeforeCompile = (sh) => {
    if (also) also(sh);
    sh.uniforms.uAoA = AOU.a; sh.uniforms.uAoB = AOU.b; sh.uniforms.uAoP = AOU.p; sh.uniforms.uAoQ = AOU.q;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vAoP;")
      .replace("#include <project_vertex>", "#include <project_vertex>\n\tvec4 aoW = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\n\taoW = instanceMatrix * aoW;\n#endif\n\tvAoP = ( modelMatrix * aoW ).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vAoP;\nuniform vec4 uAoA;\nuniform vec4 uAoB;\nuniform vec4 uAoP;\nuniform vec4 uAoQ;")
      .replace("#include <aomap_fragment>", "#include <aomap_fragment>\n\t" + AO_GLSL[mode] + "\n\treflectedLight.indirectDiffuse *= aoK; reflectedLight.indirectSpecular *= aoK; reflectedLight.directDiffuse *= mix( 1., aoK, " + (mode === "in" ? ".45" : "1.") + " ); reflectedLight.directSpecular *= mix( 1., aoK, .6 );"
        + "\n\tvec2 poQ = ( vAoP.xy - uAoP.xy ) / uAoP.z; float poK = mix( mix( uAoP.w, uAoQ.x, exp( - dot( poQ, poQ ) ) ), 1., smoothstep( 8., 60., vAoP.z ) );"
        + "\n\treflectedLight.directDiffuse *= poK; reflectedLight.directSpecular *= poK; reflectedLight.indirectDiffuse *= mix( 1., poK, .6 );");
  };
  mat.customProgramCacheKey = () => "ao-" + mode + (also ? "-" + also.name : "");     // 同一段话配不同的算法，要让渲染器知道它们不是一个程序
}

/* ---------- 三维舞台：渲染器、镜头、一盏主光加天光 ---------- */
export function createStage(canvas) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); }
  catch (e) {
    const d = document.createElement("div"); d.className = "nogl"; d.textContent = "这台设备的浏览器打不开三维画面（WebGL 不可用），样机看不了。换一个浏览器试试。";
    document.body.appendChild(d); throw e;
  }
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const scene = new THREE.Scene(); scene.background = new THREE.Color(LOOK.bg);
  const camera = new THREE.PerspectiveCamera(34, 1, 4, 4000);
  scene.add(new THREE.HemisphereLight(LOOK.hemi[0], LOOK.hemi[1], LOOK.hemi[2]));
  const key = new THREE.DirectionalLight(LOOK.key[0], LOOK.key[1]); key.castShadow = true; scene.add(key, key.target);
  const sm = innerWidth * Math.min(devicePixelRatio || 1, 2) < 1500 ? 1024 : 2048; key.shadow.mapSize.set(sm, sm);
  key.shadow.bias = -.0006; key.shadow.normalBias = .12; key.shadow.radius = LOOK.soft;
  makeEnv(renderer);
  return { renderer, scene, camera, key, maxAniso };
}
// 主光对着架子：左前上方打过来，影子的范围刚好罩住整座
export function lightCase(key, w, h) {
  const Lz = Math.max(w, h) * 1.2 + 120, half = Math.hypot(w, h) / 2 + 34;
  key.position.set(LOOK.sun[0] * Lz, h / 2 + LOOK.sun[1] * Lz, LOOK.sun[2] * Lz); key.target.position.set(0, h / 2, -DIM.CD / 2);
  Object.assign(key.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 10, far: Lz * 2.4 }); key.shadow.camera.updateProjectionMatrix();
}

/* ---------- 书的样子（占位；读没读只靠明暗和形状，不靠色相） ---------- */
export const TONES = LOOK.tones;   // 读过的书露出的面，按类各一种，都是深的
export const PALE = LOOK.pale, INK_LT = LOOK.inkLt, INK_SOFT = LOOK.inkSoft, PAPER = LOOK.paper, TAB = LOOK.tab;
export const STN = { todo: "没读", doing: "在读", done: "读过" };
const CELLW = 48, CELLH = 192, COLS = 42;
// 画一条书脊。pale：不管读没读都画成包着白纸的样子（别人那里带走的一份，到你手里都是没读的）
function titleV(g, chars, tw, y0, y1, color, font, weight, wide = .6) {      // 竖排的书名，排在 y0 到 y1 之间，居中
  const n = chars.length, fs = Math.min(tw * wide, ((y1 - y0) * .94) / n), step = Math.min(fs * 1.14, (y1 - y0) / n), top = (y0 + y1) / 2 - step * n / 2;
  g.font = weight + " " + fs.toFixed(2) + "px " + font; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = color;
  chars.forEach((c, k) => g.fillText(c, 0, top + step * (k + .5)));
}
// 每种外观的书脊怎么画。坐标：横向 -tw/2 到 tw/2，竖向 0 到 h，底色已经铺好。最上面 4% 什么都不画（封面取那里的底色）
const SPINES = {
  plain(g, tw, h, b, todo) {
    if (!todo) { g.fillStyle = INK_LT; g.globalAlpha = .5; const lh = Math.max(1, h * .008); g.fillRect(-tw / 2, h * .07, tw, lh); g.fillRect(-tw / 2, h * .925, tw, lh); g.globalAlpha = 1; }
    const chars = [...b.title], n = chars.length, fs = Math.min(tw * .6, (h * .6) / n), step = Math.min(fs * 1.14, (h * .64) / n);
    g.font = "700 " + fs.toFixed(2) + "px " + CJK; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = todo ? INK_SOFT : INK_LT;
    chars.forEach((c, k) => g.fillText(c, 0, h * .15 + step * (k + .5)));
  },
  paper(g, tw, h, b, todo) {                               // 一片卡纸：左边一道亮的切边，右边一道暗；读过的底下贴一枚小白签
    const e = Math.max(.8, tw * .05);
    g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(-tw / 2, 0, e, h); g.fillStyle = "rgba(0,0,0,.15)"; g.fillRect(tw / 2 - e, 0, e, h);
    titleV(g, [...b.title], tw, h * .1, h * .76, todo ? INK_SOFT : INK_LT, SANS, todo ? 500 : 700);
    if (todo) { g.fillStyle = INK_SOFT; g.globalAlpha = .5; g.fillRect(-tw * .3, h * .87, tw * .6, Math.max(1, h * .006)); g.globalAlpha = 1; }
    else { const lw = Math.min(tw * .56, h * .085); g.fillStyle = INK_LT; g.fillRect(-lw / 2, h * .83, lw, h * .07); }
  },
  toy(g, tw, h, b, todo) {                                 // 两截颜色的积木：下面一截换色，上面一个圆点，字粗
    g.fillStyle = todo ? LOOK.pale2 : LOOK.tones2[b.cat % LOOK.tones2.length]; g.fillRect(-tw / 2, h * .78, tw, h * .22);
    g.fillStyle = todo ? INK_SOFT : INK_LT; g.globalAlpha = todo ? .45 : .95; g.beginPath(); g.arc(0, h * .085, Math.min(tw * .22, h * .03), 0, 7); g.fill(); g.globalAlpha = 1;
    titleV(g, [...b.title], tw, h * .15, h * .75, todo ? INK_SOFT : INK_LT, SANS, 900, .68);
  },
  study(g, tw, h, b, todo, mask) {                         // mask：只画「哪里是金」那张图
    if (todo && mask) return;
    if (todo) {                                            // 没读：牛皮纸包着，上下折边，捆两道麻绳
      g.fillStyle = "rgba(90,60,30,.13)"; g.fillRect(-tw / 2, h * .04, tw, h * .035); g.fillRect(-tw / 2, h * .95, tw, h * .05);
      g.fillStyle = LOOK.twine; [.2, .8].forEach((f) => g.fillRect(-tw / 2, h * f, tw, Math.max(1.3, h * .009)));
      titleV(g, [...b.title], tw, h * .25, h * .76, INK_SOFT, CJK, 600); return;
    }
    const lw = Math.max(1, h * .007);                      // 读过：布面，书名压在一格深色的皮签上，三道竹节，烫金的线和一枚小菱花
    const gold = mask ? MASK.gilt : LOOK.gilt;
    if (!mask) {
      g.fillStyle = "rgba(0,0,0,.26)"; g.fillRect(-tw / 2, h * .16, tw, h * .56);
      [.115, .76, .885].forEach((f) => { g.fillStyle = "rgba(0,0,0,.42)"; g.fillRect(-tw / 2, h * f, tw, lw * 2.2); g.fillStyle = "rgba(255,255,255,.15)"; g.fillRect(-tw / 2, h * f - lw, tw, lw); });
    }
    g.fillStyle = gold; [.055, .07, .145, .735, .93, .945].forEach((f) => g.fillRect(-tw * .42, h * f, tw * .84, lw));
    titleV(g, [...b.title], tw, h * .18, h * .7, gold, CJK, 700);
    const d = Math.min(tw * .22, h * .024); g.save(); g.translate(0, h * .825); g.rotate(Math.PI / 4); g.fillRect(-d / 2, -d / 2, d, d); g.restore();
  },
};
const grainC = {};
export function grainOver(g, x, y, w, h, todo) {           // 往刚画好的一块上压一层花纹；包着纸的（没读）一律是纸浆，读过的按外观（纸浆 / 布纹）
  const kind = LOOK.grain && (todo ? "pulp" : LOOK.grain); if (!kind) return; grainC[kind] = grainC[kind] || PATTERN[kind]();
  g.save(); g.globalCompositeOperation = "multiply"; g.fillStyle = g.createPattern(grainC[kind], "repeat"); g.fillRect(x, y, w, h); g.restore();
}
export function drawSpine(g, x, y, w, h, b, pale, mask) {  // mask：不画颜色，画「哪里是金」那张图（只有旧书房的书脊认）
  const todo = pale || b.st === "todo";
  g.fillStyle = mask ? (todo ? MASK.paper : MASK.cloth) : todo ? PALE : TONES[b.cat % TONES.length]; g.fillRect(x, y, w, h);
  const sy = h / b.h, tw = b.t * sy;                    // 图上横竖的比例和真书脊不一样，按竖向的像素来排，横向整体拉开，贴上去才还原
  if (LOOK.jit && !mask) { const j = ((Math.imul(b.i + 1, 2654435761) >>> 0) % 1000) / 1000 - .5; g.fillStyle = j > 0 ? "rgba(255,255,255," + (j * LOOK.jit).toFixed(3) + ")" : "rgba(0,0,0," + (-j * LOOK.jit).toFixed(3) + ")"; g.fillRect(x, y, w, h); }   // 每本深浅差一点点，不那么齐
  g.save(); g.translate(x + w / 2, y); g.scale((w / b.t) / sy, 1);
  SPINES[LOOK.spine](g, tw, h, b, todo, mask);
  g.restore();
}
export function createBookKit(maxAniso) {
  const paperMat = new THREE.MeshStandardMaterial({ color: PAPER, roughness: .95 });
  const tabMat = new THREE.MeshStandardMaterial({ color: TAB, roughness: .8, emissive: new THREE.Color(TAB), emissiveIntensity: LOOK.tabGlow });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const shape = LOOK.book ? bookGeo() : null, pagesMat = shape ? paperMat.clone() : null; if (pagesMat) aoHook(pagesMat, "in", bookHook);   // 旧书房：书有封面板、飘口和圆脊
  // 书脊图集：每本一格，贴到书脊上；封面两侧只取这一格的底色。每张图集带自己的材质
  function makeAtlas(books, pale) {
    const canvas = document.createElement("canvas"), g = canvas.getContext("2d");
    canvas.width = COLS * CELLW; canvas.height = Math.max(1, Math.ceil(books.length / COLS)) * CELLH;
    function draw(b) {
      const x = (b.i % COLS) * CELLW, y = Math.floor(b.i / COLS) * CELLH;
      g.fillStyle = pale || b.st === "todo" ? PALE : TONES[b.cat % TONES.length]; g.fillRect(x, y, CELLW, CELLH);   // 格子四周留一圈同色，缩小采样时不串到邻格
      drawSpine(g, x + 3, y + 2, CELLW - 6, CELLH - 4, b, pale); grainOver(g, x, y, CELLW, CELLH, pale || b.st === "todo");
    }
    books.forEach(draw);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: LOOK.bookRough, metalness: 0 });
    const cell = function atlasCell(sh) {     // 每本书用图集里自己那一格（uvo = 左下角 u、v，宽、高）
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec4 uvo;")
        .replace("#include <uv_vertex>", "#include <uv_vertex>\n#ifdef USE_MAP\n\tvMapUv = uvo.xy + uv * uvo.zw;\n#endif");
      if (shape) bookHook(sh);
    };
    aoHook(mat, "in", cell);
    return { canvas, tex, mat, redraw(b) { draw(b); tex.needsUpdate = true; }, dispose() { tex.dispose(); mat.dispose(); } };
  }
  // 一批书 = 一个实例化的盒子（三百本也只画两三次）。书脊朝 +z，前后封面是 ±x
  function makeMesh(books, atlas) {
    let g, mats;
    if (shape) {                                                                // 旧书房：书脊用图集里自己那一格，封面板只取格子左上角的一点底色，书芯是纸
      g = shape.clone(); mats = [atlas.mat, atlas.mat, atlas.mat, atlas.mat, pagesMat];
      [1, 2].forEach((mi) => { const gr = g.groups[mi]; for (let v = gr.start; v < gr.start + gr.count; v++) g.attributes.uv.setXY(v, .06, .98); });
    } else {
      g = new THREE.BoxGeometry(1, 1, 1); mats = [atlas.mat, paperMat];         // 面的顺序：+x -x +y -y +z -z
      [0, 0, 1, 1, 0, 1].forEach((m, k) => { g.groups[k].materialIndex = m; });   // 封面与书脊用图集，上下和书口是纸
      for (let v = 0; v < 8; v++) g.attributes.uv.setXY(v, .06, .98);           // 前后封面只取格子左上角的一点底色（那里各种外观都不画东西）
    }
    const uvo = new Float32Array(books.length * 4), tw = atlas.canvas.width, th = atlas.canvas.height;
    books.forEach((b) => { const x = (b.i % COLS) * CELLW + 3, y = Math.floor(b.i / COLS) * CELLH + 2; uvo.set([x / tw, 1 - (y + CELLH - 4) / th, (CELLW - 6) / tw, (CELLH - 4) / th], b.i * 4); });
    g.setAttribute("uvo", new THREE.InstancedBufferAttribute(uvo, 4));
    const m = new THREE.InstancedMesh(g, mats, books.length); m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
    return m;
  }
  return { paperMat, tabMat, unitBox, makeAtlas, makeMesh, shape };
}

/* ---------- 架子（灰盒：几块板，外加后面的墙和脚下的地）。一个单位是一厘米 ---------- */
export const DIM = { ...LOOK.dim };      // 层高（净）、层板厚、侧板厚、柜深、踢脚高
export function createCase(scene, unitBox) {
  const { SH, BT, ST, CD, PL } = DIM, C = LOOK.cs;
  const group = new THREE.Group(); scene.add(group);
  const caseMat = new THREE.MeshStandardMaterial({ color: C.frame, roughness: C.rough }), backMat = new THREE.MeshStandardMaterial({ color: C.back, roughness: .95 });
  const wallMat = new THREE.MeshStandardMaterial({ color: C.wall, roughness: 1 }), floorMat = new THREE.MeshStandardMaterial({ color: C.floor, roughness: 1 });
  const tex = C.tex ? patternTex(C.tex) : null, wallTex = C.wallTex ? patternTex(C.wallTex) : tex, T = C.tile || 30;
  // 盒子都是一个单位立方体拉出来的，贴花纹时每块板按自己看得见的那一面有多大，定花纹重复几遍；turn：木纹顺着长边走。
  // 有真木纹（旧书房）就贴真的：part 说这块是架子、背板还是地（各有各的深浅），seed 让每块板的纹错开。图晚到的话到了以后原地重贴一遍
  const skins = [];
  const dress = (k) => {
    k.own.forEach((o) => o.dispose()); k.own = [];
    const wood = k.t === tex && C.tex === "wood" && k.part ? woodOn(k.m, k.part, k.rx * T, k.ry * T, k.turn, k.seed) : null;
    if (wood) { k.own = wood; return; }
    const tt = k.t.clone(); tt.repeat.set(k.rx, k.ry); if (k.turn) tt.rotation = Math.PI / 2; tt.needsUpdate = true;
    k.m.map = tt; k.m.color.copy(k.base.color).multiplyScalar(k.t.userData.gain); k.own = [tt];
  };
  const skin = (mat, t, rx, ry, turn, part, seed = 0) => {
    if (!t) return mat; const k = { m: mat.clone(), base: mat, t, rx, ry, turn, part, seed, own: [] }; skins.push(k); dress(k);
    if (C.aoK) aoHook(k.m, part === "wall" || part === "floor" ? part : "in");
    return k.m;
  };
  texReady.then(() => { if (TEX.wood) skins.forEach(dress); });
  // 每一层后面压一片上深下浅的影子：层板底下、书顶上面那一道暗下去，架子才有深度
  const shade = C.ao ? new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: C.ao, map: new THREE.CanvasTexture(canvasOf(64, 64, (g, w, h) => {
    const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, "rgba(0,0,0,1)"); v.addColorStop(.3, "rgba(0,0,0,.45)"); v.addColorStop(.75, "rgba(0,0,0,.1)"); v.addColorStop(1, "rgba(0,0,0,.28)"); g.fillStyle = v; g.fillRect(0, 0, w, h);
    const s = g.createLinearGradient(0, 0, w, 0); s.addColorStop(0, "rgba(0,0,0,.55)"); s.addColorStop(.1, "rgba(0,0,0,0)"); s.addColorStop(.9, "rgba(0,0,0,0)"); s.addColorStop(1, "rgba(0,0,0,.55)"); g.fillStyle = s; g.fillRect(0, 0, w, h);
  })) }) : null;
  const plane = new THREE.PlaneGeometry(1, 1);
  // 旧书房的线脚（剖面只算一次，沿外沿走一圈时才按架子的大小生成）。尺寸是量参考定的：压顶线三段大小相近（凹弧、平带、反曲线），底座是一段立面上面收一道反曲线
  const M = C.mould, keep = new Set([unitBox, plane]);
  const nose = M ? new THREE.CylinderGeometry(BT / 2, BT / 2, 1, 10, 1, true, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2) : null;      // 层板前沿：半圆的一条
  const bead = M ? new THREE.CylinderGeometry(.35, .35, 1, 8, 1, true) : null;                                                         // 壁柱里侧的一道圆线
  if (M) { keep.add(nose); keep.add(bead); }
  const PROF = M && {
    cornice: profile(M.k).line(0, 0, .5, 0).line(.5, 0, .5, .5).arc(1.7, .5, 1.2, 180, 90).line(1.7, 1.7, 2.1, 1.7).line(2.1, 1.7, 2.1, 3.3).line(2.1, 3.3, 2.4, 3.3)
      .arc(2.4, 4.25, .95, -90, 0).arc(4.3, 4.25, .95, 180, 90).line(4.3, 5.2, 4.6, 5.2).line(4.6, 5.2, 4.6, 5.9).line(4.6, 5.9, 0, 5.9).strips,
    neck: profile(1).arc(0, 0, .4, -90, 90, 5).strips,                                                                                  // 平带底下一道小圆线
    plinth: (H) => { const o = 2.2 * M.k, e = 1.9 * M.k, r = (e - .15) / 2, y = H - 2.2;   // 立面出 o；往上收一小步到 e，再一道反曲线（下半鼓、上半凹）收到离外沿 .15
      return profile(1).line(o, 0, o, y - .4).line(o, y - .4, e, y - .4).line(e, y - .4, e, y).arc(e - r, y, r, 0, 90).arc(e - r, y + 2 * r, r, -90, -180).line(.15, y + 2 * r, .15, H - .15).line(.15, H - .15, 0, H - .15).line(0, H - .15, 0, H).strips; },
  };
  function build(W, R) {                                           // W：里面净宽，R：几层。回来的是整座的外宽和总高
    group.children.forEach((m) => { if (!keep.has(m.geometry)) m.geometry.dispose(); }); group.clear();
    skins.forEach((k) => { k.own.forEach((o) => o.dispose()); k.m.dispose(); }); skins.length = 0;
    const w = W + 2 * ST, h = R * (SH + BT) + BT + PL;
    const add = (bw, bh, bd, x, y, z, mat) => { const m = new THREE.Mesh(unitBox, mat); m.scale.set(bw, bh, bd); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; group.add(m); return m; };
    add(w, h - PL, 1, 0, PL + (h - PL) / 2, -CD + .5, skin(backMat, tex, w / T, (h - PL) / T, false, "back"));           // 背板
    const board = (seed) => skin(caseMat, tex, (CD - 1) / T, W / T, true, "frame", seed), boardMat = board(11);
    [-1, 1].forEach((s) => add(ST, h, CD + .6, s * (W / 2 + ST / 2), h / 2, -CD / 2 + .3, skin(caseMat, tex, CD / T, h / T, false, "frame", s + 3)));   // 两侧
    for (let k = 0; k <= R; k++) add(W, BT, CD - 1, 0, PL + BT / 2 + k * (SH + BT), -(CD - 1) / 2, board(k + 1));        // 层板（一块一个材质，木纹错开）
    let top = h, wOut = w;
    AOU.a.value.set(W / 2, PL + BT, SH + BT, SH); AOU.b.value.set(W / 2 + ST + (M ? M.stile : 0), h, CD, C.aoK || 0);
    if (LOOK.pool) { const L = LOOK.pool; AOU.p.value.set(L.x * w, L.y * h, L.r * Math.max(w, h), L.lo); AOU.q.value.x = L.hi; }
    if (M) {
      // 旧书房：两根壁柱、层板的圆前沿、顶上一条平带加压顶线、脚下一圈底座。线脚的贴图坐标是厘米，所以重复数给 1 / T
      const X0 = W / 2 + ST + M.stile, Z0 = .6 + M.stileT, zB = -CD, run = (seed) => skin(caseMat, tex, 1 / T, 1 / T, true, "frame", seed);
      const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; group.add(m); return m; };
      [-1, 1].forEach((sd) => {
        add(ST + M.stile, h - PL, M.stileT, sd * (W / 2 + (ST + M.stile) / 2), PL + (h - PL) / 2, .6 + M.stileT / 2, skin(caseMat, tex, (ST + M.stile) / T, (h - PL) / T, false, "frame", sd + 7));
        const b = mesh(bead, skin(caseMat, tex, 2.2 / T, (h - PL) / T, false, "frame", sd + 9)); b.scale.set(1, h - PL, 1); b.position.set(sd * (W / 2 + .05), PL + (h - PL) / 2, Z0 - .1);
      });
      for (let k = 0; k <= R; k++) { const n = mesh(nose, skin(caseMat, tex, 3.4 / T, W / T, false, "frame", k + 21)); n.scale.set(W, 1, 1); n.position.set(0, PL + BT / 2 + k * (SH + BT), 0); }
      const band = (bh, seed) => skin(caseMat, tex, bh / T, 2 * X0 / T, true, "frame", seed);                                             // 横着的一条板：木纹顺着宽走
      add(2 * X0, PL, Z0 - zB, 0, PL / 2, (Z0 + zB) / 2, band(PL, 31)); mesh(sweepGeo(PROF.plinth(PL), X0, Z0, zB, 0), run(32));                 // 底座：里面一块实心的，外面一圈线脚
      add(2 * X0, M.frieze, Z0 - zB, 0, h + M.frieze / 2, (Z0 + zB) / 2, band(M.frieze, 33)); mesh(sweepGeo(PROF.neck, X0, Z0, zB, h), run(34));       // 平带和它底下的小圆线
      const cy = h + M.frieze, ch = 5.9 * M.k, cp = 4.6 * M.k;
      mesh(sweepGeo(PROF.cornice, X0, Z0, zB, cy), run(35)); add(2 * X0, .4, Z0 - zB, 0, cy + ch - .2, (Z0 + zB) / 2, band(.4, 36));               // 压顶线和它的顶
      top = cy + ch; wOut = 2 * X0 + cp;                                                                                                // 镜头按这个宽来装：压顶线两头各让它伸进边上的留白一半
    } else add(W, PL, CD - 3, 0, PL / 2, -(CD - 3) / 2 - 2, backMat);                                                    // 踢脚
    if (shade) for (let k = 0; k < R; k++) { const m = new THREE.Mesh(plane, shade); m.scale.set(W, SH, 1); m.position.set(0, PL + BT + k * (SH + BT) + SH / 2, -CD + 1.06); m.renderOrder = 1; group.add(m); }
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w + 900, h + 600), skin(wallMat, wallTex, (w + 900) / (C.wallTex ? 34 : T), (h + 600) / (C.wallTex ? 34 : T), false, "wall")); wall.position.set(0, h / 2, -CD - .2); wall.receiveShadow = true; group.add(wall);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w + 900, 900), skin(floorMat, tex, (w + 900) / T, 900 / T, false, "floor")); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 450 - CD); floor.receiveShadow = true; group.add(floor);
    return { w: wOut, h: top };
  }
  return { group, build, caseMat, backMat, wallMat, floorMat };
}
