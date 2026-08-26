# AI 文档助手界面与功能优化技术设计

## 设计目标

在不改变 BFF 路由、SSE 事件结构和核心抽取/检索逻辑的前提下，把现有单页外壳整理为稳定的双视图工作区，并将结构化回答、长会话可靠性、状态反馈和响应式行为作为同一条用户链路实现与验证。

## 总体架构

```text
App.vue
├─ WorkspaceTopbar
│  ├─ 产品身份
│  ├─ 问答 / 知识库一级视图切换
│  ├─ 可操作的知识库状态
│  └─ 导入 / 更新 / 诊断命令
├─ 全局状态与错误区域
└─ WorkspaceMain
   ├─ ChatView（常驻，v-show 切换）
   │  ├─ Conversation turns
   │  │  ├─ MarkdownContent
   │  │  ├─ DemoPreview
   │  │  └─ Source references
   │  └─ Ask composer / clear / jump-to-latest
   └─ KnowledgeWorkspace
      ├─ OverviewView
      └─ DetailView
```

不引入 Router 或 store。`App.vue` 继续持有跨视图状态，并新增 `workspaceView: 'chat' | 'knowledge'`、健康检查与组件列表的显式加载状态。`ChatView` 必须常驻挂载；知识库视图可以按当前 `knowledgeView` 在总览和详情之间切换。

## 工作区与视觉系统

### 应用壳

- 桌面端采用紧凑顶栏：品牌位于左侧，中间使用视图 tabs，右侧只保留知识库状态和必要命令。
- 移动端顶栏保留品牌、当前状态和 overflow 命令；问答/知识库使用固定高度的紧凑视图切换，不依赖会换行的 chip 集合。
- 主区使用 `min-width: 0`、`min-height: 0` 和独立滚动容器，避免 flex/grid 子项撑开页面。
- 颜色保持中性工作台基调，状态色只用于成功、警告和错误；卡片圆角不超过 8px，不嵌套卡片。
- 全局补齐共享 UI token：顶栏高度、内容宽度、边框、弱文本、焦点环和响应式间距；字号不随 viewport 缩放。

### Chat

- 对话与输入继续使用同一居中内容轨道；文字回答收窄为适合阅读的宽度，Demo 可使用更宽轨道。
- 空态只保留产品任务信号与输入框，不使用大面积说明性文案。
- 会话存在时显示“新对话/清空”图标命令；流式中触发时先失效 controller，再 abort 和清空。
- 当用户离底部超过阈值时关闭自动跟随，显示“回到最新”浮动命令；点击后滚到底并恢复跟随。
- 来源条目展示组件、包、相关度以及必填的 `docPath`；可选的 `source` 缺失时不显示来源类型，可选的 `knowledgeKey` 缺失时继续用组件名打开详情。

### Knowledge

- 移除知识库 `ElDialog` 承载，改为主区一级视图；现有 Overview/Detail 业务组件及 emit 契约保持不变。
- 总览限制最大内容宽度，搜索与结果计数在窄屏可换行；网格使用 `minmax(min(100%, 220px), 1fr)`。
- 详情使用“区块导航 + 内容列”。桌面区块导航 sticky，移动端使用可横向滚动的紧凑导航；只渲染实际存在的契约分区。
- 每个表格由自身容器承担横向滚动，详情根容器只负责纵向阅读；详情头在窄屏改为纵向排列。

### 菜单与图标

- 导出格式集合使用 Element Plus dropdown，复用其定位、click-outside、键盘与焦点行为；导入当前只有一个 JSON 命令，使用直接上传图标按钮。业务 API 调用仍留在原组件。
- `Download`、`Upload`、`RefreshCw`、`BookOpen`、`MessageSquare`、`Plus`、`ArrowUp` 等命令使用 `@lucide/vue`，图标按钮带 `aria-label` 与 tooltip。
- 详情类型解释改用可聚焦、可点击的 code 按钮作为 popover 触发器：键盘 Enter/Space 和触屏 tap 均可切换显示，Escape 或点击外部关闭并归还焦点，不改变类型内容。

## Markdown 渲染

新增 `MarkdownContent.vue` 与一个单例 renderer 模块：

```ts
new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})
```

- `MarkdownContent` 只接收原始 Markdown 字符串，内部产生 HTML；调用方不能传入预制 HTML。
- 重写 `validateLink`，只允许 `http:`、`https:`、`mailto:`、相对路径和锚点，拒绝 `javascript:`、`vbscript:`、`file:`、`data:` 与未知 scheme。
- 重写 `link_open`：HTTP(S) 外链增加 `target="_blank" rel="noopener noreferrer"`，相对链接保持当前页面语义。
- `html: false` 确保 `<script>`、事件属性、iframe 和原生 anchor 作为文本转义。首版不引入 DOMPurify，不启用透传 HTML 的插件。
- `ChatView` 仍先用 `splitAnswerSegments` 提取 Vue fence；只有 `kind === 'text'` 的分段交给 `MarkdownContent`。
- 流式阶段同步重渲染；不引入 Shiki。普通代码块使用 CSS 和原生横向滚动。

## 对话历史与流状态

### 共享边界

把 `MAX_HISTORY_MESSAGES = 20` 与 `MAX_HISTORY_CHARACTERS = 20_000` 移到 shared protocol 模块，server router 和 UI helper 共同使用，wire shape 不变。

### 历史算法

1. 过滤 `status === 'done'` 且回答非空的轮次。
2. 从最新轮次向前逐对累加。
3. 加入下一对将超过消息或字符上限时立即停止。
4. 将保留的后缀反转并展平为 `user/assistant` 消息。
5. 不截断单条内容、不拆对、不跳过过大的最新对去选择更旧内容；若最新一对自身超限，发送空历史。

字符计数使用 JavaScript `string.length`，与 Node 校验一致。

### 终态

- `streamQuery` 跟踪是否收到 `done` 或 `error`。
- 收到 `done` 后正常结束；`error` 仍通过现有 callback 更新 turn，避免同时 callback 和 throw 两次写错误。
- EOF 前没有任何终态时抛出明确的“流意外中断”错误。
- AbortError 保持 `stopped` 语义；删除 ChatView 把无异常 EOF 自动转成 done 的兜底。

## 状态模型

`App.vue` 明确区分：

- `healthStatus: 'checking' | 'ready' | 'error'`
- `componentsStatus: 'idle' | 'loading' | 'ready' | 'empty' | 'error'`
- `indexState` 继续消费现有协议，但通过本地化展示映射输出。

全局连接/构建使用 `role="status"`，错误条使用 `role="alert"` 和重试/关闭操作。Overview 获得可选 loading/error props，避免把未返回数组当空数据。流式正文不再把整个消息设为持续 live region，只用短状态节点播报“正在生成/已完成/已停止/失败”。

## 数据流与兼容性

- Chat 现有 `v-model:question`、`indexReady/indexState`、`open-source` 和 `focusQuestion()` 契约保持不变。
- Overview `components/open`、Detail `name/back/ask` 契约保持不变；仅允许为 Overview 新增带默认值的状态 props。
- `SourceRef` wire shape 不变。UI 展示必填的 `docPath` 与 `score`，消费可选的 `source` 和 `knowledgeKey`；`source` 缺失时省略来源类型，`knowledgeKey` 缺失时用组件名打开详情。
- 构建、导入、JSON 导出、索引与查询 API 不变。
- 新增直接依赖 `markdown-it`、`@types/markdown-it` 和 `@lucide/vue`，使用 workspace catalog 版本。

## 受影响文件

主要修改：

- `packages/ai-doc-assistant/src/ui/App.vue`
- `packages/ai-doc-assistant/src/ui/views/ChatView.vue`
- `packages/ai-doc-assistant/src/ui/views/OverviewView.vue`
- `packages/ai-doc-assistant/src/ui/views/DetailView.vue`
- `packages/ai-doc-assistant/src/ui/components/DemoPreview.vue`
- `packages/ai-doc-assistant/src/ui/api.ts`
- `packages/ai-doc-assistant/src/shared/protocol.ts`
- `packages/ai-doc-assistant/src/server/router.ts`
- `packages/ai-doc-assistant/package.json`

计划新增：

- `packages/ai-doc-assistant/src/ui/components/WorkspaceTopbar.vue`
- `packages/ai-doc-assistant/src/ui/components/MarkdownContent.vue`
- `packages/ai-doc-assistant/src/ui/markdown.ts`
- `packages/ai-doc-assistant/src/ui/chat-history.ts`

验证与门禁：

- `packages/ai-doc-assistant/__tests__/markdown-renderer.test.ts`
- `packages/ai-doc-assistant/__tests__/chat-view.test.ts`
- `packages/ai-doc-assistant/__tests__/ui-api.test.ts`
- `packages/ai-doc-assistant/__tests__/router.test.ts`
- `packages/ai-doc-assistant/__tests__/app-shell.test.ts`
- `packages/ai-doc-assistant/__tests__/knowledge-export-entry.test.ts`
- `packages/ai-doc-assistant/__e2e__/ui-flow.e2e.test.ts`
- `packages/ai-doc-assistant/playwright.config.ts`
- `package.json`
- `.github/workflows/ci.yml`

菜单测试必须逐项验证打开后聚焦、ArrowUp/ArrowDown、Home/End、Escape 关闭与焦点归还，以及点击外部关闭。Chat 测试必须验证来源路径/类型/相关度展示和可选字段降级；移动 E2E 必须验证类型 popover 可通过 tap 打开并关闭。

## 风险与回滚

- 工作区切换错误可能卸载 Chat 并丢失轮次。通过常驻 `v-show`、现有多轮测试与切换 E2E 防护。
- Markdown 的 `v-html` 是安全边界。通过 `html:false`、URL allowlist、禁止外部 HTML 输入和恶意 payload 单测防护；任何未来启用 HTML 的改动必须重新评估 sanitizer。
- 长详情布局改动可能影响类型 tooltip 与表格滚动。桌面/移动真实组件契约 E2E 与截图验证覆盖。
- 历史常量迁移可能造成 server/UI 漂移。共享导出和 20/21、20,000/20,001 双边界测试覆盖。
- CI 增加浏览器测试会增加时间。复用现有 Chromium job 和单一 server fixture，不新增浏览器矩阵。

回滚以功能块为单位：Markdown 组件可退回纯文本渲染；工作区可在不撤销状态修复的情况下恢复 Dialog；CI 步骤可独立移除。不得通过回滚删除新增的安全与历史边界测试来隐藏回归。
