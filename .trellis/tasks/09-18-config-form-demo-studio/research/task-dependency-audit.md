# Research: ConfigForm Demo Studio 子任务依赖审计

- Query: 审计七个子任务的实施顺序、隐藏依赖、现有代码差距，并确定 Source 包的正确抽离时机与所有权边界。
- Scope: internal
- Date: 2026-09-18

> 状态更新：后续 `config-form-studio-contracts/design.md` 已将共享包定型为 `@moluoxixi/config-form-prototype-runtime`，并固定 Source-owned provider-neutral resolver。本文中“仍待定”的表述仅保留为研究时点记录，实施以合同设计为准。

## Findings

### 结论：推荐实施顺序

```text
config-form-studio-contracts
  -> config-form-surface-foundation
  -> config-form-studio-assets
  -> config-form-studio-datasets
  -> config-form-studio-materials
  -> config-form-studio-interactions
  -> config-form-source-package
```

这是完整验收顺序，不代表所有代码都必须串行：

- `surface-foundation` 完成后，`studio-assets` 与 `studio-materials` 中不依赖 Dataset 的基础物料、布局和视觉 Token 工作可以局部并行。
- `studio-materials` 的完整验收不能早于 `studio-datasets`。Table/List 的 Dataset 投影、筛选、排序、分页、选择和 `item` 上下文都依赖稳定的数据合同。
- `studio-interactions` 必须等待资产导航、Dataset 以及具有语义触发器的物料稳定，否则参数/结果、行激活和浮层入口会反复改合同。
- `source-package` 必须最后实施。它消费前六项的最终 Canonical IR、Prototype Runtime 和物料 resolver，而不是为这些合同提供临时兼容层。

### 规划中需要先修正的两处依赖

1. `studio-assets` 的 R4 反向依赖尚未存在的交互作者能力。

   `.trellis/tasks/09-18-config-form-studio-assets/prd.md:16` 要求“从交互配置中选择已有浮层或原子地新建、绑定并打开新 Surface”，但该任务的职责应仅是资产和设计面。建议拆分为：

   - `studio-assets` 提供与入口无关的 Surface 创建、选择、打开命令，以及调用路径展示所需的导航能力。
   - “从交互编辑器原子创建、绑定并打开”移入 `studio-interactions`，由交互事务拥有绑定语义。

   这样 `studio-assets` 不需要等待 `studio-interactions`，同时不会在两个任务中各实现一套创建流程。

2. `studio-materials` 漏写 Dataset 前置条件。

   `.trellis/tasks/09-18-config-form-studio-materials/prd.md:15` 已要求 Table/List 绑定 Dataset 投影；`:24` 和 `:25` 又要求跨设计/体验/Runtime/Source 一致，并验收本地数据视图行为。因此完整任务应显式增加 `config-form-studio-datasets` 为前置条件。若确实需要并行，只能将基础物料、布局和视觉 Token 作为前置批次，Dataset 集成仍作为后置验收门禁。

### 当前实现与目标合同的主要差距

- Model 仍是 Page-only。`packages/ConfigForm/model/src/types/contracts.ts:202` 到 `:204` 使用 `homePageId/pageOrder/pagesById`，尚无统一 `SurfaceAsset` 表。
- Compiler IR 同样是 Page-only。`packages/ConfigForm/compiler/src/types/compiler.ts:119` 到 `:121` 仍输出 `homePageId/pageOrder/pagesById`。因此资产、交互和 Source 都不能在 foundation 前建立最终形状。
- Designer Inspector 当前精确只有 `properties/validation`。`packages/ConfigForm/designer/src/inspector/types/domain.ts:8` 到 `:9` 没有 `interaction`。
- 设计画布当前固定禁用真实交互。`packages/ConfigForm/designer/src/components/DesignSurface/index.vue:282` 传入 `interactive="false"`，Design/Experience 模式尚未形成。
- Workbench 左侧仍是 `components/layers/pages/data/history`。`packages/ConfigForm/workbench/src/app/components/StudioLeftPanel/index.vue:27` 到 `:31` 尚不是 Pages/Dialogs/Drawers/Datasets/Resources 资产树。
- Workbench 仍暴露动态 Data Source 作者 UI，包括 URL、请求参数、headers、body、dependencies、cache 和 mapping；入口从 `packages/ConfigForm/workbench/src/features/data/components/DataWorkspace/index.vue:236` 的 URL 编辑开始。这与“Studio Demo 只使用静态 Dataset”边界冲突，需在合同任务先明确移除范围。
- 现有 reaction executor 不能直接充当新的值动作执行器。`packages/ConfigForm/core/src/reaction/services/evaluate.ts:64` 接收初始值后立即遍历规则，并在 `:82` 到 `:89` 执行 `setValue/clearValue`；新合同要求状态表达式初始化即计算，但值动作只在用户字段变更后执行。

### Source 包必须最后实施

当前生成器和 Viewer 不是可直接移动的最终实现：

- 生成器位于 Workbench，且只遍历 Page。`packages/ConfigForm/workbench/src/project/export/services/source.ts:43` 到 `:44` 从 `pageOrder/pagesById` 取页面，尚无 Dialog/Drawer、overlay host、Dataset、Resource、主题或 Prototype Interaction 的最终输出。
- Resolver 的接口当前由 Workbench 私有定义，见 `packages/ConfigForm/workbench/src/project/export/types/bindings.ts:39`；WorkBench 又在 `packages/ConfigForm/workbench/src/adapters/services/load.ts:36` 从 Designer adapter capability 组装它。若现在抽包，Source 很容易反向依赖 Designer 或 Workbench。
- 导出 UI 混合了 Viewer 与应用命令。复制位于 `packages/ConfigForm/workbench/src/features/export/index.vue:196`，单文件下载位于 `:214`，ZIP 位于 `:245`，Dialog 从 `:265` 开始。这些命令应继续由 Studio 拥有。
- 当前 Monaco 组件仍是编辑器：`packages/ConfigForm/workbench/src/features/export/components/WorkspaceCodeEditor/composables/use-workspace-code-editor.ts:94` 发布内容变更，`:122` 开启 hover，`:132` 到 `:154` 开启提示能力，`:156` 注册保存快捷键。新 Viewer 应是只读文件查看组件，不能把这些行为原样迁移。
- `.trellis/config.yaml:212` 已登记 `config-form-source`，但 `packages/ConfigForm/source` 当前不存在。创建包时还需更新 `packages/ConfigForm/workbench/src/app/__tests__/architecture-boundary.test.ts:33` 的精确 `sourceRootFileAllowlist`。
- 最终文件树还取决于 Surface Canonical IR、运行实例栈、参数/结果合同、Dataset/Resource/主题输出以及新物料 binding。任何一项未稳定都会迫使 Source 包重复破坏性改版。

推荐最终所有权：

- Source 包拥有无 DOM Generator、`SourceFileSet`、文件树模型和只读 `ConfigFormSourceViewer`。
- Studio 拥有导出弹窗、重新生成、复制、单文件下载、ZIP、通知和持久化。
- Studio 直接消费新 Viewer；不保留旧 Workbench wrapper、别名或 re-export。
- Generator 只依赖稳定的 ProjectCompilation、公开 resolver 合同和纯数据，不依赖 Designer、Workbench 或 DOM。
- Resolver 接口可由 Source 包拥有；Studio 在应用组合根读取 adapter metadata 并注入实现，Source 不反向导入 adapter 或 Designer。

### 长期文档与规范更新路径

合同子任务必须同步修订下列现有事实源，避免新 PRD 与旧 Runtime-first/Designer Lite 规范长期冲突：

- `packages/ConfigForm/PRODUCT.md`
- `packages/ConfigForm/ROADMAP.md`
- `packages/ConfigForm/README.md`
- `packages/ConfigForm/workbench/README.md`
- `packages/ConfigForm/designer/README.md`
- `.trellis/spec/config-form/frontend/product-boundaries.md`
- `.trellis/spec/config-form/frontend/index.md`
- `.trellis/spec/config-form/frontend/runtime-state-boundaries.md`
- `.trellis/spec/config-form-workbench/frontend/index.md`
- `.trellis/spec/config-form-workbench/frontend/quality-guidelines.md`
- `.trellis/spec/config-form-designer/frontend/index.md`
- `.trellis/spec/config-form-model/frontend/index.md`
- `.trellis/spec/config-form-compiler/frontend/index.md`
- `.trellis/spec/config-form-core/frontend/architecture-documentation.md`

当前冲突是可验证的：`packages/ConfigForm/PRODUCT.md:7`、`packages/ConfigForm/ROADMAP.md:3` 和 `.trellis/spec/config-form/frontend/product-boundaries.md:10` 仍将产品定义为 Runtime-first；`.trellis/spec/config-form/frontend/product-boundaries.md:51` 到 `:54` 又把 Inspector 固定为两个区域。它们必须在代码实现前原子改成已确认的 Studio/Designer/Runtime/Source 边界。

建议新增：

- `.trellis/spec/config-form/frontend/studio-domain-contracts.md`：Surface、Dataset、Prototype Interaction、版本与错误矩阵。
- `.trellis/spec/config-form-source/frontend/index.md`：Source 包依赖、公开入口和异步 Viewer 边界。
- `.trellis/spec/config-form-source/frontend/quality-guidelines.md`：确定性生成、Node 无 DOM 导入、Monaco 懒加载和可访问性门禁。

实现各子任务时，还需同步 Model、Compiler、Core、Headless、Runtime 和两套 Designer adapter 的包 README；这些 README 应描述落地后的当前事实，不提前承诺未实现 API。

### Files Found

- `.trellis/tasks/09-18-config-form-demo-studio/{prd,design,implement}.md`：父任务产品边界、领域设计和七阶段计划。
- `.trellis/tasks/09-18-config-form-studio-*/prd.md`、`.trellis/tasks/09-18-config-form-surface-foundation/prd.md`、`.trellis/tasks/09-18-config-form-source-package/prd.md`：七个独立交付项的要求与前置条件。
- `packages/ConfigForm/model/src/types/contracts.ts`：当前 Page-only ProjectDocument。
- `packages/ConfigForm/compiler/src/types/compiler.ts`：当前 Page-only Canonical IR。
- `packages/ConfigForm/designer/src/inspector/types/domain.ts`：当前双 Inspector section 合同。
- `packages/ConfigForm/designer/src/components/DesignSurface/index.vue`：当前设计画布组合和禁用交互状态。
- `packages/ConfigForm/workbench/src/app/components/StudioLeftPanel/index.vue`：当前 Workbench 导航信息架构。
- `packages/ConfigForm/workbench/src/features/data/components/DataWorkspace/index.vue`：当前动态 Data Source 作者界面。
- `packages/ConfigForm/workbench/src/project/export/`：当前 Workbench 私有 Source 生成器与 resolver。
- `packages/ConfigForm/workbench/src/features/export/`：当前导出弹窗、命令和可编辑 Monaco 组件。
- `packages/ConfigForm/core/src/reaction/services/evaluate.ts`：现有 reaction 固定点执行器及初始化值写入行为。

### Code Patterns

- 领域合同通过版本化 JSON shape、精确 reader 和 fail-closed 策略硬切；不得引入 pages/surfaces 双读或兼容别名。
- 跨 Surface 引用应保留稳定 ID，每个 Surface 编译一次；运行时 `instanceId` 与定义身份 `surfaceId` 分离，避免循环引用导致递归编译。
- 应用命令留在 Studio 组合根，公共包只拥有可复用的纯合同或无宿主副作用的组件。
- Adapter 特定 metadata 由组合根解析后注入公共 resolver，低层包不反向依赖 Designer/Workbench。

### External References

本次审计不需要外部资料或第三方版本判断；结论完全来自仓库内已确认产品决策、任务合同、现有代码和 Trellis 规范。Monaco/Vue 的具体版本应在 `source-package` 实施前按当时 lockfile 核对，不在本依赖审计中预先固定。

### Related Specs

- `.trellis/spec/config-form/frontend/product-boundaries.md`
- `.trellis/spec/config-form/frontend/runtime-state-boundaries.md`
- `.trellis/spec/config-form-workbench/frontend/index.md`
- `.trellis/spec/config-form-workbench/frontend/quality-guidelines.md`
- `.trellis/spec/config-form-designer/frontend/index.md`
- `.trellis/spec/config-form-model/frontend/index.md`
- `.trellis/spec/config-form-compiler/frontend/index.md`
- `.trellis/spec/config-form-core/frontend/architecture-documentation.md`

## Caveats / Not Found

- 本次是只读架构与任务依赖审计，未运行构建、单测或 E2E，也未修改 PRD、规范或产品代码。
- 研究时点的建议名 `prototype-runtime` 已由后续合同设计定型为 `@moluoxixi/config-form-prototype-runtime`，公开入口和版本归属以该设计为准。
- 行号对应 2026-09-18 当前工作区快照；后续实现移动代码后应以符号和文件责任为准。
- `packages/ConfigForm/source` 尚不存在，因此没有可审计的包实现；不能把现有 Workbench 编辑器视为新 Viewer 的实现基础而跳过重新收敛职责。
