# 实施计划：ConfigForm 全包当前契约 Hard Cut

## 0. 执行门禁

- [x] `task.py start` 后才开始改产品代码。
- [x] 开始前加载 `trellis-before-dev`，读取 ConfigForm core/designer/workbench 相关 spec、PRD、design 和 research。
- [x] 保留用户既有修改，不回滚或混入无关工作树文件。

## 1. 现状基线与边界测试

- [x] 记录当前 `git status`、ConfigForm 包列表、现有定向测试和 typecheck/build 基线。
- [x] 为 current-only parser、模板 manifest、存储 reset、公共 export 扫描和 Source export 语义缺陷先补失败测试。
- [x] 明确测试扫描排除 `.trellis/tasks/archive` 与 changelog，避免历史文本误报。

## 2. JSON current-only ingress

- [x] 重写 JSON ingress 为严格 current parser，删除 `legacyProject`、`legacyPage`、migration result/record/callback 和 Page Model v1 分支。
- [x] 将格式身份字段统一改为 `version`；定义并导出 `PAGE_TRANSFER_VERSION`，拒绝旧字段名而不提供别名。
- [x] 删除 component contract migration，改为身份重映射前 Registry exact match；更新类型、创建工作区诊断与 locale。
- [x] 更新 config/tree/json export、copy/download、preview 和创建 controller，保证从同一 pinned snapshot 读取。
- [x] 更新 JSON import 单测、Workbench component/E2E fixture，覆盖 current 成功和全部旧/裸/未来输入失败。

## 3. 模板 manifest 与 template UX

- [x] 让 `ProjectTemplateManifest.version` 成为唯一格式身份字段，删除旧内容修订语义。
- [x] 在 `catalog.ts` 严格要求 `version === PROJECT_TEMPLATE_VERSION`，allowed-key 明确拒绝旧字段名，并使用 canonical seed fingerprint。
- [x] 更新 built-in provider、preview revision、template tests、TemplateCreationWorkspace 和 locale，移除模板内容版本展示。
- [x] 增加 old/missing/future version、携带旧字段名、fingerprint 变化/稳定、provider seed clone 的测试。

## 4. IndexedDB 与其他持久化协议

- [x] 删除 IndexedDB v2→v3 manifest parser/migrator/upgrade 分支，并将存储格式字段统一为 `version`。
- [x] 旧 manifest 采用确定性拒绝/reset，禁止实体转换。
- [x] 增加 v2、未知、损坏 manifest 的 storage tests，并确认 Recovery Draft/Coordination/Runtime Host current v1 协议仍严格工作。

## 5. Model/Runtime/Headless 公共兼容面

- [x] 删除 Model component migration types、registry registration/accessors、import service migration path 和相关诊断成功分支。
- [x] 删除 Runtime renderer legacy node/event aliases、old props fallback 与对应公开类型；保留 current placement/span projection。
- [x] 删除 Headless deprecated exports、Workbench/template legacy identity helper 与当前文档中的别名说明。
- [x] 更新所有生产引用、测试、fixtures 和 package exports；增加 architecture scan 阻止旧 symbol 回归。

## 5.1 文件与导出结构重整

- [x] 重整 ConfigForm feature 根目录，按职责归位类型、组件、组合逻辑、状态、服务、schema、adapter、工具和 defaults。
- [x] 为 Runtime Renderer、根 ConfigForm、Element/Antd、Designer 与 Workbench 关键 feature 建立明确 barrel，避免平铺 concern 文件和跨 feature 深层导入。
- [x] 删除短 alias，统一当前事件与节点 identity 命名，移除旧入口。
- [x] 将当前 Registry/模板检查命名收敛为 requirements/eligibility/validation，保留 exact current validation。
- [x] 更新各包根 `index.ts`、package README、type tests 和 architecture scan；根 barrel 只导出当前 API。
- [x] 扫描生产源码，确认没有 deprecated/legacy/migration/compat 入口。

## 6. Source export 语义一致性

- [x] 从 canonical compiler snapshot 投影 required/validation/validateOn、Zod/custom validator、字段 transform 和 tablet/mobile layout overrides。
- [x] 确保 Preview、Config export、Tree export、Source export 使用同一 revision/page，页面缺失时进入 unavailable state 而非空导出。
- [x] 增加 generator 单测和 browser assertions，覆盖 Element Plus/Ant Design Vue、响应式断点和校验行为。

## 7. 文档、CI 与全量验证

- [x] 更新 `packages/ConfigForm/README.md`、当前 package docs、locale、examples；删除当前文档中的旧迁移合同，保留归档历史。
- [x] 更新 ConfigForm package gate、Workbench private gate、typecheck/build、JSON Import E2E 和 architecture scan。
- [x] 加载 `trellis-check` 做跨包检查并重复验证至通过。
- [x] 核对 current-only policy、统一 version/fingerprint 和 storage reset 已写入 spec。

## 8. 完成门禁

- [x] `git diff --check` 通过；检查无未授权文件变更。
- [x] 运行定向测试、Workbench 全量测试、typecheck、build、E2E 和架构扫描，记录命令与结果。
- [x] 区分本任务改动与 release 工作流的独立 dirty 文件；不 push、不 amend。

## 9. 实际验证（2026-09-05）

- 实现提交：`4325cff4`；后续模板与 Designer 提交未重新引入旧契约。
- `pnpm test:config-form-packages`：14 个 ConfigForm 构建任务通过，公开包边界验证通过。
- `pnpm --filter @config-form/workbench test`：51 个测试文件、461 个测试通过。
- `pnpm --filter @config-form/workbench typecheck`、`build`、`verify:templates`：通过；两个独立导出项目均完成安装、类型检查与构建。
- `pnpm --filter @config-form/workbench test:e2e`：78 个 Chromium 场景通过。
- `pnpm lint`、`pnpm test:package-architecture`、`git diff --check`：通过；架构诊断为 33 个包、0 条 debt。
