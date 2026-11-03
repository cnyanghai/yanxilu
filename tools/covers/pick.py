import json, urllib.request, urllib.parse, os, time, hashlib
UA = "yanxilu-cover-research/0.1 (usyanghai86@gmail.com)"
info = json.load(open("info.json")); ranked = json.load(open("ranked.json")); wh = json.load(open("wh.json")); nz = json.load(open("nz.json"))
R = [6,7,8,12,15,22,23,44,50,58,74,78,93,109,125,127,129,131,139,142,154,163,171,176,179,200,225,236,82,100,105]
W = [55,104,89,83,23,115,140,151,124,132,136,201,226,164,177,208,212,218,230,175,57,16,28,66,67,150,170,189,187]
N = [0,17,20,40]
keys = [ranked[i]["k"] for i in R] + [wh[i] for i in W] + [nz[i] for i in N]
keys = list(dict.fromkeys(keys))
os.makedirs("big", exist_ok=True)
man = []
for i, k in enumerate(keys):
    v = info[k]
    p = dict(action="query", titles=k, prop="imageinfo", iiprop="url", iiurlwidth=1000, format="json")
    d = json.load(urllib.request.urlopen(urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p), headers={"User-Agent": UA}), timeout=30))
    u = list(d["query"]["pages"].values())[0]["imageinfo"][0]
    src = u.get("thumburl") or u["url"]
    fn = "big/%02d.jpg" % i
    if not os.path.exists(fn):
        for t in range(4):
            try: open(fn, "wb").write(urllib.request.urlopen(urllib.request.Request(src, headers={"User-Agent": UA}), timeout=60).read()); break
            except Exception as e: time.sleep(3 + 4 * t)
    man.append(dict(n=i, key=k, page=v["page"], lic=v["lic"], cat=v["cat"], date=v["date"]))
    time.sleep(0.5)
json.dump(man, open("cands.json", "w"), ensure_ascii=False, indent=1)
print(len(man))
