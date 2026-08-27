# 国际化工作台与端到端集成设计

## 界面结构

```text
Topbar: project | adapter | AI status | refresh/settings
Tabs/steps: Resources | Translate | Changes
Resources: resolved config + scan summary + language coverage
Translate: filter/actions + editable candidate table + progress
Changes: structured operations + text diff + apply confirmation
```

- 状态由应用壳持有，切换 tab 不卸载活跃翻译任务或 abort controller。
- server state 通过单一 API client 与 reducer 进入 UI；组件不直接 cast wire payload。
- 表格行维持稳定高度与列宽；移动端使用行详情/分段布局，避免压缩到不可读。

## 交互

- 启动后先验证配置并自动或显式 scan；错误提供针对配置文件的服务端诊断摘要。
- Translate 默认筛选 missing，用户选择目标 locale 后批量执行；取消保留已验证候选但标记任务 cancelled。
- candidate 编辑后重新执行本地 token/schema 校验；非法项不能选入 preview。
- Changes 明确区分 create/update/overwrite；apply dialog 显示文件数、条目数和覆盖数。
- conflict 返回 Resources/Changes 的可恢复入口，不提供 force write。

## 可访问与视觉

- Element Plus 控件与 Lucide 图标；图标命令有 tooltip/aria-label。
- tabs 支持方向键/Home/End，步骤用 `aria-current`；状态用 live region，错误用 alert。
- dialog 处理焦点；桌面和移动视口均验证无页面级 overflow。

## E2E Harness

- 测试启动真实 dist CLI、本地临时 locale 项目和 stub OpenAI-compatible SSE server。
- 每个测试独立 temp root/config/port；断言磁盘内容、HTTP/SSE、DOM 语义和浏览器问题。
- 覆盖成功、新文件、overwrite 确认、stale conflict、坏模型输出、取消、移动和键盘流程。
