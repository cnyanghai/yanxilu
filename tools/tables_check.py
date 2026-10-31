#!/usr/bin/env python3
"""校验 world/data 的七张表和预设：JSON Schema + 交叉引用 + 格子不重叠不越界。进 world_test 前置。
用法：python3 tools/tables_check.py   （失败退出 1 并逐条列出）"""
import json, os, sys, glob
from jsonschema import Draft7Validator
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "world", "data")
errs = []
def load(name): return json.load(open(os.path.join(D, name), encoding="utf-8"))
def schema(name): return json.load(open(os.path.join(D, "schema", name + ".schema.json"), encoding="utf-8"))
def check_schema(obj, sname, label):
    for e in sorted(Draft7Validator(schema(sname)).iter_errors(obj), key=lambda e: list(e.path)):
        errs.append(f"{label}: {'/'.join(map(str, e.path)) or '<root>'}: {e.message[:160]}")
T = {n: load(n + ".json") for n in ("objects", "rooms", "vis", "props", "items", "economy", "sound")}
for n, o in T.items(): check_schema(o, n, n + ".json")
presets = {os.path.basename(p)[:-5]: json.load(open(p, encoding="utf-8")) for p in glob.glob(os.path.join(D, "presets", "*.json"))}
for n, p in presets.items(): check_schema(p, "preset", f"presets/{n}.json")
# 交叉引用
obj_ids = {o["id"] for o in T["objects"]["objects"]}
fns = set(T["objects"]["functions"])
for o in T["objects"]["objects"]:
    if o["operate"]["fn"] not in fns: errs.append(f"objects: {o['id']} 的函数 {o['operate']['fn']} 不在 functions 里")
    for k, v in (o.get("next") or {}).items():
        if v not in fns: errs.append(f"objects: {o['id']}.next.{k} = {v} 不在 functions 里")
room_ids = {r["id"] for r in T["rooms"]["rooms"]}
vis_ids = {e["id"] for e in T["vis"]["entries"]}
for e in T["vis"]["entries"]:
    if e["room"] not in room_ids: errs.append(f"vis: {e['id']} 的房间 {e['room']} 不存在")
    if e["id"] != f"{e['room']}:{e['period']}": errs.append(f"vis: {e['id']} 的 id 应为 房间:时段")
for r in T["rooms"]["rooms"]:
    if r["defaultVis"] not in vis_ids: errs.append(f"rooms: {r['id']} 的 defaultVis {r['defaultVis']} 不在 vis 里")
    if r["id"] not in T["sound"]["rooms"]: errs.append(f"sound: 房间 {r['id']} 没有环境声")
    W_, D_ = r["size"]["w"], r["size"]["d"]; rects = []
    for s in r["slots"]:
        if s.get("fixed") and s["fixed"] not in obj_ids: errs.append(f"rooms: {r['id']}.{s['name']} 的 fixed {s['fixed']} 不在 objects 里")
        x0, x1, z0, z1 = s["x"] - s["w"] / 2, s["x"] + s["w"] / 2, s["z"] - s["d"] / 2, s["z"] + s["d"] / 2
        if x0 < -W_ / 2 - 1 or x1 > W_ / 2 + 1 or z0 < -D_ / 2 - 1 or z1 > D_ / 2 + 1: errs.append(f"rooms: {r['id']}.{s['name']} 越界 ({x0},{z0})-({x1},{z1})")
        if s["type"] == "floor":
            for (n2, a0, a1, b0, b1) in rects:
                if x0 < a1 and x1 > a0 and z0 < b1 and z1 > b0: errs.append(f"rooms: {r['id']} 地面槽 {s['name']} 与 {n2} 重叠")
            rects.append((s["name"], x0, x1, z0, z1))
        if s["x"] % 1 or s["z"] % 1: errs.append(f"rooms: {r['id']}.{s['name']} 坐标不是整数厘米")
for it in T["items"]["items"]:
    if it["object"] not in obj_ids: errs.append(f"items: {it['id']} 的 object {it['object']} 不存在")
    if it["comfortClass"] not in T["economy"]["comfort"]["classes"]: errs.append(f"items: {it['id']} 的 comfortClass 不在 economy.comfort.classes 里")
for n, p in presets.items():
    if p["room"] not in room_ids: errs.append(f"presets/{n}: 房间 {p['room']} 不存在")
    room = next(r for r in T["rooms"]["rooms"] if r["id"] == p["room"]); slots = {s["name"]: s for s in room["slots"]}
    for e in p["entities"]:
        if e.get("extends") and e["extends"] not in p.get("templates", {}): errs.append(f"presets/{n}: {e['id']} 的模板 {e['extends']} 不存在")
        comp = e["components"]
        if "Data" in comp and comp["Data"].get("object") not in obj_ids: errs.append(f"presets/{n}: {e['id']} 的 object 不存在")
        if "Slot" in comp:
            sl = slots.get(comp["Slot"]["slot"])
            if not sl: errs.append(f"presets/{n}: {e['id']} 的槽位 {comp['Slot']['slot']} 不在 rooms 里")
            else:
                t = comp["Transform"]
                if abs(t["x"] - sl["x"]) > sl["w"] / 2 + 1 or abs(t["z"] - sl["z"]) > sl["d"] / 2 + 1: errs.append(f"presets/{n}: {e['id']} 的位置 ({t['x']},{t['z']}) 不在槽位 {sl['name']} 内")
for k in T["sound"]["interactions"]:
    if k not in fns: errs.append(f"sound: 交互音 {k} 不是 objects.functions 里的函数")
if errs:
    print(f"表校验失败：{len(errs)} 条"); [print("  -", e) for e in errs]; sys.exit(1)
n_slots = sum(len(r["slots"]) for r in T["rooms"]["rooms"])
print(f"表校验通过：objects {len(obj_ids)}，rooms {len(room_ids)}（槽位 {n_slots}），vis {len(vis_ids)}，items {len(T['items']['items'])}，presets {len(presets)}")
