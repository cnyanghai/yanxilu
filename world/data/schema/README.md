# 表的 Schema（JSON Schema draft-07）

七张表：objects、rooms、vis、props、items、economy、sound；两类文件：presets/<房>.json（固定布局，实体-组件）、placements（用户存档）。
组件 JSON 的外形（照 OpenRA 的教训，现在定死）：`components` 是 `{组件名: {字段}}`；同类多实例用 `组件名@标签`；实体可 `extends: "^模板"`，模板在 preset 的 `templates`；写 `"-组件名": null` 表示从模板里删掉。存档只存类型加差异，带 `format` 号。
校验：`python3 tools/tables_check.py`（进 world_test 前置）。

格式（2026-10-31 用户定）：一切坐标与尺寸用厘米整数、绝对坐标（原点房间中心，x 右、z 向镜头、y 上），占地是宽 × 深，不存格号；格子大小是房间表的参数（默认 25），只用于吸附、寻路、校验；每个文件带 `format` 与 `units`；用户摆的每件带 `uid`。

第八张表 tiles（2026-11-01，照暗黑的瓦片集）：地面块按格铺、墙段沿格边拼、屋顶整层。rooms 的 tiles 层：cell、floor 网格、walls 线段（side / from / to，按格边计数，四边各自要正好覆盖一遍）、roof。

2026-11-01 排练阶段二后，preset 的组件增补（都可选，照暗黑 2 预设的 16 种组件取舍）：`Transform.rot`（三轴度数）与 `Transform.scale`；`Prefab`（整包放置）、`Variation`（按权重选模型）、`Light`（点 / 聚）、`Vfx`、`Audio`、`Stamp`（地形印章改层）、`Decal`（投影贴花）；`Model.floor`（贴地网格）、`Model.wallFade`（挡人淡出）；`Tier` 允许 -1；顶层可选 `prefabs`（内联）与 `dependencies`（由 tables_check 生成的预载清单）。依据见 design/studio/REHEARSAL.md 阶段二。
