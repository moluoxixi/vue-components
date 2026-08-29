# 技术设计

## 语义边界

```text
LowCodePageModel.flows (persistent JSON)
        |
        +-> Core ConfigFormFlowInterpreter (per-flow scheduler)
        |       |
        |       +-> Workbench PreviewFlowCoordinator -> transient values/projections
        |
        +-> Source Generator -> self-contained flow runtime -> transient values/projections
```

Core 负责单条 Flow 的图语义和 `latest / queue / ignore` 调度。Workbench coordinator 只负责一次页面事件匹配多条 Flow、revision 隔离和把已完成 run 的差量发布到 Preview；它不得再建立第二套全局并发策略。

## Core 解释器生命周期

为 run 建立明确的 `AbortScope`：链接外部 signal 时返回 cleanup；执行 promise 与 signal 做 race，因此 action 即使忽略 signal，run 仍可及时返回 `aborted`。action 子 controller、timeout 和外部 listener 都在 `finally` 清理。

队列项保存稳定的结算函数和 signal cleanup。排队期间外部 signal 触发时，从对应 Flow 队列移除并立即返回 `aborted`；active 完成后只启动仍有效的下一项。解释器不得泄漏未结算 Promise 或让旧队列跨 revision 执行。

## PreviewFlowCoordinator

新增 Workbench preview 层的纯 TypeScript coordinator，输入包括 Flow 快照、trigger、值快照、model revision 和 revision signal。一次 dispatch：

1. 按 Model 顺序筛选 trigger 匹配的 Flow。
2. 逐条调用共享 Core interpreter。
3. `success/end` 更新本次 pipeline 的工作值并记录该 Flow 的投影；`ignored` 不更新；`aborted/failure/timeout` 停止或记录诊断，不伪造成功提交。
4. 计算最终值相对 dispatch 输入的字段差量，发布时合并到 Preview 当前值，避免覆盖事件发生后由用户或其他 Flow 更新的无关字段。
5. 发布前只校验 Application/Page/Model revision token；不校验全局 trigger 序号。

Coordinator 持有按 Flow ID 的最后成功 projection。聚合投影由当前 Model 中 Flow 的顺序派生；删除 Flow、切换 revision 或 dispose 时清理对应瞬态状态。

`App.vue` 只负责读取/写入 Vue refs、把 Renderer 的 `page.mount/form.submit/field.change` 事件交给 coordinator，以及显示诊断。现有 `previewFlowTriggerRevision` 删除。

## 独立 Source 运行时

生成工程继续自包含，不导入 Core。模板实现与 coordinator 相同的状态机结果：调度结果显式包含 status；projection 以 Flow ID 保存，只有 `success/end` 覆盖；`ignore/abort/failure` 不清空旧成功投影。页面层移除全局 `triggerRevision`，改为差量合并和生命周期级 abort。

为防止模板与 Core 再次漂移，建立共享“行为矩阵”测试：同一组 latest、queue、ignore、abort、timeout fixture 分别运行 Core/coordinator 与编译后的生成 `flows.ts`，断言状态、执行顺序、值差量和投影一致。生成实现仍独立，以满足零 ConfigForm 依赖。

## 兼容性

- `ConfigFormFlow`、`LowCodePageModel`、Model Operation 和公开导出格式不变，不需要迁移。
- `ConfigFormFlowInterpreter.run()` 的既有返回类型保持兼容，仅修正取消与队列生命周期。
- 已保存页面和 ExportSnapshot 无结构变化。
- FlowWorkspace、流程弹窗和 i18n 文案不改变。

## 回滚

- Core lifecycle、Preview coordinator、Source template 分开提交或保持可独立回滚的变更块。
- 若生成 Source 的行为测试失败，不替换下载路径；当前不可变 snapshot 逻辑保持原状。
- 若 coordinator 集成失败，可回滚 App 接线而不回滚 Flow IR 或已保存数据。
