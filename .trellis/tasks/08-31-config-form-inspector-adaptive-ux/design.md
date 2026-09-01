# ConfigForm Inspector 自适应属性体验技术设计

## 1. 设计原则

本任务解决的是“Inspector 如何投影现有合同与数据”。它不改变持久化 schema、Registry wire contract 或 Runtime 语义；为保证 Registry 已陈旧的文档仍可被单调修复，Model 新增一个受限的精确删除 operation。

1. Registry/Material 描述可新增能力，PageNode 保存事实；两者都不能单独决定可见性。
2. 陈旧配置必须可见、可解释、可撤销地删除，绝不在 render/computed 阶段自动清理。
3. 多选采用安全能力交集；展示数据采用所有已选节点的并集，避免主节点掩盖其他节点。
4. 栅格分数是 `resolveConfigFormLayout` 与 placement span 的纯投影，不进入 ProjectDocument。
5. Designer 核心保持 UI 库无关，Workbench 仅负责外壳与浏览器级验证。

## 2. 所有权与边界

| 能力 | 所有者 | 本任务允许变化 | 禁止变化 |
| --- | --- | --- | --- |
| Registry 能力 | `ComponentContract` + `DesignerMaterialDefinition` | 读取 events/bindings/kind/setters 并归一化 | 新增 wire 字段、改变 provider 注册语义 |
| 已存配置 | `PageNode` | 读取、显示、通过命令清理 | render 时修改 graph、静默删除 |
| Inspector 投影 | Designer capability resolver | section/setter/stale item/multi-select 解析 | 维护第二份可编辑 schema |
| 修改事务 | `node.config.remove` + design session | 删除一个受支持的精确 path、一次 command | 组件直接 mutation、绕过 history、恢复或改写任意值 |
| 布局数值 | Runtime responsive resolver + placement | 派生 fraction label | 新布局字段或替代 Runtime 计算 |
| UI 外壳 | `DesignerPropertyPanel`/Workbench | tabs、diagnostics、ARIA、responsive 样式 | Designer 引入 Element Plus/Ant |

## 3. Capability Resolver

### 3.1 输入与输出

在 Designer 内新增领域命名的纯模块，例如 `inspector-capabilities.ts`。输入只包含可序列化/可测试数据：

```text
selected nodes
+ per-node material definition
+ per-node component contract
+ graph placement/form layout context
= InspectorProjection
```

建议输出结构：

```typescript
type InspectorSectionId
  = 'properties' | 'validation' | 'events' | 'bindings' | 'conditions' | 'reactions'

interface InspectorProjection {
  sections: InspectorSectionProjection[]
  commonSetters: DesignerPropertySetterDefinition[]
  staleItems: InspectorStaleConfigItem[]
}

interface InspectorSectionProjection {
  id: InspectorSectionId
  canCreate: boolean
  hasStoredContent: boolean
  editable: boolean
}
```

具体命名可跟随实现时的本地风格，但能力规则必须集中且能脱离 Vue 组件单测。

### 3.2 Section 规则

| Section | 可新增能力 | 保留可见性的已存数据 |
| --- | --- | --- |
| properties | 始终；setter 为安全交集 | setter 未知但已存的普通 props 仍由现有 material diagnostics 处理，不在本任务创建通用 JSON editor |
| validation | 所有选择均为 field | 任一节点含 `validation`/`validateOn` |
| events | 所有选择的 ComponentContract 声明相同 event key | 任一节点 `events` 非空，包括未知 key |
| bindings | 所有选择的 ComponentContract 声明相同 binding key 且 valueProp/trigger 相容 | 任一节点 `bindings` 非空，包括未知 key |
| conditions | 所有选择对目标 condition 都适用；field 为五类，layout 为 visible/hidden | 任一节点 `conditions` 非空，包括 kind 不适用 target |
| reactions | 选择存在且所有节点都可通过现有 reaction setter 安全编辑；单选默认可新增 | 任一节点 `reactions` 非空 |

“无内容时隐藏”只作用于高级 section；properties 始终是稳定回退点。对多选的 reactions，若无法证明数组编辑能正确合并，则 MVP 只读展示诊断，不开放批量新增/覆盖。

### 3.3 多选交集

- 不再要求相同 component 才显示一切；按 setter 的 `path + control + valueKind + constraints/options contract` 求交。
- 相同 path 但 control、valueKind、options 或约束不同视为不相容，不开放批量编辑。
- event 以 name 求交；binding 以 name、valueProp、trigger 三元组求交。
- condition target 按 node kind 求交；validation 只对全 field 选择开放。
- 数据可见性使用并集：任何节点有高级配置，对应 section 都出现；不能共同编辑的项目标记所属节点并提供逐项清理。
- 所有批量 commit 继续调用 `updatePaths`，产生一个含多个 action 的 `ProjectCommand`，保持一次撤销。

## 4. 陈旧配置与诊断

### 4.1 分类

resolver 生成 Inspector 本地 warning，不替代现有 `analyzeDesignGraph`：

- `event-unknown`：节点保存 event key，但 ComponentContract 未声明；
- `binding-unknown`：节点保存 binding key，但当前合同未声明；
- `condition-inapplicable`：node kind 不支持的 condition target；
- `selection-incompatible`：已存配置在当前多选中无法安全共同编辑。

已有内容但仍合法时不是 warning，只是让 section 保持可见。严格 Model schema 不允许 layout 保存 validation，因此不为 schema 外数据建设恢复 UI；这类输入继续由导入/模型校验拒绝。

### 4.2 呈现与删除

- 陈旧 item 在所属 section 顶部以结构化 warning 行呈现：类型、原始 key、所属节点可读名称、原因和删除按钮。
- 单选已知 item 仍走原 setter；未知 event/binding 至少显示其当前值摘要，不把结构化数据降级后再覆盖。
- 删除按钮发出 `node.config.remove` Project command；只允许 `events.<key>`、`bindings.<key>`、`conditions.<key>`、`validation`、`validateOn` 五类精确路径。MVP 不提供“全部清理”，避免把 repair operation 与普通修改混在一个 transaction。
- readonly 下 warning 和值可读，删除按钮使用现有不可用语义；执行成功后的 history/状态反馈沿用 Workbench 命令链。
- 不向 `DesignerDiagnostic` 增加 command callback，避免 domain diagnostic 携带 UI 行为。结构化 stale item 是 Inspector projection 的独立 presentation 类型。

### 4.3 单调修复边界

- 普通 `node.events`、`node.bindings` 或 `node.settings` 会让整个新 record 重新进入 Registry 校验；当同一 record 仍有其他未知 key 时，不能承担逐项修复。
- `node.config.remove` 只删除一个已存在的 schema-owned 值，transaction 必须全部由该 operation 组成且不能带 `mergeKey`。它继续校验 Project/Page schema 与 Registry lock，但不要求无关陈旧 Registry key 在同一次操作中全部消失。
- 前向 operation 不接受 replacement value，也不暴露 validation bypass。History 只对已经由领域层接受的纯删除 transaction，在应用引擎生成的 semantic inverse 时省略 Registry 复验，以精确保真恢复旧快照；Redo 重新执行并验证原删除。
- material 或 ComponentContract 缺失/错配时 resolver 不生成 removal intent。Designer 只能把 resolver 已证明安全的精确 path 转成正式 command。

## 5. 栅格分数投影

新增纯 helper，对正整数 `span`/`columns` 做 clamp 后以最大公约数约分：

```text
span < columns  -> "12 / 24 · 1/2"
span = columns  -> "24 / 24 · 100%"
```

- 表单默认 field span：desktop/tablet/mobile 均调用 `resolveConfigFormLayout` 得到最终值。
- 选中根节点：实际 span = placement span ?? 当前断点 resolved `fieldSpan`，再 clamp 到该断点 columns。
- `DesignerResponsiveSettings` 的每个 breakpoint 行显示其最终继承值和 fraction；当前 Inspector span setter显示活动 breakpoint 的 fraction。
- helper 只返回展示模型/字符串，不被 schema、command、export 或 runtime 引用。
- locale catalog 持有可见文本模板；数值、斜线与 fraction 保持 LTR 数学表达。

## 6. Vue 组件集成

`DesignerPropertyPanel` 负责：

1. 为每个选中节点取得 material 与 ComponentContract。若当前 props 只提供主节点定义，则 `DesignSurface` 传入 Registry 查询能力或预先构建 per-node 输入；不复制 Registry。
2. 计算 projection，并用 stable section order 渲染 tablist。
3. 基于 projection 组装现有 `DesignerPropertyForm` entries；未知 item 用小型领域组件/内联结构化行呈现，不伪造成 setter。
4. watch section id 列表与 selection identity：活动 section 消失时回退；若被移除 tab 持有焦点，下一 tick 将焦点放到回退 tab，否则不抢用户焦点。
5. tablist 使用单行可横向滚动轨道；激活 tab 调用 `scrollIntoView({ block: 'nearest', inline: 'nearest' })`，reduced motion 下无动画。

`DesignSurface` 继续是 graph/session/Registry bridge，不获得 Inspector 本地 tab 状态。

## 7. 兼容性与文档

- `DesignerPropertyPanel` 是内部默认实现；既有 properties slot scope 继续保留 graph/node/nodes/material/diagnostics/componentDefinition，避免破坏自定义 Inspector。
- 两套 Provider 的 material/contract 不修改；通过同一 resolver fixture 验证输出一致性和差异合法性。
- 仅在最终实现新增公共 export 或改变架构依赖时同步 `packages/ConfigForm/README.md`；内部 projection/helper 无需制造公共 API。
- 现有六页签 E2E 改成按所选组件断言具体 section 集合，并保留几何/overflow 证据。

## 8. 风险与回滚

- **选择漂移**：只 watch kind 会留下无效 active tab。以完整 section id/selection identity 为源并加焦点测试。
- **数据误删**：未知结构不能通过文本 setter round-trip。未知值只读展示，删除使用精确 path；测试相邻 key 保持不变及 undo。
- **多选误覆盖**：不相容 setter 禁止编辑，不能用 `undefined` 混合值假装安全；对每个批量能力做异构组件 fixture。
- **布局语义漂移**：fraction helper 不复制响应式继承逻辑，必须消费 `resolveConfigFormLayout` 的结果。
- **窄屏回归**：tab 动态变化可能造成焦点/滚动跳变；304/900/390 分别做组件和浏览器断言。

Capability resolver、stale recovery、fraction projection、responsive tabs 四批可独立回滚。任一批出现模型写入、非目标配置丢失、不可撤销修改或 Runtime 输出变化时，回滚该批，不放宽合同测试。
