# AI 文档助手界面与功能优化实施计划

## 实施顺序

- [x] 1. 开发前上下文
  - 完整阅读即将修改的 UI、协议、router、测试与配置文件。
  - 加载 `trellis-before-dev` 和 `ai-doc-assistant/frontend` 相关规范；搜索所有将修改的常量、组件契约和样式值。
- [x] 2. 共享边界与依赖
  - 将历史消息数/字符数上限移到 shared protocol，并让 router 复用。
  - 新增 `markdown-it`、`@types/markdown-it`、`@lucide/vue` catalog 依赖并更新 lockfile。
  - 为 20/21 条、20,000/20,001 字符补 server 边界测试。
- [x] 3. Markdown 安全渲染
  - 实现严格 renderer、链接 allowlist 与外链属性。
  - 实现 `MarkdownContent.vue`，接入 Chat 文本分段并保留 Vue Demo 分流。
  - 覆盖结构化 Markdown、原生 HTML、危险 URL、流式未闭合 fence 与 Demo 共存测试。
- [x] 4. 对话可靠性
  - 实现按完整问答对裁剪的历史 helper，并覆盖双边界测试。
  - 实现清空/新对话，包括生成中 abort、迟到回调隔离、下一问空历史。
  - 为 `streamQuery` 增加终态核验，异常 EOF 不再自动完成。
  - 实现“靠近底部才自动跟随”和“回到最新”入口。
  - 展示来源组件、包、路径、相关度和可选来源类型，并覆盖 `source/knowledgeKey` 缺失时的降级与来源跳转。
- [x] 5. 应用工作区
  - 重构 App 为问答/知识库一级视图，保持 Chat 常驻挂载。
  - 提取紧凑顶栏，收敛内部诊断信息与命令菜单。
  - 增加健康检查、组件列表与索引的显式 loading/empty/error/retry 状态及 live semantics。
- [x] 6. 知识库与响应式
  - 将 Overview/Detail 移入主工作区，保留所有既有 emit 与业务 API。
  - 优化总览搜索、计数、卡片网格和加载/错误/空态。
  - 为详情增加区块导航、移动 header、局部表格滚动，以及支持 Enter/Space、tap、Escape、click-outside 和焦点归还的类型 popover。
  - 导出格式使用 Element Plus dropdown；单一 JSON 导入使用直接上传命令；所有命令统一 Lucide 图标。
  - 补齐 DemoPreview 操作栏与代码区的移动布局。
- [x] 7. 自动化与 CI
  - 扩展 App、Chat、API、router、知识库菜单单测。
  - 菜单单测逐项覆盖打开聚焦、ArrowUp/ArrowDown、Home/End、Escape 焦点归还和 click-outside；移动 E2E 覆盖类型 popover 的 tap 打开/关闭。
  - 在现有 E2E fixture 中增加 `1440x900` 与 `390x844` 验证，不复制 server fixture。
  - 将 AI 文档助手 E2E 加入 root `test:e2e` 和 browser CI job，保留失败诊断产物。
- [x] 8. 完整验证与复核
  - 运行 lint、typecheck、单测、coverage、build、E2E。
  - 启动真实 `pnpm dev:ai-doc`，用桌面/移动视口检查截图、DOM 尺寸、横向溢出、菜单焦点、滚动和 Demo 像素输出。
  - 使用 `trellis-check` 做规范、复用、跨层数据流和回归核验；发现缺陷则修复并重跑受影响检查。

## 验证命令

```powershell
pnpm eslint packages/ai-doc-assistant
pnpm -C packages/ai-doc-assistant typecheck
pnpm -C packages/ai-doc-assistant test
pnpm -C packages/ai-doc-assistant test:coverage
pnpm -C packages/ai-doc-assistant build
pnpm -C packages/ai-doc-assistant e2e
pnpm lint:workflows
pnpm test:e2e
```

真实页面：

```powershell
pnpm dev:ai-doc
```

访问 `http://127.0.0.1:5173/__ai-doc/`，验证桌面 `1440x900` 和移动 `390x844`。

## 重点风险文件

- `src/ui/App.vue`：视图切换不能卸载 Chat 或丢失当前请求。
- `src/ui/views/ChatView.vue`：历史、清空、streaming、滚动与 Markdown 在同一状态机内，修改后需完整回归。
- `src/ui/markdown.ts`：唯一允许进入 `v-html` 的 renderer 输出边界。
- `src/ui/api.ts`：EOF、error、done 与 AbortError 必须互斥且语义稳定。
- `src/shared/protocol.ts` / `src/server/router.ts`：共享上限迁移不得改变 wire shape。
- `.github/workflows/ci.yml`：新增步骤复用现有 build 和 Chromium 环境，不重复安装。

## 回滚点

- 完成步骤 3 后先验证 Markdown 与 Demo 分流；失败时可独立退回 Markdown 接入。
- 完成步骤 4 后先验证历史/终态，不依赖工作区视觉改动。
- 完成步骤 6 后执行双视口 E2E；布局失败时保留已验证的可靠性修复，单独回滚工作区模板/CSS。
- CI 调整最后落地，避免实现尚未稳定时扩大流水线噪声。

## 启动前检查

- [x] PRD、设计与实施计划已通过用户最终确认。
- [x] Trellis 任务已进入 `in_progress` 并完成实现与质量检查。
- [x] 已识别并避开 `packages/components` 与另一个 Trellis 任务的并行改动。
