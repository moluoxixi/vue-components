# ADR-0005 BFF 技术栈：Vite 插件 + dev server middleware

## 状态

accepted（2026-06-13，开发者授权「技术栈你决定」）

## 背景

ADR-0002 确定需要 BFF 层持有密钥、代理外部模型调用。需选定其技术栈与运行形态。本仓已是 Vite 6 工程，且有成熟先例 `@moluoxixi/config-form-devtools-vite-plugin`（client-plugin 协议 + openInEditor）。

## 决策

**BFF 实现为一个 Vite 插件，通过 `configureServer` 注入 dev server middleware 暴露 `/__ai-doc/api/*` 接口；密钥在插件（Node 端）读取，浏览器 `ui` 仅走同源请求。**

- 复用项目现有 Vite 工具链与 `devtools-vite-plugin` 的 client↔plugin 通信范式，零额外服务进程，开箱即用。
- `ui` 作为 Vite 应用页面挂在同一 dev server，天然同源，无 CORS、无独立端口管理。
- 生产/独立运行场景另提供一个基于 Node `http`/`conn?` 的 standalone server 入口（复用同一组 handler），供不走 Vite 的消费方使用——handler 与传输层解耦。

## 替代方案

- 独立 Node + Express/Fastify 常驻服务：功能可行但多一个进程与端口、偏离 devtools 形态、接入成本高，降级为 standalone 后备入口。
- Serverless / 云函数代理：违背「本地工具、包内本地索引」定位，否决。

## 影响

- `server` 模块产出：(a) `aiDocAssistantPlugin()` Vite 插件；(b) 一组传输无关的 request handler（query/index）；(c) standalone server 入口。
- HTTP 接口前缀 `/__ai-doc/api/`：`POST /query`（流式 SSE 返回答案+示例+来源）、`GET|POST /index`（索引状态/触发重建）。
- 框架依赖最小化：middleware 用 Node 原生 + Vite Connect 实例，避免重型 web 框架。

## 后续约束

- handler 必须与 Vite 解耦，保证 standalone 入口复用同一逻辑，不得双份实现。
- 接口契约在 API 环节（`docs/out-api/` 或 `docs/api/`）正式定义。
