#!/usr/bin/env python3
"""给 glTF（.glb 或内嵌 base64 的 .gltf.json）里的贴图瘦身：PNG → JPEG，最长边不超过 --max 像素，重建 buffer。
是资产导入命令（design/studio/proposals/06 第三条）的第一步；KTX2 以后再加。
用法：python3 tools/asset_shrink.py <文件...> [--max 1024] [--quality 82]
"""
import argparse, base64, io, json, os, struct, sys
from PIL import Image

def load(path):
    b = open(path, "rb").read()
    if b[:4] == b"glTF":
        ln = struct.unpack_from("<I", b, 12)[0]; g = json.loads(b[20:20 + ln]); off = 20 + ln; bl = struct.unpack_from("<I", b, off)[0]
        return g, bytearray(b[off + 8:off + 8 + bl]), "glb"
    g = json.load(open(path, encoding="utf-8"))
    uri = g["buffers"][0]["uri"]; assert uri.startswith("data:"), "只支持内嵌 buffer"
    return g, bytearray(base64.b64decode(uri.split(",", 1)[1])), "json"

def save(path, g, buf, kind):
    if kind == "glb":
        g["buffers"][0] = {"byteLength": len(buf)}
        js = json.dumps(g, separators=(",", ":")).encode(); js += b" " * ((4 - len(js) % 4) % 4)
        buf = bytes(buf) + b"\0" * ((4 - len(buf) % 4) % 4)
        out = b"glTF" + struct.pack("<II", 2, 12 + 8 + len(js) + 8 + len(buf)) + struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(buf), 0x004E4942) + buf
        open(path, "wb").write(out)
    else:
        g["buffers"][0] = {"byteLength": len(buf), "uri": "data:application/octet-stream;base64," + base64.b64encode(bytes(buf)).decode()}
        open(path, "w", encoding="utf-8").write(json.dumps(g, separators=(",", ":")))

def shrink(path, max_px, quality):
    g, buf, kind = load(path); before = os.path.getsize(path)
    views = g["bufferViews"]; new_chunks = []; new_views = []
    img_by_view = {im["bufferView"]: im for im in g.get("images", []) if "bufferView" in im}
    for i, v in enumerate(views):
        data = bytes(buf[v["byteOffset"] if "byteOffset" in v else 0:][:v["byteLength"]])
        if i in img_by_view:
            im = Image.open(io.BytesIO(data)); im.load()
            if max(im.size) > max_px: im.thumbnail((max_px, max_px), Image.LANCZOS)
            has_alpha = im.mode in ("RGBA", "LA") and im.getchannel("A").getextrema()[0] < 255
            out = io.BytesIO()
            if has_alpha: im.save(out, "PNG", optimize=True); img_by_view[i]["mimeType"] = "image/png"
            else: im.convert("RGB").save(out, "JPEG", quality=quality, optimize=True); img_by_view[i]["mimeType"] = "image/jpeg"
            data = out.getvalue()
        nv = dict(v); nv.pop("byteOffset", None); nv["byteOffset"] = sum(len(c) + ((4 - len(c) % 4) % 4) for c in new_chunks); nv["byteLength"] = len(data); nv["buffer"] = 0
        new_views.append(nv); new_chunks.append(data)
    out = bytearray()
    for c in new_chunks: out += c; out += b"\0" * ((4 - len(c) % 4) % 4)
    g["bufferViews"] = new_views
    save(path, g, out, kind); after = os.path.getsize(path)
    print(f"{path}: {before / 1e6:.2f} MB → {after / 1e6:.2f} MB")

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("files", nargs="+"); ap.add_argument("--max", type=int, default=1024); ap.add_argument("--quality", type=int, default=82)
    a = ap.parse_args()
    for f in a.files: shrink(f, a.max, a.quality)
