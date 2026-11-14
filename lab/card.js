/* 牌的样子（旧书房）：牌面是一张旧书页，牌背是一本老书的烫金封面。2026-11-14 用户看过扇形开盒后说牌背太丑、牌面的颜色和感觉不好，
 * 要像炉石的牌背那样好看、牌面像魔法书的一页。这里是重做的那一版；开盒（box.js）在用，拆包页（pack.js）还是旧的，等用户挑定再接过去。
 *
 * 三件事：
 *   1 颜色  这间屋子的灯很暖（蓝光只剩三成多），照原样贴上去，米色的纸成了橙色、藏青的布成了灰褐。牌是拿在眼前看的东西，
 *           所以牌的材质一半吃灯光、一半自己亮（cardMat），再把「屏上要看到的颜色」按这盏灯反推成贴图上的颜色（TINT、lit）。
 *   2 牌背  不画。用仓库里已有的公有领域老书封面扫描（vendor/covers/，来源与授权见那里的 SOURCES.md）：真的皮面、真的烫金。
 *           几种候选在 BACKS 里，等用户挑；「跟盒子」那一种把同一张封面的皮色换成这一盒的色系，金不动。金的地方另出一张图去反环境光。
 *           牌背上不压字、不画东西：代码画的金字贴在真封面上一眼就假（试过）。
 *   3 牌面  一张旧纸（sheet：底色不匀、四边发暗、几点霉斑、帘纹，用代码烘一次，每张牌取它的一种朝向），文武边的框，
 *           左边一条是竖排的标题（扇面上只露这一条），顶上一个圆圈里是读完要几分钟；右边是编号、来处、一枚印（哪一类）、为什么存它。
 *           字要清楚：纸纹只在底色上，字是实的墨色，不做旧。 */
import { THREE, clamp, lerp, rng, CJK, grainOver, foil } from "./kit.js";

export const CW = 8.8, CH = 12.5;                           // 一张牌多大（厘米）
export const COL = .24;                                     // 牌面左边竖着写标题的那一条占牌宽的几成
const KD = .46, KE = .5;                                    // 牌的材质：吃几成灯光、自己亮几成
// 贴图上的白，在屏上是什么颜色（线性的三个数；量出来的，改了灯或者上面两个数要重量：tools 里没有脚本，见 lab/README.md「牌的样子」）
const TINT = [.97, .81, .66];
const s2l = (v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }, l2s = (v) => { v = clamp(v); return Math.round((v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055) * 255); };
const S2L = Float32Array.from({ length: 256 }, (_, v) => s2l(v)), L2S = Uint8Array.from({ length: 4097 }, (_, v) => l2s(v / 4096)), enc = (v) => L2S[v <= 0 ? 0 : v >= 1 ? 4096 : (v * 4096 + .5) | 0];      // 一张牌背五十八万个点，逐点开方手机上要卡一下，查表
const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
// 屏上要看到这个颜色，贴图上该写什么颜色
export function lit(hex, a) { const c = rgbOf(hex).map((v, k) => l2s(s2l(v) / TINT[k])); return a == null ? "rgb(" + c.join(",") + ")" : "rgba(" + c.join(",") + "," + a + ")"; }
export function cardMat(map, rough = .86) {
  const m = new THREE.MeshStandardMaterial({ roughness: rough, color: new THREE.Color(KD, KD, KD), emissive: 0xffffff, emissiveIntensity: KE });
  if (map) setMap(m, map); return m;
}
export function setMap(mat, tex) { mat.map = tex; mat.emissiveMap = tex; mat.needsUpdate = true; }

/* ---------- 牌面：一张旧书页 ---------- */
// 屏上要看到的颜色
const PAGE = { paper: "#EFE2C4", edge: "#B9925C", ink: "#2A1A10", soft: "#6B5238", rubric: "#8C2C1E", seal: "#96301F" };
const sm = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
let sheetC = null;
function sheet() {                                          // 一张旧纸，烘一次
  if (sheetC) return sheetC;
  const w = 384, h = 546, c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
  const img = g.createImageData(w, h), d = img.data, r = rng(20261114), N = 24, grid = new Float32Array(N * N * 3).map(() => r());
  const noise = (x, y, o) => {                              // 平滑的值噪声，0 到 1
    const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi), at = (a, b) => grid[(((b % N) + N) % N * N + ((a % N) + N) % N) * 3 + o];
    return lerp(lerp(at(xi, yi), at(xi + 1, yi), fx), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), fx), fy);
  };
  const A = rgbOf(PAGE.paper).map(s2l), B = rgbOf(PAGE.edge).map(s2l);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n1 = noise(x / 96, y / 96, 0), n2 = noise(x / 31, y / 31, 1), n3 = noise(x / 9, y / 9, 2);
    const e = Math.min(x, w - 1 - x, y, h - 1 - y) / w, age = 1 - sm((e + (n2 - .5) * .045 + (n1 - .5) * .05) / .17);      // 四边发暗，暗的那一圈有宽有窄
    const k = clamp(age * .66 + (.5 - n1) * .18 + (.5 - n2) * .05, 0, 1), L = 1 + (n3 - .5) * .035, i = (y * w + x) * 4;
    for (let q = 0; q < 3; q++) d[i + q] = l2s(lerp(A[q], B[q], k) * L / TINT[q]);
    d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let k = 0; k < 9; k++) {                             // 几点霉斑
    const x = r() * w, y = r() * h, rad = 2 + r() * 7, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, lit("#9A6B3A", .1 + r() * .14)); gr.addColorStop(1, lit("#9A6B3A", 0)); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.fillStyle = lit("#7A5A36", .05); for (let x = 7; x < w; x += 46) g.fillRect(x, 0, 1, h);                              // 帘纹：几道竖的粗线、密的横线
  g.fillStyle = lit("#7A5A36", .028); for (let y = 2; y < h; y += 4) g.fillRect(0, y, w, 1);
  grainOver(g, 0, 0, w, h, true);
  return (sheetC = c);
}
const rule = (g, x, y, w, h) => g.fillRect(x, y, w, h);
const fit = (g, str, wMax) => { if (g.measureText(str).width <= wMax) return str; let s = str; while (s.length > 1 && g.measureText(s + "…").width > wMax) s = s.slice(0, -1); return s + "…"; };
// 竖排的标题，从上往下顶头排（扇面上露出来的那一条上宽下窄，字靠上）。排不下先缩字，再排不下截掉
const ROT = "：；—–-…~（）()《》〈〉「」『』【】[]<>:;", CORNER = "，、。,.";      // 竖排时要躺倒的、要挪到右上角的标点
function titleDown(g, cx, top, room, str, fsMax, fsMin, color) {
  let chars = [...str]; const fs = clamp(room / (chars.length * 1.08), fsMin, fsMax), pitch = fs * 1.08, max = Math.max(1, Math.floor(room / pitch));
  if (chars.length > max) chars = [...chars.slice(0, max - 1), "…"];
  g.font = "700 " + fs.toFixed(1) + "px " + CJK; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = color;
  chars.forEach((ch, k) => {
    const cy = top + pitch * (k + .5);
    if (ROT.includes(ch)) { g.save(); g.translate(cx, cy); g.rotate(Math.PI / 2); g.fillText(ch, 0, 0); g.restore(); }
    else if (CORNER.includes(ch)) g.fillText(ch, cx + fs * .5, cy - fs * .5);
    else g.fillText(ch, cx, cy);
  });
}
// 一段话折成几行：各行差不多长（居中排才好看），附近有标点就在标点后面折；最多五行，再多截掉
const PUNC = "，。；：、！？";
function wrap(str, per) {
  const out = []; let rest = str;
  while (rest.length > per && out.length < 4) {
    const want = Math.ceil(rest.length / Math.ceil(rest.length / per)); let cut = want;
    for (let d = 0; d <= 2; d++) { if (want + d <= per && PUNC.includes(rest[want + d - 1])) { cut = want + d; break; } if (want - d >= 2 && PUNC.includes(rest[want - d - 1])) { cut = want - d; break; } }
    out.push(rest.slice(0, cut)); rest = rest.slice(cut);
  }
  out.push(rest.length > per ? rest.slice(0, per - 1) + "…" : rest); return out;
}
const diamond = (g, cx, cy, r, fill) => { g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath(); if (fill) g.fill(); else g.stroke(); };
// 一道花线：两头细线，当中一枚菱形
function flourish(g, x0, x1, y, u, color) {
  const cx = (x0 + x1) / 2, t = Math.max(1, u * .35); g.fillStyle = g.strokeStyle = color; g.lineWidth = t;
  rule(g, x0, y - t / 2, cx - x0 - u * 4.2, t); rule(g, cx + u * 4.2, y - t / 2, x1 - cx - u * 4.2, t); diamond(g, cx, y, u * 1.7, true); diamond(g, cx - u * 3.3, y, u * .8, true); diamond(g, cx + u * 3.3, y, u * .8, true);
}
// c：这张牌（title、no、src、mon、day、why、min）；glyph：这一盒是哪一类的那个字（盖在印里）
export function drawFace(g, x, y, w, h, c, glyph) {
  const u = w / 100, F = CJK, cw = w * COL, ink = lit(PAGE.ink), soft = lit(PAGE.soft), red = lit(PAGE.rubric), hair = Math.max(1, u * .35);
  let hsh = 0; for (const ch of c.no) hsh = hsh * 31 + ch.charCodeAt(0) | 0; hsh = Math.abs(hsh);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.save(); g.translate(x + (hsh & 1 ? w : 0), y + (hsh & 2 ? h : 0)); g.scale(hsh & 1 ? -1 : 1, hsh & 2 ? -1 : 1); g.drawImage(sheet(), 0, 0, w, h); g.restore();      // 同一张旧纸的四种朝向，牌和牌不一样
  // 文武边：外粗内细两道框
  g.strokeStyle = ink; g.lineWidth = Math.max(1.2, u * .9); g.strokeRect(x + u * 4, y + u * 4, w - u * 8, h - u * 8);
  g.lineWidth = hair; g.strokeRect(x + u * 5.9, y + u * 5.9, w - u * 11.8, h - u * 11.8);
  // 左边一条：顶上一个圈里是读完要几分钟，下面竖排标题；一道细线隔开
  g.fillStyle = ink; rule(g, x + cw + u * .4, y + u * 5.9, hair, h - u * 11.8);
  const mx = x + u * 5.9 + (cw - u * 5.5) / 2, my = y + u * 15.4, mr = u * 6.6;
  g.fillStyle = lit("#E3CFA6"); g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill(); g.strokeStyle = red; g.lineWidth = Math.max(1, u * .7); g.stroke(); g.lineWidth = hair; g.beginPath(); g.arc(mx, my, mr - u * 1.3, 0, 7); g.stroke();
  g.fillStyle = red; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "900 " + (u * (c.min > 9 ? 7.4 : 8.6)).toFixed(1) + "px " + F; g.fillText(String(c.min), mx, my + u * .4);
  titleDown(g, mx, y + u * 25.5, h - u * 34.5, c.title, u * 11.6, u * 7.8, ink);
  // 右边：编号、来处和日子，右上角一枚印
  const x0 = x + cw + u * 6, x1 = x + w - u * 10, tw = x1 - x0, sz = u * 17, sx = x1 - sz, sy = y + u * 10.5;
  g.textAlign = "left"; g.fillStyle = red; g.font = "700 " + (u * 5.8).toFixed(1) + "px " + F; g.fillText(c.no, x0, y + u * 14.5);
  g.fillStyle = soft; g.font = "500 " + (u * 5).toFixed(1) + "px " + F; g.fillText(fit(g, c.src, tw - sz - u * 3), x0, y + u * 22.6); g.fillText(c.mon + " 月 " + c.day + " 日", x0, y + u * 29.4);
  if (glyph) {                                              // 印：朱底白字，边上缺几口，像盖上去的
    const rr = rng(hsh + 7); g.fillStyle = lit(PAGE.seal); g.fillRect(sx, sy, sz, sz);
    g.fillStyle = lit(PAGE.paper); g.font = "900 " + (sz * .74).toFixed(1) + "px " + F; g.textAlign = "center"; g.fillText(glyph, sx + sz / 2, sy + sz * .54);
    g.globalAlpha = .55; for (let k = 0; k < 9; k++) { const e = Math.floor(rr() * 4), t = rr() * sz, s = u * (.5 + rr() * 1.1); g.fillRect(e < 2 ? sx + t : (e === 2 ? sx - s * .3 : sx + sz - s * .7), e < 2 ? (e ? sy - s * .3 : sy + sz - s * .7) : sy + t, s, s); } g.globalAlpha = 1;
    g.textAlign = "left";
  }
  flourish(g, x0, x1, y + u * 38.5, u, soft);
  // 为什么存它：摆在两道花线当中，上下居中、左右居中（像一页书名页），字少的时候下半张不空着
  g.font = "700 " + (u * 8.2).toFixed(1) + "px " + F;
  const lines = wrap(c.why, Math.max(3, Math.floor(tw / (u * 8.4))));
  const top = y + u * 38.5, bot = y + h - u * 24.5, bh = u * (11 + lines.length * 12.4), by = (top + bot) / 2 - bh / 2, cx = (x0 + x1) / 2;
  g.textAlign = "center"; g.fillStyle = red; g.font = "700 " + (u * 5.2).toFixed(1) + "px " + F; g.fillText("存它是因为", cx, by + u * 3);
  g.fillStyle = ink; g.font = "700 " + (u * 8.2).toFixed(1) + "px " + F; lines.forEach((ln, k) => g.fillText(ln, cx, by + u * (11 + k * 12.4 + 6.2)));
  // 底下：一道花线，读完要多久
  flourish(g, x0, x1, y + h - u * 24.5, u, soft);
  g.fillStyle = soft; g.font = "500 " + (u * 5.2).toFixed(1) + "px " + F; g.fillText("读完约 " + c.min + " 分钟", cx, y + h - u * 15.2);
  g.restore();
}

/* ---------- 牌背：老书的烫金封面 ---------- */
// crop：从扫描里取哪一块（左、上、右、下，比例；去掉拍进去的书口和白边）。tint：皮色换成这一盒的色系。
// squash：牌比这本书宽，照原样要多裁掉上下的花边，所以允许把它压扁这么多（比例），剩下的才裁
export const BACKS = {
  family: { name: "跟盒子", src: "c01", crop: [.035, .03, .945, .975], tint: true },      // 道夫斯装帧所（The Doves Bindery）的红摩洛哥皮烫金，皮色换成每一盒的色系
  tulip: { name: "红皮", src: "c01", crop: [.035, .03, .945, .975] },                    // 同一张，原来的红，所有的盒子一个样
  calf: { name: "老皮", src: "c62", crop: [.105, .045, .985, .965] },                    // 深色小牛皮，满版的烫金绳纹
};
// 「跟盒子」时皮面换成什么颜色（屏上要看到的；比盒子的布色深一档，金才压得住）
const DEEP = { 藏青: "#27324F", 枣红: "#7C2A22", 青绿: "#2B5645", 石青: "#465667", 赭黄: "#4E2D12", 墨: "#2B211A", 绛紫: "#4B2A45" };
const BW = 640, BH = 908, imgs = {}, made = {};
function loadCover(src, done) {
  const it = imgs[src] || (imgs[src] = { img: new Image(), ok: false, wait: [] });
  if (it.ok) return done(it.img); it.wait.push(done);
  if (!it.img.src) { it.img.onload = () => { it.ok = true; it.wait.splice(0).forEach((f) => f(it.img)); }; it.img.src = new URL("../vendor/covers/" + src + ".webp", import.meta.url).href; }
}
// 这个颜色有几成是金：色相在黄那一段、又够亮
function goldness(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn; if (dl < 12) return 0;
  let hu = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; hu = (hu * 60 + 360) % 360;
  return sm((hu - 17) / 13) * sm((78 - hu) / 14) * sm((mx / 255 - .3) / .28) * sm((dl / mx - .12) / .2);
}
/* 做一张牌背。回来的是 { c 颜色那张图, m 「哪里是金」那张图 }；图还没读到就先回 null，读到了叫 done。
 * kind：BACKS 里的哪一种；fam：这一盒的色系名 */
export function makeBack(kind, fam, done) {
  const B = BACKS[kind] || BACKS.family, key = kind + "|" + (B.tint ? fam : "");
  if (made[key]) return made[key];
  let ready = false;
  loadCover(B.src, (img) => {
    const c = document.createElement("canvas"), m = document.createElement("canvas"); c.width = m.width = BW; c.height = m.height = BH;
    const g = c.getContext("2d", { willReadFrequently: true }), [l, t, r, b] = B.crop, sw = img.width * (r - l), sh0 = img.height * (b - t), sh = sh0 * Math.max(1 - (B.squash || 0), Math.min(1, sw / sh0 * BH / BW)), k = Math.max(BW / sw, BH / sh), dw = sw * k, dh = sh * k;
    g.imageSmoothingQuality = "high"; g.drawImage(img, img.width * l, img.height * t, sw, sh0, (BW - dw) / 2, (BH - dh) / 2, dw, dh);
    const id = g.getImageData(0, 0, BW, BH), d = id.data, mk = new ImageData(BW, BH), md = mk.data, n = BW * BH;
    let ref = 0, cnt = 0; const T = new Float32Array(n);
    for (let i = 0; i < n; i++) { const R = d[i * 4], G = d[i * 4 + 1], Bl = d[i * 4 + 2], tt = T[i] = goldness(R, G, Bl); if (tt < .08) { ref += .2126 * S2L[R] + .7152 * S2L[G] + .0722 * S2L[Bl]; cnt++; } }
    ref /= Math.max(1, cnt); const deep = B.tint ? rgbOf(DEEP[fam] || DEEP.枣红).map(s2l) : null, dl = deep ? .2126 * deep[0] + .7152 * deep[1] + .0722 * deep[2] : 0;
    const px = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const j = i * 4, tt = T[i]; px[0] = S2L[d[j]]; px[1] = S2L[d[j + 1]]; px[2] = S2L[d[j + 2]];
      if (deep) { const lum = (.2126 * px[0] + .7152 * px[1] + .0722 * px[2]) / Math.max(ref, 1e-3), sh2 = clamp(lum, .35, 2.2); for (let q = 0; q < 3; q++) px[q] = lerp(deep[q] * sh2 + (lum > 1.6 ? (lum - 1.6) * dl * .5 : 0), px[q], tt); }      // 皮面：换成这一盒的颜色，明暗照原来的（皮纹、磨痕还在）；金不动
      for (let q = 0; q < 3; q++) d[j + q] = enc(px[q] / TINT[q]);
      md[j] = 0; md[j + 1] = Math.round(lerp(232, 92, tt)); md[j + 2] = Math.round(170 * tt); md[j + 3] = 255;                    // 绿管粗糙、蓝管金属：皮面要粗（光一点就整片泛白，深色发灰），金光滑、反环境光
    }
    g.putImageData(id, 0, 0); const gm = m.getContext("2d"); gm.putImageData(mk, 0, 0);
    made[key] = { c, m }; if (ready && done) done(made[key]);
  });
  ready = true; return made[key] || null;
}
// 给牌背的材质接上「金的地方反环境光」
export function gild(mat, maskTex) { foil(mat, maskTex); }
// 现在用哪一种牌背：地址里的 ?back= 最大，其次是记在设备上的，再不然是默认
const KEY = "lab-card-back";
export function backKind() { let k = new URLSearchParams(location.search).get("back"); try { if (BACKS[k]) localStorage.setItem(KEY, k); else k = localStorage.getItem(KEY); } catch (e) { /* 存不了就只认地址 */ } return BACKS[k] ? k : "family"; }
export function setBackKind(k) { if (!BACKS[k]) return; try { localStorage.setItem(KEY, k); } catch (e) { /* 忽略 */ } }
