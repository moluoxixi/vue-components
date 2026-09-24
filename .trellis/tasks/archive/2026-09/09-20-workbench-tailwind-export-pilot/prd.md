# 为 ConfigForm Workbench 建立 Tailwind 样式基础设施

## 目标

让 Tailwind CSS v4 成为 ConfigForm Workbench 自身 UI 可逐步采用的默认样式工具，并以源码导出弹窗验证构建、主题、样式隔离和测试方案。此次迁移只改变样式实现方式，不改变产品模型、交互行为或源码生成合同。

## 背景与已确认事实

- Workbench 当前使用同步样式清单、`--wb-*` 语义主题变量和 Element Plus 主题桥接。
- Workbench 与 iframe Runtime Host 是明确的样式边界，Provider 组件内部样式也不归 Workbench Tailwind 控制。
- 项目文档、Canonical IR、Compiler 和 Source 生成器必须继续保存和消费结构化视觉语义，不能持久化 Tailwind class。
- 用户已确认推荐方案并批准开始落地；第一阶段采用 Export Dialog 作为迁移试点，不进行全量重写。

## 需求

1. Workbench 使用官方 Tailwind CSS v4 Vite 插件构建 utility CSS。
2. Tailwind 入口不得引入 Preflight；现有 `foundation.css` 继续拥有全局 reset，避免污染 Element Plus、Monaco 和既有 Workbench 组件。
3. Tailwind 内容扫描必须从 `source(none)` 开始，并且第一阶段只显式扫描 Export Dialog 模板，不扫描 Runtime Host、Provider 或整个仓库。
4. Tailwind 通过 `@theme inline` 将已有 `--wb-*` 变量映射为 `wb-*` 语义 utility，保留现有 palette 和明暗主题切换能力，不复制主题色值。
5. Tailwind 入口必须由 `src/styles/index.css` 同步导入，不能依赖 Export Dialog 异步加载后才注入关键样式。
6. Export Dialog 自有 DOM 的布局、尺寸、间距和语义颜色迁移到 utility class；稳定的语义类名继续保留，供测试和组件定位使用。
7. Element Plus 内部结构、第三方根节点与 Source Viewer 集成、伪类、复杂状态和必要的移动端规则继续由 Export Dialog 自有 CSS 维护；不使用 Tailwind 穿透第三方组件内部实现。
8. 删除已经由 utility 接管的旧声明，避免未分层 CSS 静默覆盖 Tailwind 造成假迁移。
9. 不改变 Export Dialog 的刷新、模式切换、复制、单文件下载、ZIP 下载、失败态、陈旧态和只读 Viewer 行为。
10. 更新样式合同测试，验证 Tailwind 插件、无 Preflight、精确扫描、语义 token 映射、模板 utility 与保留 CSS 的职责边界，并保留真实浏览器无障碍/交互验证。

## 验收标准

- [x] Workbench 构建产物包含 Export Dialog 使用的 Tailwind utilities，且不包含 Tailwind Preflight reset。
- [x] Tailwind 扫描范围只包含 `src/features/export/index.vue`，Runtime Host 入口没有导入 Workbench Tailwind 样式。
- [x] Export Dialog 在所有现有主题中继续读取 `--wb-*` 语义 token，切换主题无需重新生成 class。
- [x] Export Dialog 桌面与 700px 以下布局、Viewer 可用面积、告警、按钮状态和操作行为与迁移前一致。
- [x] 保留 CSS 只覆盖 Element Plus 内部结构、第三方根节点与 Source Viewer 集成、复杂状态或媒体查询职责，不重复已迁移的普通声明。
- [x] `pnpm --filter @config-form/workbench test` 通过。
- [x] `pnpm --filter @config-form/workbench typecheck` 通过。
- [x] `pnpm --filter @config-form/workbench build` 通过。
- [x] Export Dialog 专项 E2E 与双 Provider 移动端无障碍用例通过；全量 E2E 的既有导航、Preview 断言及 Windows 截图基线失败需单独治理，且本任务未新增失败类别。

## 不在本期范围

- 不把 Tailwind class 写入 ProjectDocument、Canonical IR、Compiler 或持久化数据。
- 不改变 Raw Vue 或 ConfigForm binding 的源码生成格式。
- 不让 ConfigForm Runtime、Runtime Host 或 Provider 包依赖 Workbench Tailwind CSS。
- 不迁移画布几何、拖拽、Designer 包或其他 Workbench 功能区。
- 不删除所有 CSS；第三方组件内部选择器和无法由静态 utility 清晰表达的规则继续保留。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
