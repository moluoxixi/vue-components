# ADR-0002 引入 BFF 层，密钥绝不进浏览器

## 状态

proposed（待开发者确认）

## 背景

PRD 确定交付形态为带实时预览的 **Web 调试台**，AI 推理经 `coderelay.cn` 代理访问外部大模型，密钥存于 gitignored `.env.local`。同时本功能要**对外发布 npm 包**。2026-06-15 调整后，默认 content 检索不调用 embedding；vector 增强使用本地 embedding。

关键矛盾：浏览器是不可信前端环境。若让 `ui` 直接携带密钥调外部模型，密钥会被打进前端产物或在网络请求中暴露——发布到 npm 后，任何安装者都能从前端代码或 DevTools 提取密钥并盗用，造成账单与数据风险。

## 决策

**引入 BFF（Backend for Frontend）服务层，由它持有密钥并代理外部大模型调用；浏览器端 `ui` 零密钥，只与同源 BFF 通信。**

- 密钥仅在运行 BFF 的进程环境读取（`.env.local` / 环境变量注入），永不下发到浏览器。
- BFF 暴露 `/api/query`（NL 查询，串 retrieval-strategy→ai，流式返回）、`/api/index`（触发/查询知识库状态）等接口。
- 发布产物 `files` 仅含 `dist`/索引产物，`.npmignore` 显式排除 `.env*`；消费方自行通过环境变量为 BFF 注入密钥。

## 替代方案

- 前端直连外部模型（密钥进浏览器）：致命安全缺陷，发布后必然泄密，否决。
- 让消费方自己写后端代理：增加接入成本、违背「开箱即用」目标，否决；BFF 随包提供。

## 影响

- 架构新增 `server` 模块；运行形态变为「BFF + ui」一体的本地开发服务。
- `ui` 依赖方向收敛：禁止直接 import `ai`/`retrieval-strategy`/`vector-store`，只能走 HTTP。
- 需确认 BFF 技术栈（Node + HTTP 框架 / Vite middleware / Vite 插件随 dev server 起）——见 overview 待确认。

## 后续约束

- BFF 默认仅监听 localhost；是否需额外鉴权待确认。
- 任何把密钥暴露给前端的改动都违反本 ADR，评审须拦截。
