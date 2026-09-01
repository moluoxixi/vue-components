# ConfigForm Inspector 自适应属性体验

## 目标与用户价值

让 Inspector 只呈现当前选择真正可配置或已经包含数据的能力，并把栅格数值翻译成即时可理解的宽度语义。用户不再需要逐个打开空页签，也不会因为 Registry 合同变化而失去查看和清理既有配置的入口。

## 背景与已确认事实

- `DesignerPropertyPanel.vue` 已按部分能力动态显示页签：属性始终显示；字段显示校验；Registry `ComponentContract` 声明事件/绑定时显示对应页签；条件和联动始终显示。
- `PageNode` 对字段与布局节点都持久化 `events`、`bindings`、`conditions`、`reactions`；只有字段节点持久化 `validation`。因此已有配置必须参与可见性判断，不能只依赖当前 Registry 声明。
- `DesignerMaterialDefinition` 提供 kind、setters、events、slots 和设计策略；`ComponentContract` 提供 kind、events 和 bindings。当前没有必要为本任务扩展公共 Registry wire contract。
- 当前多选只有“相同 component + kind”才复用物料 setter；不同组件的安全公共能力没有集中求交逻辑。
- 现有 Designer diagnostics 是只读文本列表，没有针对未知 event/binding 等陈旧配置的定位和删除操作。
- 普通 `createNodePathCommand` 会重写完整 event/binding/condition record；当 record 内还存在其他 Registry 未知 key 时，最终 Registry 校验会拒绝这种清理。陈旧配置清理因此必须仍走 command/session/history，但由 Model 提供只删除一个 schema-owned path 的单调修复 operation。
- `resolveConfigFormLayout` 是 desktop/tablet/mobile 最终列数与默认 field span 的正式投影；节点实际宽度还需结合 placement span。分数/百分比只能派生展示，不能写回 Project Model。
- Workbench E2E 当前显式断言 Inspector 有六个页签；该断言与自适应目标冲突，必须改为代表性能力矩阵和几何断言。

## 需求

### R1 集中能力解析

- 在 Designer 内建立纯函数 capability resolver，统一组合物料定义、组件合同、节点 kind、当前存储配置和所选节点集合。
- `DesignerPropertyPanel` 只消费 resolver 结果生成页签、setter 和诊断，不再分别硬编码同一组能力判断。
- Designer 核心继续保持 UI 库无关；resolver 不依赖 Element Plus 或 Ant Design Vue。

### R2 自适应页签

- 属性页签始终存在；校验仅对字段节点或仍保存校验数据的节点存在。
- 事件、绑定页签在 Registry 声明相应能力或当前选择仍保存相应数据时存在。
- 条件、联动在存在已配置内容时始终存在；在无内容时，只对 resolver 判定可安全新增的选择显示。
- 单选页签按稳定顺序显示：属性、校验、事件、绑定、条件、联动。
- 选择变化后，若当前页签仍可用则保留；否则回退到第一个可用页签，默认是属性。焦点不能留在已卸载元素上。

### R3 已有与陈旧配置不丢失

- Registry 未声明但节点仍保存的 event/binding 必须作为未知配置项显示，不得静默隐藏或丢弃。
- 已有但不再适用或无法安全编辑的配置以 warning 诊断呈现，包含配置类型、原始 key 和原因。
- 每条可安全删除的陈旧配置提供明确、可访问、可本地化的删除命令；执行后走正式 `ProjectCommand` 与 Model 单调修复 operation，可撤销且不直接修改 graph。
- 不提供未经 Registry 合同证明的自动迁移或猜测性“修复”。普通编译/物料诊断继续由原有 diagnostics 所有者负责。

### R4 多选安全求交

- 多选只展示所有节点都支持且 setter path/control/value contract 相容的公共 setter 和能力。
- 字段/标签等单节点身份属性不批量编辑；根节点选择仍可通过现有一次 command 修改公共 span。
- 事件、绑定、校验、条件和联动只有在所有选中节点可安全执行同一操作时允许新增或批量编辑。
- 任一节点含有不能共同编辑的既有配置时，仍显示对应页签和逐节点诊断/清理入口，不以主节点能力掩盖其余节点数据。

### R5 栅格占比语义

- 表单 `fieldSpan`、根节点 placement span 和响应式覆盖旁展示“span / columns · 约分/百分比”的辅助文本。
- `12 / 24` 显示 `1/2`，`8 / 24` 显示 `1/3`，整宽显示 `100%`；其他值使用最大公约数准确约分，不使用浮点近似作为主语义。
- desktop/tablet/mobile 分别使用 `resolveConfigFormLayout` 的最终 columns/fieldSpan 计算；未显式覆盖时清楚反映继承后的最终值。
- 修改列数、field span、节点 span 或响应式覆盖后辅助文本立即更新；Project JSON、导出和 Runtime 不新增 fraction/percentage 字段。

### R6 可访问与响应式交互

- 自适应 tablist 保持规范的 `tab`/`tabpanel` 关联、roving tabindex、左右方向键、Home/End 和可预测焦点恢复。
- warning 与删除命令具有可读名称和状态反馈；只读模式下仍能查看数据与诊断，但不能执行删除。
- 304px Inspector、900px overlay 和 390px full-screen Inspector 中页签不换行、不遮挡；允许在单一水平轨道内滚动，但不能产生页面级横向溢出，当前页签保持可见。
- zh-CN/en-US 长文案、两套 Provider、Light/Dark 均保持可读和可操作。

## 验收标准

- [ ] AC1：Input、Switch、Section/Grid、Tabs/Collapse 等字段与布局代表组件只显示 Registry 声明、节点 kind 允许或已有配置对应的页签；不再依赖固定六页签断言。
- [ ] AC2：未知 event/binding、layout 上仍保存的 field-only condition target，以及当前多选无法共同编辑的 reaction 不会被隐藏；warning 显示原始 key/类型，删除后只移除目标配置并可一次撤销。
- [ ] AC3：切换单选、多选、组件种类和节点 kind 时，只出现安全公共 setter/能力；活动页签稳定保留或回退到属性，键盘焦点不丢失。
- [ ] AC4：`12 / 24`、`8 / 24`、`24 / 24` 分别显示 `1/2`、`1/3`、`100%`，非整除值正确约分；列数或 span 修改后即时更新。
- [ ] AC5：desktop/tablet/mobile 使用各自最终列数和 span；派生分数不进入 Project Model、Config/Source Export 或 Runtime contract。
- [ ] AC6：304px、900px、390px 下 tablist/tabpanel/diagnostics 无遮挡、换行、不可达操作或页面级横向溢出；ARIA 键盘行为和只读行为通过。
- [ ] AC7：capability resolver、command 清理、Inspector component、两套 Provider、axe、Playwright、typecheck、build、lint 和 ConfigForm package gate 全部通过。

## 范围外

- 不扩展 Registry snapshot、ComponentContract wire schema 或 Provider 业务能力；只有代码证据证明现有合同不足时才回到规划重新评审。
- 不改变现有业务 props、events、bindings、conditions、reactions 或 validation 的运行时语义。
- 不新建第二份布局状态，不持久化百分比/分数，不改变 Runtime 栅格算法。
- 不实现通用批量操作引擎、自动 Registry migration、模板管理、JSON 导入或持久化历史。
- 不把所有高级配置合并成一个无结构的长表单，也不重做已完成的 Workbench 视觉外壳。

## 阻塞问题

无。现有代码与父任务目标已经给出 MVP 所需的产品边界。
