# 为 ConfigForm Source 增加可选 Tailwind v4 输出后端

## 目标

在不改变 ProjectDocument、Canonical IR、Runtime 与 Provider 边界的前提下，为 Raw Vue 和 ConfigForm binding 增加 Source 层可选的 Tailwind CSS v4 样式输出后端。Tailwind 是结构化视觉语义的生成目标，不是设计器持久化模型，也不替代字段联动、校验、模拟数据或原型交互合同。

## 已确认边界

- 设计器继续保存受控、结构化的布局与视觉语义，不保存任意 Tailwind class，也不新增通用 CSS/class 编辑器。
- Source 提供封闭的样式目标联合，例如 `css | tailwind-v4`；默认继续使用现有 CSS 输出，保证当前调用方行为不变。
- Raw Vue 可以生成完整的 Tailwind v4 工程；ConfigForm binding 只输出 Tailwind-compatible 的外围样式与公开 attrs，不能要求 ConfigForm Runtime 依赖 Tailwind。
- Tailwind 不接管 Element Plus、Ant Design Vue 等 Provider 的内部 DOM，只处理生成器拥有的应用壳层、Surface、字段外围与布局容器。
- 连续数值、动态值、精确响应式列数及不适合静态 utility 的样式继续使用 CSS 变量或受控 inline style。
- 本任务不升级 ProjectDocument、SurfaceGraph、Canonical IR、Compiler 或 `SourceFileSetV1` 版本。

## 需求

1. 两个公开生成 API 可分别选择 `css` 或 `tailwind-v4`，未传配置时归一化为 `css`，非法目标必须 fail closed，不能静默回退或生成部分文件。
2. Source 内部建立内置样式后端边界，统一负责生成项目依赖、Vite 配置、主题、公共样式、壳层 class 以及布局 class/style 投影，避免在 emitter 中散布后端条件分支。
3. Raw Tailwind 工程使用 Tailwind v4 官方 Vite 插件；`tailwindcss` 与 `@tailwindcss/vite` 只进入 `devDependencies`，运行时依赖仍限于 Vue、Vue Router 与目标 UI Provider。
4. Raw 模板输出可静态扫描的完整字面量 utility class，不动态拼接 class；主题 token 由 `ProjectTheme` 确定性生成。
5. ConfigForm binding 通过 `formAttrs`、`layoutAttrs`、`cellAttrs`、`fieldAttrs` 等公开合同承载可用 class，并保留 adapter style 与 Runtime 自有布局实现。
6. CSS 与 Tailwind 两种 binding 产物都必须生成统一的本地样式入口，并由 `src/bindings.ts` 显式导入，避免生成未被消费的孤立主题文件。
7. CSS 与 Tailwind 两个后端对字段联动、required、RuleSet、模拟数据、页面/Dialog/Drawer 交互和具名函数绑定保持语义等价；本任务不恢复事件编排、事件转发或通用 handler registry。
8. 生成结果保持确定性；相同 compilation、resolver 与 style target 必须得到相同文件集合和内容。
9. Workbench 中的样式目标选择属于后续集成范围：若接入，只能作为导出会话状态，不写入 ProjectDocument，并且 Raw 与 binding 的生成成功/失败继续互相独立。

## 验收标准

- [ ] 未传样式目标与显式 `css` 的产物完全一致，既有消费者无需安装 Tailwind。
- [ ] 非法样式目标返回稳定的输入诊断，且不产生部分文件。
- [ ] Raw Tailwind 产物包含官方 v4 Vite 插件、完整字面量 utilities 和确定性主题映射，且运行时依赖白名单不变。
- [ ] ConfigForm binding Tailwind 产物只使用公开 attrs 和生成器自有壳层，不让 Runtime 或 Provider adapter 增加 Tailwind 依赖。
- [ ] CSS 与 Tailwind binding 均正确导入本地样式入口，并在真实 library build 中产出可消费的 CSS asset。
- [ ] Element Plus 与 Ant Design Vue 的 Raw Tailwind 临时工程均通过安装、类型检查与生产构建。
- [ ] 至少一套 ConfigForm binding Tailwind 临时工程通过类型检查与真实 library build。
- [ ] 样式后端切换不改变校验、联动、模拟数据与原型交互的生成语义。
- [ ] Source 单测、类型检查、构建、架构门禁和 frozen lockfile 校验通过。

## 非目标

- 不把 Tailwind class 写入 Model、Compiler IR、项目 JSON 或 Registry fingerprint。
- 不把 Workbench、Runtime Host、ConfigForm Runtime 或 Provider adapter 改造成 Tailwind 运行时依赖方。
- 不承诺 Provider 控件内部 DOM 的 Tailwind 化。
- 不在本任务中实现 Workbench 导出弹窗选择器；该集成需在 Source 后端合同稳定后单独启动。

## 后续规划要求

这是跨生成器、真实消费工程和公开 API 的复杂任务。启动实现前必须补齐 `design.md`、`implement.md`，并明确 style backend 接口、兼容策略、临时工程测试矩阵与 Changeset 范围。
