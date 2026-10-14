#!/usr/bin/env python3
"""把一份讲义或路线单包成写进研习录数据库（集合 lessons）用的 JSON。
用法：
  python3 study/lesson_json.py 2026-10-15   → /tmp/lesson-2026-10-15.json  内容 {date, md}
  python3 study/lesson_json.py sql-02       → /tmp/lesson-sql-02.json      内容 {key, md}
"""
import json, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent
key = sys.argv[1]
if re.fullmatch(r"\d{4}-\d{2}-\d{2}", key):
    doc = {"date": key, "md": (root / "daily" / f"{key}.md").read_text(encoding="utf-8")}
else:
    m = re.fullmatch(r"([a-z]+)-(\d{2})", key)
    if not m:
        sys.exit("键要么是日期 2026-10-15，要么是课号 sql-02")
    doc = {"key": key, "md": (root / "lessons" / m.group(1) / f"{m.group(2)}.md").read_text(encoding="utf-8")}
out = pathlib.Path("/tmp") / f"lesson-{key}.json"
out.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
print(out)
