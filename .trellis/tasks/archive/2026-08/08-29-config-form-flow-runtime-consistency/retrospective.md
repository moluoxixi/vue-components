# 缺陷复盘：流程运行语义跨层漂移

## 1. 根因分类

- **类别 B：跨层契约缺失**。Core、Workbench Preview 与生成 Source 都执行同一份 Flow IR，但并发、取消、投影保留和值提交没有统一的状态矩阵。
- **类别 C：变更传播失败**。Preview 和生成 Source 各自增加了全局 trigger revision，覆盖了 Flow ID 级 `latest / queue / ignore` 语义。
- **类别 D：测试覆盖缺口**。原测试偏重单层与生成文本关键字，没有执行生成的 `flows.ts`，也没有真实父组件 `v-model` 和浏览器提交入口回归。

## 2. 之前修复为何不够

1. 只修调用方序号属于表面修复：它让最新事件看似正确，却破坏 `queue` 和 `ignore`。
2. 只检查 action 的 signal 属于范围不完整：不监听 signal 的 Promise 仍会永久占用 active/queue。
3. 只断言模板字符串属于工具证据不足：无法证明生成 Runtime 的超时、取消、输出映射和投影行为。
4. 只写入整个 values 快照属于错误心智模型：异步完成时会覆盖用户或其他 Flow 的后续无关改动。

## 3. 预防机制

| 优先级 | 机制 | 动作 | 状态 |
| --- | --- | --- | --- |
| P0 | 架构 | 并发只由 Flow ID 调度器负责，Preview 不再建立第二套全局并发策略 | 完成 |
| P0 | 生命周期 | Promise 与 abort/timeout 竞速，所有 listener、timer、controller 在终态清理 | 完成 |
| P0 | 测试 | 执行生成 `flows.ts`，覆盖并发、错误策略、多 Flow 顺序和值差量 | 完成 |
| P0 | 集成 | 四套真实导出工程安装、类型检查、生产构建 | 完成 |
| P1 | 规范 | 新增 Flow 跨 Runtime code-spec 与跨层检查清单 | 完成 |

## 4. 系统性扩展

- **类似风险**：任何同时存在“共享 Runtime + 自包含生成 Runtime”的功能都可能发生语义漂移。
- **设计改进**：实现可以独立，但可观察状态矩阵、fixture 和断言点必须共享。
- **流程改进**：模板代码变化后，单元测试、可执行生成代码测试和真实消费者构建缺一不可。
- **知识改进**：异步结果不应直接替换 UI 快照，应提交相对输入的业务差量。

## 5. 知识固化

- [x] 新增 `.trellis/spec/config-form-core/frontend/flow-runtime-consistency.md`。
- [x] 更新 `.trellis/spec/guides/cross-layer-thinking-guide.md`。
- [x] 为 Core、Preview coordinator、生成 Runtime 和真实导出工程补充回归证据。
