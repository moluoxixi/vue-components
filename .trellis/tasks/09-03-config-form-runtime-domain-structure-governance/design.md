# ConfigForm Runtime 与领域结构治理技术设计

## 1. 总体边界

本任务按数据流保持单向依赖：

```text
Core contracts
  -> Model transaction engine
  -> Compiler canonical IR
  -> Headless controller / Runtime useForm
  -> Runtime renderer
  -> Provider wrappers / Playground consumers
```

拆分只改变私有模块位置和组合方式。包根 export、跨包依赖方向、协议版本、诊断 code/message 与用户交互不变。每个目录的 `index.ts` 只做 export；纯计算进入 services，Vue state/listener/lifecycle 进入 composables，可视区域进入 owner/components。

## 2. Architecture Debt 与 Playground

- `antd|element/src/services/components/` 持有各自唯一 Runtime wrapper，`services/install.ts` 通过局部 barrel 消费；package root 仍只公开安装包装后的组件。
- `runtime/src/errors/config-form-error.ts` 持有类实现，`errors/index.ts` 只 re-export。
- `playground/src/examples/ConfigForm/components/` 持有 Antd/Element 子示例；顶层 glob 继续只发现 `ConfigForm.vue`。
- 每套示例继续按 Provider 独立拆 `LayoutScenario`、`ContainerScenario`、`LinkedScenario`，Element 额外拆 `StressScenario`。字段/默认值构造进入该 Provider 场景自己的 services/defaults，不提取伪共享层。
- Devtools 只同步必要 fixture source path；不改变 source injection 协议。

## 3. Model Transaction Engine

```text
model/src/services/transactions/
  index.ts
  apply.ts
  operations/
    index.ts
    project-page.ts
    node.ts
    flow.ts
  graph/
    index.ts
    mutation.ts
    targets.ts
  validation/
    index.ts
    plan.ts
    registry.ts
    payload.ts
  changes/
    index.ts
    collection.ts
    normalization.ts
  types/
    index.ts
    internal.ts
```

`services/index.ts` 改为从 `./transactions` 导出，不保留旧 `transactions.ts`。`applyProjectTransaction`、`applyProjectDraftTransaction`、`applyProjectCommandDraftTransaction` 名称和签名不变。

`apply.ts` 仍拥有 Immer draft、batch 原子性、`inverseOperations.unshift(...)`、最终 validation 和 result assembly。每个 operation 的 mutation 与 inverse 在同一 operation module 中，避免 inverse 漏项或顺序漂移。Validation plan、Registry lock 和 semantic no-op 通过 typed internal context 传递，不创建第二套 document state。

## 4. Compiler

```text
compiler/src/services/compile/
  index.ts
  canonical.ts
  page.ts
  diagnostics/
  registry/
  coordinator/
  types/
```

Canonical compile 与 incremental page compile 共用明确的 page compilation context。Capability/flow/reaction 与 Registry lock diagnostics 由纯 services 返回，coordinator 独占 committed/draft LRU、cache key、invalidation 和 latest revision。根 API 的三个函数通过 `compile/index.ts` 原名导出，旧 `compile.ts` 删除。

## 5. Runtime Renderer

```text
runtime/src/renderer/
  index.ts
  index.vue
  composables/
    use-renderer-controller.ts
    use-design-interaction-guard.ts
    use-runtime-editor-bridge.ts
  services/
    runtime-flow-events.ts
    binding.ts
    metadata.ts
    renderer-pipeline.ts
    renderer-layout.ts
    renderer-node.ts
    renderer-field.ts
    renderer-component.ts
    renderer-slots.ts
  types/
```

Facade 保留 props/emits/model/slots/expose 与 `<form>` 模板，只组装 controller、editor bridge、guard 和 tree renderer。Design guard 独占 tabindex snapshot、MutationObserver 与 mode teardown；editor bridge 独占 registration generation/cleanup 和 event interception；Flow service 保留 `design intercept -> configured listener -> preview runtimeEvent` 顺序。Runtime host 的 geometry 与 hit testing不迁入 renderer。

渲染流水线是无 Vue 生命周期状态的 VNode 工厂，按全局允许的责任目录归入 `services/renderer-*.ts`；不新增未被目录合同认可的 `renderers/` 顶层责任类型。递归由 pipeline 注入回调，避免 `slots -> node` 的模块循环。

## 6. Headless 与 Runtime Validation

- Headless controller 拆为 controller facade、values/meta/reaction、validation、reset/submit services。Facade 保留回调时序和 async stale-result guard。
- Runtime `useFormValidation` 拆为 queue/snapshot lifecycle、field policy、result commit 与 submit orchestration；`VALIDATION_THROTTLE_MS` 继续由既有 public barrel 导出，内部 service 不新增 public symbol。
- Snapshot reference count、timer、dispose、submit flush 与 stale suppression 各自只有一个 owner。

## 7. 行为锚点

- Model：原子失败不泄漏 draft；inverse 反序；command 中间态可暂时无效但最终 transaction 必须有效；change-set 合并顺序固定。
- Compiler：完整/增量结果一致；Registry lock 与 capability diagnostics 不漂移；committed/draft cache 隔离。
- Renderer：mounted 后 mode 切换恢复 tabindex；动态可聚焦后代被 guard；editor 替换清旧 registration；nested slot path/visibility 保持；design 不广播 runtime event。
- Playground：layout/container/linked/stress 四类现有场景和 test id 不变。
- Headless/validation：async validation 旧结果不可覆盖新值；reset/submit/meta/reaction 回调顺序不变；dispose 清 timer/snapshot。

## 8. 回滚与提交

Architecture debt/Playground、Model、Compiler、Runtime renderer、Headless/validation 分五个工作提交。每批通过局部 test/typecheck/build 后再提交；失败只回滚该职责边界。完成所有批次后运行全量 consumer/E2E/architecture gate，更新 spec 并归档任务，不 push。
