# AI 文档助手结构治理验收证据

## 结构结果

- Architecture tracked debt 从 UI 迁移前的 145 降至 118，本任务 27 条 debt 全部消失：7 条单父组件、19 条 Core 根实现、1 条 UI preview compiler。
- `src/core` 根仅保留 `index.ts` 与 discovery、extraction、generation、indexing、knowledge、retrieval、vector、preview、types domain。
- App、ChatView、DetailView 的私有子组件均归入真实 owner；旧 `src/ui/components`、`src/ui/views` 与 Core 根实现路径不存在。
- `ChatView/index.vue` 从 648 行降至 426 行；唯一 `useChat` 和请求生命周期位于 `composables/use-chat-workspace.ts`，纯消息投影位于 `services/chat-turn-projection.ts`。

## P2 单一职责证据

- `component-discovery.ts` 639 行，仅负责从 package entry、glob、workspace export 与 alias 图解析组件源；无 Core/UI/server 反向依赖。
- `extractor.ts` 515 行，仅编排 `vue-component-meta` 契约抽取、转发合并与类型闭包，不拥有索引、检索或生成状态。
- `type-source.ts` 505 行，仅负责 TypeScript/Vue 类型源定位、解析与可达闭包收集；由 extraction domain 内部消费。
- 三者均无 P1/P0 规模、无 emitted-value cycle，继续机械拆分不会形成新的独立 owner；若后续新增第二类行为，再按真实责任拆分。

## 边界证据

- package exports 保持 `.`, `./plugin`, `./protocol`, `./api-contract`，bin 与 `dist/{index,plugin,protocol,api-contract,cli}.js` 名称不变。
- `VectorStrategy`、Orama、Qdrant 与 DemoPreview 保持 literal dynamic import；构建仍生成独立 chunk。
- `core/index.ts` 对 `splitAnswerSegments` 使用 browser-safe leaf facade，UI 主 chunk 为 220.93 kB，没有吸收 TypeScript-backed SFC transpiler。
- `NO_MATCH_SCORE_THRESHOLD` 仅由 `shared/protocol` 定义；`RetrievedChunk` 归 vector-store result contract，vector 不再 runtime deep-import legacy retriever。
- pack dry-run 包含 `dist`、`index.ts` 与 `src`，不包含 `.playwright`、`test-results` 或 `playwright-report`。

## 验证结果

- AI-doc unit：28 files / 221 tests。
- CLI characterization：7/7；architecture：11/11，33 packages / 118 tracked debt。
- Chat/App/Demo 定向：30/30；vector/App 收口定向：27/27；workflow regression：9/9。
- AI-doc typecheck、build、E2E 2/2、VitePress API-contract consumer typecheck通过。
- 全仓 lint、path contracts 8/8、workflow validation、`git diff --check` 通过。

## 独立复核

- UI owner、Core domain、Chat state 与最终结构分别完成只读独立 review。
- review 发现并修复：旧真实 workspace fixture 路径、preview 注释、UI 主 chunk 意外吸收 TypeScript、vector/retrieval 反向深导入与双阈值、Playwright 发布目录污染、CI artifact 旧路径。
- 最终未发现公共 API、用户行为、HTTP/UI Message Stream 或索引格式回归。
