# 完整工程导出与源码查看设计

## 边界

- Config 导出继续复用现有 `formatLowCodePageConfig`，输出公开 `defineFields` / `defineField` TypeScript，只读查看。
- Source 导出从已提交 `LowCodePageModel` 生成独立 Vue 3 + Vite 文件树；页面使用原生 Vue 控件表达字段与布局，不依赖 ConfigForm runtime。
- 导出工程使用当前模板的真实版本号，但过滤工作区协议和 ConfigForm 依赖；ZIP 仍复用项目内核的安全路径与归档实现。
- 导出弹窗左侧显示文件树，右侧复用 Monaco 只读编辑器；导出内容不回写模型。

## 数据流

```text
committed LowCodePageModel
  ├─ formatLowCodePageConfig → Config read-only source
  └─ createPureSourceExport → WorkspaceProject → file tree / ZIP
```

动态事件、绑定、反应式和条件在 standalone Source 无法安全表达时阻止导出并显示诊断；不会静默丢失语义。
