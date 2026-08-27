# 在线工作台产品界面设计

## 工作区结构

```text
Topbar: project / save / export / preview toggle
Workspace
  ├─ Editor surface
  │    ├─ Source (Monaco)
  │    ├─ Config (Monaco TypeScript)
  │    └─ Designer (ConfigFormDesigner)
  └─ Preview（右侧、可折叠）
```

- 项目 repository 仍是单一真源；UI 持有当前 project 的工作副本与 dirty/config diagnostic 状态。
- Source 与 Config 共用 `WorkspaceCodeEditor` 外壳；Source 固定当前页面 `src/App.vue`，Config 固定 `src/form.config.ts`。
- Designer 的 `update:document` 同步写入 `manifest.designerArtifact` 的 JSON 文本，并重新生成等价的公开 ConfigForm 配置源码。
- Config 直接使用用户 API：从 `@moluoxixi/config-form-headless` 导入 `defineFields`，导出 `form`、`initialValues` 和由 `defineField(...)` 构成的 `fields`。
- Babel AST 仅解析 JSON-safe 静态子集，不执行用户代码；动态表达式、spread、computed key、外部引用和函数保留为无效草稿并显示诊断。
- `src/form.config.ts` 同时是 Config provider 文件和 Source 页面真实导入的运行时模块，不再生成独立 `src/form.ts`。
- 设计器专属 `id/material/conditions/validation` 保存在字段 `extensions['mx.config-form-designer']`；用户业务扩展仍保留在 `extensions` 顶层，保证三形态往返不丢失。
- 首版 Source 的任意文件编辑可保存进项目 revision；完整 Source -> Page 编译由 live-preview 子任务接管。
- Source Preview 使用项目 REPL 编译真实 `src/App.vue` 与 `src/form.config.ts`；Config/Designer Preview 使用 Designer compiler + ConfigFormRenderer 预览同一有效文档。

## 响应式

- 桌面：Editor 弹性，Preview 36%-42%，可折叠或展开。
- 中宽：Preview 折叠为右侧控制，按需覆盖/分栏。
- 窄屏：Edit / Preview 两个主视图，不横向挤压 Monaco 和 Designer。

## 状态

- Topbar 显示 revision、Saved/Unsaved、durable/volatile。
- 显式 Save 通过 repository CAS 提交；冲突不覆盖并显示错误。
- Export 使用当前 committed project；dirty 时先提示/禁用，避免导出与编辑器不一致。
