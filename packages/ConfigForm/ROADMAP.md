# ConfigForm 路线图

产品方向以 [PRODUCT.md](./PRODUCT.md) 为准：Runtime-first，Designer optional，复杂业务逻辑由工程师在宿主 Vue/TypeScript 中维护。

## 当前优先级

1. 稳定 Runtime、Headless、Element Plus 与 Ant Design Vue 的生产表单能力。
2. 保持嵌套对象/数组、readonly、校验、提交、同步 reactions、Data Source、动态 options 和 value scope 的运行一致性。
3. 将 Designer 维持为只包含 `properties` 与 `validation` 的轻量 Schema 编辑器。
4. 让 Preview 与静态 Source/Config 导出持续验证 Runtime 合同，但不承载宿主业务函数。
5. 完善包级类型、架构、发布和真实生成项目门禁。

## 已完成的基础

- 同步 `model.read/write` 单一值源、Headless controller 与统一 Renderer。
- Element Plus / Ant Design Vue 运行适配与 readonly 展示。
- 响应式布局、嵌套 slot、object/array value scope 与行级操作。
- required、RuleSet、Zod、业务 validator、`validateOn`、dirty/touched 和防陈旧异步校验。
- 同步 reactions、Data Source、option source、variables 与 scope cancellation。
- ProjectDocument、编译链、Preview、Source/Config 导出和 current-contract-only 版本门禁。
- 画布选择、拖拽、resize、候选投影、模板创建和 JSON ingress。

## 明确终止的方向

旧 E1-E5 事件编排专项及其后续扩张已被 Runtime-first 决策取代，不属于“完成项”：

- 可视化事件编辑、内联动作清单和流程图。
- 动作注册表、异步 Flow 调度、trace 面板和事件参数映射。
- Designer/Preview iframe 的组件事件转发。
- Source 中的 handler stub、action binding 或 Flow runtime。

复杂组件事件统一使用代码态 config 的 `props.onX`。未来若真实需求证明 Automation 值得产品化，必须重新立项并使用独立 package 和合同，不从主产品恢复旧实现。

## 后续候选

- 基于真实业务样本补齐表单组件与校验能力。
- 移动端渲染适配与 Vant adapter 可行性验证。
- 元素级多语言配置。
- Data Source 的可观测性与 DevTools，前提是不引入事件编排。
- AI 辅助生成静态 PageGraph，输出仍须通过当前 Schema、Registry 和 Compiler 校验。

候选项不代表承诺。任何新增作者能力都必须先满足 `PRODUCT.md` 的扩展准入条件。

## 已知风险

- CI Linux 视觉基线需随现有主题变更维护。
- Compiler 性能预算在高并发任务下可能受机器负载影响，应在独立复跑后判断。
- Preview 无法复现宿主未注入的 `props.onX` 函数，这是可序列化边界，不通过 RPC 绕过。
