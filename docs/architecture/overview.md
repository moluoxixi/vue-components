# 组件 AI 文档与调试助手 架构概览

> 状态：**已定稿（ACCEPTED 2026-06-13）**。依据已定稿 PRD（`docs/prds/组件AI文档与调试助手.md`）+ Spike 001 结论（`spikes/001-runtime-sfc-compile/`）+ 本仓真实包结构。开发者已确认「用标准向量库 + 技术栈自定」并此前授予剩余决策自主权，原 6 项 `MISSING` 已全部拍板（见决策与约束节）。仅 ADR-0003 沙箱方案的隔离强度待 Spike 002 实测，不阻断架构定稿。

## 背景

仓库是 pnpm workspace 的 Vue 组件库 monorepo（`packages/components`、`packages/ConfigForm/*`、`packages/hooks`，npm scope `@moluoxixi`，Vue 3.5.33 / Vite 6 / TS 5.8）。本功能新增一个**可发布的 npm 包**，提供：AST 契约提取 → 示例生成 → 本地知识库（向量+FTS）→ 自然语言查询 → AI 推理 → 带实时组件预览的 Web 调试台。

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
| `extractor` | 用 `vue-docgen-api` 解析 SFC + 类型门面，产出组件契约对象（Props/Emits/Slots/Expose/Model/类型/默认值） | 不碰 AI、不碰 UI、不做检索 | 组件源码 | indexer / generator |
| `generator` | 由契约生成带类型提示的 `.vue` SFC 示例片段 | 不运行/不编译示例 | extractor | ui / indexer |
| `indexer` | 构建本地索引（向量+FTS），调 embedding 端点；产物落包内本地文件 | 不直接服务查询 UI | extractor / generator / out-components 文档 | retriever |
| `retriever` | 混合检索（向量为主 + FTS 多路召回融合），返回命中契约/文档片段 + 来源元数据 | 不调大模型、不生成答案 | indexer 产物 | server |
| `ai` | AI 推理抽象层：provider 接口（Anthropic / OpenAI 兼容），组装上下文 → 答案+示例 | 不持有密钥读取逻辑以外的业务、不直接被浏览器调用 | retriever 上下文 | server |
| `runtime/sfc-compiler` | 运行时把 SFC 源码编译成可挂载组件（Spike 001 产物）；抽象层下挂 loader / compiler-sfc 两实现 | 不做沙箱策略决策（由 ui 层注入执行容器） | — | ui |
| `server`（BFF） | 后端服务：暴露 `/api/query`、`/api/index` 等；**持有密钥**、代理 AI 与 embedding 调用、串 retriever→ai | 不含前端渲染逻辑 | retriever / ai | ui（HTTP） |
| `ui` | Web 调试台：NL 问答 + 生成示例实时渲染 + Props 调节面板 | 不持有密钥、不直接调外部模型 | server（HTTP）/ runtime | 开发者 |
| `cli` | 命令行：`build-index` 等，触发 extractor→indexer | 不服务运行时查询 | extractor / indexer | 构建钩子 |

## 依赖方向

```
组件源码 → extractor → generator → indexer → retriever ┐
                                                        ├→ server(BFF, 持密钥) → ui(浏览器)
                              ai(provider抽象) ──────────┘            ↑
                                          runtime/sfc-compiler ───────┘
cli → extractor/indexer（构建期）
```

- 单向依赖，禁止反向：`ui` 不得直接 import `ai`/`retriever`/`indexer`（只能走 server HTTP）；`extractor` 不得依赖 `ai`/`ui`。
- 跨模块只经各自 `index.ts` 门面，禁止 Deep Import（遵循项目前端架构红线）。
- `ai` 的 provider 抽象与 `runtime/sfc-compiler` 的编译器抽象同构：接口稳定、实现可热插拔。

## 数据流

1. **构建期（CLI / 构建钩子）**：扫描 `packages/**` 组件 → `extractor` 出契约 → `generator` 出 `.vue` 示例 → `indexer` 调 embedding 端点算向量 + 建 FTS → 索引落包内本地文件（构建产物 + `.cache/`）。索引状态机：`未构建`→`构建中`→`就绪`→`过期(源码变更)`。
2. **查询期（运行时）**：开发者在 `ui` 提问 → HTTP 到 BFF 服务 → `retriever` 混合检索命中契约/文档片段 → `ai` 组装上下文（契约+约束+示例+来源）→ 经 `coderelay.cn` 代理调外部模型 → 流式返回答案+类型提示示例+来源路径 → `ui` 用 `runtime/sfc-compiler` 把示例实时编译挂载，开发者调 Props 看效果。
3. **来源可追溯**：检索结果携带来源元数据（文件路径/文档标题）；检索不到时返回 `MISSING evidence`，AI 不得编造。

## 权限与安全边界

- **密钥绝不进浏览器（核心安全决策，见 ADR-0002）**：AI 与 embedding 的 API Key 仅存于运行 BFF 的环境（gitignored `.env.local` / 环境变量），由 BFF 持有并代理所有外部模型调用。`ui` 只与同源 BFF 通信，前端产物里**不得**出现任何密钥。若把密钥打进前端，发布后可被任意提取盗用。
- **不可信代码沙箱（见 ADR-0003）**：AI 生成的 SFC 是不可信代码。`runtime/sfc-compiler` 的编译产物必须在隔离容器（iframe sandbox 或 Web Worker）中执行挂载，避免 XSS / 全局污染 / 越权访问父页面。Spike 001 的主页面 `new Function` 仅为可行性验证，生产不可直接用。沙箱方案需独立 spike（Spike 002）。
- **数据出仓**（PRD 已确认接受）：组件源码/契约经 `coderelay.cn` 代理发往外部模型，按内部组件库处理。
- **发布产物排除密钥**：`package.json` `files` 仅列 `dist`/索引产物，`.npmignore` 显式排除 `.env*`；消费方自行通过环境变量注入密钥。

## 部署与运行时

- **包形态**：可发布 npm 包，遵循本仓既有约定——`exports` 三态映射（source/types/import）、`.d.ts` 声明、changeset 版本管理、`files` 仅含发布产物。
- **运行形态**：消费方安装后，(a) 跑 `cli build-index` 生成本地索引；(b) 启动 BFF（本地服务，注入密钥）；(c) 浏览器打开 `ui` 调试台。BFF + `ui` 可打包为一体的本地开发服务（类 devtools）。
- **索引分发**：persist 产物随包分发（开箱即用）；`cli build-index` 供消费方源码变更后按需重建。索引引擎 = Orama（见 ADR-0004）。
- 复用 `config-form-devtools-vite-plugin` 的 client-plugin 协议与 `openInEditor` 能力。

## 决策与约束

- ADR-0001：编译器选型——MVP 用 `vue3-sfc-loader`，留 `compileSfc()` 抽象层可切 `@vue/compiler-sfc`（依据 Spike 001）。
- ADR-0002：引入 BFF 层持有密钥并代理外部模型调用，浏览器零密钥。
- ADR-0003：AI 生成代码必须沙箱隔离执行（iframe/Worker），隔离强度待 Spike 002 验证。
- ADR-0004：知识库引擎 = `@orama/orama`（原生全文+向量+混合检索）+ `@orama/plugin-data-persistence`（包内本地文件持久化）。embedding 维度对齐 `text-embedding-3-small`（1536）。
- ADR-0005：BFF = Vite 插件 + dev server middleware（`/__ai-doc/api/*`），handler 与传输层解耦，另提供 standalone server 入口。
- **包名/目录（确认）**：`@moluoxixi/ai-doc-assistant`，位于 `packages/ai-doc-assistant/`。
- **索引分发（确认）**：随包分发 persist 产物（开箱即用），同时提供 `cli build-index` 供消费方按需重建（源码变更后刷新时效）。两者并存：随包给默认，CLI 给更新。
- **BFF 鉴权（确认）**：默认仅监听 `127.0.0.1`，不对外暴露；MVP 不加 token。若未来需非 localhost 访问，再加 token（记为后续约束，不在 MVP 范围）。
- 模块间单向依赖、门面出口、禁止 Deep Import（遵循前端架构红线）。
- AI provider、编译器、知识库引擎均走抽象层，实现可热插拔。

## 风险与待确认

- ✅ 已解决（Spike 002）：沙箱隔离强度与宿主↔沙箱 Props 双向同步协议已用真实浏览器验证（iframe sandbox `allow-scripts` 无 `allow-same-origin` + 自包含 IIFE + postMessage）。详见 ADR-0003 与 `spikes/002-iframe-sandbox/`。
- 查询期对用户问题算 embedding 是网络调用，是 < 500ms 检索目标的主要风险源——需做查询向量缓存（实现计划环节细化）。
- `text-embedding-3-small` 1536 维写入 Orama 的检索性能与 persist 体积需在实现期实测；超标则评估降维或裁剪语料。
- `MISSING verify script`：知识源注册表未经 `verify-knowledge-sources.mjs` 校验（环境项，不阻断）。
