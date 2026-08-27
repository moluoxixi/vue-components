# 国际化本地服务与安全写回

## 目标

为 `@moluoxixi/i18n-tool` 实现可发布 CLI、本地同源 BFF、项目配置加载、受控资源扫描以及 `scan -> preview -> apply` 安全写回协议，使上层 UI 能在不接触任意文件路径或密钥的前提下创建和更新本地语言文件。

## 需求

### R1. 配置与 CLI

- 使用 `jiti` 加载 `i18n-tool.config.ts/.mts/.js/.mjs`；支持 `--config` 显式指定和从 cwd 向上发现。
- 提供 `defineConfig()` 与运行时 resolver，验证 adapter、资源 glob/layout、locale、输出规则、AI 配置和服务参数。
- root 优先级为 `--root > config.root > config directory`；CLI 参数优先于 `config.server`，未知参数和非法端口直接失败。
- 默认监听 `127.0.0.1`；支持 `--host`、`--port`、`--open`，Vite server 使用 `configFile: false` 隔离用户项目配置。
- AI key 仅从配置指定的服务端环境变量读取；健康接口只返回脱敏状态。

### R2. API 与状态机

- 共享协议覆盖 config、scan、translate stream、preview、apply、cancel 和稳定错误码。
- 成功 scan 产生不可变 `scanId`、服务端签发的 resource ID 和 baseline hash。
- preview 绑定 `scanId`、baseline hashes 和 normalized operations，返回结构化变更、文本 diff、warning 与一次性/幂等 apply token。
- apply 只接受 preview token，不接受浏览器提供绝对路径或任意 operation；stale/invalid preview 禁止写盘。
- 请求体、文件数、总字节、key 数、并发任务和并发 apply 具有集中限制。

### R3. 路径与同源安全

- 配置解析后得到 canonical project root 与显式 resource roots；所有目标同时做词法与 canonical containment 校验。
- 对不存在目标解析最近存在祖先，拒绝 symlink/junction 逃逸、相邻同前缀目录、绝对路径和 traversal。
- 有副作用的请求要求专用私有 header、POST 和 Origin/Referer 同源校验；不能只依赖 CORS。
- 浏览器及公开错误 DTO 不暴露绝对路径、密钥或上游响应正文。

### R4. 原子写回

- apply 前重新读取文件并校验 baseline、adapter schema、占位符、serialize 和 adapter round-trip。
- 新建与更新均先写同目录唯一临时文件，再 rename；失败清理临时文件且保留原文件。
- 只对已知瞬时 Windows 锁错误有界重试；baseline 或目标冲突不重试。
- 已有非空译文必须在 preview 中标记 overwrite 并携带明确确认。

## 验收标准

- [x] CLI 可通过默认发现和 `--config` 启动本地服务，展示最终 config path/root 和可访问 URL。
- [x] 合法项目可 scan，目标文件不存在时 preview/apply 原子创建，存在时只应用已确认操作。
- [x] preview 后外部修改返回稳定冲突且不覆盖磁盘。
- [x] 绝对路径、`../`、编码 traversal、symlink/junction 和相邻同前缀目录均被拒绝。
- [x] 缺私有 header、跨源 Origin/Referer、GET 写请求、超限 payload 与并发 apply 均失败且无副作用。
- [x] serialize/round-trip/rename 失败保留旧文件并清理临时文件。
- [x] 取消从 HTTP 连接传播到翻译核心和上游请求，断连后不继续写 SSE。
- [x] 单元测试、API 集成测试、类型检查、构建和 pack 验证通过。

## 范围外

- 远程部署、多租户鉴权和公网监听默认值。
- 云端文件系统、Git 提交或 Pull Request 自动化。
- Vue 工作台实现。

## 依赖

- 依赖 `08-27-shared-ai-provider-migration` 的共享 AI transport。
- 依赖 `08-27-i18n-json-translation-core` 的资源适配、翻译与变更计划契约。
