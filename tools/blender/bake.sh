#!/usr/bin/env bash
# 烘焙并导出书房（第 3 步）。优先用 Windows 侧的 Blender 4.5（有显卡，OptiX），没有就用 WSL 里的 Blender。
# 用法：bash tools/blender/bake.sh [输出目录=world/assets] [采样=256] [尺寸=2048] [光=day,night,rain]
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
OUT=${1:-world/assets}; SAMPLES=${2:-256}; SIZE=${3:-2048}; LIGHTS=${4:-day,night,rain}
case "$OUT" in /*) ;; *) OUT="$ROOT/$OUT";; esac
mkdir -p "$OUT"
WB=$(ls /mnt/*/齐河OnLine/tools/blender/blender.exe 2>/dev/null | head -1 || true)
if [ -n "$WB" ] && command -v wslpath >/dev/null; then
  echo "用 Windows 的 Blender：$WB"
  "$WB" -b --python "$(wslpath -w "$ROOT/tools/blender/bake_study.py")" -- --out "$(wslpath -w "$OUT")" --size "$SIZE" --samples "$SAMPLES" --lights "$LIGHTS" --gpu 2>&1 | grep -E "用显卡|UV 打包|烘焙完成|导出|产物|全部完成|Error|Traceback|rror:" || true
else
  echo "用 WSL 的 Blender"
  blender -b --python "$ROOT/tools/blender/bake_study.py" -- --out "$OUT" --size "$SIZE" --samples "$SAMPLES" --lights "$LIGHTS" 2>&1 | grep -E "UV 打包|烘焙完成|导出|产物|全部完成|Error|Traceback|rror:" || true
fi
# 几何：没压过就用 gltf-transform 压 Draco（1 MB → 约 150 KB）
export PATH=$HOME/.nvm/versions/node/v22.22.3/bin:$PATH
if [ -f "$OUT/study.glb" ]; then
  npx --yes @gltf-transform/cli@4.1.1 draco "$OUT/study.glb" "$OUT/study.glb" 2>&1 | grep -E "info|rror" || true
fi
# 转成内嵌 base64 的 JSON glTF：Baba 的静态类型表只认 .json；GLTFLoader 不看扩展名
if [ -f "$OUT/study.glb" ]; then
  python3 - "$OUT" <<'PY'
import json, struct, base64, os, sys
d = sys.argv[1]; b = open(os.path.join(d, "study.glb"), "rb").read()
jl = struct.unpack("<I", b[12:16])[0]; g = json.loads(b[20:20 + jl]); off = 20 + jl; bl = struct.unpack("<I", b[off:off + 4])[0]
g["buffers"][0]["uri"] = "data:application/octet-stream;base64," + base64.b64encode(b[off + 8:off + 8 + bl]).decode()
open(os.path.join(d, "study.gltf.json"), "w").write(json.dumps(g, separators=(",", ":"))); os.remove(os.path.join(d, "study.glb"))
PY
fi
ls -la "$OUT" | awk '{print $5, $9}'
