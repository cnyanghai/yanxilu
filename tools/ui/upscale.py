#!/usr/bin/env python3
"""fal 放大试验：把一张图放大两倍。用法：fal_upscale.py IN.png OUT.png [--model fal-ai/clarity-upscaler] [--factor 2]
密钥读法同 media-toolkit 的 fal_image.py（环境变量 FAL_KEY → ~/ai-studio/apps/web/.env → ~/brain/.env），不打印。
"""
import argparse, base64, json, mimetypes, os, sys, time
from pathlib import Path
import requests


def load_key():
    k = os.environ.get('FAL_KEY')
    if k: return k
    for p in (Path.home() / 'ai-studio/apps/web/.env', Path.home() / 'brain/.env'):
        if p.exists():
            for line in p.read_text().splitlines():
                if line.startswith('FAL_KEY='):
                    return line.split('=', 1)[1].strip().strip('"').strip("'")
    sys.exit('没有找到 FAL_KEY')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--model', default='fal-ai/clarity-upscaler')
    ap.add_argument('--factor', type=float, default=2)
    ap.add_argument('--set', action='append', default=[])
    a = ap.parse_args()
    p = Path(a.src); mime = mimetypes.guess_type(p.name)[0] or 'image/png'
    body = {'image_url': f'data:{mime};base64,{base64.b64encode(p.read_bytes()).decode()}', 'upscale_factor': a.factor}
    for kv in a.set:
        k, v = kv.split('=', 1)
        try: v = float(v) if '.' in v else int(v)
        except ValueError: pass
        body[k] = v
    headers = {'Authorization': f'Key {load_key()}', 'Content-Type': 'application/json'}
    t0 = time.time()
    r = requests.post(f'https://fal.run/{a.model}', headers=headers, data=json.dumps(body), timeout=600)
    if r.status_code >= 300:
        sys.exit(f'[失败] {r.status_code}: {r.text[:300]}')
    res = r.json()
    im = res.get('image') or (res.get('images') or [None])[0]
    if not im: sys.exit(f'[失败] 没有图：{str(res)[:300]}')
    u = im['url']
    data = base64.b64decode(u.split(',', 1)[1]) if u.startswith('data:') else requests.get(u, timeout=300).content
    Path(a.out).write_bytes(data)
    print(f"[完成] {a.out} ({len(data) // 1024} KB, {im.get('width')}x{im.get('height')})  [耗时] {time.time() - t0:.1f}s")


if __name__ == '__main__':
    main()
