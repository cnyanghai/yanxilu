import json, urllib.request, urllib.parse, sys, time
UA = "yanxilu-cover-research/0.1 (usyanghai86@gmail.com)"
API = "https://commons.wikimedia.org/w/api.php"
def get(params):
    params["format"] = "json"
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers={"User-Agent": UA})
    return json.load(urllib.request.urlopen(req, timeout=30))
def members(cat, typ):
    out, cont = [], {}
    while True:
        d = get(dict(action="query", list="categorymembers", cmtitle=cat, cmlimit=500, cmtype=typ, **cont))
        out += [m["title"] for m in d["query"]["categorymembers"]]
        if "continue" not in d: return out
        cont = {"cmcontinue": d["continue"]["cmcontinue"]}
roots = sys.argv[1:]
seen, files = set(), {}
q = [(r, 0) for r in roots]
while q:
    c, dep = q.pop(0)
    if c in seen: continue
    seen.add(c)
    for f in members(c, "file"): files.setdefault(f, c)
    if dep < 2:
        for s in members(c, "subcat"): q.append((s, dep + 1))
    time.sleep(0.2)
print(len(seen), "cats", len(files), "files", file=sys.stderr)
json.dump(files, open("files.json", "w"), ensure_ascii=False, indent=0)
