# 组件 AI 文档与调试助手 架构概览

> 状态：**已定稿（ACCEPTED 2026-06-13，UPDATED 2026-06-15）**。依据已定稿 PRD（`docs/prds/组件AI文档与调试助手.md`）+ Spike 001 历史结论（已沉淀到 ADR-0001）+ 本仓真实包结构。2026-06-15 已按开发者确认把默认知识库检索调整为结构化关键词 topK，vector 保留为可选增强。ADR-0003 沙箱方案的隔离强度已由 Spike 002 历史结论确认。

## 背景

仓库是 pnpm workspace 的 Vue 组件库 monorepo（`packages/components`、`packages/ConfigForm/*`、`packages/hooks`，npm scope `@moluoxixi`，Vue 3.5.33 / Vite 6 / TS 5.8）。本功能新增一个**可发布的 npm 包**，提供：AST 契约提取 → 示例生成 → 本地知识库（默认关键词 topK，vector 可选增强）→ 自然语言查询 → AI 推理 → 带实时组件预览的 Web 调试台。

Spike 001 已验证最高技术风险点（浏览器内运行时编译 `<script setup lang="ts">` SFC + 动态挂载 + Props 实时调）**可行**，并给出编译器选型建议（MVP 用 vue3-sfc-loader，留抽象层可切 @vue/compiler-sfc）。

## 现状

- 已有可复用基建：`@moluoxixi/config-form-devtools-vite-plugin`（含 `protocol.ts`/`client.ts`/`adapter.ts`/`openInEditor.ts`/`sourceInject.ts`），其客户端-插件通信协议与 openInEditor 能力可被调试台复用。
- 组件包遵循门面模式：`packages/components/src/index.ts` 统一出口，`exports` 映射 `source/types/import` 三态，`files` 仅含 `dist`。
- 8+ 组件对外契约已沉淀在 `docs/out-components/`，是知识库的现成语料。
- `.env.local`（gitignored）存双 provider 密钥；`.env.example` 为模板。

## 模块边界

新包暂定 `packages/ai-doc-assistant/`（最终包名待确认，建议 `@moluoxixi/ai-doc-assistant`）。内部按职责分层，每层职责单一、对外经门面 `index.ts`：

| 模块 | 职责 | 不负责 | 上游 | 下游 |
|---|---|---|---|---|
| `extractor` | 用 `vue-docgen-api` 解析 SFC + 类型门面，产出组件契约对象（Props/Emits/Slots/Model/类型/默认值） | 不碰 AI、不碰 UI、不做检索 | 组件源码 | retrieval-strategy / generator |
| `generator` | 由契约生成带类型提示的 `.vue` SFC 示例片段 | 不运行/不编译示例 | extractor | ui / retrieval-strategy |
| `retrieval-strategy` | 构建并执行检索策略：默认 content 用结构化关键词 topK；vector 可选增强用本地 embedding + 向量存储 | 不调大模型、不直接渲染 UI | extractor / generator / out-components 文档 | server |
| `vector-store` | vector 模式下封装 Orama / Qdrant 等后端，按向量语义 + 全文能力召回 topK | 不进入默认 content bundle，不替代公共契约抽取 | vector-strategy | server |
| `ai` | AI 推理抽象层：provider 接口（Anthropic / OpenAI 兼容），组装上下文 → 答案+示例 | 不持有密钥读取逻辑以外的业务、不直接被浏览器调用 | retrieval-strategy 上下文 | server |
| `runtime/sfc-compiler` | 运行时把 SFC 源码编译成可挂载组件（Spike 001 产物）；抽象层下挂 loader / compiler-sfc 两实现 | 不做沙箱策略决策（由 ui 层注入执行容器） | — | ui |
| `server`（BFF） | 后端服务：暴露 `/api/query`、`/api/index` 等；**持有 chat 密钥**、串 retrieval-strategy→ai | 不含前端渲染逻辑，不把密钥暴露给浏览器 | retrieval-strategy / ai | ui（HTTP） |
| `ui` | Web 调试台：NL 问答 + 生成示例实时渲染 + Props 调节面板 | 不持有密钥、不直接调外部模型 | server（HTTP）/ runtime | 开发者 |
| `cli` | 命令行：`build-index` 等，触发 extractor→retrieval-strategy | 不服务运行时查询 | extractor / retrieval-strategy | 构建钩子 / CI |

## 依赖方向

```
组件源码 → extractor → generator → retrieval-strategy ┐
                                                       ├→ server(BFF, 持密钥) → ui(浏览器)
                             ai(provider抽象) ──────────┘            ↑
                                         runtime/sfc-compiler ───────┘
cli → extractor/retrieval-strategy（显式刷新 / CI 校验）
```

- 单向依赖，禁止反向：`ui` 不得直接 import `ai`/`retrieval-strategy`/`vector-store`（只能走 server HTTP）；`extractor` 不得依赖 `ai`/`ui`。
- 跨模块只经各自 `index.ts` 门面，禁止 Deep Import（遵循项目前端架构红线）。
- `ai` 的 provider 抽象与 `runtime/sfc-compiler` 的编译器抽象同构：接口稳定、实现可热插拔。

## 数据流

1. **构建期（插件自动 / CLI 手动）**：扫描 `packages/**` 组件 → `extractor` 出公共契约 → `generator` 出 `.vue` 示例 → content 策略建立结构化关键词检索态。vector 模式按需再做本地 embedding + 向量存储构建。索引状态机：`未构建`→`构建中`→`就绪`→`过期(源码变更)`。
2. **查询期（运行时）**：开发者在 `ui` 提问 → HTTP 到 BFF 服务 → retrieval strategy 返回命中契约/文档片段 → `ai` 组装上下文（契约+约束+示例+来源）→ 经 `coderelay.cn` 代理调外部模型 → 流式返回答案+类型提示示例+来源路径 → `ui` 用 `runtime/sfc-compiler` 把示例实时编译挂载，开发者调 Props 看效果。
3. **来源可追溯**：检索结果携带来源元数据（文件路径/文档标题）；检索不到时返回 `MISSING evidence`，AI 不得编造。

## 权限与安全边界

- **密钥绝不进浏览器（核心安全决策，见 ADR-0002）**：AI Chat API Key 仅存于运行 BFF 的环境（gitignored `.env.local` / 环境变量），由 BFF 持有并代理外部模型调用。默认 content 与 vector 的本地 embedding 不需要远端 embedding key。`ui` 只与同源 BFF 通信，前端产物里**不得**出现任何密钥。若把密钥打进前端，发布后可被任意提取盗用。
- **不可信代码沙箱（见 ADR-0003）**：AI 生成的 SFC 是不可信代码。`runtime/sfc-compiler` 的编译产物必须在隔离容器（iframe sandbox）中执行挂载，避免 XSS / 全局污染 / 越权访问父页面。Spike 001 的主页面 `new Function` 仅为可行性验证，生产不可直接用；沙箱方案已由 Spike 002 历史结论确认。
- **数据出仓**（PRD 已确认接受）：组件源码/契约经 `coderelay.cn` 代理发往外部模型，按内部组件库处理。
- **发布产物排除密钥**：`package.json` `files` 仅列 `dist`/索引产物，`.npmignore` 显式排除 `.env*`；消费方自行通过环境变量注入密钥。

## 部署与运行时

- **包形态**：可发布 npm 包，遵循本仓既有约定——`exports` 三态映射（source/types/import）、`.d.ts` 声明、changeset 版本管理、`files` 仅含发布产物。
- **运行形态**：消费方安装后，启动 Vite 插件/BFF（本地服务，注入 chat 密钥），浏览器打开 `ui` 调试台。默认 content 模式首次打开面板自动准备知识库；`cli build-index` 保留为手动刷新与 CI 校验入口。
- **索引分发**：默认 content 不要求随包分发向量 persist 产物；vector 模式可按需使用 Orama/Qdrant 等存储扩展（见 ADR-0007）。
- 复用 `config-form-devtools-vite-plugin` 的 client-plugin 协议与 `openInEditor` 能力。

## 决策与约束

- ADR-0001：编译器选型——MVP 用 `vue3-sfc-loader`，留 `compileSfc()` 抽象层可切 `@vue/compiler-sfc`（依据 Spike 001）。
- ADR-0002：引入 BFF 层持有密钥并代理外部模型调用，浏览器零密钥。
- ADR-0003：AI 生成代码必须沙箱隔离执行（iframe sandbox），隔离强度已由 Spike 002 历史结论验证。
- ADR-0004：历史向量优先方案，已被 ADR-0006/ADR-0007 调整为默认 content + vector 可选增强。
- ADR-0005：BFF = Vite 插件 + dev server middleware（`/__ai-doc/api/*`），handler 与传输层解耦，另提供 standalone server 入口。
- ADR-0006：默认检索策略 = 结构化关键词 topK，只把命中公共契约交给 chat 模型。
- ADR-0007：vector 是可选增强，采用本地 embedding + 可插拔向量存储，仅在显式切换时启用。
- **包名/目录（确认）**：`@moluoxixi/ai-doc-assistant`，位于 `packages/ai-doc-assistant/`。
- **索引构建（确认）**：默认 content 模式可由插件自动准备知识库，同时提供 `cli build-index` 供消费方按需重建或 CI 校验。vector 模式显式启用后再构建向量索引。
- **BFF 鉴权（确认）**：默认仅监听 `127.0.0.1`，不对外暴露；MVP 不加 token。若未来需非 localhost 访问，再加 token（记为后续约束，不在 MVP 范围）。
- 模块间单向依赖、门面出口、禁止 Deep Import（遵循前端架构红线）。
- AI provider、编译器、知识库引擎均走抽象层，实现可热插拔。

## 风险与待确认

- ✅ 已解决（Spike 002）：沙箱隔离强度与宿主↔沙箱 Props 双向同步协议已用真实浏览器验证（iframe sandbox `allow-scripts` 无 `allow-same-origin` + 自包含 IIFE + postMessage）。结论已沉淀到 ADR-0003；`spikes/` 可作为本地 gitignored 参考，但不作为长期测试目录、知识库语料或发布输入。
- 默认关键词检索对同义词、口语化问题的召回弱于 embedding；实现期用领域词映射与可解释来源减少误召回，必要时再启用 vector 增强。
- vector 模式的本地模型首次加载、索引体积和大知识库性能仍需实测；超标时评估外部向量库或缩小语料。
- `MISSING verify script`：知识源注册表未经 `verify-knowledge-sources.mjs` 校验（环境项，不阻断）。
