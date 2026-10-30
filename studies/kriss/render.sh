#!/usr/bin/env bash
# 渲一张咨询室对照图并和 kriss 的截图并排。用法：bash studies/kriss/render.sh <tag> [更多传给 scene.py 的参数]
set -euo pipefail
ROOT=$(cd "$(dirname "$(readlink -f "$0")")/../.." && pwd); TAG=${1:-01}; shift || true
OUT=$ROOT/tools/out/kriss_study; mkdir -p "$OUT"
WB=$(ls /mnt/*/齐河OnLine/tools/blender/blender.exe 2>/dev/null | head -1 || true)
if [ -n "$WB" ]; then "$WB" -b --python "$(wslpath -w "$ROOT/studies/kriss/scene.py")" -- --out "$(wslpath -w "$OUT")" --tag "$TAG" --gpu "$@" 2>&1 | grep -E "GPU|已渲染|rror" || true
else blender -b --python "$ROOT/studies/kriss/scene.py" -- --out "$OUT" --tag "$TAG" --samples 48 "$@" 2>&1 | grep -E "已渲染|rror" || true; fi
python3 - "$ROOT" "$TAG" <<'PY'
import sys, os
from PIL import Image, ImageDraw, ImageFont
root, tag = sys.argv[1], sys.argv[2]
ref = Image.open(os.path.join(root, "tools/out/kriss_ref/consultation.jpg")).convert("RGB")
ours = Image.open(os.path.join(root, f"tools/out/kriss_study/consult_{tag}.png")).convert("RGB")
w = 960; a = ref.resize((w, int(ref.size[1] * w / ref.size[0]))); b = ours.resize((w, int(ours.size[1] * w / ours.size[0])))
h = max(a.size[1], b.size[1]); sheet = Image.new("RGB", (2 * w + 30, h + 44), (236, 230, 218)); dr = ImageDraw.Draw(sheet)
try: f = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc", 20)
except Exception: f = ImageFont.load_default()
dr.text((10, 10), "kriss 咨询室（目标）", fill=(40, 30, 20), font=f); dr.text((w + 40, 10), f"我们 · 第 {tag} 版", fill=(40, 30, 20), font=f)
sheet.paste(a, (10, 44)); sheet.paste(b, (w + 20, 44)); out = os.path.join(root, f"tools/out/kriss_study/compare_{tag}.jpg"); sheet.save(out, quality=88); print(out)
PY
