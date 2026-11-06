# tools/ui · 奇幻界面零件的生产线工具

总计划见 `docs/ui-system-plan.md` 第四节。生图用 `~/brain/3-Resources/media-toolkit/fal_image2.py`（`-i` 给参考图就走 edit 端点，最多 4 张，已验过余额与密钥），出来的图按下面四步进库。

| 步 | 脚本 | 做什么 | 出什么 |
|---|---|---|---|
| 抠底 / 拆表 | `cut.py` | 平色背景按 Lab 色键抠成透明，半透明边反算前景色去色溢；`--split` 把一张零件表按行列拆成多件 | 带透明的 PNG |
| 九宫格 | `nine.py` | 定四条切线，出 CSS `border-image` 片段、kit.json 条目、三种尺寸拉伸预览 | `*-nine.png`、`*-slices.png` |
| 瓷砖 | `tile.py` | 材质图做成无缝方砖，出 2x2 平铺预览和平均色 | `.webp` 方砖 |
| 对照墙 | `wall.py` | 把我们的件混进参考图里排墙、只标序号、答案另存；量明度 / 彩度 / 描边密度 / 饱和看是否离群 | `wall.png`、`wall-key.txt` |

生图约定：零件一律画在纯洋红 `#FF00FF` 平底上（厚涂里不会出现这个颜色），一张表放同类几件，留足间距；英雄物件一件一张。统一调色仍用 `tools/blender/web_props/comp_grade.py`。
入库路径：`vendor/ui/tiles/`、`vendor/ui/frames/`、`vendor/ui/icons/`、`vendor/ui/props/`，登记到 `vendor/ui/kit.json`。参考图只在本机（`tools/out/ui/ref/`，已 gitignore），不入库。
