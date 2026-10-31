# 表的 Schema（JSON Schema draft-07）

七张表：objects、rooms、vis、props、items、economy、sound；两类文件：presets/<房>.json（固定布局，实体-组件）、placements（用户存档）。
组件 JSON 的外形（照 OpenRA 的教训，现在定死）：`components` 是 `{组件名: {字段}}`；同类多实例用 `组件名@标签`；实体可 `extends: "^模板"`，模板在 preset 的 `templates`；写 `"-组件名": null` 表示从模板里删掉。存档只存类型加差异，带 `format` 号。
校验：`python3 tools/tables_check.py`（进 world_test 前置）。
