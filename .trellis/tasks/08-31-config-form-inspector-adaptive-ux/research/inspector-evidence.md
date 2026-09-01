# Inspector 自适应体验代码证据

## 当前行为

- `packages/ConfigForm/designer/src/components/DesignerPropertyPanel.vue:42` 定义六类 property tab。
- `DesignerPropertyPanel.vue:47` 以主节点 kind 和主节点 `ComponentContract` 生成页签：properties 始终存在，field 增加 validation，合同有 events/bindings 时增加对应页签，conditions/reactions 始终存在。
- `DesignerPropertyPanel.vue:62` 仅在所有选择具有相同 component 和 kind 时认为多选相容。
- `DesignerPropertyPanel.vue:127` 按 kind 生成 condition target；`DesignerPropertyPanel.vue:141` 仅为 field 生成 validation；`DesignerPropertyPanel.vue:145` 对任意节点生成 reactions。
- `DesignerPropertyPanel.vue:169` 只呈现既有 Designer/Model diagnostics；`DesignerPropertyPanel.vue:484` 的 UI 是无操作的文本列表。
- `packages/ConfigForm/workbench/e2e/interaction.spec.ts:561` 显式断言六个页签，实施时必须改为能力集合断言。

## 现有合同与持久化事实

- `packages/ConfigForm/model/src/types.ts:83` 的 `ComponentContract` 持有 kind、props、events、bindings、slots 和 parent contract。
- `packages/ConfigForm/designer/src/registry/types.ts:186` 的 `DesignerMaterialDefinitionBase` 持有 kind、runtime/source policy、events、setters 和可选 analyze。
- `packages/ConfigForm/model/src/types.ts:158` 的 PageNode base 持久化 props、events、bindings、conditions、reactions；`types.ts:177` 的 FieldNode 额外持有 validation/validateOn。
- `packages/ConfigForm/model/src/schema.ts:148` 对上述数据进行严格 schema 校验；正常 ProjectDocument 不能包含 schema 外字段。
- `packages/ConfigForm/runtime/src/renderer/responsive.ts:26` 的 `resolveConfigFormLayout` 是 breakpoint 列数和 field span 继承/clamp 的正式实现。

## 命令与状态所有权

- `.trellis/spec/config-form-designer/frontend/state-management.md:9` 规定 `ProjectDocument` 是唯一持久化业务内容模型。
- 同一规范第 24 行描述所有修改进入 `ProjectDomainEngine (Command / Transaction / History)`；Inspector 不直接修改 graph。
- 同一规范第 189-193 行规定 breakpoint 是瞬态 presentation，不能写入 `ProjectDocument` 或作为 design operation。
- 同一规范第 326-332 行规定 Registry 函数/组件不进入 ProjectDocument，transient session/UI state 不得成为第二份业务模型。
- `packages/ConfigForm/designer/src/graph/commands.ts:93` 的 `assignPath` 在 value 为 `undefined` 时精确删除目标 key。
- `packages/ConfigForm/designer/src/graph/commands.ts:118` 的 `createNodePathCommand` 对 events、bindings 和 node patch 构造正式 command，并把多个 node action 放入同一 command。
- `packages/ConfigForm/designer/src/components/DesignSurface.vue:440` 将 `updatePath`/`updatePaths` 统一转成 `createNodePathCommand` 后 dispatch。
- `packages/ConfigForm/designer/__tests__/designer-controller-actions.test.ts:105` 已证明多节点 span 修改是一个 command；陈旧配置清理仍需补精确删除与 undo 回归。

## 规划结论

1. 不扩展 Registry wire contract；能力由现有 material、ComponentContract、node kind 和 stored data 组合得出。
2. `canCreate` 使用所有选中节点的安全交集，`hasStoredContent` 使用所有选中节点的并集。
3. 未知 event/binding 不能进入普通文本 setter，以免结构化数据被破坏；只读保真展示并提供精确删除。
4. fraction helper 只消费 `resolveConfigFormLayout` 结果与 placement span，不复制响应式继承算法。
5. Designer capability resolver 保持纯函数和 UI 库无关；Workbench 负责真实 viewport、axe 和两套 Provider E2E。

## 缺失覆盖

- 没有 capability resolver 单测或 `DesignerPropertyPanel` 的独立 component test。
- 没有未知 event/binding 可见、删除和 undo 测试。
- 没有 active tab 在 selection/capability 变化后的焦点回退测试。
- 没有 `DesignerResponsiveSettings` fraction 或逐 breakpoint 语义测试。
- 现有 304/900/390 浏览器覆盖验证外壳与几何，但没有自适应 section/stale warning 的响应式断言。
