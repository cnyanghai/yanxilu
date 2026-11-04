# 老书皮的生产线

研习录「老书皮」装帧的封面图从这里来。原图和中间产物都不入库（在一个临时工作目录里跑），仓库里只有最后的 `vendor/covers/c*.webp` 和 `SOURCES.md`。

在一个空目录里依次跑：

1. `crawl.py "Category:Publishers' bindings" ...`：爬维基共享资源的装帧分类，得 `files.json`
2. `info.py`：取每张图的尺寸、授权、缩略图地址，得 `info.json`；只留 CC0 / 公有领域 / 无限制 / CC BY 2.0
3. `thumbs.py`、`rank.py`：下缩略图，按封面比例、细节密度、颜色数排序出样张
4. `pick.py`：按样张里挑中的编号下 1000 像素宽的图（`cands.json` 是 2026-11-03 挑的 63 张）
5. `ann.py`：人工标注，每张的裁切框、要抹的原书名框、书名框、样式（烫字 stamp / 皮签 plate）、是否竖排
6. `process.py`：抹字（找出笔画像素 → 周围像素修补明暗 → 从同一封面最素的一块借布纹高频），裁切缩到 540 宽存 WebP，得 `covers.json`
7. `embed.py [不要的编号...]`：拷进 `vendor/covers/`，写 `SOURCES.md`，把清单写进 `src/app.js` 的 `OLDC`；之后跑 `python3 build.py`

花纹底上的字抹不干净，这类改用皮签盖住；抹完逐张看，不干净的去掉（2026-11-03 去掉了 32、36 号，以及抹字后留下淡色方块的 3、12、24 号）。
