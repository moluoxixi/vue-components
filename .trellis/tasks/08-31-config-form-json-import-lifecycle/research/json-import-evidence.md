# JSON 导入证据记录

## 当前协议

- `packages/ConfigForm/model/src/types.ts`：`PROJECT_DOCUMENT_VERSION = 4`、`PAGE_GRAPH_VERSION = 2`；Project/Page/Registry/Resource 均为 JSON-safe canonical model。
- `packages/ConfigForm/model/src/schema.ts`：Zod strict schema、污染键拒绝、graph hierarchy/field/reaction/Flow/project invariants；`parseProjectDocument` 已提供稳定 diagnostics。
- `packages/ConfigForm/workbench/src/features/export/ExportDialog.vue`：JSON 直接来自 `snapshot.compilation.snapshot.document`，不是 TypeScript Source 的反向解析。
- `packages/ConfigForm/workbench/src/project/export/config.ts`：Config Source 是 canonical IR 的只读投影，不应成为 JSON import parser。

## 可复用创建边界

- `packages/ConfigForm/workbench/src/app/workbench-controller.ts`：模板 Project 已实现 repository create→open→delete compensation；Page 已实现 full candidate preflight→single page.add command。
- `packages/ConfigForm/workbench/src/project/identity-remap.ts`：已覆盖 hierarchy、field、condition、reaction、Flow trigger/node/edge/typed config 引用。
- `packages/ConfigForm/workbench/src/project/templates/service.ts`：已使用 canonical compiler 与 isolated Runtime preview，原始 provider seed 不进入 Runtime。

## 历史迁移证据

`git show 4325cff4^:packages/ConfigForm/model/src/legacy.ts` 与 `migrate.ts` 证明：

- `LEGACY_PROJECT_DOCUMENT_VERSION = 3`，与 v4 唯一差异是 Flow 从 `PageGraph.flows` 迁到 `ProjectPage.flows`。
- `LEGACY_LOW_CODE_PAGE_MODEL_VERSION = 1` 使用树形 `nodes/children/slots/span`，存在确定性到 PageGraph v2 的迁移算法。
- 旧 Workspace Application v2 和 DesignerDocument v1 是不同产品/编辑协议，不属于当前 Config Model JSON import。

`4325cff4` 有意 hard cut 运行时兼容模块，因此新迁移只能位于显式 import ingress，不能重新接入 Repository 自动读取。

## 性能与限制依据

- Model production performance 已覆盖 2000 节点；导入上限采用 4096 节点，在留有增长空间的同时避免 UI/compile 被任意载荷拖垮。
- 模板 provider 已采用 4096 array item 限制；导入沿用同一单数组边界并额外增加 2 MiB、64 depth、100000 structural entry、128 page 总预算。

## 成熟库选择

- 运行时解析继续使用原生 `JSON.parse` + 仓库既有 Zod schema，不引入第二套语义 parser。
- 文件交互复用 Element Plus `ElUpload`，关闭 auto upload，仅使用本地 File API。
- Round-trip 属性测试使用 `fast-check`，不自造随机生成框架。
