# 验收记录

日期：2026-09-07。范围为 rich-text-editor 的 P1/P2 及之前重构引入的回归。

## 完成映射

| 原问题 | 结果与证据 |
| --- | --- |
| 工具栏只看 disabled | 服务统一 can/execute/active；所有格式按钮、块类型和链接均读取快照 |
| toolbarVersion 手动刷新 | 事件订阅快照；transaction/update/destroy 清理；editable 在 controller 更新后刷新 |
| 业务依赖原始 Editor | 新增 commands/state/getHTML/getJSON；默认工具栏和增量插槽使用高层 API；保留旧 Editor 兼容 |
| HTML/JSON 模型 | 独立 jsonValue；JSON 输入优先、双输出、Node.eq 比较、非法内容不覆盖、深层更新 |
| 扩展注入不足 | Extensions 类型支持 Node/Mark；递归拒绝重复名称，明确创建期边界 |
| URL 和链接交互 | 输入/HTML/粘贴/autolink 统一政策，JSON 链接校验；无效输入保留原链接，IME Enter 和选区失效防护 |
| UI 拆分样式失效 | 子组件归属修复，独立公共前缀 CSS，真实浏览器计算尺寸与截图 |
| 嵌套 form 和焦点 | 链接改为 group，Enter/Escape 显式行为、焦点恢复、宿主 form 提交次数=0 |
| 发布和版本测试 | 真实 tarball 独立安装，Node/SSR/类型/Vite/CSS/桌面移动/axe；3.29.0、3.29.2、3.31.3 |
| 文档与维护规则 | README、中英文 API 文档、public-entry 与 production-contracts 规范，CI 门禁 |

## 最终通过

- 包级单测：59 个。
- vue-tsc typecheck、包 eslint、Vite build + declaration finalizer。
- 架构单测：19 个；扫描 33 包、0 tracked debt。
- 发布验证脚本与 CI 合同：29 个。
- actionlint：3 个 workflow。
- publint --strict；attw esm-only 对 JS 根入口验证（CSS 在浏览器验证）。
- 三版本消费者矩阵，每版 1280x800 和 375x812，Node/SSR/NodeNext/Vite/CSS/键盘/表单/可编辑切换/axe 均通过。
- 两名只读代理分别审查编辑器和发布链路，未发现确定性未解决问题；最终修改由主代理验证。

报告：packages/rich-text-editor/.playwright/consumer-report。
报告不在 dist，因此不会进入 npm tarball。消费者锁文件随诊断报告保留。

## 兼容边界

- 未 fork TipTap/ProseMirror，保持 HTML 字符串和旧导出/API。
- 原始 Editor 是兼容 escape hatch；常规业务按钮使用受保护的 commands。
- HTML 是 schema 序列化，扩展/展示/服务端仍需自身的可信内容政策。
- 不承诺未来未测试的 TipTap 版本；已验证完整同版本元组 3.29.0/3.29.2/3.31.3。
- 本地验证 Chromium 桌面/移动视口及 axe；不是对所有浏览器、真实设备或原生 IME 的普遍认证。
- 本次没有运行不相关包的全仓构建/测试；CI 中保留现有全仓门禁。
