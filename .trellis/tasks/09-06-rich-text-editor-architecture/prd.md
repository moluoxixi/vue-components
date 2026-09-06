# 重构富文本编辑器扩展边界

## 目标

在不改变现有 HTML `v-model`、事件、Vue 插件入口和 `editor` expose 契约的前提下，降低富文本编辑器核心逻辑、工具栏 UI 和 TipTap 扩展配置之间的耦合，为后续业务扩展提供明确边界。

## 范围

- 抽取 TipTap 扩展工厂，集中维护默认扩展和配置。
- 抽取编辑器 controller，负责编辑器实例、内容同步、可编辑状态、公开命令和状态刷新。
- 抽取工具栏命令描述与工具栏组件，默认工具栏继续提供现有功能。
- 抽取链接面板组件，链接规范化逻辑保持在纯工具函数中。
- 保留现有包根入口、默认/命名导出、样式子路径、HTML 输出和 toolbar slot 兼容性。
- 为扩展工厂、controller 关键行为、链接边界和工具栏行为补充测试。

## 不在范围

- 不 fork TipTap、ProseMirror 或 `@tiptap/vue-3`。
- 不引入 HTML/JSON 双格式或改变 `modelValue` 类型。
- 不新增图片、表格、协同编辑、提及等编辑能力。
- 不重做现有视觉样式或国际化体系。

## 验收标准

- [x] `RichTextEditor` 仍满足现有公开入口、Vue plugin、HTML `v-model`、事件和 expose 测试。
- [x] 默认扩展配置从组件壳中移出，新增扩展时只需修改扩展工厂或显式传入扩展配置。
- [x] 编辑器同步和可编辑状态由 controller 统一管理，组件不再直接承担全部 TipTap 生命周期逻辑。
- [x] 默认工具栏与链接面板成为独立组件，工具栏命令具备统一的执行、激活和可用状态。
- [x] `normalizeHref` 拒绝协议相对外链等危险边界，并有回归测试。
- [x] rich-text-editor 包的 lint、typecheck、unit test、build 均通过，且包架构检查无新增债务。
