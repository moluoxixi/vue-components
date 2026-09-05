# Workbench 样式所有权拆分设计

## Owner 映射

- `TemplateCreationWorkspace/style/index.css`：创建工作区 shell、详情、drawer、响应式与 reduced-motion。
- `TemplateCatalogPanel/style/index.css`：catalog filters/list/status/empty/fatal。
- `JsonImportPane/style/index.css`：JSON source/upload/diagnostics/preview/footer 与响应式。
- `features/{export,persistence,flow,pages}/style/index.css`：各 feature dialog。
- `app/style/index.css`：Workbench toast/message/recovery notice。
- `styles/feature-surfaces.css`：跨 feature 的 Workbench shell、overlay 与 light-theme surface 规则。

## 聚合与层叠

`styles/index.css` 仍由 Main 与 Runtime Host 同步加载。新的 owner 文件在 `studio.css` 后、`responsive.css` 前按原功能顺序导入；不由异步 Vue 组件自行触发 CSS chunk，从而避免首次打开 dialog 时闪烁或 iframe Runtime 缺样式。

混合 selector rule 按 selector owner 拆成内容相同的规则；单个 owner 内保持原规则顺序。视觉 E2E 与主题合同作为层叠等价门禁。

## 清理边界

仅删除全仓生产 Vue/TS 中没有 class owner 的遗留 selector。任何动态 class 或 Teleport 根无法静态确认时保留在共享文件，不以“未搜索到”作为唯一删除依据。

旧 `.preview-stage` container rules 试图从父文档命中 iframe 内的 `.page-preview-form`，浏览器不会跨 document 应用该 selector，因此一并删除；Preview 继续由 iframe viewport 与 Runtime media contracts 响应。
