import json, urllib.request, urllib.parse, time, sys
UA = "yanxilu-cover-research/0.1 (usyanghai86@gmail.com)"
API = "https://commons.wikimedia.org/w/api.php"
files = json.load(open("files.json"))
titles = list(files)
out = {}
for i in range(0, len(titles), 50):
    b = titles[i:i+50]
    p = dict(action="query", titles="|".join(b), prop="imageinfo", iiprop="url|size|extmetadata|mime", iiurlwidth=240, iiextmetadatafilter="LicenseShortName|DateTimeOriginal|ImageDescription|Artist|Credit", format="json")
    req = urllib.request.Request(API, data=urllib.parse.urlencode(p).encode(), headers={"User-Agent": UA})
    for _ in range(3):
        try: d = json.load(urllib.request.urlopen(req, timeout=60)); break
        except Exception as e: time.sleep(3)
    for pg in d["query"]["pages"].values():
        ii = (pg.get("imageinfo") or [{}])[0]
        em = ii.get("extmetadata", {})
        out[pg["title"]] = dict(cat=files.get(pg["title"]), w=ii.get("width"), h=ii.get("height"), url=ii.get("url"), thumb=ii.get("thumburl"), mime=ii.get("mime"), page=ii.get("descriptionurl"),
            lic=em.get("LicenseShortName", {}).get("value"), date=em.get("DateTimeOriginal", {}).get("value"), desc=(em.get("ImageDescription", {}).get("value") or "")[:300])
    time.sleep(0.3)
json.dump(out, open("info.json", "w"), ensure_ascii=False, indent=0)
import collections
print(collections.Counter(v["lic"] for v in out.values()).most_common(15))
