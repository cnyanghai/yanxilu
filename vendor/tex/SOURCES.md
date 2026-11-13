# vendor/tex：扫描的材质

样机（`lab/`）旧书房外观用的木纹和布纹。都来自 Poly Haven，授权 CC0（公有领域，可商用，不用署名）。2026-11-13 下载，下载前用户点过头。

| 文件 | 原图 | 来源 | 用在哪 |
|---|---|---|---|
| `dark_wood_diff_1k.webp` | `dark_wood_diff_1k.jpg` | https://polyhaven.com/a/dark_wood | 木头的颜色：架子、背板、地，拆包页的桌面 |
| `dark_wood_rough_1k.webp` | `dark_wood_rough_1k.jpg` | 同上 | 木头哪里亮哪里哑（灰度） |
| `book_pattern_nor_gl_1k.webp` | `book_pattern_nor_gl_1k.jpg` | https://polyhaven.com/a/book_pattern | 书布的凹凸：抽出来的那本书、牌背 |

原图是 1k 的 JPG（三张共 1.5 兆），用 `python3 -I tools/tex/to_webp.py` 转成 WebP（三张共 0.44 兆），手机上打开快。原图放在 `tools/out/tex-dl/`，不入库；要重转就按上面的地址重新下载到那里。

下载了没用上的（都在 `tools/out/tex-dl/`，不入库）：

- `dark_wood_nor_gl_1k.jpg`：这块木头的凹凸图几乎是平的，贴上看不出差别。
- `book_pattern_rough_1k.jpg`：半兆，换来的只是布面反光上一点点不匀。
- `rosewood_veneer1_*`（红木贴面三张）：和 dark_wood 在架子和桌面上并排比过，花纹是对称的大卷纹，铺在桌面上太花，抢牌的戏；架子的板窄，两种看不出分别。留了 dark_wood。
