# AI 文档助手结构调研

## Architecture Debt

- 7 条 single-parent debt：App 的 `WorkspaceTopbar`/三个 View、ChatView 的 `DemoPreview`/`MarkdownContent`、DetailView 的 `TypeReference`。
- 19 条 `src/core/*.ts` feature-root debt。
- 1 条 `src/ui/preview/compile.ts` feature-root debt。

合计 27 条，均指向本子任务。

## 热点

- `src/ui/views/ChatView.vue`：648 行，混合 chat transport/state/actions 与消息 UI。
- `src/core/component-discovery.ts`：639 行，负责 entry/glob/workspace/alias discovery。
- `src/core/extractor.ts`：515 行，负责 component-meta contract extraction。
- `src/core/type-source.ts`：505 行，负责 TypeScript 类型来源与 attrs/expose 解析。
- 无 P0/P1 文件；上述均为 P2，按职责而非行数机械拆分。

## 稳定契约

- package exports：`.`, `./plugin`, `./protocol`, `./api-contract`；bin：`ai-doc-assistant`。
- 构建产物：`index`、`plugin`、`protocol`、`api-contract`、`cli` 与 `dist/ui`。
- CLI：`build-index`、`serve`，默认 `127.0.0.1:5173`，固定 stdout/stderr/exit 行为。
- HTTP：`/__ai-doc/api` routes、错误码/状态码、sources -> text -> example -> finish stream 顺序。
- 动态边界：Vite peer、VectorStrategy、Orama/Qdrant store、DemoPreview。
- 外部源码 consumer：VitePress theme 通过 `@moluoxixi/ai-doc-assistant/api-contract` 导入类型。

## 覆盖缺口

- 缺 CLI command/options/output/error 直接测试，移动或重组 CLI 前需补。
- Router 对 import success/conflict/overwrite 与 declared `force` 字段覆盖较弱，但本任务不改 HTTP 行为。
- Core/router/UI unit 与 desktop/mobile E2E 已覆盖主要生成、检索、stream 和交互路径。
