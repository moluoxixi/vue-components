# Designer 拖拽落点与全物料回归测试

## Goal

修复物料拖入布局容器、末尾落点和日期时间宽度问题，并为 Element Plus 与 Ant Design Vue 全部物料建立拖拽、嵌套与渲染回归测试。

## 背景与已确认事实

- `DesignerNodeList.vue:155-180` 使用 Sortable 处理列表拖动；Palette 通过 clone group 投放，列表的 `onAdd` 以 `newIndex` 生成目标。
- 嵌套列表通过 `localTarget()` 写入 `parentId` / `slot`（`DesignerNodeList.vue:117-131`），最终由 controller 的 `addMaterial()` 和 model reducer 校验并提交。
- 空列表有专用 `.is-empty` 投放提示（`DesignerNodeList.vue:432-440`），非空列表的末尾落点依赖 Sortable 的列表几何和 `newIndex`。
- Model reducer 本身允许 `index === children.length` 追加（`packages/ConfigForm/designer/src/model/operations.ts:231-235`）；因此“无法放到最后”属于落点识别或 DOM 结构问题时，不能通过放宽 Model 校验掩盖。
- Element Plus 和 Ant Design Vue 都有字段与布局物料；Collapse/Tabs 的 slot 只接受对应的 item/pane 容器，Section/Card/Grid/Flex 等内容 slot 接受 field/container，测试必须区分合法和非法落点。
- 当前 Playground E2E 已覆盖部分常见物料和少量容器流程，但没有以 registry 为基准证明每个物料都能新增、嵌套、渲染和撤销。

## 需求

### R1. Palette 到布局容器的拖入

- 从 Palette 拖入任一合法 field 或 layout material 时，能够准确落入目标布局容器的合法 slot；目标 slot、父节点和插入顺序必须写入 Model Operation。
- Section、Card、Grid、Flex、Collapse/Collapse item、Tabs/Tab pane 等布局物料都要覆盖；只接受 Registry 声明的 kind/material，不允许把非法 field 直接塞进 Collapse/Tabs 的 item slot。
- 拖动过程中显示清晰的容器和 slot 投放反馈；取消或非法落点不得产生幽灵节点、半次提交或错误选中状态。

### R2. 非空列表的末尾投放

- 任一非空 root 或嵌套 slot 列表都必须存在可命中的末尾投放区域；把 Palette 物料拖到最后一个节点之后应生成 `index === siblings.length` 的追加操作。
- 把已有节点移动到末尾也必须保持顺序正确；重复拖动、跨容器移动和从末尾移出不能丢失节点或产生重复节点。
- 空列表与非空列表的落点反馈视觉一致，且不依赖用户精确命中 1px 的边界。

### R3. Date / Time 宽度

- Element Plus 与 Ant Design Vue 的 date、time（以及已注册的 range/time-range 变体）在 Designer Canvas 中应占满所属 field control 容器，不显示比 input/select 更窄的控件。
- 设计态宽度必须与 Runtime Preview 使用同一布局约束；不能通过固定像素覆盖响应式 desktop/tablet/mobile 宽度。
- 容器嵌套、label left/top、grid span 和 inline 模式下都要验证控件不溢出、不塌缩。

### R4. 全物料测试矩阵

- 测试矩阵从 Element Plus / Ant Design Vue Registry 动态枚举全部 material key，禁止手工只维护一份容易过期的列表。
- 每个 field material 至少覆盖：Palette click 新增、拖入 root、拖入一个合法布局 slot、Runtime/Designer 可见、撤销/重做。
- 每个 layout material 至少覆盖：新增、合法子节点投放、末尾追加、嵌套层级展示；有受限 slot 的物料还要覆盖非法 material 被拒绝。
- Date/time 宽度断言纳入两个适配器；所有失败必须输出 material key、adapter、目标 slot 和可复现步骤。
- 单元测试覆盖 target 计算、append index、slot accepts/materials 和 DOM 结构；真实浏览器 E2E 覆盖拖动命中、排序和最终 Runtime 结果。

## 验收标准

- [ ] AC1：Element Plus 与 Ant Design Vue 中，合法 field/layout material 均可从 Palette 拖入所有允许的布局 slot，并在 Layers/Model 中出现在正确父节点下。
- [ ] AC2：root 与每一种嵌套 slot 的非空列表都能把新物料追加到最后；已有节点移动到最后后顺序和 revision 正确。
- [ ] AC3：非法 slot 投放被 Registry 诊断拒绝，Model、Preview 和选中状态保持不变。
- [ ] AC4：两个适配器的 date/time/range 控件占满 control 容器，且与 Runtime Preview 在不同 label/viewport/layout 模式下保持一致。
- [ ] AC5：测试从两个 Registry 动态生成完整物料矩阵；新增物料后若未补齐所需能力或测试，质量门禁能明确失败。
- [ ] AC6：Designer 单元测试、两个适配器包测试/typecheck/build，以及 Playground Chromium 拖拽 E2E 全部通过；关键矩阵失败带 material key 和 adapter 诊断。
- [ ] AC7：桌面、中等宽度和 390px 移动视口下拖放区域可见、可命中，无横向溢出或遮挡关键控件。

## 不在范围内

- 不改变 Config Model 的唯一数据源原则，不把 Sortable 内部对象持久化。
- 不新增未在 Registry 注册的任意 DOM 物料或自定义用户函数。
- 不在本子任务实现流程编排、导出源码或国际化翻译能力。
