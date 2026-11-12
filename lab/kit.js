/* lab 里样机公用的零件：小工具、动画轨、现场合成的声音、三维舞台（渲染器与光）、书的样子（书脊图集、实例化的盒子）、架子。
 * 2026-11-12 做第三个样机（进门）时从 shelf.js 抽出来，书架和进门两页共用；pack.js 是最早写的，自带一份没有动。
 * 外观都是占位的。以后选了外观，书和架子长什么样只改这一个文件。 */
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
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2a221c);
  const camera = new THREE.PerspectiveCamera(34, 1, 4, 4000);
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x4a3c30, 1.55));
  const key = new THREE.DirectionalLight(0xfff4e2, 2.3); key.castShadow = true; scene.add(key, key.target);
  const sm = innerWidth * Math.min(devicePixelRatio || 1, 2) < 1500 ? 1024 : 2048; key.shadow.mapSize.set(sm, sm);
  key.shadow.bias = -.0006; key.shadow.normalBias = .12; key.shadow.radius = 3;
  return { renderer, scene, camera, key, maxAniso };
}
// 主光对着架子：左前上方打过来，影子的范围刚好罩住整座
export function lightCase(key, w, h) {
  const Lz = Math.max(w, h) * 1.2 + 120, half = Math.hypot(w, h) / 2 + 34;
  key.position.set(-.5 * Lz, h / 2 + .75 * Lz, .8 * Lz); key.target.position.set(0, h / 2, -DIM.CD / 2);
  Object.assign(key.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 10, far: Lz * 2.4 }); key.shadow.camera.updateProjectionMatrix();
}

/* ---------- 书的样子（占位；读没读只靠明暗和形状，不靠色相） ---------- */
export const TONES = ["#4B4138", "#5C5142", "#3C3D44", "#66574A", "#50433D", "#454F49"];   // 读过的书露出的布面，按类各一种，都是深的
export const PALE = "#D8CEBC", INK_LT = "#EADDC4", INK_SOFT = "#8B7C69", PAPER = "#E9E0CE", TAB = "#FFF3DC";
export const CJK = '"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC","SimSun",serif';   // 画布上的字用系统字体：几百个书名要是走自带字体会拉很多分片
export const STN = { todo: "没读", doing: "在读", done: "读过" };
const CELLW = 48, CELLH = 192, COLS = 42;
// 画一条书脊。pale：不管读没读都画成包着白纸的样子（别人那里带走的一份，到你手里都是没读的）
export function drawSpine(g, x, y, w, h, b, pale) {
  const todo = pale || b.st === "todo";
  g.fillStyle = todo ? PALE : TONES[b.cat]; g.fillRect(x, y, w, h);
  const sy = h / b.h, tw = b.t * sy;                    // 图上横竖的比例和真书脊不一样，按竖向的像素来排，横向整体拉开，贴上去才还原
  g.save(); g.translate(x + w / 2, y); g.scale((w / b.t) / sy, 1);
  if (!todo) { g.fillStyle = INK_LT; g.globalAlpha = .5; const lh = Math.max(1, h * .008); g.fillRect(-tw / 2, h * .07, tw, lh); g.fillRect(-tw / 2, h * .925, tw, lh); g.globalAlpha = 1; }
  const chars = [...b.title], n = chars.length, fs = Math.min(tw * .6, (h * .6) / n), step = Math.min(fs * 1.14, (h * .64) / n);
  g.font = "700 " + fs.toFixed(2) + "px " + CJK; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = todo ? INK_SOFT : INK_LT;
  chars.forEach((c, k) => g.fillText(c, 0, h * .15 + step * (k + .5)));
  g.restore();
}
export function createBookKit(maxAniso) {
  const paperMat = new THREE.MeshStandardMaterial({ color: PAPER, roughness: .95 });
  const tabMat = new THREE.MeshStandardMaterial({ color: TAB, roughness: .8, emissive: new THREE.Color(TAB), emissiveIntensity: .28 });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  // 书脊图集：每本一格，贴到书脊上；封面两侧只取这一格的底色。每张图集带自己的材质
  function makeAtlas(books, pale) {
    const canvas = document.createElement("canvas"), g = canvas.getContext("2d");
    canvas.width = COLS * CELLW; canvas.height = Math.max(1, Math.ceil(books.length / COLS)) * CELLH;
    function draw(b) {
      const x = (b.i % COLS) * CELLW, y = Math.floor(b.i / COLS) * CELLH;
      g.fillStyle = pale || b.st === "todo" ? PALE : TONES[b.cat]; g.fillRect(x, y, CELLW, CELLH);   // 格子四周留一圈同色，缩小采样时不串到邻格
      drawSpine(g, x + 3, y + 2, CELLW - 6, CELLH - 4, b, pale);
    }
    books.forEach(draw);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: .86, metalness: 0 });
    mat.onBeforeCompile = (sh) => {          // 每本书用图集里自己那一格（uvo = 左下角 u、v，宽、高）
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec4 uvo;")
        .replace("#include <uv_vertex>", "#include <uv_vertex>\n#ifdef USE_MAP\n\tvMapUv = uvo.xy + uv * uvo.zw;\n#endif");
    };
    return { canvas, tex, mat, redraw(b) { draw(b); tex.needsUpdate = true; }, dispose() { tex.dispose(); mat.dispose(); } };
  }
  // 一批书 = 一个实例化的盒子（三百本也只画两三次）。书脊朝 +z，前后封面是 ±x
  function makeMesh(books, atlas) {
    const g = new THREE.BoxGeometry(1, 1, 1);                                   // 面的顺序：+x -x +y -y +z -z
    [0, 0, 1, 1, 0, 1].forEach((m, k) => { g.groups[k].materialIndex = m; });   // 封面与书脊用图集，上下和书口是纸
    for (let v = 0; v < 8; v++) g.attributes.uv.setXY(v, .06, .03);             // 前后封面只取格子左下角的一点底色
    const uvo = new Float32Array(books.length * 4), tw = atlas.canvas.width, th = atlas.canvas.height;
    books.forEach((b) => { const x = (b.i % COLS) * CELLW + 3, y = Math.floor(b.i / COLS) * CELLH + 2; uvo.set([x / tw, 1 - (y + CELLH - 4) / th, (CELLW - 6) / tw, (CELLH - 4) / th], b.i * 4); });
    g.setAttribute("uvo", new THREE.InstancedBufferAttribute(uvo, 4));
    const m = new THREE.InstancedMesh(g, [atlas.mat, paperMat], books.length); m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
    return m;
  }
  return { paperMat, tabMat, unitBox, makeAtlas, makeMesh };
}

/* ---------- 架子（灰盒：几块板，外加后面的墙和脚下的地）。一个单位是一厘米 ---------- */
export const DIM = { SH: 29, BT: 2, ST: 2, CD: 21, PL: 5 };      // 层高（净）、层板厚、侧板厚、柜深、踢脚高
export function createCase(scene, unitBox) {
  const { SH, BT, ST, CD, PL } = DIM;
  const group = new THREE.Group(); scene.add(group);
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x8f7d6a, roughness: .9 }), backMat = new THREE.MeshStandardMaterial({ color: 0x51463d, roughness: .95 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x40352e, roughness: 1 }), floorMat = new THREE.MeshStandardMaterial({ color: 0x2c231d, roughness: 1 });
  function build(W, R) {                                           // W：里面净宽，R：几层。回来的是整座的外宽和总高
    group.children.forEach((m) => { if (m.geometry !== unitBox) m.geometry.dispose(); }); group.clear();
    const w = W + 2 * ST, h = R * (SH + BT) + BT + PL;
    const add = (bw, bh, bd, x, y, z, mat) => { const m = new THREE.Mesh(unitBox, mat); m.scale.set(bw, bh, bd); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; group.add(m); return m; };
    add(w, h - PL, 1, 0, PL + (h - PL) / 2, -CD + .5, backMat);                                  // 背板
    [-1, 1].forEach((s) => add(ST, h, CD + .6, s * (W / 2 + ST / 2), h / 2, -CD / 2 + .3, caseMat));  // 两侧
    for (let k = 0; k <= R; k++) add(W, BT, CD - 1, 0, PL + BT / 2 + k * (SH + BT), -(CD - 1) / 2, caseMat); // 层板
    add(W, PL, CD - 3, 0, PL / 2, -(CD - 3) / 2 - 2, backMat);                                   // 踢脚
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w + 900, h + 600), wallMat); wall.position.set(0, h / 2, -CD - .2); wall.receiveShadow = true; group.add(wall);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w + 900, 900), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 450 - CD); floor.receiveShadow = true; group.add(floor);
    return { w, h };
  }
  return { group, build, caseMat, backMat, wallMat, floorMat };
}
