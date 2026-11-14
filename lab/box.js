/* 开盒（档案架上的一个牌盒打开以后）。回答一件事：一盒几十张牌，怎么一眼看全、一下找到想看的那张、看完放回去。
 * 2026-11-14 第一版，只有旧书房。由书架那一页（shelf.js）叫：盒子从架上抽出来以后点「打开」。
 *
 * 节拍：
 *   1 打开   盒子落到屏幕底下、盒口朝着人，盒盖往后掀开；里面的牌一张张飞出来
 *   2 摊开   牌叠着摊成一列（多了两列），后面的每张露出顶上一条，上面是标题；没读的背面朝上（藏青烫金），排在最前面
 *   3 划过   手指按在牌上划，碰到哪张哪张探头，一张一声一震（和划过书脊同一个动作）
 *   4 拿起   松手，那张飞到眼前；没读的翻过来（翻过来就算读了）
 *   5 放回   点一下，那张回到原来的位置（已经是正面朝上）
 *   6 合上   牌一张张回盒里，盒盖合上
 *
 * 结构：每张牌是正反两片（共用一张图集，一张牌一格；拿到眼前的那张另画一张清楚的）。牌一直是真的大小（厘米），
 *   摊开时放在离镜头某个距离上，让它在屏上正好是要的宽；所以这里所有位置都是「屏上的像素 → 那个距离上的厘米」换出来的。
 * 盒子本身的开合（下半截盒身、上半截盒盖，各取盒面那张图的一截）也在这里；盒子飞到哪、底下那张纸写什么，在 shelf.js。 */
import { THREE, clamp, lerp, E, rng, LOOK, CJK, grainOver } from "./kit.js";

const CW = 8.8, CH = 12.5;                                  // 一张牌多大（厘米）
const P = {
  dealDur: .62, dealEach: .3,                               // 发出来：全部牌一共错开多久、每张飞多久
  backDur: .4, backEach: .22,                               // 收回去
  popUp: 26, popDown: 14,                                   // 手指碰到的那张探头、缩回的快慢
  take: .36, flip: .3, put: .3,                             // 拿到眼前、翻面、放回
  lid: .26, lidOpen: 1.9,                                   // 盒盖掀开多久、掀到多大（弧度）
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
// 牌面：最上面一条是标题（叠着摊开时只露这一条，所以标题写在这里，一行）；下面是编号与来处、为什么存它、读完要多久
function drawFace(g, x, y, w, h, c) {
  const K = LOOK.pk, u = w / 100, F = CJK;
  g.fillStyle = K.cardFace; g.fillRect(x, y, w, h); grainOver(g, x, y, w, h, true);
  g.strokeStyle = inkA(K.ink, .5); g.lineWidth = Math.max(1, u * .5); rr(g, x + u * 3, y + u * 3, w - u * 6, h - u * 6, u * 3); g.stroke();
  g.fillStyle = K.ink; g.textAlign = "left"; g.textBaseline = "middle"; g.font = "700 " + (u * 8.6).toFixed(1) + "px " + F; g.fillText(fit(g, c.title, w - u * 14), x + u * 7, y + u * 11.2);
  g.fillStyle = inkA(K.ink, .4); g.fillRect(x + u * 7, y + u * 18.4, w - u * 14, Math.max(1, u * .35));
  g.fillStyle = K.accent; g.font = "600 " + (u * 5.2).toFixed(1) + "px " + F; g.fillText(c.no, x + u * 7, y + u * 26); g.textAlign = "right"; g.fillText(c.src + " · " + c.mon + " 月 " + c.day + " 日", x + w - u * 7, y + u * 26);
  g.textAlign = "left"; g.fillStyle = inkA(K.ink, .62); g.font = "500 " + (u * 5.4).toFixed(1) + "px " + F; g.fillText("存它是因为", x + u * 7, y + u * 44);
  g.fillStyle = K.ink; g.font = "700 " + (u * 7.4).toFixed(1) + "px " + F;
  const per = Math.max(4, Math.floor((w - u * 14) / (u * 7.6))); for (let i = 0, ln = 0; i < c.why.length && ln < 4; i += per, ln++) g.fillText(c.why.slice(i, i + per), x + u * 7, y + u * (56 + ln * 11));
  g.fillStyle = inkA(K.ink, .4); g.fillRect(x + u * 7, y + h - u * 21, w - u * 14, Math.max(1, u * .35));
  g.fillStyle = K.ink; g.font = "500 " + (u * 5.4).toFixed(1) + "px " + F; g.fillText("读完约 " + c.min + " 分钟", x + u * 7, y + h - u * 12.5);
}
// 牌背：藏青布面，烫金的两道框，当中一个圆里一个大字（这一盒是哪一类），和拆包页的牌背是同一种
function drawBackSide(g, w, h, ch, no) {
  const K = LOOK.pk, u = w / 100;
  g.fillStyle = K.cardBack; g.fillRect(0, 0, w, h); grainOver(g, 0, 0, w, h, false);
  g.strokeStyle = g.fillStyle = K.cardLine; g.lineWidth = u * 1.5; rr(g, u * 5, u * 5, w - u * 10, h - u * 10, u * 3.5); g.stroke(); g.lineWidth = Math.max(1, u * .45); rr(g, u * 8.5, u * 8.5, w - u * 17, h - u * 17, u * 2); g.stroke();
  const cx = w / 2, cy = h / 2; g.lineWidth = u; g.beginPath(); g.arc(cx, cy, u * 30, 0, 7); g.stroke(); g.lineWidth = Math.max(1, u * .35); g.beginPath(); g.arc(cx, cy, u * 33, 0, 7); g.stroke();
  g.textAlign = "center"; g.textBaseline = "middle"; g.font = "900 " + (u * 38).toFixed(1) + "px " + CJK; g.fillText(ch, cx, cy + u * 1.5);
  g.font = "600 " + (u * 5.4).toFixed(1) + "px " + CJK; g.textAlign = "left"; g.fillText(no, u * 13, u * 15.5);
}

/* env：scene 场景；hero 抽出来那一件所在的组（盒身、盒盖挂在它下面）；play 动画轨；view() 现在的屏幕与镜头
 *   （vw、vh 屏幕多大，tanH 半个视角的正切，camY、camZ 镜头在哪，top、bottom 上下各让开多少像素）；tick(i, n)、flipSnd() 出声 */
export function createBoxView(env) {
  const { scene, hero, play, maxAniso } = env;
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const shape = new THREE.Shape(), R = .42, hw = CW / 2, hh = CH / 2, Q = Math.PI / 2;                    // 圆角的一片
  shape.moveTo(-hw + R, -hh); shape.lineTo(hw - R, -hh); shape.absarc(hw - R, -hh + R, R, -Q, 0, false); shape.lineTo(hw, hh - R); shape.absarc(hw - R, hh - R, R, 0, Q, false);
  shape.lineTo(-hw + R, hh); shape.absarc(-hw + R, hh - R, R, Q, 2 * Q, false); shape.lineTo(-hw, -hh + R); shape.absarc(-hw + R, -hh + R, R, 2 * Q, 3 * Q, false);
  const geo = new THREE.ShapeGeometry(shape, 4);
  { const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / CW + .5, p.getY(i) / CH + .5); }
  const mkTex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; };
  const atlasC = document.createElement("canvas"), backC = document.createElement("canvas"), bigC = document.createElement("canvas");
  backC.width = 384; backC.height = 544; bigC.width = 640; bigC.height = 908;
  let atlasT = null; const backT = mkTex(backC), bigT = mkTex(bigC);
  const backMat = new THREE.MeshStandardMaterial({ map: backT, roughness: .8 }), backUp = backMat.clone(), bigMat = new THREE.MeshStandardMaterial({ map: bigT, roughness: .86 });   // backUp：拿在眼前那张的背面（别的牌压暗时它不暗）
  const shade = (k) => { backMat.color.setScalar(k); cards.forEach((c) => c.faceMat.color.setScalar(k)); };                                    // 拿起一张的时候，摊着的那些压暗
  let cards = [], box = null, L = null, hot = -1, cur = -1, busy = false;

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

  // 屏上的一个点（像素）、要它在屏上多宽（像素），换成这张牌该放在哪（厘米）
  function place(px, py, wpx, lift = 0) {
    const V = env.view(), wpp = CW / wpx, D = wpp * V.vh / (2 * V.tanH);
    return { x: (px - V.vw / 2) * wpp, y: V.camY + (V.vh / 2 - py) * wpp, z: V.camZ - D + lift };
  }
  // 摊开的摆法：一列或几列，每列从上往下叠，后一张压着前一张、往下错开一条
  function layout() {
    const V = env.view(), n = cards.length, areaT = V.top + 14, areaH = V.vh - V.bottom - areaT, wide = V.vw > V.vh;
    const cols = wide ? clamp(Math.ceil(n / 7), 1, Math.floor(V.vw / 200)) : n > 9 ? 2 : 1, m = Math.ceil(n / cols), gap = 10;
    let wpx = Math.min((V.vw - 28 - (cols - 1) * gap) / cols, wide ? 210 : cols > 1 ? 190 : 250, areaH * .62 * CW / CH), hpx = wpx * CH / CW;
    let step = m > 1 ? (areaH - hpx) / (m - 1) : 0;
    if (m > 1 && step < 17) { hpx = Math.max(150, areaH - 17 * (m - 1)); wpx = hpx * CW / CH; step = (areaH - hpx) / (m - 1); }      // 牌太多：牌缩小一点，每条至少露十七像素
    step = Math.min(step, hpx * .34);
    const totalW = cols * wpx + (cols - 1) * gap, x0 = (V.vw - totalW) / 2 + wpx / 2, usedH = hpx + step * (m - 1), y0 = areaT + (areaH - usedH) / 2 + hpx / 2;
    L = { cols, m, wpx, hpx, step, x0, y0, gap, areaT, areaH };
    cards.forEach((c, i) => { const col = Math.floor(i / m), k = i % m; c.sx = x0 + col * (wpx + gap); c.sy = y0 + k * step; c.slot = place(c.sx, c.sy, wpx, k * .03); });      // 每列里后一张比前一张离镜头近一点点（压在上面），各列一样，不然后面的列看着大一圈
    return L;
  }
  function drawAtlas() {
    const V = env.view(), n = cards.length, cw = clamp(Math.round(L.wpx * Math.min(V.pr, 3) / 32) * 32, 192, 448), ch = Math.round(cw * CH / CW), cols = Math.min(n, Math.floor(4096 / cw)), rows = Math.ceil(n / cols);
    atlasC.width = cols * cw; atlasC.height = rows * ch; const g = atlasC.getContext("2d");
    cards.forEach((c, i) => drawFace(g, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch, c.c));
    if (atlasT) atlasT.dispose(); atlasT = mkTex(atlasC);
    cards.forEach((c, i) => { const t = atlasT.clone(); t.repeat.set(1 / cols, 1 / rows); t.offset.set((i % cols) / cols, 1 - (Math.floor(i / cols) + 1) / rows); t.needsUpdate = true; c.faceMat.map = t; c.faceMat.needsUpdate = true; c.front.material = c.faceMat; });
  }
  function clear() { backMat.color.setScalar(1); cards.forEach((c) => { group.remove(c.g); if (c.faceMat.map) c.faceMat.map.dispose(); c.faceMat.dispose(); }); cards = []; hot = cur = -1; }

  // 盒口在哪（牌从那里出来、回那里去）：盒子打开时的位置上面一点
  const mouthPose = () => { const b = env.boxPose(); return { x: b.x, y: b.y + box.h * .22 * b.k, z: b.z + 1.5, rx: b.tilt, k: b.k }; };
  function open(b, list, tex, cloth, done) {
    box = b; clear(); busy = true; group.visible = true;
    drawBackSide(backC.getContext("2d"), backC.width, backC.height, env.glyph(b), b.vol); backT.needsUpdate = true;
    list.forEach((cd, i) => {
      const g3 = new THREE.Group(), faceMat = new THREE.MeshStandardMaterial({ roughness: .86 });
      const front = new THREE.Mesh(geo, faceMat); front.position.z = .012; const back = new THREE.Mesh(geo, backMat); back.position.z = -.012; back.rotation.y = Math.PI;
      g3.add(front, back); g3.visible = false; group.add(g3);
      cards.push({ c: cd, i, g: g3, front, back, faceMat, x: 0, y: 0, z: 0, rx: 0, ry: cd.read ? 0 : Math.PI, rz: 0, k: 1, pop: 0, popT: 0 });
    });
    layout(); drawAtlas(); dressBox(b, tex, cloth); open3d.visible = true;
    play(P.lid, (e) => { lidPivot.rotation.z = P.lidOpen * e; }, { ease: E.back });
    const n = cards.length, m0 = mouthPose();
    cards.forEach((c, i) => {
      Object.assign(c, { x: m0.x, y: m0.y, z: m0.z, rx: m0.rx, k: m0.k });
      play(P.dealEach, (e, kk) => { c.g.visible = true; c.x = lerp(m0.x, c.slot.x, e); c.y = lerp(m0.y, c.slot.y, e) + Math.sin(Math.PI * kk) * 2.2; c.z = lerp(m0.z, c.slot.z, e); c.rx = m0.rx * (1 - e); c.rz = Math.sin(Math.PI * kk) * .12 * (i % 2 ? 1 : -1); c.k = lerp(m0.k, 1, e); },
        { delay: P.lid * .6 + (i / n) * P.dealDur, ease: E.out3, done: i === n - 1 ? () => { busy = false; done && done(); } : null });
      play(.01, () => env.tick(i, n), { delay: P.lid * .6 + (i / n) * P.dealDur });
    });
  }
  function close(done) {
    if (!box) return; busy = true; setHot(-1); const n = cards.length, m0 = mouthPose();
    cards.forEach((c, k) => {
      const i = n - 1 - k, x0 = c.x, y0 = c.y, z0 = c.z;
      play(P.backEach, (e) => { c.x = lerp(x0, m0.x, e); c.y = lerp(y0, m0.y, e); c.z = lerp(z0, m0.z, e); c.rx = m0.rx * e; c.k = lerp(1, m0.k, e); }, { delay: (i / n) * P.backDur, ease: E.in2, done: () => { c.g.visible = false; } });
    });
    play(P.lid, (e) => { lidPivot.rotation.z = P.lidOpen * (1 - e); }, { delay: P.backDur + P.backEach * .7, ease: E.io3, done() { open3d.visible = false; group.visible = false; clear(); box = null; busy = false; done && done(); } });
  }
  // 手指底下是哪张：先看落在哪一列，再从最前面（最下面）的一张往后找，第一张盖得住这个点的就是
  function pick(px, py) {
    if (!L || busy || cur >= 0) return -1;
    for (let i = cards.length - 1; i >= 0; i--) { const c = cards[i]; if (Math.abs(px - c.sx) <= L.wpx / 2 && py >= c.sy - L.hpx / 2 && py <= c.sy + L.hpx / 2) return i; }
    return -1;
  }
  function setHot(i) { if (i === hot) return false; if (hot >= 0 && cards[hot]) cards[hot].popT = 0; hot = i; if (i >= 0) { cards[i].popT = 1; env.tick(i, cards.length); } return true; }
  // 拿到眼前：没读的翻过来，翻过来就算读了。回来的是「这一张是不是刚读的」
  function take(i, done) {
    const c = cards[i]; if (!c || busy || cur >= 0) return false; busy = true; setHot(-1); cur = i;
    const V = env.view(), wpx = Math.min(V.vw - 64, 330, (V.vh - V.bottom - V.top - 40) * CW / CH), T = place(V.vw / 2, V.top + 20 + (V.vh - V.bottom - V.top - 20) / 2, wpx, 3), fresh = !c.c.read;
    drawFace(bigC.getContext("2d"), 0, 0, bigC.width, bigC.height, c.c); bigT.needsUpdate = true; c.front.material = bigMat; c.back.material = backUp;
    const x0 = c.x, y0 = c.y, z0 = c.z, ry0 = c.ry;
    play(P.take, (e) => shade(lerp(1, .4, e)), { ease: E.lin });
    play(P.take, (e, kk) => { c.x = lerp(x0, T.x, e); c.y = lerp(y0, T.y, e); c.z = lerp(z0, T.z, e); c.rz = Math.sin(Math.PI * kk) * -.06; }, { ease: E.back, done() {
      if (!fresh) { busy = false; done && done(false); return; }
      env.flipSnd(); play(P.flip, (e, kk) => { c.ry = lerp(ry0, 0, e); c.k = 1 + Math.sin(Math.PI * kk) * .06; }, { ease: E.io3, done() { c.c.read = true; busy = false; done && done(true); } });
    } });
    return true;
  }
  function putBack(done) {
    const c = cards[cur]; if (!c || busy) return false; busy = true;
    const x0 = c.x, y0 = c.y, z0 = c.z;
    play(P.put, (e) => { c.x = lerp(x0, c.slot.x, e); c.y = lerp(y0, c.slot.y, e); c.z = lerp(z0, c.slot.z, e); shade(lerp(.4, 1, e)); }, { ease: E.io3, done() { c.front.material = c.faceMat; c.back.material = backMat; cur = -1; busy = false; done && done(); } });
    return true;
  }
  function relayout() { if (!box || busy) return; layout(); cards.forEach((c, i) => { if (i !== cur) { c.x = c.slot.x; c.y = c.slot.y; c.z = c.slot.z; } }); }
  const _e = new THREE.Euler(0, 0, 0, "YXZ");
  function step(raw) {
    if (!group.visible) return;
    const V = env.view(), wpp = L ? CW / L.wpx : 0;
    for (const c of cards) {
      c.pop += (c.popT - c.pop) * (1 - Math.exp(-(c.popT > c.pop ? P.popUp : P.popDown) * raw));
      c.g.position.set(c.x + c.pop * 12 * wpp, c.y + c.pop * 7 * wpp, c.z + c.pop * .9); _e.set(c.rx * Math.cos(c.ry), c.ry, c.rz); c.g.quaternion.setFromEuler(_e);      // 背面朝上的牌，往前倾要反着转才是往前 c.g.scale.setScalar(c.k);
    }
  }
  // 给测试脚本和页面用：这张牌在屏上露出来的那一条的中间（拿它当手指落点）
  function stripOf(i) { const c = cards[i]; if (!c || !L) return null; const last = i % L.m === L.m - 1 || i === cards.length - 1; return { x: c.sx, y: last ? c.sy : c.sy - L.hpx / 2 + L.step / 2 }; }
  return { open, close, pick, hot: setHot, take, back: putBack, relayout, step, stripOf, get cards() { return cards; }, get cur() { return cur; }, get hotI() { return hot; }, get busy() { return busy; }, get L() { return L; }, get box() { return box; } };
}
