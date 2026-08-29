# Designer 真实拖拽反馈

## 目标

让指针拖拽拥有“鼠标旁真实虚影 + 画布中真实落点 candidate”的双层反馈，并保证两者与提交后的 Runtime 节点在视觉尺寸和嵌套布局上保持一致。

## 需求

- 物料拖拽和已有节点拖拽都显示跟随 viewport 指针的半透明 Overlay。
- 画布落点继续由临时 Model Operation 投影到 `projectedDocument`，并使用真实 `RuntimeSurface` candidate 渲染。
- Overlay 与落点 candidate 消费同一个候选节点和 Registry，不新增伪造物料 DOM 或独立样式模型。
- candidate 注册后，Overlay 复用其真实视觉结果和 `ResizeObserver` 实测尺寸；跨容器时及时同步。
- Overlay 脱离滚动容器、不可命中、无障碍隐藏、不得触发业务事件或持久化变更。
- 未形成合法落点时允许使用同一 Registry material 的真实预览作为短暂来源，合法 candidate 出现后立即切换。
- cancel、drop、pointer capture lost、readonly、页面切换和 unmount 共享确定性 teardown。
- 键盘拖拽保留落点候选和公告，Overlay 仅适用于指针会话。

## 范围外

- 不引入完整第三方 DnD 框架。
- 不改变 Runtime 组件默认视觉，也不让设计器伪造业务状态。
- 不在本任务改变 Model Operation 语义。

## 验收标准

- [x] AC1 所有注册物料和已有节点指针拖拽均出现真实半透明 Overlay，移动流畅且不阻挡命中。
- [x] AC2 根画布、布局容器和三层嵌套中的 candidate 与提交节点宽高、Props、Slots 和位置一致，提交时无视觉跳变。
- [x] AC3 跨不同宽度容器后 Overlay 在一帧内采用最新 candidate 实测矩形。
- [x] AC4 取消、提交、页面切换、readonly 和 unmount 后无 Overlay、candidate、observer、raf 或监听器残留。
- [x] AC5 Overlay 不触发输入、点击、导航、网络、计时器或表单写入；键盘拖拽行为无回归。
