/* 研习录 · 版本 2 · 小世界（灰盒第一稿）
   一个 three.js 场景：院子 → 书房 → 家具 → 物。四个景别，一套镜头，三种光。
   建筑层（墙、地、架、桌）是简单几何加程序化木纹；物件层（书、盒、袋、牌、文竹）按数据生成。
   单位：米。原点在书房地面中心，后墙在 z = -2.5，镜头从 +z 看进去。 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { DOMAINS, BOOKS, BOXES, BAGS, TODAY, STATS, PLANT } from "./sample.js";

/* ============ 0. 基本设施 ============ */
const canvas = document.getElementById("gl");
const isMobile = Math.min(innerWidth, innerHeight) < 700 || /Mobi|Android/i.test(navigator.userAgent);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: "high-performance" });
} catch (e) { document.body.classList.add("nogl"); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isMobile ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 80);
const clock = new THREE.Clock();
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* 材质宇宙：纸、木、墨、铜。颜色和 room/index.html 的 CSS 变量一致 */
const C = {
  paper: 0xF1E3C0, paper2: 0xE3CFA0, paper3: 0xC9AD78, kraft: 0xC09C62,
  ink: 0x1F1309, ink2: 0x4A3218, zhu: 0xA3231B,
  wood: 0x4C3220, wood2: 0x2E1C10, woodHi: 0x6A4A2E, floor: 0x3A2616,
  brass: 0xC9A05A, brassHi: 0xF3D98A, brassLo: 0x7E5A1E,
  shade: 0x2E5A4B, clay: 0xA9603A, soil: 0x2A1A10, leaf: 0x5E8A4E, stone: 0x8A8378,
};

/* 程序化木纹：一张 canvas，直纹加一点噪声。桌、架、地板共用，靠 repeat 和色调区分 */
function woodTexture(base = "#4C3220", hi = "#6A4A2E", lo = "#2E1C10", w = 512, h = 512) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * w, wd = 1 + Math.random() * 4, a = 0.05 + Math.random() * 0.12;
    g.fillStyle = Math.random() < 0.5 ? hi : lo; g.globalAlpha = a;
    g.fillRect(x, 0, wd, h);
  }
  g.globalAlpha = 1;
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const texWood = woodTexture();
const texFloor = woodTexture("#3A2616", "#5A3C24", "#20120A"); texFloor.repeat.set(5, 4);
const texWall = (() => {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256; const g = c.getContext("2d");
  g.fillStyle = "#CFC6B6"; g.fillRect(0, 0, 256, 256);
  const img = g.getImageData(0, 0, 256, 256), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

const M = {
  wood: new THREE.MeshStandardMaterial({ map: texWood, color: 0xFFFFFF, roughness: 0.78, metalness: 0 }),
  woodDark: new THREE.MeshStandardMaterial({ map: texWood, color: 0x8E7A66, roughness: 0.85 }),
  floor: new THREE.MeshStandardMaterial({ map: texFloor, roughness: 0.9 }),
  wall: new THREE.MeshStandardMaterial({ map: texWall, color: 0x3A2A1E, roughness: 1 }),
  paper: new THREE.MeshStandardMaterial({ color: C.paper, roughness: 0.95 }),
  kraft: new THREE.MeshStandardMaterial({ color: C.kraft, roughness: 0.95 }),
  ink: new THREE.MeshStandardMaterial({ color: C.ink, roughness: 0.55 }),
  brass: new THREE.MeshStandardMaterial({ color: C.brass, roughness: 0.35, metalness: 0.9 }),
  shade: new THREE.MeshStandardMaterial({ color: C.shade, roughness: 0.45, metalness: 0.25, side: THREE.DoubleSide }),
  clay: new THREE.MeshStandardMaterial({ color: C.clay, roughness: 0.9 }),
  soil: new THREE.MeshStandardMaterial({ color: C.soil, roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: C.stone, roughness: 1 }),
  stone2: new THREE.MeshStandardMaterial({ color: 0x7E7A70, roughness: 1 }),
  roof: new THREE.MeshStandardMaterial({ map: (() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 256; const g = c.getContext("2d");
    g.fillStyle = "#5C5450"; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) { g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(0, y, 256, 5); g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(0, y + 5, 256, 3); }
    for (let x = 0; x < 256; x += 16) { g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(x, 0, 2, 256); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 6); t.colorSpace = THREE.SRGBColorSpace; return t;
  })(), roughness: 0.95, transparent: true, opacity: 1 }),
};

/* 文字贴图：竖排的题签、看板、牌面都靠它。等字体到了再画，否则是宋体兜底 */
const FONT_SONG = '"Noto Serif SC","Songti SC",serif', FONT_BRUSH = '"Ma Shan Zheng","Kaiti SC",serif', FONT_NUM = '"Barlow Condensed","Arial Narrow",sans-serif';
async function fontsReady() {
  try { await Promise.all([document.fonts.load(`600 40px ${FONT_SONG}`), document.fonts.load(`40px ${FONT_BRUSH}`), document.fonts.load(`700 40px ${FONT_NUM}`)]); } catch (e) { /* 没字体也画 */ }
}
await fontsReady();
function vtext(g, s, x, y, step, max) {
  /* 竖排：一个字一个字往下写 */
  let n = 0;
  for (const ch of s) { if (max && n >= max) break; g.fillText(ch, x, y + n * step); n++; }
  return n;
}

/* ============ 1. 小工具：有厚度的盒子、实例化加贴图集 ============ */
function box(w, h, d, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; return m;
}

/* 一批同形物件（书、盒）用一个 InstancedMesh 画；每件的正面从一张贴图集里取自己那一条。
   做法：几何体正面的 uv.x 在 0..1，其它面的 uv 标成 -1；顶点着色器里把正面的 u 映射到自己那一条，其它面采白点。
   贴图集画成白底深字，颜色由实例色乘上去：正面底色 = 实例色，字仍是深的。 */
function atlasInstanced(geom, count, atlas, faceIndex, mat) {
  /* 把非正面的 uv.x 标成 -1 */
  const uv = geom.attributes.uv, groups = geom.groups;
  for (const gr of groups) {
    if (gr.materialIndex === faceIndex) continue;
    const idx = geom.index.array;
    for (let i = gr.start; i < gr.start + gr.count; i++) uv.setX(idx[i], -1);
  }
  geom.clearGroups();
  const off = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
  geom.setAttribute("aAtlas", off);
  mat.map = atlas;
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aAtlas;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nif (uv.x < 0.0) { vMapUv = vec2(0.0, 0.998); } else { vMapUv = vec2(aAtlas.x + uv.x * aAtlas.y, uv.y); }");
  };
  mat.customProgramCacheKey = () => "atlas" + faceIndex;
  const mesh = new THREE.InstancedMesh(geom, mat, count);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return { mesh, off };
}
function atlasCanvas(n, cellW, cellH, draw) {
  const c = document.createElement("canvas"); c.width = n * cellW; c.height = cellH;
  const g = c.getContext("2d");
  g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < n; i++) { g.save(); g.translate(i * cellW, 0); draw(g, i, cellW, cellH); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = true;
  return t;
}

/* ============ 2. 房间的槽位表 ============ */
/* 这就是"间"的雏形：建筑尺寸 + 家具槽位 + 每个槽位绑的数据。第 4 步正式化成配置文件 */
const ROOM = {
  w: 6.4, h: 3.1, d: 5.0,
  slots: {
    wall:    { name: "书墙",   x: -1.75, w: 2.5, shelves: 4, shelfH: 0.56, y0: 0.18, depth: 0.32 },
    archive: { name: "档案架", x: 1.95, w: 2.1, shelves: 3, shelfH: 0.62, y0: 0.18, depth: 0.3 },
    desk:    { name: "案头",   x: 0.15, z: -1.45, w: 1.7, d: 0.72, h: 0.76 },
    board:   { name: "看板",   x: 0.15, y: 2.25 },
    window:  { name: "窗",     side: -1, y: 1.75, w: 1.2, h: 1.3, z: -0.4 },
  },
};

/* ============ 3. 建筑层 ============ */
const house = new THREE.Group(); scene.add(house);
const hot = []; /* 能点的东西 */
function hotspot(obj, route, name, sub) { obj.userData.route = route; obj.userData.name = name; obj.userData.sub = sub || ""; hot.push(obj); return obj; }

{
  const { w, h, d } = ROOM;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.floor); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; house.add(floor);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.wall); back.position.set(0, h / 2, -d / 2); back.receiveShadow = true; back.castShadow = false; house.add(back);
  /* 两侧墙：只做半截，像剖开的模型屋，从院子看得进去 */
  const sideL = new THREE.Mesh(new THREE.PlaneGeometry(d, h), M.wall); sideL.rotation.y = Math.PI / 2; sideL.position.set(-w / 2, h / 2, 0); sideL.receiveShadow = true; house.add(sideL);
  const sideR = sideL.clone(); sideR.rotation.y = -Math.PI / 2; sideR.position.x = w / 2; house.add(sideR);
  /* 踢脚线与梁 */
  house.add(box(w, 0.1, 0.03, M.woodDark, 0, 0.05, -d / 2 + 0.015, false));
  house.add(box(w, 0.16, 0.16, M.woodDark, 0, h - 0.08, -d / 2 + 0.08, false));
  house.add(box(0.16, 0.16, d, M.woodDark, -w / 2 + 0.08, h - 0.08, 0, false));
  house.add(box(0.16, 0.16, d, M.woodDark, w / 2 - 0.08, h - 0.08, 0, false));
  /* 窗：左墙上一个洞的样子，用一块亮板加窗棂 */
  const win = ROOM.slots.window;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(win.w, win.h), new THREE.MeshBasicMaterial({ color: 0xFFF4DC }));
  pane.rotation.y = Math.PI / 2; pane.position.set(-w / 2 + 0.01, win.y, win.z); house.add(pane); house.userData.pane = pane;
  const frame = new THREE.Group(); frame.position.copy(pane.position); frame.rotation.y = Math.PI / 2;
  frame.add(box(win.w + 0.1, 0.06, 0.05, M.woodDark, 0, win.h / 2 + 0.03, 0.02, false), box(win.w + 0.1, 0.06, 0.05, M.woodDark, 0, -win.h / 2 - 0.03, 0.02, false),
    box(0.06, win.h, 0.05, M.woodDark, -win.w / 2 - 0.03, 0, 0.02, false), box(0.06, win.h, 0.05, M.woodDark, win.w / 2 + 0.03, 0, 0.02, false),
    box(0.03, win.h, 0.03, M.woodDark, 0, 0, 0.02, false), box(win.w, 0.03, 0.03, M.woodDark, 0, 0, 0.02, false));
  house.add(frame);
  /* 屋顶：院子里看是一间房；走进去就淡掉 */
  const roof = new THREE.Group();
  const slope = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.08, Math.hypot(d / 2 + 0.3, 1.1)), M.roof);
  slope.position.set(0, h + 0.55, -(d / 4 + 0.075)); slope.rotation.x = Math.atan2(1.1, d / 2 + 0.3); roof.add(slope);
  const slope2 = slope.clone(); slope2.position.z = d / 4 + 0.075; slope2.rotation.x = -slope.rotation.x; roof.add(slope2);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.12, 0.12), M.roof); ridge.position.set(0, h + 1.1, 0); roof.add(ridge);
  roof.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  house.add(roof); house.userData.roof = roof;
}

/* 书墙：背板、侧板、层板 */
function shelfUnit(slot, zBack) {
  const g = new THREE.Group();
  const H = slot.y0 + slot.shelves * slot.shelfH + 0.04, W = slot.w, D = slot.depth;
  g.add(box(W, H, 0.02, M.woodDark, 0, H / 2, -D / 2 + 0.01, false));
  g.add(box(0.03, H, D, M.wood, -W / 2 + 0.015, H / 2, 0), box(0.03, H, D, M.wood, W / 2 - 0.015, H / 2, 0));
  g.add(box(W, 0.04, D, M.wood, 0, H - 0.02, 0));
  for (let i = 0; i <= slot.shelves; i++) g.add(box(W - 0.06, 0.03, D, M.wood, 0, slot.y0 + i * slot.shelfH - 0.015 - (i === 0 ? 0 : 0), 0));
  g.position.set(slot.x, 0, zBack + D / 2);
  return g;
}
const wallUnit = shelfUnit(ROOM.slots.wall, -ROOM.d / 2); house.add(wallUnit);
const archUnit = shelfUnit(ROOM.slots.archive, -ROOM.d / 2); house.add(archUnit);
/* 整件家具的点击区：一个看不见的盒子 */
function slotHit(slot, H, route, name) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(slot.w, H, slot.depth + 0.1), new THREE.MeshBasicMaterial({ visible: false }));
  m.position.set(slot.x, H / 2, -ROOM.d / 2 + slot.depth / 2); hotspot(m, route, name); house.add(m); return m;
}
slotHit(ROOM.slots.wall, ROOM.slots.wall.y0 + 4 * ROOM.slots.wall.shelfH, "/study/wall", "书墙");
slotHit(ROOM.slots.archive, ROOM.slots.archive.y0 + 3 * ROOM.slots.archive.shelfH, "/study/archive", "档案架");

/* 桌：面板加四条腿 */
const desk = new THREE.Group();
{
  const s = ROOM.slots.desk;
  desk.add(box(s.w, 0.05, s.d, M.wood, 0, s.h - 0.025, 0));
  desk.add(box(s.w, 0.12, 0.03, M.woodDark, 0, s.h - 0.11, s.d / 2 - 0.015, false));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) desk.add(box(0.06, s.h - 0.05, 0.06, M.woodDark, sx * (s.w / 2 - 0.08), (s.h - 0.05) / 2, sz * (s.d / 2 - 0.08)));
  desk.position.set(s.x, 0, s.z);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.2, 0.5, s.d + 0.2), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = s.h + 0.2; hotspot(hit, "/study/desk", "案头"); desk.add(hit);
}
house.add(desk);

/* 看板：挂在后墙上的木牌，字是贴图 */
const board = (() => {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 220; const g = c.getContext("2d");
  g.fillStyle = "#2A1A0E"; g.fillRect(0, 0, 1024, 220);
  g.strokeStyle = "rgba(201,160,90,.5)"; g.lineWidth = 3; g.strokeRect(10, 10, 1004, 200);
  g.fillStyle = "#EFE6D2"; g.textBaseline = "middle";
  g.font = `44px ${FONT_BRUSH}`; g.fillText(STATS.date, 64, 110);
  g.font = `36px ${FONT_SONG}`; g.fillText("没读", 300, 112); g.fillText("本周结卷", 520, 112); g.fillText("连着", 790, 112);
  g.fillStyle = "#F3D98A"; g.font = `700 64px ${FONT_NUM}`; g.fillText(String(STATS.unread), 390, 110); g.fillText(String(STATS.sealedWeek), 690, 110); g.fillText(String(STATS.streak), 880, 110);
  g.fillStyle = "#EFE6D2"; g.font = `30px ${FONT_SONG}`; g.fillText("天", 960, 114);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.34, 0.04), [M.woodDark, M.woodDark, M.woodDark, M.woodDark, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), M.woodDark]);
  m.position.set(ROOM.slots.board.x, ROOM.slots.board.y, -ROOM.d / 2 + 0.03); m.castShadow = true; house.add(m);
  /* 两根挂绳和一颗铜钉 */
  const rope = new THREE.MeshStandardMaterial({ color: 0x8A6A3A, roughness: 1 });
  for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5), rope); r.position.set(m.position.x + sx * 0.6, m.position.y + 0.4, m.position.z); r.rotation.z = sx * 0.22; house.add(r); }
  const nail = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), M.brass); nail.position.set(m.position.x, m.position.y + 0.65, m.position.z); house.add(nail);
  return m;
})();

/* ============ 4. 物件层：书 ============ */
const bookMeshes = [];
const booksGroup = new THREE.Group(); house.add(booksGroup);
{
  const slot = ROOM.slots.wall, n = BOOKS.length;
  const geom = new THREE.BoxGeometry(1, 1, 1);
  /* 书脊贴图集：一本一条，白底深字，竖排书名 */
  const atlas = atlasCanvas(n, 64, 512, (g, i, cw, ch) => {
    const b = BOOKS[i];
    g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(0, 0, cw, 6); g.fillRect(0, ch - 6, cw, 6);
    g.fillStyle = "#1F1309"; g.font = `600 30px ${FONT_SONG}`; g.textAlign = "center"; g.textBaseline = "top";
    vtext(g, b.title, cw / 2, 40, 34, 12);
    /* 底部一个小方块：读完了 */
    if (b.state === "读完") { g.fillStyle = "#A3231B"; g.fillRect(cw / 2 - 9, ch - 40, 18, 18); }
  });
  /* 正面是 +z 面，BoxGeometry 的 group 顺序：+x -x +y -y +z -z → index 4 */
  const { mesh, off } = atlasInstanced(geom, n, atlas, 4, new THREE.MeshStandardMaterial({ roughness: 0.85 }));
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  /* 排法：按层从左到右，宽窄高矮随机但可复现；在读的往外抽 3 厘米；偶尔一本斜靠 */
  let rnd = 7; const R = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  const perShelf = Math.ceil(n / slot.shelves);
  let i = 0;
  for (let s = 0; s < slot.shelves && i < n; s++) {
    let x = -slot.w / 2 + 0.06;
    const yBase = slot.y0 + (slot.shelves - 1 - s) * slot.shelfH;
    for (let k = 0; k < perShelf && i < n; k++, i++) {
      const b = BOOKS[i], bw = 0.028 + R() * 0.032, bh = 0.19 + R() * 0.08, bd = 0.15 + R() * 0.05;
      const lean = R() < 0.12 && k > 0;
      const out = b.state === "在读" ? 0.03 : 0;
      dummy.position.set(slot.x + x + bw / 2, yBase + bh / 2 + 0.0, -ROOM.d / 2 + slot.depth - bd / 2 - 0.04 + out);
      dummy.rotation.set(0, 0, lean ? -0.12 : 0); dummy.scale.set(bw, bh, bd); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      col.setHex(DOMAINS[b.dom].color);
      /* 同一格相邻两本不同色：微调明度 */
      col.offsetHSL(0, 0, (k % 2 ? 0.04 : -0.03)); mesh.setColorAt(i, col);
      off.setXY(i, i / n, 1 / n);
      bookMeshes.push({ i, b, pos: dummy.position.clone(), w: bw, h: bh, d: bd });
      x += bw + 0.004 + (lean ? 0.02 : 0);
      if (x > slot.w - 0.1) break;
    }
  }
  mesh.count = i; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; off.needsUpdate = true;
  /* 每层末尾平放两三本（没有字的），像随手搁的；真实数据来了按"在读"的摆 */
  const flats = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), slot.shelves * 3);
  let fi = 0; const fc = new THREE.Color();
  for (let s2 = 0; s2 < slot.shelves; s2++) {
    const yBase = slot.y0 + (slot.shelves - 1 - s2) * slot.shelfH, k = 2 + (s2 % 2);
    let yy = yBase, xx = slot.x + slot.w / 2 - 0.26 - R() * 0.1;
    for (let j = 0; j < k; j++, fi++) {
      const fw = 0.15 + R() * 0.04, fh = 0.028 + R() * 0.012, fd = 0.2 + R() * 0.03;
      dummy.position.set(xx + (R() - 0.5) * 0.02, yy + fh / 2, -ROOM.d / 2 + slot.depth - fd / 2 - 0.05); dummy.rotation.set(0, (R() - 0.5) * 0.12, 0); dummy.scale.set(fw, fh, fd); dummy.updateMatrix(); flats.setMatrixAt(fi, dummy.matrix);
      fc.setHex(Object.values(DOMAINS)[(s2 * 3 + j) % 6].color); fc.offsetHSL(0, -0.1, 0.05); flats.setColorAt(fi, fc); yy += fh;
    }
  }
  flats.count = fi; flats.instanceMatrix.needsUpdate = true; flats.instanceColor.needsUpdate = true; flats.castShadow = true; flats.receiveShadow = true; booksGroup.add(flats);
  hotspot(mesh, "/study/wall/", "书"); booksGroup.add(mesh); booksGroup.userData.mesh = mesh;
}

/* ============ 5. 物件层：盒与袋 ============ */
const boxItems = [];
{
  const slot = ROOM.slots.archive, items = [...BOXES.map((b) => ({ kind: "box", ...b })), ...BAGS.map((b) => ({ kind: "bag", ...b }))];
  const n = items.length, geom = new THREE.BoxGeometry(1, 1, 1);
  const atlas = atlasCanvas(n, 96, 320, (g, i, cw, ch) => {
    const it = items[i];
    if (it.kind === "box") {
      /* 题签：纸白底，两道框，竖排盒名，底下编号；结卷的盖"引"印 */
      g.fillStyle = "#F1E3C0"; g.fillRect(12, 20, cw - 24, 200);
      g.strokeStyle = "rgba(90,60,20,.7)"; g.lineWidth = 3; g.strokeRect(17, 25, cw - 34, 190);
      g.fillStyle = "#1F1309"; g.font = `700 24px ${FONT_SONG}`; g.textAlign = "center"; g.textBaseline = "top";
      vtext(g, it.title, cw / 2, 36, 27, 6);
      g.fillStyle = "#4A3218"; g.font = `600 16px ${FONT_NUM}`; g.fillText(String(it.n) + " 件", cw / 2, 196);
      if (it.sealed) { g.save(); g.translate(cw / 2, 262); g.rotate(-0.15); g.fillStyle = "#A3231B"; g.fillRect(-16, -16, 32, 32); g.fillStyle = "#F7E9C8"; g.font = `22px ${FONT_BRUSH}`; g.textBaseline = "middle"; g.fillText("引", 0, 1); g.restore(); }
      /* 指孔 */
      g.fillStyle = "#1A100A"; g.beginPath(); g.arc(cw / 2, 300, 8, 0, Math.PI * 2); g.fill();
    } else {
      /* 档案袋：牛皮纸，封口盖，绳扣；没拆的有封条和朱印 */
      g.fillStyle = "rgba(0,0,0,.08)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(cw, 0); g.lineTo(cw, 60); g.lineTo(cw / 2, 90); g.lineTo(0, 60); g.closePath(); g.fill();
      g.strokeStyle = "rgba(60,40,15,.6)"; g.lineWidth = 2; g.beginPath(); g.arc(cw / 2, 120, 9, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(cw / 2, 170, 9, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = "#5A3C1A"; g.lineWidth = 2; g.beginPath(); g.moveTo(cw / 2, 120); g.lineTo(cw / 2 - 8, 170); g.lineTo(cw / 2 + 8, 120); g.lineTo(cw / 2, 170); g.stroke();
      g.fillStyle = "#1F1309"; g.font = `600 18px ${FONT_SONG}`; g.textAlign = "center"; g.textBaseline = "top"; vtext(g, it.title.replace("剪报·", ""), cw / 2, 200, 20, 4);
      if (it.unseen) { g.fillStyle = "#F1E3C0"; g.fillRect(18, 140, cw - 36, 14); g.save(); g.translate(cw - 26, 150); g.rotate(-0.2); g.fillStyle = "#A3231B"; g.fillRect(-11, -11, 22, 22); g.fillStyle = "#F7E9C8"; g.font = `15px ${FONT_BRUSH}`; g.textBaseline = "middle"; g.fillText("封", 0, 1); g.restore(); }
    }
  });
  const { mesh, off } = atlasInstanced(geom, n, atlas, 4, new THREE.MeshStandardMaterial({ roughness: 0.92 }));
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  let x = -slot.w / 2 + 0.08, s = 0, i = 0;
  for (; i < n; i++) {
    const it = items[i], bw = it.kind === "box" ? 0.085 : 0.045, bh = it.kind === "box" ? 0.3 : 0.3, bd = it.kind === "box" ? 0.24 : 0.2;
    if (x + bw > slot.w / 2 - 0.08) { s++; x = -slot.w / 2 + 0.08; }
    const yBase = slot.y0 + (slot.shelves - 1 - s) * slot.shelfH;
    dummy.position.set(slot.x + x + bw / 2, yBase + bh / 2, -ROOM.d / 2 + slot.depth - bd / 2 - 0.03);
    dummy.rotation.set(0, 0, 0); dummy.scale.set(bw, bh, bd); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    if (it.kind === "box") { col.setHex(DOMAINS[it.dom].color); col.offsetHSL(0, -0.05, 0.02); } else col.setHex(C.kraft);
    mesh.setColorAt(i, col); off.setXY(i, i / n, 1 / n);
    boxItems.push({ i, it, pos: dummy.position.clone(), w: bw, h: bh, d: bd });
    x += bw + 0.02;
  }
  mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; off.needsUpdate = true;
  hotspot(mesh, "/study/archive/", "盒"); house.add(mesh); archUnit.userData.mesh = mesh;
}

/* ============ 6. 桌上的东西：灯、砚、今天的牌、文竹 ============ */
const deskTop = ROOM.slots.desk.h;
const lamp = new THREE.Group();
{
  const s = ROOM.slots.desk;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.02, 24), M.brass); base.position.y = 0.01; lamp.add(base);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.46, 10), M.brass); stem.position.y = 0.24; lamp.add(stem);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.34, 10), M.brass); arm.position.set(-0.14, 0.51, 0); arm.rotation.z = 1.0; lamp.add(arm);
  /* 灯罩：尖朝上、口朝下的锥，铜口箍在锥底；一起稍微歪一点 */
  const head = new THREE.Group(); head.position.set(-0.28, 0.56, 0); head.rotation.z = -0.25; lamp.add(head);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.13, 28, 1, true), M.shade); head.add(shade);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.006, 8, 32), M.brass); rim.position.y = -0.065; rim.rotation.x = Math.PI / 2; head.add(rim);
  lamp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  lamp.position.set(s.x + 0.62, deskTop, s.z - 0.15); house.add(lamp);
  lamp.userData.bulb = new THREE.Vector3(s.x + 0.62 - 0.28, deskTop + 0.5, s.z - 0.15);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(-0.26, 0.5, 0); hotspot(hit, "/study/desk/lamp", "灯", "夜读的唯一光源"); lamp.add(hit);
}
/* 砚台与一支笔 */
{
  const s = ROOM.slots.desk;
  const ink = box(0.2, 0.025, 0.13, M.ink, s.x - 0.55, deskTop + 0.0125, s.z + 0.15); ink.geometry = new THREE.BoxGeometry(0.2, 0.025, 0.13); house.add(ink);
  const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.004, 0.24, 8), M.woodDark); brush.position.set(s.x - 0.5, deskTop + 0.03, s.z + 0.1); brush.rotation.z = Math.PI / 2; brush.rotation.y = 0.5; brush.castShadow = true; house.add(brush);
}
/* 今天的牌：牌背朝上，斜放在桌上；牌背 = 题签 + 圆光 + 铜钱 + 来源 + 宝石 */
const card = (() => {
  const c = document.createElement("canvas"); c.width = 512; c.height = 720; const g = c.getContext("2d");
  const col = "#5B2A6B";
  g.fillStyle = col; g.fillRect(0, 0, 512, 720);
  g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 6; g.strokeRect(18, 18, 476, 684);
  /* 圆光：月、远山、一盏灯、一卷书 */
  g.save(); g.beginPath(); g.arc(300, 430, 120, 0, Math.PI * 2); g.clip();
  const grd = g.createLinearGradient(0, 310, 0, 550); grd.addColorStop(0, "#1A1030"); grd.addColorStop(1, "#4A2A4A"); g.fillStyle = grd; g.fillRect(180, 310, 240, 240);
  g.fillStyle = "#F3D98A"; g.beginPath(); g.arc(340, 380, 26, 0, Math.PI * 2); g.fill(); g.fillStyle = "#1A1030"; g.beginPath(); g.arc(352, 372, 24, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#2E1C40"; g.beginPath(); g.moveTo(180, 520); g.quadraticCurveTo(260, 440, 330, 500); g.quadraticCurveTo(380, 460, 420, 520); g.lineTo(420, 550); g.lineTo(180, 550); g.fill();
  g.fillStyle = "#F3D98A"; g.fillRect(250, 470, 8, 30); g.beginPath(); g.arc(254, 465, 10, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#F1E3C0"; g.fillRect(300, 505, 70, 14);
  g.restore();
  g.strokeStyle = "rgba(243,217,138,.6)"; g.lineWidth = 4; g.beginPath(); g.arc(300, 430, 122, 0, Math.PI * 2); g.stroke();
  /* 题签 */
  g.fillStyle = "#F1E3C0"; g.fillRect(50, 50, 78, 420); g.strokeStyle = "rgba(90,60,20,.6)"; g.lineWidth = 3; g.strokeRect(56, 56, 66, 408);
  g.fillStyle = "#1F1309"; g.font = `700 36px ${FONT_SONG}`; g.textAlign = "center"; g.textBaseline = "top"; vtext(g, TODAY.title, 89, 72, 38, 10);
  /* 铜钱：读完大约几分钟 */
  g.save(); g.translate(440, 80); g.fillStyle = "#C9A05A"; g.beginPath(); g.arc(0, 0, 34, 0, Math.PI * 2); g.fill(); g.fillStyle = "#2A1408"; g.font = `700 34px ${FONT_NUM}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(TODAY.minutes), 0, 2); g.restore();
  /* 底边：来源与宝石 */
  g.fillStyle = "rgba(255,255,255,.85)"; g.font = `26px ${FONT_SONG}`; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(TODAY.source, 50, 660);
  g.fillStyle = "#8A857A"; g.beginPath(); g.arc(455, 660, 16, 0, Math.PI * 2); g.fill(); g.fillStyle = "#F1E3C0"; g.font = `18px ${FONT_SONG}`; g.textAlign = "center"; g.fillText("未", 455, 661);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const face = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.225, 0.004), [M.paper, M.paper, M.paper, M.paper, face, M.paper]);
  m.castShadow = true; m.receiveShadow = true;
  /* 斜靠在一个小木座上 */
  const s = ROOM.slots.desk;
  const stand = box(0.1, 0.03, 0.05, M.woodDark, s.x + 0.12, deskTop + 0.015, s.z + 0.05); house.add(stand);
  m.position.set(s.x + 0.12, deskTop + 0.11, s.z + 0.0); m.rotation.x = -0.28;
  hotspot(m, "/study/desk/card", "今天的牌", TODAY.source); house.add(m);
  return m;
})();

/* 文竹：主角。茎是细管，叶是一层层扇形的羽叶（透明贴图的薄片）。grow 0..1 决定几根茎、多高、几层叶 */
const plant = new THREE.Group();
const leafTex = (() => {
  /* 一片羽叶：中脉加两侧细密的小针叶，画成透明贴图 */
  const c = document.createElement("canvas"); c.width = 512; c.height = 512; const g = c.getContext("2d");
  g.clearRect(0, 0, 512, 512);
  /* 一层淡淡的叶形打底，让远看有一团绿 */
  g.fillStyle = "rgba(94,138,78,.42)"; g.beginPath(); g.moveTo(256, 30);
  for (let i = 0; i <= 20; i++) { const t = i / 20, y = 30 + t * 470, w = 118 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.25) + 5; g.lineTo(256 + w, y); }
  for (let i = 20; i >= 0; i--) { const t = i / 20, y = 30 + t * 470, w = 118 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.25) + 5; g.lineTo(256 - w, y); }
  g.closePath(); g.fill();
  g.strokeStyle = "#5E8A4E"; g.lineCap = "round"; g.lineJoin = "round";
  g.lineWidth = 5; g.beginPath(); g.moveTo(256, 500); g.lineTo(256, 36); g.stroke();
  let rr = 11; const RR = () => (rr = (rr * 48271) % 2147483647) / 2147483647;
  for (let i = 0; i < 34; i++) {
    const y = 486 - i * 13, len = 112 * Math.sin((i / 34) * Math.PI * 0.95 + 0.08) * (1 - i / 60) + 8;
    for (const sx of [-1, 1]) {
      g.lineWidth = 2.6; g.globalAlpha = 0.95; g.beginPath(); g.moveTo(256, y); g.lineTo(256 + sx * len, y - 26); g.stroke();
      for (let j = 0; j < 26; j++) { const t = j / 26, px = 256 + sx * len * t, py = y - 26 * t, L = 9 + RR() * 7; g.lineWidth = 2; g.globalAlpha = 0.75 + RR() * 0.25; g.beginPath(); g.moveTo(px, py); g.lineTo(px + sx * L * 0.45, py - L); g.stroke(); g.beginPath(); g.moveTo(px, py); g.lineTo(px - sx * L * 0.25, py - L * 0.8); g.stroke(); }
    }
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
})();
const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9, color: 0xEEF8E2 });
const stemMat = new THREE.MeshStandardMaterial({ color: 0x4E7A3E, roughness: 0.9 });
let plantState = { grow: PLANT.grow, newLeaves: PLANT.newLeaves };
function buildPlant(grow) {
  while (plant.children.length) plant.remove(plant.children[0]);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.15, 24), M.clay); pot.position.y = 0.075; pot.castShadow = true; pot.receiveShadow = true; plant.add(pot);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.1, 0.03, 24), M.clay); rim.position.y = 0.15; plant.add(rim);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.01, 24), M.soil); soil.position.y = 0.16; plant.add(soil);
  const stems = 3 + Math.round(grow * 4), leafGeom = new THREE.PlaneGeometry(0.22, 0.22);
  let rnd = 3; const R = () => (rnd = (rnd * 48271) % 2147483647) / 2147483647;
  const foliage = new THREE.Group(), stemGeos = [];
  for (let s = 0; s < stems; s++) {
    /* 一根茎：先直上，到上半段往外拱，像文竹那样散开 */
    const h = 0.26 + grow * 0.5 + R() * 0.14, ang = (s / stems) * Math.PI * 2 + R() * 0.7, lean = 0.1 + R() * 0.12 + grow * 0.06;
    const pts = [];
    for (let k = 0; k <= 7; k++) { const t = k / 7; const r = lean * t * t * 2.2; pts.push(new THREE.Vector3(Math.cos(ang) * r, 0.16 + h * (t - 0.12 * t * t), Math.sin(ang) * r)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    stemGeos.push(new THREE.TubeGeometry(curve, 12, 0.003, 5, false));
    /* 节：沿上面三分之二，每节左右交替长一簇扁平的小羽叶，越往梢越小 */
    const nodes = 7 + Math.round(grow * 6);
    for (let t = 0; t < nodes; t++) {
      const u = 0.38 + 0.62 * (t / (nodes - 1)), p = curve.getPoint(u), dir = curve.getTangent(u);
      const tier = new THREE.Group(); tier.position.copy(p);
      /* 这一节的朝向：茎的切线在水平面上的方向，左右交替偏 90 度 */
      const base = Math.atan2(dir.x, dir.z) + (t % 2 ? 1 : -1) * (Math.PI / 2) * (0.75 + R() * 0.3);
      const n = 3 + Math.round(R() * 1.6), size = (0.5 + 0.42 * (1 - t / nodes)) * (0.8 + grow * 0.4);
      for (let k = 0; k < n; k++) {
        const g = new THREE.Group();
        g.rotation.y = base + ((k - (n - 1) / 2) * 0.42) + (R() - 0.5) * 0.3;
        g.rotation.z = 0.04 + R() * 0.14;       /* 几乎平躺，微微上翘 */
        const leaf = new THREE.Mesh(leafGeom, leafMat);
        leaf.rotation.set(-Math.PI / 2, 0, 0); leaf.position.set(0, 0.004, 0.105 * size); leaf.scale.setScalar(size);
        g.add(leaf); tier.add(g);
      }
      foliage.add(tier);
    }
    /* 梢头一小簇朝上的嫩叶 */
    const tip = new THREE.Group(); tip.position.copy(curve.getPoint(1));
    for (let k = 0; k < 3; k++) { const g = new THREE.Group(); g.rotation.y = (k / 3) * Math.PI * 2 + R(); g.rotation.z = 0.5 + R() * 0.4; const leaf = new THREE.Mesh(leafGeom, leafMat); leaf.rotation.set(-Math.PI / 2, 0, 0); leaf.position.set(0, 0, 0.03); leaf.scale.setScalar(0.22 + grow * 0.1); g.add(leaf); tip.add(g); }
    foliage.add(tip);
  }
  /* 叶子几十上百片，合成一个网格一笔画完；整株轻轻晃就够了 */
  foliage.updateMatrixWorld(true);
  const leafGeos = []; foliage.traverse((o) => { if (o.isMesh) leafGeos.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); });
  const leaves = new THREE.Mesh(mergeGeometries(leafGeos, false), leafMat); leaves.castShadow = true; leaves.userData.sway = true; plant.add(leaves);
  const stemsMesh = new THREE.Mesh(mergeGeometries(stemGeos, false), stemMat); stemsMesh.castShadow = true; stemsMesh.userData.sway = true; plant.add(stemsMesh);
  plant.userData.top = 0.16 + 0.28 + grow * 0.5;
}
buildPlant(plantState.grow);
{
  const s = ROOM.slots.desk; plant.position.set(s.x - 0.55, deskTop, s.z - 0.1); house.add(plant);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.14, 0.9, 10), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.45; hotspot(hit, "/study/desk/plant", "文竹", `这周长了 ${plantState.newLeaves} 片叶`); plant.add(hit);
}

/* ============ 7. 院子 ============ */
const yard = new THREE.Group(); scene.add(yard);
{
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x6E6A60, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; yard.add(ground);
  /* 书房的台基 */
  const base = box(ROOM.w + 0.8, 0.12, ROOM.d + 0.8, M.stone, 0, -0.06, 0, false); yard.add(base);
  /* 以后要建的几间：石板地基加一块刻字的牌 */
  const plots = [{ name: "花房", x: -8.5, z: 1 }, { name: "宠物间", x: 8.5, z: 1 }, { name: "收藏室", x: 0, z: 9 }];
  for (const p of plots) {
    const slab = box(4.2, 0.1, 3.6, M.stone2, p.x, -0.07, p.z, false); yard.add(slab);
    const c = document.createElement("canvas"); c.width = 512; c.height = 256; const g = c.getContext("2d");
    g.fillStyle = "#1F1309"; g.font = `88px ${FONT_BRUSH}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(p.name, 256, 100);
    g.font = `34px ${FONT_SONG}`; g.fillText("待建", 256, 190);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 1, opacity: 0.55 }));
    sign.rotation.x = -Math.PI / 2; sign.position.set(p.x, 0.0, p.z); yard.add(sign);
  }
  /* 石板小径 */
  for (let i = 0; i < 6; i++) { const st = box(0.9, 0.04, 0.6, M.stone, (i % 2 ? 0.25 : -0.25), -0.0, ROOM.d / 2 + 1 + i * 0.9, false); yard.add(st); }
  /* 整间房的点击区 */
  const hit = new THREE.Mesh(new THREE.BoxGeometry(ROOM.w + 0.6, ROOM.h + 1.3, ROOM.d + 0.6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = (ROOM.h + 1.3) / 2; hotspot(hit, "/study", "书房"); yard.add(hit); yard.userData.hit = hit;
}

/* ============ 7b. 把不会动的木头、铜、石头按材质合并，省 draw call ============ */
function mergeStatic(group, mats, skip) {
  group.updateMatrixWorld(true);
  const buckets = new Map(), rm = [];
  (function walk(o) {
    if (skip.includes(o)) return;
    if (o.isMesh && !o.isInstancedMesh && !o.userData.route && !Array.isArray(o.material) && mats.includes(o.material) && o.geometry.index) {
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      if (!buckets.has(o.material)) buckets.set(o.material, []);
      buckets.get(o.material).push(g); rm.push(o);
    }
    for (const c of o.children) walk(c);
  })(group);
  for (const o of rm) o.parent.remove(o);
  for (const [mat, gs] of buckets) { const m = new THREE.Mesh(mergeGeometries(gs, false), mat); m.castShadow = true; m.receiveShadow = true; m.userData.merged = true; group.add(m); }
}
mergeStatic(house, [M.wood, M.woodDark, M.brass, M.clay, M.ink, M.shade], [plant]);
mergeStatic(yard, [M.stone, M.stone2], []);

/* ============ 8. 光：三间房只换光，东西不换 ============ */
const L = {
  amb: new THREE.AmbientLight(0xFFE6C8, 0.08),
  hemi: new THREE.HemisphereLight(0xFFE6C8, 0x2A1A10, 0.15),
  lamp: new THREE.SpotLight(0xFFD68C, 0, 6.5, Math.PI / 2.4, 0.75, 1.4),
  sun: new THREE.DirectionalLight(0xFFF2DC, 0),
  fill: new THREE.DirectionalLight(0xDDE6F0, 0),
};
L.lamp.position.copy(lamp.userData.bulb); L.lamp.target.position.set(lamp.userData.bulb.x - 0.1, deskTop, lamp.userData.bulb.z + 0.1); L.lamp.castShadow = true; L.lamp.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048); L.lamp.shadow.bias = -0.0005; L.lamp.shadow.normalBias = 0.05; L.lamp.shadow.radius = 4; L.lamp.shadow.camera.near = 0.1; L.lamp.shadow.camera.far = 8;
L.sun.position.set(-9, 5.5, -0.5); L.sun.target.position.set(0.5, 0.6, -1.2); L.sun.castShadow = true;
L.sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048); L.sun.shadow.camera.left = -4.5; L.sun.shadow.camera.right = 4.5; L.sun.shadow.camera.top = 4; L.sun.shadow.camera.bottom = -2.6; L.sun.shadow.camera.near = 1; L.sun.shadow.camera.far = 24; L.sun.shadow.bias = -0.0005; L.sun.shadow.normalBias = 0.06;
L.fill.position.set(3, 4, 6);
for (const k in L) scene.add(L[k]); scene.add(L.sun.target, L.lamp.target);

const LIGHTS = {
  night: { bg: 0x17110C, fog: 0x0B0705, wall: 0x3A2A1E, amb: 0.3, hemi: 0.52, lamp: 16, sun: 0, fill: 0.5, fillC: 0x8FA3C8, pane: 0x2A2440, exposure: 1.1 },
  day:   { bg: 0xE6DDC9, fog: 0xBDAF93, wall: 0xF2EBDA, amb: 0.45, hemi: 0.7, lamp: 0, sun: 2.6, fill: 0.6, fillC: 0xDDE6F0, pane: 0xFFF4DC, exposure: 1.0 },
  rain:  { bg: 0x5B636A, fog: 0x3A4046, wall: 0x8A8E90, amb: 0.35, hemi: 0.5, lamp: 10, sun: 0.45, fill: 0.5, fillC: 0xB8C4D0, pane: 0xC9D2DA, exposure: 0.95 },
};
scene.background = new THREE.Color(LIGHTS.night.bg);
scene.fog = new THREE.Fog(LIGHTS.night.fog, 22, 60);
let lightNow = { ...LIGHTS.night, bgC: new THREE.Color(LIGHTS.night.bg), fogC: new THREE.Color(LIGHTS.night.fog), paneC: new THREE.Color(LIGHTS.night.pane), wallC: new THREE.Color(LIGHTS.night.wall) };
let lightTarget = LIGHTS.night, lightT = 1;
function setLight(name) {
  lightTarget = LIGHTS[name]; lightT = 0; document.body.dataset.light = name;
  document.querySelectorAll("[data-light]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.light === name)));
  try { localStorage.setItem("yxl-world-light", name); } catch (e) {}
}
function applyLight(dt) {
  if (lightT >= 1) return false;
  lightT = Math.min(1, lightT + dt / (reduceMotion ? 0.01 : 1.2));
  const k = lightT < 0.5 ? 2 * lightT * lightT : 1 - Math.pow(-2 * lightT + 2, 2) / 2;
  const t = lightTarget, n = lightNow;
  L.amb.intensity = THREE.MathUtils.lerp(n.amb, t.amb, k); L.hemi.intensity = THREE.MathUtils.lerp(n.hemi, t.hemi, k);
  L.lamp.intensity = THREE.MathUtils.lerp(n.lamp, t.lamp, k); L.sun.intensity = THREE.MathUtils.lerp(n.sun, t.sun, k); L.fill.intensity = THREE.MathUtils.lerp(n.fill, t.fill, k);
  L.fill.color.copy(new THREE.Color(n.fillC)).lerp(new THREE.Color(t.fillC), k);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(n.exposure, t.exposure, k);
  scene.background.copy(n.bgC).lerp(new THREE.Color(t.bg), k); scene.fog.color.copy(n.fogC).lerp(new THREE.Color(t.fog), k);
  house.userData.pane.material.color.copy(n.paneC).lerp(new THREE.Color(t.pane), k);
  M.wall.color.copy(n.wallC).lerp(new THREE.Color(t.wall), k);
  M.shade.emissive.setHex(0xFFD68C).multiplyScalar(Math.min(1, L.lamp.intensity / 16) * 0.14);
  if (lightT >= 1) lightNow = { ...t, bgC: new THREE.Color(t.bg), fogC: new THREE.Color(t.fog), paneC: new THREE.Color(t.pane), wallC: new THREE.Color(t.wall) };
  return true;
}

/* ============ 9. 镜头：四个景别，一条缓动 ============ */
/* 每个路由一个机位：位置 + 看向。书、盒这类按下标找机位 */
const SHOTS = {
  "/":              { pos: [0, 10.5, 13.5], at: [0, 0.6, 0.5], fov: 38 },
  "/study":         { pos: [0.2, 1.75, 4.4], at: [0.1, 1.15, -1.6], fov: 44 },
  "/study/wall":    { pos: [-1.75, 1.45, 1.1], at: [-1.75, 1.3, -2.5], fov: 44 },
  "/study/archive": { pos: [1.95, 1.3, 1.0], at: [1.95, 1.15, -2.5], fov: 44 },
  "/study/desk":    { pos: [0.15, 1.55, 0.35], at: [0.15, 0.85, -1.45], fov: 44 },
  "/study/desk/plant": { pos: [0.1, 1.42, -0.1], at: [-0.4, 1.1, -1.55], fov: 40 },
  "/study/desk/card":  { pos: [0.3, 1.05, -0.95], at: [0.27, 0.87, -1.45], fov: 36 },
  "/study/desk/lamp":  { pos: [0.95, 1.5, -0.6], at: [0.5, 1.25, -1.6], fov: 40 },
};
function shotFor(route) {
  if (SHOTS[route]) return SHOTS[route];
  let m = route.match(/^\/study\/wall\/(\d+)$/);
  if (m && bookMeshes[+m[1]]) { const b = bookMeshes[+m[1]]; return { pos: [b.pos.x, b.pos.y + 0.05, b.pos.z + 0.55], at: [b.pos.x, b.pos.y, b.pos.z], fov: 36 }; }
  m = route.match(/^\/study\/archive\/(\d+)$/);
  if (m && boxItems[+m[1]]) { const b = boxItems[+m[1]]; return { pos: [b.pos.x, b.pos.y + 0.06, b.pos.z + 0.7], at: [b.pos.x, b.pos.y, b.pos.z], fov: 36 }; }
  return null;
}
const cam = { pos: new THREE.Vector3(), at: new THREE.Vector3(), fov: 42, from: null, to: null, t: 1, dur: 1.1 };
const SHOT0 = SHOTS["/"]; cam.pos.fromArray(SHOT0.pos); cam.at.fromArray(SHOT0.at); cam.fov = SHOT0.fov;
function fitFov(fov) {
  /* 竖屏时放宽视角，让一间房还能装进画面；最大 72 */
  const a = innerWidth / innerHeight;
  if (a >= 1.1) return fov;
  const v = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * (1.1 / a)) * 180 / Math.PI;
  return Math.min(72, v);
}
function moveTo(shot, instant) {
  cam.from = { pos: cam.pos.clone(), at: cam.at.clone(), fov: cam.fov };
  cam.to = { pos: new THREE.Vector3().fromArray(shot.pos), at: new THREE.Vector3().fromArray(shot.at), fov: shot.fov };
  cam.t = instant || reduceMotion ? 1 : 0;
  cam.dur = 0.9 + Math.min(0.9, cam.from.pos.distanceTo(cam.to.pos) * 0.08);
  if (cam.t >= 1) { cam.pos.copy(cam.to.pos); cam.at.copy(cam.to.at); cam.fov = cam.to.fov; }
}
function stepCamera(dt) {
  let moving = false;
  if (cam.t < 1) {
    cam.t = Math.min(1, cam.t + dt / cam.dur);
    const k = cam.t < 0.5 ? 4 * cam.t ** 3 : 1 - Math.pow(-2 * cam.t + 2, 3) / 2;
    cam.pos.lerpVectors(cam.from.pos, cam.to.pos, k); cam.at.lerpVectors(cam.from.at, cam.to.at, k); cam.fov = THREE.MathUtils.lerp(cam.from.fov, cam.to.fov, k);
    moving = true;
  }
  /* 轻微的手持感：鼠标位置带一点视差，手机上用陀螺仪以后再说 */
  const px = drift.x * 0.06, py = drift.y * 0.04;
  camera.position.copy(cam.pos);
  if (innerWidth / innerHeight < 1) camera.position.copy(cam.at).add(cam.pos.clone().sub(cam.at).multiplyScalar(0.84));
  camera.position.add(new THREE.Vector3(px, py, 0));
  camera.lookAt(cam.at);
  const f = fitFov(cam.fov); if (Math.abs(camera.fov - f) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); }
  return moving;
}
const drift = new THREE.Vector2();

/* ============ 10. 路由：hash 就是你站在哪 ============ */
const NAMES = { "": "院子", study: "书房", wall: "书墙", archive: "档案架", desk: "案头", plant: "文竹", card: "今天的牌", lamp: "灯" };
let route = "/";
function parse() { const h = location.hash.replace(/^#/, ""); return h.startsWith("/") ? h.replace(/\/+$/, "") || "/" : "/"; }
function depth(r) { return r === "/" ? 0 : r.split("/").length - 1; }
function parent(r) { if (r === "/") return "/"; const p = r.split("/"); p.pop(); return p.join("/") || "/"; }
let pendingHash = null;
function go(r) { if (!shotFor(r)) return; apply(r); const h = "#" + r; if (location.hash !== h) { pendingHash = h; location.hash = h; } }
function apply(r, instant) {
  const shot = shotFor(r); if (!shot) { location.hash = "/"; return; }
  route = r; moveTo(shot, instant);
  /* 屋顶：院子里有，走进去就没了 */
  roofTarget = depth(r) === 0 ? 1 : 0;
  /* 面包屑 */
  const parts = r === "/" ? [""] : ["", ...r.slice(1).split("/")];
  let acc = "";
  crumbEl.innerHTML = parts.map((p, i) => {
    acc = i === 0 ? "/" : (acc === "/" ? "/" + p : acc + "/" + p);
    let name = NAMES[p] || p;
    if (/^\d+$/.test(p)) { const prev = parts[i - 1]; name = prev === "wall" ? (bookMeshes[+p]?.b.title || "书") : prev === "archive" ? (boxItems[+p]?.it.title || "盒") : p; }
    const last = i === parts.length - 1;
    return (i ? '<i>›</i>' : "") + (last ? `<b>${name}</b>` : `<button type="button" data-go="${acc}">${name}</button>`);
  }).join("");
  hintEl.classList.toggle("off", r !== "/" || seenHint);
  if (r !== "/") seenHint = true;
  document.title = (r === "/" ? "小世界" : crumbEl.textContent.replace(/›/g, " · ")) + " · 研习录";
}
let roofTarget = 1, seenHint = false;
const crumbEl = document.getElementById("crumb"), hintEl = document.getElementById("hint"), tagEl = document.getElementById("tag");
addEventListener("hashchange", () => { if (pendingHash && location.hash === pendingHash) { pendingHash = null; return; } pendingHash = null; apply(parse()); });
crumbEl.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); });
document.getElementById("back").addEventListener("click", () => go(parent(route)));
addEventListener("keydown", (e) => { if (e.key === "Escape") go(parent(route)); });
document.querySelectorAll("[data-light]").forEach((b) => b.addEventListener("click", () => setLight(b.dataset.light)));
document.getElementById("grow").addEventListener("click", () => { plantState.grow = Math.min(1, plantState.grow + 0.1); plantState.newLeaves += 2; buildPlant(plantState.grow); plant.children.find((o) => o.userData.route)?.remove(); const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.14, 0.9, 10), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.45; hot.splice(hot.findIndex((o) => o.userData.route === "/study/desk/plant"), 1); hotspot(hit, "/study/desk/plant", "文竹", `这周长了 ${plantState.newLeaves} 片叶`); plant.add(hit); });

/* ============ 11. 指与点 ============ */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null, hover = null;
function pick(x, y) {
  ptr.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera);
  /* 只在当前景别能点的层级里挑：院子里只能点房；房里能点家具；家具里能点物 */
  const d = depth(route);
  const cands = hot.filter((o) => { const r = o.userData.route; const rd = r.endsWith("/") ? depth(r.slice(0, -1)) + 1 : depth(r); return rd === d + 1 && (d === 0 || r.startsWith(route.split("/").slice(0, 2).join("/"))) && (d < 2 || r.startsWith(route)); });
  const hits = ray.intersectObjects(cands, false);
  if (!hits.length) return null;
  const h = hits[0], o = h.object; let r = o.userData.route, name = o.userData.name, sub = o.userData.sub;
  if (o.isInstancedMesh) { const i = h.instanceId; r += i; if (o === booksGroup.userData.mesh) { name = bookMeshes[i].b.title; sub = DOMAINS[bookMeshes[i].b.dom].name + " · " + bookMeshes[i].b.state; } else { name = boxItems[i].it.title; sub = boxItems[i].it.kind === "box" ? `${boxItems[i].it.n} 件` : `${boxItems[i].it.n} 篇`; } }
  return { route: r, name, sub, point: h.point };
}
canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener("pointerup", (e) => {
  if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y; const was = down; down = null;
  if (Math.hypot(dx, dy) > 8 || performance.now() - was.t > 600) return;
  const p = pick(e.clientX, e.clientY);
  if (p) go(p.route); else if (depth(route) >= 2) go(parent(route));
});
canvas.addEventListener("pointermove", (e) => {
  drift.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (e.pointerType === "touch") return;
  const p = pick(e.clientX, e.clientY);
  hover = p; canvas.classList.toggle("hand", !!p);
  if (p) { tagEl.innerHTML = p.name + (p.sub ? `<small>${p.sub}</small>` : ""); tagEl.classList.add("on"); } else tagEl.classList.remove("on");
});
canvas.addEventListener("pointerleave", () => { hover = null; tagEl.classList.remove("on"); canvas.classList.remove("hand"); drift.set(0, 0); });
/* 滚轮：在当前景别里稍微推拉；拉到头就退后一级 */
let wheelAcc = 0;
canvas.addEventListener("wheel", (e) => { e.preventDefault(); wheelAcc += e.deltaY; if (wheelAcc > 900) { wheelAcc = 0; go(parent(route)); } if (wheelAcc < -900) { wheelAcc = 0; if (hover) go(hover.route); } }, { passive: false });

/* ============ 12. 每帧 ============ */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();
let roofNow = 1;
function frame() {
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  stepCamera(dt); applyLight(dt);
  /* 屋顶淡入淡出 */
  if (Math.abs(roofNow - roofTarget) > 0.001) { roofNow += (roofTarget - roofNow) * Math.min(1, dt * 4); M.roof.opacity = roofNow; house.userData.roof.visible = roofNow > 0.02; }
  /* 文竹轻轻晃 */
  if (!reduceMotion) for (const o of plant.children) if (o.userData.sway) { o.rotation.z = Math.sin(t * 0.9) * 0.018; o.rotation.x = Math.sin(t * 0.7 + 1.3) * 0.012; }
  /* 指到的名字跟着那件东西 */
  if (hover && tagEl.classList.contains("on")) { const v = hover.point.clone().project(camera); tagEl.style.transform = `translate(${(v.x + 1) / 2 * innerWidth}px, ${(1 - v.y) / 2 * innerHeight}px) translate(-50%, -130%)`; }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ============ 13. 开场 ============ */
{
  let saved = null; try { saved = localStorage.getItem("yxl-world-light"); } catch (e) {}
  if (saved && LIGHTS[saved]) { setLight(saved); lightNow = { ...LIGHTS[saved], bgC: new THREE.Color(LIGHTS[saved].bg), fogC: new THREE.Color(LIGHTS[saved].fog), paneC: new THREE.Color(LIGHTS[saved].pane), wallC: new THREE.Color(LIGHTS[saved].wall) }; lightT = 0; }
  else { lightT = 0; }
  /* 手机默认近一档：没指定去哪就直接站在书房里 */
  const r0 = parse();
  if (r0 === "/" && isMobile && !location.hash) { route = "/study"; location.replace("#/study"); apply("/study", true); }
  else apply(r0, true);
  /* 进场：从稍远一点推到位，像走进来 */
  if (!reduceMotion) { const s = shotFor(route); cam.pos.fromArray(s.pos).multiplyScalar(1.12); cam.at.fromArray(s.at); cam.fov = s.fov + 4; moveTo(s); cam.dur = 1.6; }
  window.__yxlWorld = { renderer, scene, camera, go, route: () => route, setLight, info: () => renderer.info.render, hot, settled: () => cam.t >= 1 && lightT >= 1 };
  frame();
}
