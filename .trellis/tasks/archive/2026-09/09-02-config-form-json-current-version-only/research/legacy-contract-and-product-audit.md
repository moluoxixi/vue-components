# 旧契约与产品完整性审计

## 结论

不能断言“除 Project v3 / Page v1 外所有旧契约都已移除”。当前仍有 Registry 组件迁移公共 API、IndexedDB manifest v2→v3、本地/公共薄兼容别名，以及 Runtime legacy shape fallback。

当前功能足够作为本地、受控组件、Design-first 的表单设计与源码生成工具，但不足以无条件称为无需开发者接线即可上线的通用低代码表单平台。

## 用户决策

- ConfigForm 尚未上线，所有包都不需要旧契约兼容；旧开发数据可直接失效。
- 删除范围包含 JSON、Registry 公共迁移 API、IndexedDB 存储迁移、Runtime legacy aliases、deprecated exports 与内部 legacy helpers。
- 产品采用本地 Design-first 设计与源码生成器定位，业务 API、权限和部署由开发者接线。
- Source export 的 validation/validateOn 与响应式语义缺失属于上线阻断缺陷，按推荐立即纳入后续实施。
- Page JSON 采用统一字段名 `PageTransferDocument.version: 1` 与 Registry subset lock，不再接受裸 Page。
- Template manifest 采用统一字段名 `version: 1` 作为格式身份；原内容修订用途的 `version` 不另存，预览/缓存身份改用规范化 seed 内容指纹。

## 真实旧兼容面

- JSON Project v3→v4 与 Page Model v1→PageGraph v2：`packages/ConfigForm/workbench/src/project/import/migrations.ts:140`、`:187`、`:286`。
- Registry component migration 公共 API：`packages/ConfigForm/model/src/types.ts:95`、`packages/ConfigForm/model/src/registry.ts:140`、`packages/ConfigForm/workbench/src/project/import/service.ts:128`。
- IndexedDB manifest v2→v3：`packages/ConfigForm/workbench/src/project/project-document-repository-indexed-db.ts:27`、`:259`、`:580`。
- Runtime legacy node/event aliases 与 fallback：`packages/ConfigForm/runtime/src/renderer/types.ts:33`、`:118`，`ConfigFormRenderer.vue:294`、`:418`。
- Deprecated Headless exports：`packages/ConfigForm/headless/src/utils/install.ts:3`。
- Workbench template identity legacy helpers：`packages/ConfigForm/workbench/src/project/templates/index.ts:78`。

## 不是旧兼容

- Flow/Plan/Runtime v1、Registry Snapshot v1、Recovery Draft v1、Coordination Protocol v1 和 RuleSet v1 都是当前唯一合同；非当前版本会被严格拒绝。
- Runtime-compatible numeric span 是 PageGraph placement 到当前 Runtime 字段 API 的投影，不是旧模型迁移。
- Template manifest 原 `version` 仅服务于展示与预览缓存身份，当前没有外部发布消费者；不保留其内容修订语义，改由统一的格式身份 `version: 1` 负责 wire-format gate。所有 `schemaVersion`、`protocolVersion`、`storageSchemaVersion` 字段名均不再作为兼容别名。

## Strict Current-Only 缺口

- Project v4 Import 当前重建 Registry lock，而不是验证源 lock 完整 exact match。
- 裸 PageGraph v2 没有 Registry lock，无法证明来源 component contract 是当前版本。
- 当前生产 adapters 未注册 component migrations，但 Model 公共迁移能力仍存在。

## 功能完整性风险

- P0：Standalone Source export 未保留 validation/validateOn，也未准确消费 tablet/mobile 响应式覆盖。
- P1：Workbench Flow 真实 Action 仅有 notify；API、导航等需要宿主或导出后开发者接线。
- P1：Workbench 没有动态 optionResolver/custom validator 的产品集成入口，Source 还会删除 optionSource。
- P1：根 build/test 和 CI 没有自动覆盖 private Workbench，当前全绿主要依赖手动门禁。
- 产品边界：重复字段、文件/资源、发布部署等是否必要，取决于目标是生成器还是完整业务表单平台。

## 代码组织审计

- Runtime 的 Element/Antd 包已经有 `src/types/props.ts`、`expose.ts`、`index.ts`，FormNode 等内部组件也有部分拆分；但 Renderer、Designer Canvas/PropertyPanel 和 Workbench 多数复杂 Vue 组件仍把 props/emits/公开方法内联在 `.vue`。
- Runtime Renderer 当前存在 `id`/`nodeId` 双字段、`onEvent`/`interceptEvent` 双事件入口、`getNodeId` 旧节点解析、`data-node-id` 历史 DOM alias 以及 `RuntimeEditorBridge`/`RuntimeNodeMetadata`/`RuntimeEditorEventContext` 短别名。
- Headless `withInstall`/`InstallableComponent` 仍标记 deprecated；Workbench import、IndexedDB、preview/template 仍有 migration/fallback 生产路径或公开类型。
- 已确认的目标组织：feature 根目录只放 `index.ts` 与可选 `index.vue`；类型集中到 `types/`，其他组件、组合逻辑、状态、服务、schema、adapter、工具分别放入同职责目录，每层 `index.ts` 汇总；删除旧 alias、deprecated export、migration/fallback 入口，不用 barrel 保留旧 subpath。

## 文档同步锚点

- `packages/ConfigForm/README.md:123`、`:125`、`:195`。
- `.trellis/spec/config-form-designer/frontend/state-management.md:1092` 起的 JSON Import Ingress 章节。
- README 的 RuntimeHost 版本文字与当前 protocol v3 存在漂移，需要独立校正。
