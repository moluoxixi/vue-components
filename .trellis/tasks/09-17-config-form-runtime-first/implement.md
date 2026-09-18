# 实施与验收计划

## 实施顺序

### 1. 固化产品与架构合同

- [ ] 新建 `packages/ConfigForm/PRODUCT.md`，更新 ConfigForm/root README、`ROADMAP.md` 和关键包 README。
- [ ] 添加 product-boundaries spec，删除 `flow-runtime-consistency.md`，修订与事件转发、默认高级作者入口冲突的现行规范和 spec index。
- [ ] Phase 1 完成新 spec 后，将 `implement.jsonl`/`check.jsonl` 从旧 Flow spec 改指 product-boundaries，并重新运行 `task.py validate`，保证后续 implement/check context 不引用已删除文件。
- [ ] 补 Model、Compiler、Vue backend 的 Trellis package/spec 索引。
- [ ] 扩展架构测试，先写出 Runtime 单向依赖、Workbench internal、Designer Lite、代码态事件和“无 Flow/无转发”的失败断言。

检查点：文档与失败测试准确描述目标状态；不能通过放宽断言让旧实现通过。

### 2. 先解除 Data 与通用 Renderer 行为对 Flow 的依赖

- [ ] 将 `ConfigFormFlowHttpRequestInput/Output` 移到 Data Source 领域并重命名，更新直接消费者，删除旧 Flow export 和别名。
- [ ] 将 `FlowValueEditor` 及 Data 真正使用的 reference helper 移到 Data feature 并使用 Data/value-reference 命名，删除旧 `features/flow` barrel。
- [ ] 将 `source-flow.ts` 中的 `createStandaloneDataSourceRequestSource` 迁到 Source Data 模块，并让生成页面在无 Flow/action bundle 时仍直接创建 `dataSourceHost`。
- [ ] 从 `use-renderer-data` 删除 `ConfigFormFlowActionContext`、`cloneConfigFormFlowData`、`createRendererFlowValueContext` 和 `loadFromAction`，改用 Data/value-reference 的 clone、load options 与 context。
- [ ] 将 `flow-value-context.ts` 拆分/改名为 Data/value/scope context；删除 `ConfigFormFlowEvent` 输入和 `component.event/dataSource.load` 伪事件构造。
- [ ] 从 `use-renderer-events` 抽出 Data Source 的 prepare/start/refresh/reset/cancelScope/stop 生命周期，建立 Data 专属 composable 和回归测试。
- [ ] 从 `runtime-flow-events` 抽出字段内部 trigger/blur validation 与外部 `props.onX` 的监听器组合，使用中性内部名称。
- [ ] 删除 `ConfigFormRuntimeEventContext`、`interceptEvent` 和 editor bridge 的事件 payload 路径；design mode 改为 Renderer 内部 mode guard，并删除事件名收集、参数 snapshot、公共 emit 和 Flow diagnostic 包装。

检查点：Data Source、option source、variables、scope cancellation、字段写值/校验和代码态 `props.onX` 测试通过；这些能力已无 Flow import。

### 3. Model 与 Registry 当前合同硬切

- [ ] 删除 `RegisteredEventAction`、`PageNode.events`、schema 字段和默认 `events: {}`。
- [ ] 删除 `ProjectPage.flows`、Flow schema、`flow.add/update/remove`、`node.events` operation、inverse、validation plan、引用完整性和复制/重命名分支。
- [ ] 删除 `ComponentEventContract`、`ComponentContract.events`、registry schema 字段和相关唯一性/引用校验；保留 bindings trigger。
- [ ] 提升 PageGraph、ProjectDocument、Registry Snapshot 版本，刷新 fingerprint、registry lock、writer、reader、fixture 和 fail-closed 测试。
- [ ] 删除仓库 fixture 中所有节点 events 与 page flows，不创建人工转换或迁移路径。

检查点：Model 类型、schema、transaction、registry 和持久化测试通过；旧事件/Flow/registry shape 稳定拒绝。

### 4. 删除 Core、Headless、Compiler、Vue backend 与 Runtime 的 Flow 执行链

- [ ] 删除 Core `src/flow/**`、`src/flow-authoring/**`、barrel exports、Flow 专属测试和 `CONFIG_FORM_FLOW_VERSION`。
- [ ] 从 Headless `ConfigFormNodeBase` 删除 `eventNames`，同步清理根导出、声明产物和 public type tests；保留 bindings trigger 与表单 controller 合同。
- [ ] 删除 Compiler Flow 编译/校验/plan、synthetic flow、`collectFlowEvents`、Canonical node `events/flowEvents` 和 page `flows`。
- [ ] 删除 Vue backend 的 `flowEvents -> eventNames`、Flow cache key、`plan.flows` 和相关类型/测试。
- [ ] 删除 Runtime 对 `eventNames` 的消费、renderer `flowActions`、scheduler、builtin actions、scoped Flow transaction、flow projection、result/error/trace 和专属测试。
- [ ] 删除 `runtimeEvent`/`ConfigFormRuntimeEventPayload`/`ConfigFormRuntimeEventContext`、`interceptEvent` 及组件 public prop/emit；不增加 `componentEvent`、`forwardEvents` 或其他替代总线。
- [ ] 让 Runtime 组合新的 Data lifecycle、reaction projection 和 component listener helper，清理无消费者的依赖与 exports。
- [ ] 提升 Canonical IR 与 Compiler 版本，刷新缓存 identity、fixture 和架构文档。

检查点：Core/Headless/Compiler/Vue backend/Runtime 定向测试与类型检查通过；代码态 `props.onX` 在运行态恰好执行一次、design mode 不执行，表单/Data emits 与 expose 保持不变。

### 5. Designer Lite 与组件物料收敛

- [ ] 将 Inspector section 收敛为 `properties`、`validation`，删除 events/bindings/conditions/reactions 作者分支和 stale repair UI。
- [ ] 从 DesignSurface/PropertyPanel 公共 props、emits、slot scope 删除 Flow/事件配置合同。
- [ ] 删除 Designer material `events` 字段及两套 Provider 物料中的事件声明；保留运行值 binding。
- [ ] 删除不再公开的 condition/reaction/event/binding setter 组件、样式、locale、barrel 和测试。
- [ ] 在 Registry/Inspector bridge 建立唯一 setter path allowlist，并添加第三方 material 绕过测试。
- [ ] 将 validation 作者集合收敛为基础规则；已有 compare/custom 规则只读或无损保留。
- [ ] 从两套 Provider 官方物料移除动态 option source setter，保留静态 options 与 Runtime resolver。
- [ ] 保留 conditions/reactions 的设计态只读投影，添加普通属性编辑不丢高级配置的回归。

检查点：Designer 与两套 adapter 单测、类型检查、样式入口和公共导出测试通过；默认 UI 只有两个 section。

### 6. 完整删除 Workbench 事件系统并收敛 Preview/现有静态 Source

- [ ] 删除 `workbench/src/features/flow/**`、FlowDialog/FlowWorkspace、动作/条件/参数编辑组件及专属类型、样式、store、locale、测试和 E2E。
- [ ] 删除 `workbench/src/flow/**` 的 PageFlowEngine、action registry、event targets、builtin descriptors、controller projection 及 exports。
- [ ] 删除 App 中 Flow 异步组件、打开/关闭处理、焦点恢复、模板挂载和 DesignSurface Flow 接线。
- [ ] 删除 Runtime Host/PreviewFrame/PreviewDrawer 的 `runtimeEvent` 与全部 Flow 消息、schema、handler、trace UI 和 action RPC。
- [ ] 保留 Data/普通 runtime state 所需的 iframe 协议，提升 `RUNTIME_HOST_PROTOCOL_VERSION` 并更新 fail-closed 测试。
- [ ] 删除 Source 的 `flows.ts`、flow plan bundle、action binding、callbacks、events/flowEvents portability 规则和 Flow 生成类型；保留并改写静态 props、bindings 与递归 portability 校验，Source 只生成可序列化静态结构配置。
- [ ] 保留迁出的 Source Data request generator 与 dataSourceHost 接线，增加无 Flow 的生成项目 data source parity 测试。
- [ ] 提升 transfer、entity codec、export generator 版本，验证旧输入拒绝、当前输入往返。
- [ ] 从 Workbench manifest、workspace catalog 和 lockfile 移除 `@vue-flow/core`。
- [ ] 删除纯事件/Flow E2E；保留并改写结构、校验、数据、Preview 与 Source 的有效集成用例。

检查点：仓库无事件编辑器、Flow engine、转发 RPC、Flow Source 生成或隐藏入口；Workbench test/typecheck/build/template verification 通过。

### 7. Fixture、文档与历史任务收尾

- [ ] 更新所有 Registry、ProjectDocument、Canonical IR、Runtime config、Preview protocol、import/export、template 和示例 fixture。
- [ ] 更新 Runtime README 的代码态 `props.onX` 示例，并明确 Designer JSON 不承载函数。
- [ ] 更新旧 09-12 任务的 `meta.disposition` 与处置说明，保留历史证据但停止旧产品方向。
- [ ] 搜索并清理残余兼容别名、deprecated wrapper、双读、空目录、无消费者 locale 和死测试。
- [ ] 更新手写 Changeset：直接删除公开 API 的 pre-1.0 包使用 minor bump；element/antd、两套 plugin、devtools 与 designer adapters 同步发布并更新到新 peer range。
- [ ] 验证自动 patch Changeset 不会覆盖手写 breaking 级别，Changeset status 中不存在遗漏的 ConfigForm 发布包。
- [ ] 重跑 lockfile-only 安装并确认 `@vue-flow/core` 仍零命中。

检查点：所有长期文档与目标实现一致；旧任务未被误标完成。

### 8. 集成验证与规范回写

- [ ] 运行完整 ConfigForm 包测试、类型检查、构建、架构门禁、模板验证和必要 E2E。
- [ ] 使用 `trellis-check` 检查 spec、类型、测试、跨层数据流、复用和 current-contract-only 合规性；修复后复跑受影响门禁。
- [ ] 使用 `trellis-update-spec` 将最终产品边界、代码态事件合同、版本策略和架构门禁写回 `.trellis/spec/`。

## 验证命令

按阶段先定向运行，最终至少运行：

```powershell
pnpm --filter @moluoxixi/config-form-core test
pnpm --filter @moluoxixi/config-form-core typecheck
pnpm --filter @moluoxixi/config-form-model test
pnpm --filter @moluoxixi/config-form-model typecheck
pnpm --filter @moluoxixi/config-form-compiler test
pnpm --filter @moluoxixi/config-form-compiler typecheck
pnpm --filter @moluoxixi/config-form-vue-backend test
pnpm --filter @moluoxixi/config-form-vue-backend typecheck
pnpm --filter @moluoxixi/config-form-vue-backend build
pnpm --filter @moluoxixi/config-form test
pnpm --filter @moluoxixi/config-form typecheck
pnpm --filter @moluoxixi/config-form-headless test
pnpm --filter @moluoxixi/config-form-headless typecheck
pnpm --filter @moluoxixi/config-form-element test
pnpm --filter @moluoxixi/config-form-antd-vue test
pnpm --filter @moluoxixi/config-form-plugin-element-plus test
pnpm --filter @moluoxixi/config-form-plugin-antd-vue test
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer typecheck
pnpm --filter @moluoxixi/config-form-designer-element-plus test
pnpm --filter @moluoxixi/config-form-designer-element-plus typecheck
pnpm --filter @moluoxixi/config-form-designer-antd-vue test
pnpm --filter @moluoxixi/config-form-designer-antd-vue typecheck
pnpm --filter @moluoxixi/config-form-devtools-vite-plugin test
pnpm --filter @moluoxixi/config-form-devtools-vite-plugin typecheck
pnpm --filter @moluoxixi/config-form-devtools-vite-plugin build
pnpm --filter @config-form/workbench test --maxWorkers=2
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench verify:templates
pnpm test:config-form-packages
pnpm test:package-architecture
pnpm typecheck
pnpm lint
pnpm changeset status
pnpm release:check
pnpm test:release
pnpm test:pack
```

根据受影响清单运行 Workbench 浏览器测试，至少覆盖 Inspector 两 section、基础 validation、静态 options、事件编辑入口不存在、代码态 listener、表单 submit、数据源、Preview 与静态 Source。不能通过删除有效断言、降低类型、跳过关键测试或延长无关超时获得通过。

## 关键搜索门禁

- `packages/ConfigForm` 生产代码不存在 `RegisteredEventAction`、`ProjectPage.flows`、`ConfigFormFlow`、`flowEvents`、`eventNames`、`flowActions`、`flowResult`、`flowError`、`flowTrace` 或 `runtimeEvent`。
- Core 不存在 `src/flow`、`src/flow-authoring` 或旧 barrel；Workbench 不存在 `features/flow`、Flow engine、Flow Source generator 或 Flow RPC。
- Model/Canonical node 不定义动作型 `events`，ProjectPage 不定义 `flows`，Registry/Designer material 不定义组件 `events`。
- Runtime public API 不出现 `ConfigFormRuntimeEventContext`、`interceptEvent`、`componentEvent`、`forwardEvents`、`onRuntimeEvent` 等中央转发或设计器事件 payload 合同。
- 字段值 binding trigger、blur validation 和代码态 `props.onX` 仍存在且有顺序测试。
- Data Source、`use-renderer-data`、value/scope context 和 DataWorkspace 不从 Flow 路径导入；不存在 `loadFromAction`、`component.event/dataSource.load` 伪事件或旧 Flow 类型/组件 export。
- Source Data request generator 与生成页面的 `dataSourceHost` 不从 Flow/action 路径导入，并通过生成项目 parity 测试。
- Workbench 与 workspace catalog 不声明 `@vue-flow/core`，lockfile 无该依赖。
- Runtime、Headless、Core 的生产依赖不包含 Designer 或 Workbench。
- Workbench `package.json` 保持 `private: true`，根 README 与 ConfigForm README 可发现 `PRODUCT.md`。
- 手写 Changeset 覆盖所有破坏性 ConfigForm 包；element/antd/plugins/devtools/designer adapters 的 peer range 与新 minor 一致，不接受已删除合同的旧版本。

## 风险文件与回滚点

- `core/src/flow` 与 data-source 的类型耦合必须先拆再删，避免误删 Data HTTP 宿主合同。
- `use-renderer-data.ts` 与 `flow-value-context.ts` 仍直接消费 Flow action/event 语义，必须迁成 Data/value-reference API 后再删除 Flow contracts。
- `source-flow.ts` 与 `source-action-bindings.ts` 混有 Source Data request 生成逻辑，必须先迁移并验证生成页面数据请求后再删。
- `runtime/src/renderer/composables/use-renderer-events.ts` 同时承载 Flow、Data 和 lifecycle，必须按责任拆分并以 Data/表单回归作为检查点。
- `runtime-flow-events.ts` 决定字段内部 binding/validation 与外部 listener 顺序，必须保留运行态行为，并用直接 mode guard 替代 Designer event bridge 后再删除 Flow 命名。
- `model/src/types/contracts.ts`、schemas、transaction 服务和 Registry snapshot 是持久化原子边界；完成 Model 定向测试后再进入 Compiler。
- Compiler、Vue backend 与 Runtime 共同定义 Canonical -> renderer config；必须同批删除 flows/flowEvents/eventNames。
- Workbench Preview protocol、IndexedDB、import/export 和 Source generator 版本必须同批切换，避免产生混合合同。
- 若阶段失败，只回退本任务产生的相应文件改动；不恢复双读兼容，不覆盖工作区中其他人的改动。

## 完成定义

只有 AC1-AC14 全部有可复现证据、完整质量门禁通过、长期文档与 spec 更新、breaking Changeset/peer range 原子发布验证和旧任务处置记录完成后，才可结束本任务。发现与本任务无关的既有失败时必须记录命令、错误和归属；不得把未执行项记为通过。
