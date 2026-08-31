# ConfigForm Inspector 自适应属性体验

## 目标与用户价值

让 Inspector 只展示当前组件真正支持且有意义的配置能力，并把栅格等底层模型概念翻译成用户能直接理解的页面语义，减少空页签和试错。

## 已确认事实

- 当前节点 Inspector 固定平铺“属性、校验、事件、绑定、条件、联动”六个 tab；简单组件也会显示内容很少或为空的视图。
- Registry 已包含 component kind、props schema、events、binding 与 slots 等能力信息，可以作为 tab 可用性的唯一判断来源。
- 表单列数和节点 span 都是正式 Config Model 布局合同；辅助说明只能派生展示，不能另存百分比或第二份宽度状态。
- 当前 304px 左右的 Inspector 已采用纵向 setter，但 tab 数量在窄面板下仍增加扫描成本。

## 需求

- 从 Registry contract、节点 kind 和当前配置派生 Inspector section/tab；不适用能力默认隐藏，有配置但暂不可编辑时显示 disabled 并解释原因。
- 属性、校验、事件、绑定、条件、联动的显示逻辑由集中 capability resolver 决定，Designer 和 provider 不各自硬编码。
- 已配置内容不得因 Registry 能力变化而静默不可见；存在未知/失效配置时显示 diagnostics 与恢复/删除入口。
- 栅格宽度旁实时显示“当前占表单宽度的 1/2”等约分结果，并同时说明 `12 / 24`；响应式 breakpoint 分别计算。
- 多选时仅展示所有选中节点的可安全公共属性；批量 span 修改交给编辑效率任务的一次 transaction。
- tab/section 遵循 ARIA、键盘方向键和焦点恢复；切换节点后保持合理默认页，不落到已隐藏 tab。

## 验收标准

- [ ] Input、Switch、Layout、Tabs/Collapse 等代表性组件只显示 Registry 声明或已有配置对应的 Inspector 能力。
- [ ] 任何已有 event/binding/condition/reaction 不会因 tab 动态化而丢失或无入口，失效配置有明确诊断。
- [ ] `12/24`、`8/24`、`24/24` 分别显示 `1/2`、`1/3`、`100%` 等准确辅助语义；列数修改后立即更新。
- [ ] desktop/tablet/mobile 响应式 span 使用各自列数计算，不把派生百分比写入 Project Model。
- [ ] 304px、900px overlay 和 390px full-screen Inspector 无 tab 换行、内容遮挡和焦点丢失。
- [ ] Registry capability 单测、Inspector component 测试、两套 provider 矩阵、axe、Playwright 与 typecheck 通过。

## 范围外

- 不改变 Registry 已注册的业务 props、events 或 binding 语义。
- 不把所有高级配置合并成一个不可搜索的长表单。
- 不在本任务实现批量操作引擎、模板或持久化历史。
