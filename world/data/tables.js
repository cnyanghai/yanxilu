/* 数据层：七张表与预设的加载（design/studio/REVIEW-1.md 第 2 节；格式见 world/data/schema/README.md）。
   纯函数、不 import three；坐标一律厘米整数，这里提供 cm → 米的换算。运行时只读。 */
export const TABLE_NAMES = ["objects", "rooms", "vis", "props", "items", "economy", "sound"];

export const m = (cm) => cm / 100;                       /* 厘米 → 米 */
export const v3 = (p) => [m(p.x), m(p.y ?? 0), m(p.z)];  /* {x,y,z} 厘米 → [x,y,z] 米 */

async function getJSON(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}

/* 读全部表。base 是 world/ 目录的地址（相对或绝对，带尾斜杠）。失败抛错，由调用方决定怎么显示。 */
export async function loadTables(base = "./") {
  const raw = {};
  await Promise.all(TABLE_NAMES.map(async (n) => { raw[n] = await getJSON(`${base}data/${n}.json`); }));
  const problems = validate(raw);
  const presets = {};
  for (const room of raw.rooms.rooms) {
    if (!room.preset) continue; /* 只有声明了 preset 的房间才有固定布局文件，别去撞 404 */
    presets[room.id] = await getJSON(`${base}data/presets/${room.preset}.json`);
  }
  return makeTables(raw, presets, problems);
}

/* 最小校验：format / units / 交叉引用。完整校验在 tools/tables_check.py，这里只挡住会让运行时崩的那几样。 */
export function validate(raw) {
  const p = [];
  for (const n of TABLE_NAMES) if (!raw[n] || raw[n].format !== 1) p.push(`${n}: format 不是 1`);
  for (const n of ["objects", "rooms"]) if (raw[n] && raw[n].units !== "cm") p.push(`${n}: units 不是 cm`);
  const objIds = new Set((raw.objects?.objects || []).map((o) => o.id));
  const fns = new Set(raw.objects?.functions || []);
  for (const o of raw.objects?.objects || []) if (!fns.has(o.operate?.fn)) p.push(`objects.${o.id}: 函数 ${o.operate?.fn} 未登记`);
  const visIds = new Set((raw.vis?.entries || []).map((e) => e.id));
  for (const r of raw.rooms?.rooms || []) {
    if (!visIds.has(r.defaultVis)) p.push(`rooms.${r.id}: defaultVis ${r.defaultVis} 不存在`);
    for (const s of r.slots || []) if (s.fixed && !objIds.has(s.fixed)) p.push(`rooms.${r.id}.${s.name}: 固定物件 ${s.fixed} 不存在`);
  }
  for (const it of raw.items?.items || []) if (!objIds.has(it.object)) p.push(`items.${it.id}: 物件 ${it.object} 不存在`);
  return p;
}

export function makeTables(raw, presets = {}, problems = []) {
  const objects = Object.fromEntries(raw.objects.objects.map((o) => [o.id, o]));
  const rooms = Object.fromEntries(raw.rooms.rooms.map((r) => [r.id, r]));
  const vis = Object.fromEntries(raw.vis.entries.map((e) => [e.id, e]));
  const items = Object.fromEntries(raw.items.items.map((i) => [i.id, i]));
  return {
    raw, problems, objects, rooms, vis, items, presets,
    economy: raw.economy, sound: raw.sound, props: raw.props,
    functions: raw.objects.functions,
    periods: raw.vis.periods,
    weather: raw.vis.weather || {},
    transition: raw.vis.transition || { seconds: 2.5 },
    /* 某房某时段的光；没有就退到该房的 defaultVis，再没有就退到任一条 */
    visFor(roomId, period) {
      return vis[`${roomId}:${period}`] || vis[rooms[roomId]?.defaultVis] || raw.vis.entries[0];
    },
    slot(roomId, name) { return rooms[roomId]?.slots.find((s) => s.name === name) || null; },
    fixedSlots(roomId) { return (rooms[roomId]?.slots || []).filter((s) => s.fixed); },
    shopSlots(roomId) { return (rooms[roomId]?.slots || []).filter((s) => s.shop); },
  };
}
