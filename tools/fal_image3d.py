#!/usr/bin/env python3
"""图生三维：fal 上的 Hyper3D Rodin（fal-ai/hyper3d/rodin，约 0.4 美元一次）。
用法: python3 tools/fal_image3d.py <参考图...> -o <输出目录> [--material Shaded|PBR] [--quality medium] [--prompt 文本]
产出: <输出目录>/model.glb 与贴图（若接口单独给出）、result.json。
密钥按 fal_image2.py 的顺序找：环境变量 FAL_KEY → ~/ai-studio/apps/web/.env → ~/brain/.env；不打印。
fal.run 在境外，本机要开着代理（读 http_proxy / https_proxy）。
"""
import argparse, base64, json, mimetypes, os, sys, time
from pathlib import Path
import requests

QUEUE = "https://queue.fal.run/fal-ai/hyper3d/rodin"
UPLOAD_INIT = "https://rest.alpha.fal.ai/storage/upload/initiate"


def resolve_key():
    if os.environ.get("FAL_KEY"):
        return os.environ["FAL_KEY"]
    for p in (Path.home() / "ai-studio/apps/web/.env", Path.home() / "brain/.env"):
        if p.exists():
            for line in p.read_text().splitlines():
                if line.strip().startswith("FAL_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("找不到 FAL_KEY")


def upload(path: Path, headers) -> str:
    """传到 fal 的存储拿公开地址（Rodin 对 data URI 不保证支持）。"""
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    r = requests.post(UPLOAD_INIT, headers={**headers, "Content-Type": "application/json"},
                      params={"storage_type": "fal-cdn-v3"}, data=json.dumps({"content_type": mime, "file_name": path.name}), timeout=60)
    if r.status_code >= 300:
        return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"
    j = r.json()
    put = requests.put(j["upload_url"], data=path.read_bytes(), headers={"Content-Type": mime}, timeout=300)
    put.raise_for_status()
    return j["file_url"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+")
    ap.add_argument("-o", "--outdir", required=True)
    ap.add_argument("--material", default="Shaded", choices=["Shaded", "PBR"])
    ap.add_argument("--quality", default="medium", choices=["high", "medium", "low", "extra-low"])
    ap.add_argument("--tier", default="Regular", choices=["Regular", "Sketch"])
    ap.add_argument("--prompt", default="")
    ap.add_argument("--bbox", default="", help="X,Y,Z 包围盒比例，可不填")
    ap.add_argument("--tapose", action="store_true", help="人形：出 A/T 姿势")
    a = ap.parse_args()
    key = resolve_key()
    headers = {"Authorization": f"Key {key}"}
    out = Path(a.outdir); out.mkdir(parents=True, exist_ok=True)
    urls = [upload(Path(p), headers) for p in a.images]
    body = {"input_image_urls": urls, "condition_mode": "concat", "geometry_file_format": "glb",
            "material": a.material, "quality": a.quality, "tier": a.tier, "use_hyper": False}
    if a.prompt: body["prompt"] = a.prompt
    if a.bbox: body["bbox_condition"] = [int(x) for x in a.bbox.split(",")]
    if a.tapose: body["TAPose"] = True
    t0 = time.time()
    r = requests.post(QUEUE, headers={**headers, "Content-Type": "application/json"}, data=json.dumps(body), timeout=120)
    if r.status_code >= 300:
        sys.exit(f"[失败] 提交 {r.status_code}: {r.text[:300]}")
    j = r.json(); rid = j["request_id"]; status_url = j.get("status_url") or f"{QUEUE}/requests/{rid}/status"; result_url = j.get("response_url") or f"{QUEUE}/requests/{rid}"
    print(f"[提交] {rid}  material={a.material} quality={a.quality}  预估 $0.40")
    last = ""
    while True:
        s = requests.get(status_url, headers=headers, params={"logs": "0"}, timeout=60).json()
        st = s.get("status")
        if st != last:
            print(f"[状态] {st}  {int(time.time() - t0)}s"); last = st
        if st == "COMPLETED": break
        if st in ("FAILED", "CANCELLED"):
            sys.exit(f"[失败] {s}")
        time.sleep(5)
    res = requests.get(result_url, headers=headers, timeout=60).json()
    (out / "result.json").write_text(json.dumps(res, ensure_ascii=False, indent=1))
    mesh = res.get("model_mesh") or {}
    if mesh.get("url"):
        data = requests.get(mesh["url"], timeout=600).content
        (out / "model.glb").write_bytes(data)
        print(f"[完成] {out / 'model.glb'}  ({len(data) // 1024} KB)")
    for i, t in enumerate(res.get("textures") or []):
        if t.get("url"):
            ext = (t.get("content_type") or "image/png").split("/")[-1].replace("jpeg", "jpg")
            (out / f"tex_{i}.{ext}").write_bytes(requests.get(t["url"], timeout=300).content)
            print(f"[贴图] tex_{i}.{ext} {t.get('width')}x{t.get('height')}")
    print(f"[耗时] {int(time.time() - t0)}s")


if __name__ == "__main__":
    main()
