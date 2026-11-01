#!/usr/bin/env python3
"""资产导入一条命令（design/studio/proposals/06 第三条；目录规范照暗黑 2 重制版：一件资产一个目录 + 定义 JSON）。

用法：
  python3 tools/asset_import.py <glb|gltf.json|图片> --id desk --kind furniture [--pack modern] [--fit h|wh|wdh] [--prompt "..."]
步骤（任何一步不过就拒绝入库并说明）：
  1. 图片 → 先走 Rodin（tools/fal_image3d.py，PBR 材质）出 glb
  2. gltf-transform：焊接 + 减面到预算（furniture 3000 / prop 500 / character 8000 / shop 1500）
  3. Rodin Shaded 的坑：底色黑 + 自发光贴图 → 搬回 baseColor，关自发光
  4. 贴图瘦身：PNG → JPEG，最长边 ≤ 1024（tools/asset_shrink.py 的逻辑）
  5. 原点落地、XZ 居中；按 objects 表的占地（w × d × h 厘米）缩放，默认按高等比（--fit 指定按宽 / 深拉伸）
  6. 转成内嵌 base64 的 JSON glTF（Baba 静态类型只认 .json）
  7. 写到 world/packs/<pack>/<kind>/<id>/<id>.gltf.json + <id>.json（实体-组件定义），登记到 world/data/props.json
需要：node ≥ 22（~/.nvm/versions/node/v24*），PIL。
"""
import argparse, base64, json, os, shutil, struct, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUDGET = {"furniture": 3000, "prop": 500, "character": 8000, "shop": 1500, "shell": 20000}
NODE_BIN = next(iter(sorted(Path.home().glob(".nvm/versions/node/v2[2-9]*/bin"), reverse=True)), None)


def sh(cmd, **kw):
    env = dict(os.environ); env["PATH"] = (str(NODE_BIN) + ":" if NODE_BIN else "") + env["PATH"]
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, env=env, **kw)
    if r.returncode != 0: sys.exit(f"[失败] {cmd}\n{r.stdout[-600:]}{r.stderr[-600:]}")
    return r.stdout


def load_gltf(path: Path):
    """读 glb 或内嵌 JSON glTF → (json, buffer bytes)"""
    b = path.read_bytes()
    if b[:4] == b"glTF":
        ln = struct.unpack_from("<I", b, 12)[0]; g = json.loads(b[20:20 + ln]); off = 20 + ln; bl = struct.unpack_from("<I", b, off)[0]
        return g, bytearray(b[off + 8:off + 8 + bl])
    g = json.loads(b.decode("utf-8")); uri = g["buffers"][0]["uri"]; assert uri.startswith("data:")
    return g, bytearray(base64.b64decode(uri.split(",", 1)[1]))


def write_glb(path: Path, g, buf):
    g["buffers"][0] = {"byteLength": len(buf)}
    js = json.dumps(g, separators=(",", ":")).encode(); js += b" " * ((4 - len(js) % 4) % 4)
    buf = bytes(buf) + b"\0" * ((4 - len(buf) % 4) % 4)
    path.write_bytes(b"glTF" + struct.pack("<II", 2, 12 + 8 + len(js) + 8 + len(buf)) + struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(buf), 0x004E4942) + buf)


def write_gltf_json(path: Path, g, buf):
    g["buffers"][0] = {"byteLength": len(buf), "uri": "data:application/octet-stream;base64," + base64.b64encode(bytes(buf)).decode()}
    path.write_text(json.dumps(g, separators=(",", ":")), encoding="utf-8")


def fix_shaded(g):
    """Rodin Shaded：baseColor 黑 + emissiveTexture → 搬回 baseColor。返回改了几个材质"""
    n = 0
    for m in g.get("materials", []):
        pbr = m.setdefault("pbrMetallicRoughness", {})
        if "emissiveTexture" in m and pbr.get("baseColorFactor", [1, 1, 1, 1])[:3] == [0, 0, 0] and "baseColorTexture" not in pbr:
            pbr["baseColorTexture"] = m.pop("emissiveTexture"); pbr["baseColorFactor"] = [1, 1, 1, 1]
            m["emissiveFactor"] = [0, 0, 0]; pbr.setdefault("metallicFactor", 0.0); pbr.setdefault("roughnessFactor", 0.9); n += 1
    return n


def bbox(g, buf):
    """全部 POSITION accessor 的包围盒（忽略节点变换：Rodin 产物是单节点单位矩阵；有变换时偏差写进报告）"""
    lo = [1e9] * 3; hi = [-1e9] * 3
    for mesh in g.get("meshes", []):
        for p in mesh["primitives"]:
            a = g["accessors"][p["attributes"]["POSITION"]]
            for i in range(3): lo[i] = min(lo[i], a["min"][i]); hi[i] = max(hi[i], a["max"][i])
    return lo, hi


def tri_count(g):
    n = 0
    for mesh in g.get("meshes", []):
        for p in mesh["primitives"]:
            if "indices" in p: n += g["accessors"][p["indices"]]["count"] // 3
            else: n += g["accessors"][p["attributes"]["POSITION"]]["count"] // 3
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("--id", required=True); ap.add_argument("--kind", required=True, choices=list(BUDGET))
    ap.add_argument("--pack", default="modern"); ap.add_argument("--fit", default="h", help="h 按高等比；wh / wdh 按宽深各轴拉伸")
    ap.add_argument("--object", default=None, help="objects 表里的物件 id（默认同 --id），取占地 w d h")
    ap.add_argument("--prompt", default="", help="图片输入时给 Rodin 的提示词")
    ap.add_argument("--max-tex", type=int, default=1024); ap.add_argument("--keep-glb", action="store_true")
    a = ap.parse_args()
    objects = json.loads((ROOT / "world/data/objects.json").read_text(encoding="utf-8"))
    obj = next((o for o in objects["objects"] if o["id"] == (a.object or a.id)), None)
    if not obj: sys.exit(f"[失败] objects 表里没有 {a.object or a.id}，先登记物件再导入资产")
    fp = obj["footprint"]; W, D, H = fp["w"] / 100, fp["d"] / 100, fp["h"] / 100
    src = Path(a.src); work = Path(tempfile.mkdtemp(prefix="yxl_import_"))
    report = {"id": a.id, "kind": a.kind, "pack": a.pack, "source": str(src), "steps": []}
    # 1. 图片 → Rodin
    if src.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
        out = work / "rodin"; sh(f'python3 {ROOT}/tools/fal_image3d.py "{src}" -o "{out}" --material PBR --quality medium --prompt "{a.prompt}"')
        src = out / "model.glb"; report["steps"].append("rodin:PBR")
    # 2. 减面
    glb0 = work / "in.glb"
    if src.suffix == ".glb": shutil.copy(src, glb0)
    else: g0, b0 = load_gltf(src); write_glb(glb0, g0, b0)
    g, buf = load_gltf(glb0); before = tri_count(g); budget = BUDGET[a.kind]
    glb1 = work / "simp.glb"
    if before > budget:
        ratio = max(0.02, budget / before)
        sh(f'npx --yes @gltf-transform/cli@4.1.1 optimize "{glb0}" "{glb1}" --simplify-ratio {ratio:.4f} --simplify-error 0.002 --texture-compress false --compress false')
    else: shutil.copy(glb0, glb1)
    g, buf = load_gltf(glb1); after = tri_count(g); report["tris"] = {"before": before, "after": after, "budget": budget}
    if after > budget * 1.15: sys.exit(f"[失败] 减面后仍 {after} 面，超预算 {budget}")
    # 3. 材质归位
    report["shaded_fixed"] = fix_shaded(g)
    # 4. 贴图瘦身（借 asset_shrink 的实现）
    sys.path.insert(0, str(ROOT / "tools")); import asset_shrink  # noqa
    tmp = work / "shrink.glb"; write_glb(tmp, g, buf); asset_shrink.shrink(str(tmp), a.max_tex, 82); g, buf = load_gltf(tmp)
    # 5. 原点与缩放：包一层根节点
    lo, hi = bbox(g, buf); size = [hi[i] - lo[i] for i in range(3)]
    sy = H / size[1] if size[1] else 1
    sx = (W / size[0] if size[0] else 1) if "w" in a.fit else sy
    sz = (D / size[2] if size[2] else 1) if "d" in a.fit else sy
    root = {"name": f"{a.id}_root", "children": list(g["scenes"][g.get("scene", 0)]["nodes"]),
            "scale": [sx, sy, sz], "translation": [-(lo[0] + hi[0]) / 2 * sx, -lo[1] * sy, -(lo[2] + hi[2]) / 2 * sz]}
    g["nodes"].append(root); g["scenes"][g.get("scene", 0)]["nodes"] = [len(g["nodes"]) - 1]
    final = [size[0] * sx, size[1] * sy, size[2] * sz]
    dev = {"w": (final[0] - W) / W, "d": (final[2] - D) / D, "h": (final[1] - H) / H}
    report["size_m"] = {"raw": [round(v, 3) for v in size], "final": [round(v, 3) for v in final], "deviation": {k: round(v, 3) for k, v in dev.items()}}
    if a.fit == "h" and (abs(dev["w"]) > 0.35 or abs(dev["d"]) > 0.35):
        report["warning"] = "按高等比后宽或深偏离占地超过 35%，考虑 --fit wdh 或换参考图"
    # 6/7. 落目录、登记、定义
    dest = ROOT / "world/packs" / a.pack / a.kind / a.id; dest.mkdir(parents=True, exist_ok=True)
    write_gltf_json(dest / f"{a.id}.gltf.json", g, buf)
    if a.keep_glb: shutil.copy(tmp, dest / f"{a.id}.glb")
    texs = [im.get("mimeType", "") for im in g.get("images", [])]
    definition = {"format": 1, "units": "cm", "id": a.id, "kind": a.kind, "pack": a.pack, "object": obj["id"],
                  "components": {"Model": {"file": f"{a.id}.gltf.json", "tris": after, "textures": len(texs), "maxTex": a.max_tex},
                                 "Footprint": fp, "ContactShadow": {"w": fp["w"], "d": fp["d"], "opacity": 0.35},
                                 "Collider": {"type": "box", "w": fp["w"], "d": fp["d"], "h": fp["h"]}}, "import": report}
    (dest / f"{a.id}.json").write_text(json.dumps(definition, ensure_ascii=False, indent=1), encoding="utf-8")
    props_p = ROOT / "world/data/props.json"; props = json.loads(props_p.read_text(encoding="utf-8"))
    rel = f"packs/{a.pack}/{a.kind}/{a.id}"
    props["assets"][a.id] = {"model": f"{rel}/{a.id}.gltf.json", "def": f"{rel}/{a.id}.json", "tris": after, "tex": a.max_tex, "kind": a.kind, "status": "imported", "fit": a.fit}
    props_p.write_text(json.dumps(props, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    sizekb = os.path.getsize(dest / f"{a.id}.gltf.json") // 1024
    print(f"[入库] {rel}/  {after} 面（原 {before}，预算 {budget}）  {sizekb} KB  尺寸 {[round(v, 2) for v in final]} m  偏差 {report['size_m']['deviation']}" + (f"\n[提醒] {report['warning']}" if "warning" in report else ""))
    shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
