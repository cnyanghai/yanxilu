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
    g = r["grid"]; occ = {}
    for s in r["slots"]:
        if s.get("fixed") and s["fixed"] not in obj_ids: errs.append(f"rooms: {r['id']}.{s['name']} 的 fixed {s['fixed']} 不在 objects 里")
        for c, rr in s["cells"]:
            if not (0 <= c < g["cols"] and 0 <= rr < g["rows"]): errs.append(f"rooms: {r['id']}.{s['name']} 格 {c},{rr} 越界")
            key = (c, rr)
            if s["type"] in ("floor",) and key in occ and occ[key] != s["name"]:
                errs.append(f"rooms: {r['id']} 地面格 {c},{rr} 被 {occ[key]} 与 {s['name']} 重叠")
            if s["type"] in ("floor",): occ[key] = s["name"]
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
            elif sorted(map(tuple, sl["cells"])) != sorted(map(tuple, comp["Slot"]["cells"])): errs.append(f"presets/{n}: {e['id']} 的格子与 rooms 槽位 {sl['name']} 不一致")
for k in T["sound"]["interactions"]:
    if k not in fns: errs.append(f"sound: 交互音 {k} 不是 objects.functions 里的函数")
if errs:
    print(f"表校验失败：{len(errs)} 条"); [print("  -", e) for e in errs]; sys.exit(1)
n_slots = sum(len(r["slots"]) for r in T["rooms"]["rooms"])
print(f"表校验通过：objects {len(obj_ids)}，rooms {len(room_ids)}（槽位 {n_slots}），vis {len(vis_ids)}，items {len(T['items']['items'])}，presets {len(presets)}")
