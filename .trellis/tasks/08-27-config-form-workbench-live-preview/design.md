# 浏览器实时页面运行与诊断设计

## 运行边界

- Page Preview 只消费当前 `LowCodePageModel` 编译得到的 immutable renderer props，不直接读取 Designer DOM、Monaco 或草稿文本。
- `PreviewRuntimeBoundary` 捕获运行时异常并显示诊断；存在最近一次成功运行时保留 fallback 页面。
- 每次模型投影生成唯一 project/revision token，异步 mount 或旧 runtime ready 事件必须经过 latest-only gate，不能覆盖新 revision。
- 预览 viewport、刷新和运行状态属于 UI 投影；不会写回 Config Model。

## 数据流

```text
committed model → DesignerDocument projection → compileDesignerDocument
               → ConfigFormRenderer → PreviewRuntimeBoundary → Page Preview
```

编译失败保留最近成功结果并显示 stale 状态；项目切换和组件卸载会使旧 token 失效。
