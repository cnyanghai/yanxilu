import json, urllib.request, os, hashlib, time
from concurrent.futures import ThreadPoolExecutor
UA = "yanxilu-cover-research/0.1 (usyanghai86@gmail.com)"
info = json.load(open("info.json"))
ok = {k: v for k, v in info.items() if v["lic"] in ("CC0", "Public domain", "No restrictions", "CC BY 2.0") and v["thumb"] and (v["mime"] or "").startswith("image/")}
idx = {}
def fetch(item):
    k, v = item
    fn = "th/" + hashlib.md5(k.encode()).hexdigest()[:12] + ".jpg"
    idx[fn] = k
    if os.path.exists(fn): return
    for t in range(4):
        try:
            r = urllib.request.urlopen(urllib.request.Request(v["thumb"], headers={"User-Agent": UA}), timeout=40)
            open(fn, "wb").write(r.read()); return
        except Exception as e:
            time.sleep(2 + t * 3)
with ThreadPoolExecutor(4) as ex: list(ex.map(fetch, ok.items()))
json.dump(idx, open("thidx.json", "w"), ensure_ascii=False)
print(len(ok), len(os.listdir("th")))
