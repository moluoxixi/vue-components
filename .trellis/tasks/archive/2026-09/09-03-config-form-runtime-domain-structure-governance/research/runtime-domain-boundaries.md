# Runtime/Domain 结构调研摘要

## 精确债务

- Antd/Element `src/index.vue`：single-feature，owner 为各自 `src/services/install.ts`，目标 `src/services/components/`。
- Playground `AntdConfigForm.vue`/`ElementConfigForm.vue`：single-parent，owner 为 `examples/ConfigForm.vue`，目标 `examples/ConfigForm/components/`。
- Runtime `src/errors/index.ts`：logic barrel，类实现移入具名 service module。

## 热点与不可变合同

- Model transactions 1362 行：公开三个 apply API；必须保持 batch 原子性、inverse 反序、evolving command draft、Registry lock、semantic no-op 与 change-set。
- Compiler compile 1175 行：公开 canonical project/page 与 coordinator；必须保持 incremental/cache/diagnostic 语义。
- Runtime renderer 1091 行：公开 props/emits/slots/expose；必须保持 model/meta、Design guard、editor registration、render/slot/binding 与 Flow event 顺序。
- Playground Provider 示例 927/1074 行：必须保持顶层 glob 只发现父 example，并同步 Devtools fixture path。
- Headless controller 640 行、Runtime validation 584 行：分别保持 callback 顺序、async stale guard、queue/snapshot/timer/dispose 合同。

## 依赖方向

```text
Model -> Compiler -> Workbench projection
Headless -> Runtime renderer -> Provider wrappers
Runtime renderer editor bridge -> Designer/Workbench host
Playground parent -> Provider scenario children
```

Geometry 继续属于 Workbench runtime-host；Provider 与 Playground 不建立跨 adapter shared service。
