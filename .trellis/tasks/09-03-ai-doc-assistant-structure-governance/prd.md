# AI 文档助手结构治理

## 目标

治理 `packages/ai-doc-assistant` 的 UI 组件所有权、Core domain 目录与内部依赖边界，使组件和核心服务可按职责定位，同时保持 CLI、HTTP/UI Message Stream、索引/生成结果、UI 行为与公开 package subpath 不变。

## 背景

- Architecture manifest 有 27 条本任务精确债务：7 条单父组件 owner debt、19 条 `src/core` feature root debt、1 条 `src/ui/preview/compile.ts` root-file debt。
- `ChatView.vue` 648 行，同时承载 transport/history、请求取消和消息/来源/示例 UI；`component-discovery.ts` 639 行、`extractor.ts` 515 行、`type-source.ts` 505 行为 P2 热点。
- package 已公开 `.`, `./plugin`, `./protocol`, `./api-contract` 与 `ai-doc-assistant` bin；这些入口及 `dist/{index,plugin,protocol,api-contract,cli}.js` 文件名是稳定契约。
- CLI 缺少对 command/options/stdout/stderr/exit 的直接 characterization；Core、router、UI 与 browser flow 已有较完整覆盖。

## 需求

1. 清零该任务的 27 条 architecture debt，不新增 unknown/stale diagnostic，不保留旧私有路径 forwarding shim。
2. 将 `WorkspaceTopbar`、`ChatView`、`DetailView`、`OverviewView` 归入 `ui/App/components/`；将 `DemoPreview`、`MarkdownContent` 归入 `ChatView/components/`，`TypeReference` 归入 `DetailView/components/`。
3. 保持 `DemoPreview` 的 literal dynamic import 和 UI chunk 行为；移动后同步测试/import，不从旧 `ui/components` 或 `ui/views` 暴露兼容入口。
4. 将 `ui/preview/compile.ts` 归入 `preview/services/`，`preview/index.ts` 保持声明式 feature barrel。
5. 将 Core 根实现拆成 discovery、extraction、generation、indexing、knowledge、retrieval、vector、preview domain feature；每个 feature 根只保留 barrel，行为进入 services/adapters/validation/types。
6. 保持 `src/core/index.ts` 对原公开符号的兼容导出；内部跨 domain import 走 public barrel，type-only 边保持 type-only，vector/Orama/Qdrant/Vite 的动态加载边界不变。
7. 拆分 `ChatView` 的会话/请求状态与渲染编排，使 SFC 保留模板和事件连接，不复制 AI SDK chat state。
8. 在移动前补 CLI command/options/output/error characterization；复用 router/context/extractor/generator/UI/browser tests 锁定协议和结果。
9. 每个稳定边界独立提交并运行 package test/typecheck/build；最终运行 package E2E、VitePress API-contract consumer typecheck 与全仓 lint/architecture/path/workflow。

## 验收标准

- [ ] 27 条目标 debt 删除，architecture unknown/stale 为零。
- [ ] UI 单父组件位于真实父组件 `components/`，旧 `ui/components`/`ui/views` 私有路径不存在。
- [ ] Core 根只保留 `index.ts` 与 domain feature 目录，各 domain 的 services/adapters/validation/types 可独立定位。
- [ ] Core P2 热点按真实职责拆分或具有单一职责证据；ChatView 不再同时拥有 transport state 与大段渲染编排。
- [ ] CLI commands/options/stdout/stderr/exit、server routes、stream chunk 顺序、index/import/生成结果与 UI 行为不变。
- [ ] package 根与 `./plugin`、`./protocol`、`./api-contract`、bin 的 source/import/types/build 入口无漂移。
- [ ] 动态 vector stores、Vite peer 与 Demo preview 保持按需加载，无新增 value cycle 或错误 deep import。
- [ ] package test/typecheck/build、E2E、consumer typecheck、全仓 lint/architecture/path/workflow 与 `git diff --check` 通过。
- [ ] README/spec 与最终边界一致；每批独立 commit，不 push；归档时工作树干净。

## 范围外

- 不改变 UI 视觉、文案、焦点/键盘交互、响应式布局或组件库。
- 不改变 `/__ai-doc/api` 路由、HTTP 状态码、错误码、UI Message Stream 数据顺序或 provider 配置语义。
- 不改变索引 schema、持久化格式、knowledge import wire format、生成 Markdown/代码块格式。
- 不重构无 architecture debt 且职责清晰的 CLI/server 文件，除非是移动后的必要 import 或 characterization。
- 不改变公开 package API；不为测试方便扩大入口。

## 关键决策

- 按 domain ownership 建立 Core feature，而不是把 19 个文件全部塞进一个 `services/` 大桶。
- Core domain feature 使用 `index.ts` 公开边界，具体实现进入其责任目录，符合全仓 feature-root 合同。
- `ChatView` 的 AI SDK state 仍只有一个 owner；提取 composable 只移动现有生命周期和请求动作。
- 父任务 standing approval 覆盖本子任务的内部重构与 phase transition；只有公共行为/API 或跨包依赖方向变化才重新请求确认。
