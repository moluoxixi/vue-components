# ConfigForm 全包当前契约 Hard Cut

## 目标与用户价值

ConfigForm 仍处于开发阶段，不保留任何旧版本、deprecated alias、legacy fallback、存储迁移或公共迁移扩展点。所有包只写入和接受当前契约，旧开发数据允许失效。产品定位为本地、受控组件、Design-first 的表单设计与源码生成工具；同时修复 Source 导出丢失当前校验和响应式语义的上线阻断缺陷。

## 需求

- 所有格式/协议身份版本统一使用字段名 `version`；Project 导入只接受 `version: 4`。
- Page 导入只接受 `graph.version: 2`。
- Page JSON 使用 current `PageTransferDocument`：固定 `kind`、统一 `version: 1`、页面实际使用组件的 Registry subset lock 与 `ProjectPage`；拒绝裸 `ProjectPage/PageGraph`。
- Project v3、Page Model v1 及其他非当前版本不得迁移、预览或创建。
- 代码库不再保留旧版本迁移实现、迁移结果、迁移文案或迁移测试。
- 删除 Model Registry component migration 公共 API、诊断成功分支和 Workbench import migration 链。
- 删除 IndexedDB manifest v2→v3 迁移；旧开发存储必须被明确拒绝或通过新 namespace/reset 失效，不得重写成当前格式。
- 删除 Runtime legacy node id/event aliases/fallback、Headless deprecated exports、Workbench/template legacy helpers 及其他已确认的薄兼容 API。
- 所有 ConfigForm feature 按职责分目录：根目录只保留 `index.ts` 与可选 `index.vue`；纯类型统一进入 `types/`（其中管理 `props.ts`、`emits.ts`、`expose.ts`、`slots.ts` 和领域类型），组件、组合逻辑、状态、服务、schema、adapter、工具、运行时默认值分别进入 `components/`、`composables/`、`state/`、`services/`、`schemas/`、`adapters/`、`utils/`、`defaults/`，每个存在的职责目录由自己的 `index.ts` 汇总；Expose 代理等运行时逻辑不得混入 `types/`。
- 删除所有旧 subpath 转发、短类型 alias、重复事件/identity 名称和 compatibility wrapper；当前 Registry/模板要求检查保留为严格 validation/eligibility，不以 compatibility/migration 抽象存在。
- 模板 manifest 严格校验统一的 `version: 1`；原内容修订 `version` 不保留为独立字段，预览/缓存身份使用规范化 seed 内容指纹。旧/未来/缺失 version 或 `schemaVersion`/`protocolVersion`/`storageSchemaVersion` 等非统一字段一律拒绝。
- 所有 ConfigForm 包后续变更都遵循 `.trellis/spec/config-form-core/frontend/architecture-documentation.md` 的 current-contract-only policy。
- 当前唯一版本恰为 v1 的 Flow、Registry Snapshot、Recovery Draft、Coordination Protocol 和 RuleSet 继续保留，并严格拒绝其他版本。
- 版本不支持时返回稳定、可本地化且指向版本字段的诊断。
- 当前版本的严格校验、预算限制、Registry 校验、身份重映射、隔离预览和创建生命周期保持不变。
- “当前版本”不能只按 Project/Page 结构版本判断；Project Registry lock 必须与当前 Registry 完整精确匹配。
- Standalone Source export 必须保留 Compiler 已验证的 `validation`、`validateOn` 和 tablet/mobile 响应式布局语义；Preview、Config export 与 Source export 不得语义漂移。
- Workbench 作为本地源码生成器，不扩张为无需开发者接线即可上线的通用业务表单平台。

## 已确认事实

- `packages/ConfigForm/workbench/src/project/import/migrations.ts:286` 是文档版本入口；当前显式接受 Project v3 与 Page Model v1，并分别调用 `legacyProject`、`legacyPage`。该入口及其字段名将在 hard cut 中统一为 `version`。
- `packages/ConfigForm/workbench/src/project/import/service.ts:112` 还提供另一类兼容：在 Project v4 内把旧 `ComponentContract.contractVersion` 迁移到当前 Registry 合同。
- `packages/ConfigForm/workbench/src/features/templates/JsonImportPane.vue:346` 会展示所有迁移记录；即使没有迁移也显示“无需迁移”。
- `IMPORT_VERSION_UNSUPPORTED` 已是稳定双语诊断，可继续用于拒绝旧文档版本，并保留准确 JSON path。
- IndexedDB manifest v2→v3 虽是本地持久化升级而非 JSON 导入，但根据全包 hard-cut 决策也必须删除。
- 当前 Project v4 导入会重建 Registry lock，可能让不完整或伪造的旧 lock 静默变成当前 lock；严格 current-only 必须改成导入前 exact match。
- 裸 PageGraph v2 不携带 Registry lock，无法证明来源组件契约是当前版本；已决定使用带 Registry subset lock 和统一 `version: 1` 的 current Page envelope。
- Model 仍公开提供组件 contract migration API；当前 Element Plus/Ant Design Vue 生产 Registry 没有注册 migration，因此能力存在但生产路径暂时不可命中。
- 除 JSON 导入外仍存在真实兼容面：IndexedDB manifest v2→v3、Runtime 公共 API legacy aliases/fallback、deprecated Headless/Workbench exports、模板旧 identity helper。
- Flow v1、Registry Snapshot v1、Recovery Draft v1、Coordination Protocol v1 和 RuleSet v1 均是当前唯一版本，不是旧版兼容。
- 功能完整性审计发现 Source export 丢失 validation/validateOn 与显式响应式布局语义，属于现有 Preview/Source 一致性目标内的上线阻断缺陷。

## 验收标准

- [x] 导入 Project v3 时在分析阶段失败，不产生预览或创建入口。
- [x] 导入 Page Model v1 时在分析阶段失败，不产生预览或创建入口。
- [x] Project v4 与 PageGraph v2 的导入、预览和创建回归通过。
- [x] Current Page JSON 导出/导入只使用 `PageTransferDocument version: 1`，裸 Page 或旧/未来 envelope 被拒绝。
- [x] 模板 Provider 只接受 current manifest `version: 1`，旧/未来/缺失 version 或携带非统一版本字段均被拒绝，预览/缓存使用规范化内容指纹。
- [x] 产品 UI 不再出现“迁移记录”“无需迁移”或任何旧版本兼容提示。
- [x] 源码、测试、当前文档与规格中不再存在 Project v3→v4、Page v1→v2 的可执行迁移合同；归档历史保留。
- [x] Project v4 的 Registry adapter/version/fingerprint、组件 key 集合、contractVersion/fingerprint 与当前 Registry 完整精确匹配，否则拒绝导入。
- [x] ConfigForm 生产源码与公共 exports 中不存在 legacy/deprecated/migration alias、fallback 或兼容入口；当前协议和必要的当前层间投影不被误删。
- [x] 所有 feature 都能通过职责目录定位类型、组件、状态、服务、schema、adapter 与工具；feature/职责目录各有唯一 `index.ts`，根目录不存在平铺的 props/expose/state/service/helper 文件，package root 不包含旧 alias/subpath 转发。
- [x] 旧 IndexedDB manifest 不会被迁移成当前格式，并有确定性的开发态拒绝/reset 行为。
- [x] Source export 的 required/Zod/custom validation、`validateOn`、tablet/mobile responsive overrides 与 Preview/Config export 语义一致。
- [x] Architecture tests 防止旧契约、公共迁移 API 和兼容别名重新进入任一 ConfigForm 包。
- [x] 定向单测、Workbench 全量单测、typecheck、build 与 JSON Import E2E 通过。
- [x] 根 ConfigForm package gate 与 Workbench CI/浏览器门禁覆盖本次跨包 hard cut 和 Source 导出回归。

## 产品定位与范围外

- 不提供旧 JSON 的离线转换工具。
- 不为旧开发数据提供备份、转换、升级或恢复工具。
- 不因数字为 `1` 而修改仍是当前唯一合同的协议版本。
- 不把当前层间适配（例如 PageGraph placement 到 Runtime span）误判为旧版兼容。
- 不删除 changelog 与归档任务中的真实历史；当前 README、spec、源码、fixture 和可执行示例必须只描述当前合同。
- 不建设账号、云同步、多人协作、权限、在线发布、审批/BPMN 或任意脚本执行。
- API action、动态选项、重复字段和文件资源不在本轮扩张；产品仍是导出后由开发者接线的本地生成器。
