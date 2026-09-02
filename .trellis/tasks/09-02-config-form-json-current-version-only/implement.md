# 实施计划：ConfigForm 全包当前契约 Hard Cut

## 0. 执行门禁

- [ ] `task.py start` 后才开始改产品代码。
- [ ] 开始前加载 `trellis-before-dev`，读取 ConfigForm core/designer/workbench 相关 spec、PRD、design 和 research。
- [ ] 保留用户既有修改，特别是 `packages/ConfigForm/designer/src/registry/types.ts`，不回滚、不暂存，除非后续证明必须配合修改。

## 1. 现状基线与边界测试

- [ ] 记录当前 `git status`、ConfigForm 包列表、现有定向测试和 typecheck/build 基线。
- [ ] 为 current-only parser、模板 manifest、存储 reset、公共 export 扫描和 Source export 语义缺陷先补失败测试。
- [ ] 明确测试扫描排除 `.trellis/tasks/archive` 与 changelog，避免历史文本误报。

## 2. JSON current-only ingress

- [ ] 重写 `workbench/src/project/import/migrations.ts` 为严格 current parser，删除 `legacyProject`、`legacyPage`、migration result/record/callback 和 Page Model v1 分支。
- [ ] 将 `ProjectDocument.schemaVersion`、`RegistryContractSnapshot.schemaVersion`、Page transfer `schemaVersion` 统一改为 `version`；定义并导出 `PAGE_TRANSFER_VERSION`，拒绝旧字段名而不提供别名。
- [ ] 在 `service.ts` 中删除 component contract migration，改为身份重映射前 Registry exact match；更新 `types.ts`、创建工作区诊断与 locale。
- [ ] 更新 config/tree/json export、copy/download、preview 和创建 controller，保证从同一 pinned snapshot 读取。
- [ ] 更新 JSON import 单测、Workbench component/E2E fixture，覆盖 Project v4/PageGraph v2 成功和全部旧/裸/未来输入失败。

## 3. 模板 manifest 与 template UX

- [ ] 在 `templates/types.ts` 让 `ProjectTemplateManifest.version` 成为唯一格式身份字段，删除其旧内容修订语义和 `ProjectTemplate.version`（若该字段仅为同一旧内容版本）。
- [ ] 在 `catalog.ts` 严格要求 `version === PROJECT_TEMPLATE_VERSION`，allowed-key 明确拒绝 `schemaVersion`/`protocolVersion`/`storageSchemaVersion`；增加 canonical seed fingerprint helper。
- [ ] 更新 built-in provider、create-template、service preview revision、template tests、TemplateCreationWorkspace 和 locale，移除模板版本展示。
- [ ] 增加 old/missing/future version、携带旧字段名、fingerprint 变化/稳定、provider seed clone 的测试。

## 4. IndexedDB 与其他持久化协议

- [ ] 删除 `project-document-repository-indexed-db.ts` 的 v2→v3 manifest parser/migrator/upgrade 分支，并将存储格式字段统一为 `version`。
- [ ] 设计旧 manifest 的确定性 reject/reset：记录 diagnostic，清理旧开发 namespace 或切换明确的新 namespace；禁止实体转换。
- [ ] 增加 v2、未知、损坏 manifest 的 storage tests，并确认 Recovery Draft/Coordination/Runtime Host current v1 协议仍严格工作。

## 5. Model/Runtime/Headless 公共兼容面

- [ ] 删除 Model component migration types、registry registration/accessors、import service migration path 和相关诊断成功分支。
- [ ] 删除 Runtime renderer legacy node/event aliases、old props fallback 与对应公开类型；保留 current placement/span projection。
- [ ] 删除 Headless deprecated exports、Workbench/template legacy identity helper 与 current 文档中的别名说明。
- [ ] 更新所有生产引用、测试、fixtures 和 package exports；增加 architecture scan 阻止旧 symbol 回归。

## 5.1 文件与导出结构重整

- [ ] 重整 ConfigForm feature 根目录：只保留 `index.ts` 与可选 `index.vue`；将 props/emits/expose/slots/领域纯类型放入 `types/`，将组件、组合逻辑、状态、服务、schema、adapter、工具、运行时 defaults 分别放入对应职责目录；Expose 代理实现放入 composables/services。
- [ ] 为 Runtime Renderer、根 ConfigForm、Element/Antd、Designer Canvas/PropertyPanel/DesignSurface 和 Workbench import/export/template/persistence 建立 feature barrel 与每个职责目录的 `index.ts`，避免平铺 concern 文件和跨 feature 深层导入。
- [ ] 删除 `RuntimeEditorBridge`、`RuntimeNodeMetadata` 等短 alias，统一 `interceptEvent`/节点 identity 单一命名；移除 `onEvent`、`getNodeId`、`data-node-id` 等旧入口。
- [ ] 将模板/Registry 当前合同的 `compatibility` 服务和 UI 命名收敛为 requirements/eligibility/validation；保留 exact current validation，禁止演变为版本兼容入口。
- [ ] 更新各包根 `index.ts`、package README、type tests 和 architecture scan；根 barrel 只导出当前 API，不保留旧 subpath/别名转发。
- [ ] 扫描生产源码，确认没有 deprecated/legacy/migration/compat 入口；区分当前默认值/错误恢复与旧契约 fallback，禁止后者。

## 6. Source export 语义一致性

- [ ] 从 canonical compiler snapshot 投影 required/validation/validateOn、Zod/custom validator、字段 transform 和 tablet/mobile layout overrides。
- [ ] 确保 Preview、Config export、Tree export、Source export 使用同一 revision/page，页面缺失时进入 unavailable state 而非空导出。
- [ ] 增加 generator 单测和 browser assertions，覆盖 Element Plus/Ant Design Vue、响应式断点和校验行为。

## 7. 文档、CI 与全量验证

- [ ] 更新 `packages/ConfigForm/README.md`、当前 package docs、locale、examples；删除当前文档中迁移/旧版本/模板 `version` 合同，保留归档历史。
- [ ] 更新 ConfigForm package gate、Workbench private gate、typecheck/build、JSON Import E2E 和 architecture scan。
- [ ] 加载 `trellis-check` 做跨包检查；按 package spec Quality Check 逐项执行，修复后重复检查直到通过。
- [ ] 加载 `trellis-update-spec`，把本次 current-only policy、统一 version/fingerprint 和 storage reset 经验写入 spec（已有内容则核对一致性）。

## 8. 完成门禁

- [ ] `git diff --check` 通过；检查无未授权文件变更。
- [ ] 运行定向测试、Workbench 全量测试、typecheck、build、E2E 和架构扫描，记录命令与结果。
- [ ] 按 Trellis 3.4 规则区分本轮编辑与未识别 dirty 文件，提交前向用户提供一次性 commit plan；不 push、不 amend。
