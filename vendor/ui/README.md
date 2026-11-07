# vendor/ui · 邮差奇幻界面的定稿图与零件

风格按 `docs/ui-style-bible.md` 第四稿（青橙墓园）。全部由 `tools/ui/build_kit.py` 从本机的生图原件（`tools/out/`，不入库）生成，坐标与来源记在 `kit.json`。

## 来源与授权

- 所有图都是 2026-11-06 用 gpt-image-2（经 fal）按本仓库 `docs/ui-prompts.md` 登记的提示词生成的，提示词编号写在 `kit.json` 的 `prompt` 字段。
- 生成时拿用户自己收藏的一张参考图当风格锚（只学风格不抄内容），那张图不在仓库里。
- 图里没有任何字；站名、牌名、题签、夹名都由代码叠（`tools/ui/glow_text.py`、`tools/ui/shelf_books.py`）。
- 场景图已套定稿曲线（gamma 0.85，档案与笔记 0.9）。

## 目录

| 目录 | 内容 | 坐标字段 |
|---|---|---|
| `scenes/` | 首页大门（2:3）、宽柜（3:2，擦脸版）、碑林、骨臂、石台对开 | `plate` 站名牌，`boards` 路牌，`rows` 格层（领域牌、书脚、空腔高），`panels` 碑面，`books` 本子封面区，`pages` 对开两页 |
| `paper/` | 单页纸纹（已裁暗角） | 平铺或拉伸，正文底 `#EFE8D6` |
| `spines/` | 细书脊 `n01` 到 `n16`（优先），宽书脊 `wa_` `wb_` 各十六根 | 题签板在上三分之一到三分之二 |
| `covers/` | 书封面八本 | `plate` 题签板 |
| `notebooks/` | 本子封面六本 | `plate` 题签板，`name` 材质 |
| `cards/` | 羊皮纸牌正面、牌背 | `plate` 题签板，`seal` 蜡封位 |
| `seals/` | 状态印四枚：空圈没读、实心读了、羽毛批注、方印结卷 | `state` |

格式一律 WebP（场景 86、零件带透明通道 88），全套约 3.5 MB。坐标都是该图的像素坐标，场景不缩放；缩放时按比例换算。

## 令牌与组件

- `tokens.css`：颜色、字、形、影、光、时长，只放数值。
- `atoms.css`：瓷砖类（`.yx-tile-*`、`.yx-night`）、框（`.yx-ironplate`、`.yx-ruler`）、羊皮纸板（`.yx-panel`）、阅读页（`.yx-page`，`.night` 夜读）、控件（`.yx-btn glow|stone|ghost`、`.yx-input`、`.yx-toggle`、`.yx-tabs`、`.yx-seal`、`.yx-chip`）、卷轴弹窗（`.yx-scroll`）。图片路径相对本目录。
- `tiles/`：五块无缝瓷砖（石、铁、纸、天、木），`frames/`：铁牌九宫格与石尺三切，切线在 `kit.json`。
- 样子看 `docs/ui-atoms.html`。
