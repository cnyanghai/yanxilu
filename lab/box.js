/* 开盒（档案架上的一个牌盒打开以后）。回答一件事：一盒几十张牌，怎么翻着看、一下找到想看的那张、看完合上。
 * 2026-11-14 第一版是叠着摊成一两列；同日按用户的话改成扇形（他原来想的就是「一个大圆的扇形，来回左右翻」），只有旧书房。
 * 由书架那一页（shelf.js）叫：盒子从架上抽出来以后再点它一下。
 *
 * 节拍：
 *   1 打开   盒子落到屏幕底下、盒口朝着人，盒盖往后掀开；里面的牌一张张飞出来
 *   2 成扇   牌排在一个大圆的弧上，后一张压着前一张，每张露出左边一条，上面竖着写标题；没读的背面朝上（藏青烫金），在扇子的右头
 *   3 转     手指按着左右划，整把扇子跟着转；转到正中的那张立起来、放大，停在扇子上面给人看（转得快的时候只探一点头）
 *   4 翻开   立着的那张要是背面朝上，点它一下翻过来（翻过来就算读了）
 *   5 合上   牌一张张回盒里，盒盖合上
 *
 * 结构：每张牌是正反两片（共用一张图集，一张牌一格；立起来的那张另画一张清楚的）。牌一直是真的大小（厘米），
 *   放在离镜头某个距离上，让它在屏上正好是要的宽；所以这里所有位置都是「屏上的像素 → 那个距离上的厘米」换出来的。
 *   扇面每一帧现算：pos 是转到第几张（可以是小数），牌的位置只跟着它走，所以转、松手滑一段、点某一张转过去是同一套。
 * 盒子本身的开合（下半截盒身、上半截盒盖，各取盒面那张图的一截）也在这里；盒子飞到哪、底下那张纸写什么，在 shelf.js。 */
import { THREE, clamp, lerp, E, rng, LOOK, CJK, grainOver } from "./kit.js";

const CW = 8.8, CH = 12.5;                                  // 一张牌多大（厘米）
const COL = .24;                                            // 牌面左边竖着写标题的那一条占牌宽的几成：扇面上后一张压着前一张，露出来的就是这一条
const P = {
  dealDur: .5, dealEach: .32,                               // 发出来：全部牌一共错开多久、每张飞多久
  backDur: .3, backEach: .22,                               // 收回去
  lid: .26, lidOpen: 1.9,                                   // 盒盖掀开多久、掀到多大（弧度）
  sag: .2,                                                  // 扇子两头比正中低多少（牌高的几成）：越大越弯
  follow: 13,                                               // 松手以后转到位的快慢
  fling: .22, flingMax: 30,                                 // 松手时顺着手上的速度再滑多远（秒）；速度最多按每秒几张算（甩得再快也只多滑六七张）
  riseUp: 9, riseDown: 16,                                  // 正中那张立起来、落回去的快慢
  poke: .1,                                                 // 转得快的时候正中那张只探这么一点头（立起来那段路的几成）
  slow: 1.6, fast: 5,                                       // 每秒转过几张以内算「停下来看」，超过几张算「在翻」
  flip: .32,                                                // 翻面
};
const SRC = ["知乎", "公众号", "网页", "知乎", "播客文稿"];
const WHY = ["把来龙去脉讲清了", "数据是一手的", "和上周读的那一章对得上", "反方的说法，留着对照", "例子举得好", "以后写东西用得上", "作者亲历的事", "一张图把关系画明白了", "问题提得好，答案存疑"];
const TAIL = ["到底是什么", "的三个误区", "为什么会这样", "一张图看懂", "的几个关键年份", "：正反两种说法", "，行内人怎么看", "入门该先读哪篇", "和它的反例", "背后的账怎么算", "最容易算错的地方", "：一个亲历者的回忆"];
// 一盒牌（编的）：n 张，其中 u 张没读。没读的排在最后（摊开时在最前面）
export function makeCards(box, heads) {
  const r = rng((box.i + 1) * 7919 + box.n * 31), out = [], seen = new Set();
  for (let k = 0; k < box.n; k++) {
    let title; do { title = heads[Math.floor(r() * heads.length)] + TAIL[Math.floor(r() * TAIL.length)]; } while (seen.has(title) && seen.size < heads.length * TAIL.length); seen.add(title);
    out.push({ title, src: SRC[Math.floor(r() * SRC.length)], why: WHY[Math.floor(r() * WHY.length)], min: 2 + Math.floor(r() * 14), mon: 6 + Math.floor(r() * 6), day: 1 + Math.floor(r() * 28), no: box.vol + "·" + String(k + 1).padStart(2, "0"), read: k < box.n - box.u });
  }
  return out;
}

const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const inkA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return "rgba(" + (n >> 16) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")"; };
const fit = (g, str, wMax) => { if (g.measureText(str).width <= wMax) return str; let s = str; while (s.length > 1 && g.measureText(s + "…").width > wMax) s = s.slice(0, -1); return s + "…"; };
const sm = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
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
// 牌面：左边一条竖着写标题（扇面上只露这一条），一道细线隔开；右边是编号、来处和日子、为什么存它、读完要多久
function drawFace(g, x, y, w, h, c) {
  const K = LOOK.pk, u = w / 100, F = CJK, cw = w * COL, line = Math.max(1, u * .35);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = K.cardFace; g.fillRect(x, y, w, h); grainOver(g, x, y, w, h, true);
  g.strokeStyle = inkA(K.ink, .5); g.lineWidth = Math.max(1, u * .5); rr(g, x + u * 3, y + u * 3, w - u * 6, h - u * 6, u * 3); g.stroke();
  g.fillStyle = inkA(K.ink, .32); g.fillRect(x + cw, y + u * 8, line, h - u * 16);
  titleDown(g, x + u * 3 + (cw - u * 3) / 2, y + u * 9.5, h - u * 19, c.title, u * 12, u * 8.2, K.ink);
  const x0 = x + cw + u * 6, tw = w - cw - u * 14;
  g.textAlign = "left"; g.textBaseline = "middle"; g.fillStyle = K.accent; g.font = "600 " + (u * 5.6).toFixed(1) + "px " + F; g.fillText(c.no, x0, y + u * 13.5);
  g.fillStyle = inkA(K.ink, .66); g.font = "500 " + (u * 5.2).toFixed(1) + "px " + F; g.fillText(fit(g, c.src + " · " + c.mon + " 月 " + c.day + " 日", tw), x0, y + u * 23);
  g.fillStyle = inkA(K.ink, .32); g.fillRect(x0, y + u * 30, tw, line);
  g.fillStyle = inkA(K.ink, .66); g.font = "500 " + (u * 5.4).toFixed(1) + "px " + F; g.fillText("存它是因为", x0, y + u * 42);
  g.fillStyle = K.ink; g.font = "700 " + (u * 7.8).toFixed(1) + "px " + F;
  const per = Math.max(3, Math.floor(tw / (u * 8))); for (let i = 0, ln = 0; i < c.why.length && ln < 5; i += per, ln++) g.fillText(c.why.slice(i, i + per), x0, y + u * (54.5 + ln * 11.5));
  g.fillStyle = inkA(K.ink, .32); g.fillRect(x0, y + h - u * 22, tw, line);
  g.fillStyle = inkA(K.ink, .66); g.font = "500 " + (u * 5.4).toFixed(1) + "px " + F; g.fillText("读完约 " + c.min + " 分钟", x0, y + h - u * 13.5);
  g.restore();
}
// 牌背：藏青布面，烫金的两道框，当中一个圆里一个大字（这一盒是哪一类），和拆包页的牌背是同一种。扇面上露出来的是左边那两道金线
function drawBackSide(g, w, h, ch, no) {
  const K = LOOK.pk, u = w / 100;
  g.fillStyle = K.cardBack; g.fillRect(0, 0, w, h); grainOver(g, 0, 0, w, h, false);
  g.strokeStyle = g.fillStyle = K.cardLine; g.lineWidth = u * 1.5; rr(g, u * 5, u * 5, w - u * 10, h - u * 10, u * 3.5); g.stroke(); g.lineWidth = Math.max(1, u * .45); rr(g, u * 8.5, u * 8.5, w - u * 17, h - u * 17, u * 2); g.stroke();
  const cx = w / 2, cy = h / 2; g.lineWidth = u; g.beginPath(); g.arc(cx, cy, u * 30, 0, 7); g.stroke(); g.lineWidth = Math.max(1, u * .35); g.beginPath(); g.arc(cx, cy, u * 33, 0, 7); g.stroke();
  g.textAlign = "center"; g.textBaseline = "middle"; g.font = "900 " + (u * 38).toFixed(1) + "px " + CJK; g.fillText(ch, cx, cy + u * 1.5);
  g.font = "600 " + (u * 5.4).toFixed(1) + "px " + CJK; g.fillText(no, cx, h - u * 19);
}

/* env：scene 场景；hero 抽出来那一件所在的组（盒身、盒盖挂在它下面）；play 动画轨；view() 现在的屏幕与镜头
 *   （vw、vh 屏幕多大，tanH 半个视角的正切，camY、camZ 镜头在哪，top、bottom 上下各让开多少像素，pr 画布的像素比）；
 *   boxPose() 打开的盒子在哪；glyph(b) 牌背上那个字；tick(i, n)、flipSnd() 出声；focus(i) 正中换了一张时叫一下（底下那行字跟着换） */
export function createBoxView(env) {
  const { scene, hero, play, maxAniso } = env;
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const shape = new THREE.Shape(), R = .42, hw = CW / 2, hh = CH / 2, Q = Math.PI / 2;                    // 圆角的一片
  shape.moveTo(-hw + R, -hh); shape.lineTo(hw - R, -hh); shape.absarc(hw - R, -hh + R, R, -Q, 0, false); shape.lineTo(hw, hh - R); shape.absarc(hw - R, hh - R, R, 0, Q, false);
  shape.lineTo(-hw + R, hh); shape.absarc(-hw + R, hh - R, R, Q, 2 * Q, false); shape.lineTo(-hw, -hh + R); shape.absarc(-hw + R, -hh + R, R, 2 * Q, 3 * Q, false);
  const geo = new THREE.ShapeGeometry(shape, 4);
  { const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / CW + .5, p.getY(i) / CH + .5); }
  const mkTex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; };
  const atlasC = document.createElement("canvas"), backC = document.createElement("canvas"); backC.width = 512; backC.height = 728;
  let atlasT = null; const backT = mkTex(backC), backMat = new THREE.MeshStandardMaterial({ map: backT, roughness: .8 });
  // 立起来的那张另画一张清楚的。备两张：前一张还没落回去、后一张已经在往上走的时候各用各的
  const big = [0, 1].map(() => { const c = document.createElement("canvas"); c.width = 640; c.height = 908; const t = mkTex(c); return { c, t, mat: new THREE.MeshStandardMaterial({ map: t, roughness: .86 }), who: -1 }; });
  let cards = [], box = null, L = null;
  let pos = 0, tgt = 0, pos1 = 0, vel = 0, focus = -1, drag = null;       // pos：转到第几张（小数）；tgt：松手以后要转到的那张；vel：现在每秒转过几张
  let dealing = false, closing = false, flipping = false;

  // 盒子打开的样子：下半截盒身、上半截盒盖，各取盒面那几张图的一截；盒盖绕着后沿往后掀
  const unit = new THREE.BoxGeometry(1, 1, 1), SEAM = .2;
  const body = new THREE.Mesh(unit, []), lidPivot = new THREE.Group(), lid = new THREE.Mesh(unit, []); lidPivot.add(lid);
  const open3d = new THREE.Group(); open3d.add(body, lidPivot); open3d.visible = false; hero.add(open3d);
  const mouth = new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 1 }), plain = new THREE.MeshStandardMaterial({ roughness: LOOK.bookRough });
  let crops = [];
  function dressBox(b, tex, cloth) {                         // tex：{ front, back, end } 盒子大面、背面、朝外那一头的图
    crops.forEach((m) => { m.map.dispose(); m.dispose(); }); crops = [];
    const cut = (src, lo, hi) => { const t = src.clone(); t.repeat.set(1, hi - lo); t.offset.set(0, lo); t.needsUpdate = true; const m = new THREE.MeshStandardMaterial({ map: t, roughness: LOOK.bookRough }); crops.push(m); return m; };
    plain.color.set(cloth);
    body.material = [cut(tex.front, 0, 1 - SEAM), cut(tex.back, 0, 1 - SEAM), mouth, plain, cut(tex.end, 0, 1 - SEAM), plain];      // 面的顺序：+x -x +y -y +z -z
    lid.material = [cut(tex.front, 1 - SEAM, 1), cut(tex.back, 1 - SEAM, 1), plain, mouth, cut(tex.end, 1 - SEAM, 1), plain];
    body.scale.set(b.t, b.h * (1 - SEAM), b.d); body.position.set(0, -b.h * SEAM / 2, 0);
    lidPivot.position.set(-b.t / 2, b.h * (.5 - SEAM), 0); lid.scale.set(b.t, b.h * SEAM, b.d); lid.position.set(b.t / 2, b.h * SEAM / 2, 0); lidPivot.rotation.z = 0;
  }

  /* 扇子怎么摆（都是屏上的像素）。上面是立起来给人看的那一张，下面是扇面，再下面是盒子（盒子和那行字的地方在 view().bottom 里让开了）。
   *   扇面：每张牌左边那一条（宽 s0）的中线落在一个大圆的弧上，圆心在屏幕正下方很远；牌跟着弧歪，正中那张是正的。
   *   相邻两张沿弧错开 s（牌少的时候错得开一点，整把正好摊满）；离正中远到快出屏幕的，越挤越紧，挤成一沓边（看得出两头还有，不占地方）。
   *   牌多的时候扇面跟着 pos 转（正中就是 pos）；转到头，头一张、末一张停在屏幕边上不再往里走，这时候是「立起来的那张」在扇面上往边上挪。 */
  function layout() {
    const V = env.view(), n = cards.length, areaT = V.top + 10, areaH = V.vh - V.bottom - areaT;
    const W = Math.min(clamp(V.vw * .36, 112, 190), areaH * .235), H = W * CH / CW, s0 = W * COL;
    const half = Math.min(V.vw / 2 - 8, W * 3.6), sag = H * P.sag, R = half * half / (2 * sag);
    const bigW = Math.min(V.vw - 72, 290, areaH * .52 * CW / CH), bigH = bigW * CH / CW, gap = 20;
    const y0 = areaT + Math.max(0, (areaH - (bigH + gap + H + sag)) / 2), dispY = y0 + bigH / 2, fanTop = y0 + bigH + gap;
    // 牌只有两三张：错开得大一点，每张露出大半张。再多就只露标题那一条，露半截正文反而乱；整把摊不满屏幕就摆在正中
    const wide = n > 1 ? Math.min((2 * half - W) / (n - 1), W * .8) : 0, s = wide >= W * .62 ? wide : s0, zone = s0;                          // zone：离边上还有这么远就开始挤
    const linL = half - s0 / 2 - zone, linR = half - 4 + s0 / 2 - zone;
    const cmin = linL / s, cmax = n - 1 - Math.min(linR, Math.max(0, half - W + s0 / 2)) / s, cfit = ((n - 1) * s + W - s0) / (2 * s);      // 转到头：头一张刚好不挤、末一张整张在屏幕里
    // 扇面离镜头多远：照「牌是真的大小、在屏上正好这么宽」算；但一定要在盒子前面（横屏时牌小，照真的大小算会掉到盒子和那层暗幕后面去），那时候牌缩小一点
    const D = Math.min(CW / W * V.vh / (2 * V.tanH), V.camZ - env.boxPose().z - 6), wpp = 2 * D * V.tanH / V.vh, kF = W * wpp / CW;
    L = { n, vw: V.vw, vh: V.vh, camY: V.camY, W, H, s0, s, half, R, cx: V.vw / 2, pivY: fanTop + H / 2 + R, fanTop, bigW, bigH, dispY, zone, linL, linR, cmin, cmax, cfit, fits: (n - 1) * s + W <= 2 * half + .5,
      keep: (Math.max(linL, linR) + zone * 5) / s, wpp, kF, zFan: V.camZ - D, disp: { x: 0, y: V.camY + (V.vh / 2 - dispY) * wpp, k: bigW / W } };      // 立着的那张和扇面在同一个远近上，是放大出来的：这样它往上走的时候还夹在左右两张中间，像从扇子里抽出来的
    return L;
  }
  const centre = () => (L.fits ? L.cfit : clamp(pos, L.cmin, L.cmax));                                      // 扇面的正中现在是第几张
  function arcAt(d) {                                                                                       // 离正中 d 张的牌，沿弧离正中多远
    const v = Math.abs(d) * L.s, lin = d < 0 ? L.linL : L.linR;
    return (d < 0 ? -1 : 1) * (L.fits || v <= lin ? v : lin + L.zone * (1 - Math.exp(-(v - lin) / L.zone)));
  }
  function fanAt(i, c) {                                                                                    // 第 i 张在扇面上：那一条的中线在哪（ax、ay），牌心在哪（sx、sy），歪多少（phi，顺时针为正）
    const phi = arcAt(i - c) / L.R, sn = Math.sin(phi), cs = Math.cos(phi), off = (L.W - L.s0) / 2, ax = L.cx + L.R * sn, ay = L.pivY - L.R * cs;
    return { ax, ay, sx: ax + off * cs, sy: ay + off * sn, phi };
  }
  function drawAtlas() {
    const V = env.view(), n = cards.length, cw = clamp(Math.round(L.W * Math.min(V.pr, 3) / 32) * 32, 192, 384), ch = Math.round(cw * CH / CW), cols = Math.min(n, Math.floor(4096 / cw)), rows = Math.ceil(n / cols);
    atlasC.width = cols * cw; atlasC.height = rows * ch; const g = atlasC.getContext("2d");
    cards.forEach((c, i) => drawFace(g, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch, c.c));
    if (atlasT) atlasT.dispose(); atlasT = mkTex(atlasC);
    cards.forEach((c, i) => { const t = atlasT.clone(); t.repeat.set(1 / cols, 1 / rows); t.offset.set((i % cols) / cols, 1 - (Math.floor(i / cols) + 1) / rows); t.needsUpdate = true; c.faceMat.map = t; c.faceMat.needsUpdate = true; c.front.material = c.faceMat; });
  }
  function clear() { cards.forEach((c) => { group.remove(c.g); if (c.faceMat.map) c.faceMat.map.dispose(); c.faceMat.dispose(); }); cards = []; big.forEach((s) => { s.who = -1; }); focus = -1; drag = null; }

  // 盒口在哪（牌从那里出来、回那里去）：盒子打开时的位置上面一点
  const mouthPose = () => { const b = env.boxPose(); return { x: b.x, y: b.y + box.h * .22 * b.k, z: b.z + 1.5, rx: b.tilt, k: b.k }; };
  function open(b, list, tex, cloth, done) {
    box = b; clear(); dealing = true; closing = flipping = false; group.visible = true;
    drawBackSide(backC.getContext("2d"), backC.width, backC.height, env.glyph(b), b.vol); backT.needsUpdate = true;
    list.forEach((cd, i) => {
      const g3 = new THREE.Group(), faceMat = new THREE.MeshStandardMaterial({ roughness: .86 });
      const front = new THREE.Mesh(geo, faceMat); front.position.z = .012; const back = new THREE.Mesh(geo, backMat); back.position.z = -.012; back.rotation.y = Math.PI;
      g3.add(front, back); g3.visible = false; group.add(g3);
      cards.push({ c: cd, i, g: g3, front, back, faceMat, ry: cd.read ? 0 : Math.PI, k: 1, r: 0, d: 0, dk: 0, shown: false, big: null, sx: 0, sy: 0, ax: 0, ay: 0, phi: 0 });      // r：立起来几成；d：从盒口飞到扇面上走了几成
    });
    const n = cards.length, first = list.findIndex((c) => !c.read);
    pos = tgt = pos1 = first >= 0 ? first : n - 1; vel = 0; focus = pos;                                    // 一打开就停在头一张没读的上；都读过就停在最后一张
    layout(); drawAtlas(); dressBox(b, tex, cloth); open3d.visible = true;
    play(P.lid, (e) => { lidPivot.rotation.z = P.lidOpen * e; }, { ease: E.back });
    const c0 = centre(), fly = cards.filter((cd) => Math.abs(cd.i - c0) <= L.keep), m = fly.length;        // 挤在两头看不见的那些不用飞，直接在位
    cards.forEach((cd) => { if (!fly.includes(cd)) { cd.d = 1; cd.shown = true; } });
    fly.forEach((cd, k) => {
      const delay = P.lid * .6 + (k / m) * P.dealDur;
      play(P.dealEach, (e, kk) => { cd.shown = true; cd.d = e; cd.dk = kk; }, { delay, ease: E.out3, done: () => { cd.d = 1; cd.dk = 0; if (k === m - 1) { dealing = false; env.focus && env.focus(focus); done && done(); } } });
      play(.01, () => env.tick(cd.i, n), { delay });
    });
  }
  function close(done) {
    if (!box) return; dealing = closing = true; drag = null; tgt = pos;
    const fly = cards.filter((cd) => cd.g.visible), m = fly.length;
    cards.forEach((cd) => { if (!fly.includes(cd)) cd.shown = false; });
    fly.forEach((cd, k) => play(P.backEach, (e) => { cd.d = 1 - e; }, { delay: .1 + ((m - 1 - k) / m) * P.backDur, ease: E.in2, done: () => { cd.shown = false; } }));
    play(P.lid, (e) => { lidPivot.rotation.z = P.lidOpen * (1 - e); }, { delay: .1 + P.backDur + P.backEach * .7, ease: E.io3, done() { open3d.visible = false; group.visible = false; clear(); box = null; dealing = closing = false; done && done(); } });
  }

  // 手指：按下（转着的时候按住就停）、拖、松手（顺着速度再滑一点，停在最近的一张上）
  const lock = () => !L || dealing || flipping;
  const rubber = (p) => { const hi = cards.length - 1; return p < 0 ? p * .3 : p > hi ? hi + (p - hi) * .3 : p; };       // 转过头了：跟手只跟三成
  function grab(px) { if (lock()) return false; drag = { x0: px, p0: pos }; tgt = pos; return true; }
  function dragTo(px) { if (!drag || lock()) return; pos = rubber(drag.p0 - (px - drag.x0) / Math.min(L.s, L.s0 * 1.6)); }
  function release() { if (!drag) return; drag = null; tgt = clamp(Math.round(pos + clamp(vel, -P.flingMax, P.flingMax) * P.fling), 0, cards.length - 1); }
  function go(i) { if (lock()) return false; drag = null; tgt = clamp(Math.round(i), 0, cards.length - 1); return true; }
  const nudge = (dir) => go(Math.round(tgt) + dir);
  function jump(i) { if (!go(i)) return false; pos = pos1 = tgt; vel = 0; return true; }                    // 给测试脚本：不走动画直接到
  // 手指点在哪：立着的那张（big）、扇面上的某一张，还是都不是
  function hit(px, py) {
    if (lock()) return null;
    const f = cards[focus];
    if (f && f.r > .5 && Math.abs(px - L.cx) <= L.bigW / 2 && Math.abs(py - L.dispY) <= L.bigH / 2) return { big: true, i: focus };
    for (let i = cards.length - 1; i >= 0; i--) {                                                           // 后面的压着前面的，从最上面那张往下找
      const cd = cards[i]; if (!cd.g.visible || (i === focus && cd.r > .5)) continue;
      const dx = px - cd.sx, dy = py - cd.sy, cs = Math.cos(cd.phi), sn = Math.sin(cd.phi);
      if (Math.abs(dx * cs + dy * sn) <= L.W / 2 && Math.abs(-dx * sn + dy * cs) <= L.H / 2) return { big: false, i };
    }
    return null;
  }
  // 立着的那张要是背面朝上，翻过来；翻过来就算读了
  function flip(done) {
    const cd = cards[focus]; if (!cd || lock() || cd.c.read || cd.r < .8) return false;
    flipping = true; env.flipSnd();
    play(P.flip, (e, kk) => { cd.ry = Math.PI * (1 - e); cd.k = 1 + Math.sin(Math.PI * kk) * .06; }, { ease: E.io3, done() { cd.ry = 0; cd.k = 1; cd.c.read = true; flipping = false; done && done(cd.i); } });
    return true;
  }
  function relayout() { if (box) layout(); }

  const _e = new THREE.Euler(0, 0, 0, "ZXY");                                                               // 先翻面，再朝人倾，最后在屏幕里歪：背面朝上的牌歪的方向才和正面朝上的一样
  function step(raw) {
    if (!group.visible || !L) return;
    const n = cards.length; if (!n) return;
    if (!drag && !dealing) { pos += (tgt - pos) * (1 - Math.exp(-P.follow * raw)); if (Math.abs(tgt - pos) < 1e-3) pos = tgt; }
    vel += ((pos - pos1) / Math.max(raw, 1e-4) - vel) * (1 - Math.exp(-20 * raw)); pos1 = pos;
    const f = clamp(Math.round(pos), 0, n - 1);
    if (f !== focus) { focus = f; if (!dealing) { env.tick(f, n); env.focus && env.focus(f); } }
    const still = 1 - sm((Math.abs(vel) - P.slow) / (P.fast - P.slow)), c = centre(), m0 = dealing ? mouthPose() : null;
    let up = null, up2 = null;                                                                              // 立起来了的牌（同时最多两张：一张在落、一张在起）
    for (const cd of cards) {
      const i = cd.i, want = i === focus && !dealing ? sm((.5 - Math.abs(i - pos)) / .32) * lerp(P.poke, 1, still) : 0;
      cd.r += (want - cd.r) * (1 - Math.exp(-(want > cd.r ? P.riseUp : P.riseDown) * raw)); if (want === 0 && cd.r < .002) cd.r = 0;
      if (want > .3 && !cd.big) {                                                                           // 要立起来了：换上那张画得清楚的
        const sl = big.find((s) => s.who < 0) || (cards[big[0].who].r <= cards[big[1].who].r ? big[0] : big[1]);
        if (sl.who >= 0) { const o = cards[sl.who]; o.big = null; o.front.material = o.faceMat; }
        sl.who = i; cd.big = sl; drawFace(sl.c.getContext("2d"), 0, 0, sl.c.width, sl.c.height, cd.c); sl.t.needsUpdate = true; cd.front.material = sl.mat;
      } else if (cd.big && want === 0 && cd.r < .03) { cd.big.who = -1; cd.big = null; cd.front.material = cd.faceMat; }
      if (cd.r > 0) { if (!up) up = cd; else up2 = cd; }
    }
    for (const cd of cards) {
      // 立起来的那张离开了扇面：它两边的牌往中间各靠半条，把空出来的地方合上（不然露出前一张牌的半截正文，乱）；它落回来的时候再让开
      const i = cd.i, shut = (up && up !== cd ? (i < up.i ? .5 : -.5) * up.r : 0) + (up2 && up2 !== cd ? (i < up2.i ? .5 : -.5) * up2.r : 0);
      const F = fanAt(i + shut, c); cd.sx = F.sx; cd.sy = F.sy; cd.phi = F.phi; cd.ax = F.ax; cd.ay = F.ay;
      cd.g.visible = cd.shown && (Math.abs(i - c) <= L.keep || cd.r > 0);
      if (!cd.g.visible) continue;
      let x = (F.sx - L.vw / 2) * L.wpp, y = L.camY + (L.vh / 2 - F.sy) * L.wpp, z = L.zFan + i * .03, rz = -F.phi, rx = 0, k = cd.k * L.kF;
      if (cd.r > 0) { x = lerp(x, L.disp.x, cd.r); y = lerp(y, L.disp.y, cd.r); k *= lerp(1, L.disp.k, cd.r); rz *= 1 - cd.r; }
      if (cd.d < 1 && m0) { const e = cd.d, w = Math.sin(Math.PI * cd.dk); x = lerp(m0.x, x, e); y = lerp(m0.y, y, e) + w * 2.2; z = lerp(m0.z, z, e); rx = m0.rx * (1 - e); rz = rz * e + w * .12 * (i % 2 ? 1 : -1); k = lerp(m0.k, k, e); }
      cd.g.position.set(x, y, z); _e.set(rx, cd.ry, rz); cd.g.quaternion.setFromEuler(_e); cd.g.scale.setScalar(k);
    }
  }
  // 给测试脚本和页面用：这张牌在扇面上露出来的那一条的中间（拿它当手指落点）；立着的那张在屏上占的方块
  function stripOf(i) { const cd = cards[i]; return L && cd ? { x: cd.ax, y: cd.ay } : null; }
  const dispRect = () => (L ? { x: L.cx, y: L.dispY, w: L.bigW, h: L.bigH } : null);
  return { open, close, grab, dragTo, release, go, nudge, jump, hit, flip, relayout, step, stripOf, dispRect,
    get cards() { return cards; }, get focus() { return focus; }, get pos() { return pos; }, get centre() { return L ? centre() : 0; }, get busy() { return dealing || flipping; }, get L() { return L; }, get box() { return box; } };
}
