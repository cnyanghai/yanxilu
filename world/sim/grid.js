/* 世界层：格子、阻挡、寻路、摆放合法性。纯函数，不 import three，可在 Node 里测（tools/tests/sim_test.mjs）。
   单位厘米；原点房间中心，x 向右，z 向镜头。格子大小来自 rooms 表（默认 25），只用于吸附、寻路、校验。 */

export class Grid {
  constructor(room) {
    this.cell = room.grid?.cell || 25;
    this.w = room.size.w; this.d = room.size.d;
    this.cols = Math.round(this.w / this.cell); this.rows = Math.round(this.d / this.cell);
    this.block = new Uint8Array(this.cols * this.rows);
  }
  /* 厘米坐标 → 格 */
  cellOf(x, z) { return [Math.floor((x + this.w / 2) / this.cell), Math.floor((z + this.d / 2) / this.cell)]; }
  /* 格 → 格心厘米坐标 */
  center(c, r) { return [Math.round(-this.w / 2 + (c + 0.5) * this.cell), Math.round(-this.d / 2 + (r + 0.5) * this.cell)]; }
  /* 吸附到格心 */
  snap(x, z) { const [c, r] = this.cellOf(x, z); return this.center(Math.max(0, Math.min(this.cols - 1, c)), Math.max(0, Math.min(this.rows - 1, r))); }
  inside(c, r) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }
  idx(c, r) { return r * this.cols + c; }
  /* 一个占地矩形（中心 x,z，宽 w 深 d，朝向 rot 度）覆盖的格 */
  cellsOfRect(x, z, w, d, rot = 0) {
    const q = Math.round(((rot % 360) + 360) % 360 / 90) % 2; if (q) [w, d] = [d, w];
    /* 内缩 1 厘米：碰到格线不算占，也吃掉格心四舍五入的半厘米 */
    const [c0, r0] = this.cellOf(x - w / 2 + 1, z - d / 2 + 1), [c1, r1] = this.cellOf(x + w / 2 - 1, z + d / 2 - 1);
    const out = [];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push([c, r]);
    return out;
  }
  blockRect(x, z, w, d, rot = 0, val = 1) { for (const [c, r] of this.cellsOfRect(x, z, w, d, rot)) if (this.inside(c, r)) this.block[this.idx(c, r)] = val; }
  isBlocked(c, r) { return !this.inside(c, r) || this.block[this.idx(c, r)] === 1; }
  /* A*，四邻加对角（对角不许切角）。返回格子序列，起点到终点；不可达返回 null */
  astar(from, to) {
    const [sc, sr] = from, [tc, tr] = to;
    if (!this.inside(sc, sr) || !this.inside(tc, tr) || this.isBlocked(tc, tr)) return null;
    const N = this.cols * this.rows, g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const h = (c, r) => Math.hypot(c - tc, r - tr);
    const open = [[h(sc, sr), this.idx(sc, sr)]]; g[this.idx(sc, sr)] = 0;
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, cur] = open.splice(bi, 1)[0];
      if (closed[cur]) continue; closed[cur] = 1;
      const cc = cur % this.cols, cr = (cur - cc) / this.cols;
      if (cc === tc && cr === tr) {
        const path = []; for (let i = cur; i !== -1; i = came[i]) path.push([i % this.cols, Math.floor(i / this.cols)]);
        return path.reverse();
      }
      for (const [dc, dr, cost] of dirs) {
        const nc = cc + dc, nr = cr + dr;
        if (this.isBlocked(nc, nr)) continue;
        if (dc && dr && (this.isBlocked(cc + dc, cr) || this.isBlocked(cc, cr + dr))) continue;
        const ni = this.idx(nc, nr), ng = g[cur] + cost;
        if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; open.push([ng + h(nc, nr), ni]); }
      }
    }
    return null;
  }
}

/* 房间的阻挡图：固定槽里占地面的家具不可走；地毯、门、墙面、桌面不挡路 */
export function roomGrid(room, objects) {
  const grid = new Grid(room);
  for (const s of room.slots) {
    if (s.type !== "floor" && s.type !== "wall") continue;
    const o = s.fixed ? objects[s.fixed] : null;
    if (o && o.collision === false) continue;
    if (!s.fixed) continue; /* 空的商店槽可走 */
    grid.blockRect(s.x, s.z, s.w, s.d, s.rot || 0);
  }
  return grid;
}

/* 摆放合法性：一个纯函数，预览、确认、加载校验共用（OpenRA 的教训）。
   返回 { ok, reason, cells }。placements 是已摆的 [{uid,item,x,z,rot,surface}]，items / objects 是表。 */
export function canPlace(room, objects, items, placements, want) {
  const it = items[want.item]; if (!it) return { ok: false, reason: "no-item" };
  const o = objects[it.object]; if (!o) return { ok: false, reason: "no-object" };
  if (!it.slotTypes.includes(want.surface)) return { ok: false, reason: "surface" };
  const slots = room.slots.filter((s) => s.type === want.surface && s.shop);
  const slot = want.slot ? slots.find((s) => s.name === want.slot) : slots.find((s) => Math.abs(s.x - want.x) <= s.w / 2 && Math.abs(s.z - want.z) <= s.d / 2);
  if (!slot) return { ok: false, reason: "no-slot" };
  const grid = new Grid(room), fp = o.footprint || { w: 25, d: 25 };
  const cells = grid.cellsOfRect(want.x, want.z, fp.w, fp.d, want.rot || 0);
  for (const [c, r] of cells) if (!grid.inside(c, r)) return { ok: false, reason: "bounds" };
  if (want.surface === "floor") {
    for (const s of room.slots) if (s.fixed && s.type === "floor" && overlap(want.x, want.z, fp.w, fp.d, s)) return { ok: false, reason: "fixed:" + s.name };
  }
  for (const p of placements) {
    if (p.uid === want.uid || p.surface !== want.surface) continue;
    const po = objects[items[p.item]?.object]; const pf = po?.footprint || { w: 25, d: 25 };
    if (overlap(want.x, want.z, fp.w, fp.d, { x: p.x, z: p.z, w: pf.w, d: pf.d })) return { ok: false, reason: "overlap:" + p.uid };
  }
  return { ok: true, reason: "", cells, slot: slot.name };
}
function overlap(x, z, w, d, s) { return Math.abs(x - s.x) * 2 < w + s.w && Math.abs(z - s.z) * 2 < d + s.d; }
