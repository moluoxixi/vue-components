# 全局接口协议

> 提供方：组件 AI 文档与调试助手 BFF（`@moluoxixi/ai-doc-assistant`）。依据架构 ADR-0002（BFF 持密钥）、ADR-0005（Vite 插件 + dev server middleware）。状态：契约设计（与架构同步，随实现细化）。

## 适用范围

- 本协议覆盖 BFF 经 Vite dev server middleware 暴露的全部 HTTP 接口，统一前缀 `/__ai-doc/api`。
- 消费方 = 同源浏览器内的调试台 UI。BFF 与 UI 同源（同一 Vite server），无跨域。
- 浏览器侧零密钥：外部大模型调用由 BFF 服务端代理，密钥仅存于服务端进程环境变量。默认 content 检索不调用 embedding；vector 增强使用本地 embedding，不需要远端 embedding key。

## 成功响应

- 非流式接口：HTTP 200，`Content-Type: application/json`，响应体为接口各自定义的 JSON 结构（无统一信封包裹，直接返回资源对象）。
- 流式接口（问答）：HTTP 200，`Content-Type: text/event-stream`，SSE 协议，详见下「流式响应」。

## 流式响应

- 问答接口用 SSE（Server-Sent Events）逐段下推大模型输出，满足 PRD「端到端首字 < 3s」的体验目标。
- 事件类型（`event:` 字段）：
  - `token`：`data` 为增量文本片段（answer 流式正文）。
  - `sources`：`data` 为本次回答引用的知识库命中项数组（检索结果，含组件名/文档路径/score）。
  - `example`：`data` 为生成的 `.vue` 示例代码块（可被调试台沙箱挂载）。
  - `done`：流结束，`data` 为 `{"finishReason": "stop|length|error"}`。
  - `error`：流中错误，`data` 为 `{"code", "message"}`，随后关闭流。
- 客户端须处理流中途 `error` 事件与连接中断。

## 列表分页

- MVP 阶段无大列表分页接口（知识库检索固定 top-K，由 query 参数 `topK` 控制，非分页）。后续若新增列表接口在此补充。

## 错误响应

- 非流式接口错误：对应 HTTP 状态码 + JSON 体：

```json
{ "code": "INDEX_NOT_READY", "message": "索引尚未构建，请先运行 build-index" }
```

- `code` 为稳定机器可读错误码（全大写蛇形），`message` 为人类可读说明（可含中文）。
- 通用错误码：

| 状态码 | code | 说明 |
|---|---|---|
| 400 | INVALID_REQUEST | 请求参数缺失或非法 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | INDEX_NOT_READY | 知识库索引未就绪（未构建/构建中/已过期） |
| 429 | UPSTREAM_RATE_LIMITED | 上游大模型限流 |
| 502 | UPSTREAM_ERROR | 上游大模型调用失败，或 vector 增强的本地 embedding / 向量存储失败 |
| 500 | INTERNAL_ERROR | BFF 内部错误 |

## 鉴权与 Headers

- MVP：BFF 默认仅监听 `127.0.0.1`（本地开发工具场景），不引入 token 鉴权（ADR-0002 决策）。
- 请求 Headers：`Content-Type: application/json`（非流式）；问答接口客户端可带 `Accept: text/event-stream`。
- 服务端绝不向浏览器返回任何密钥或上游凭证。

## 版本策略

- 接口随包 `@moluoxixi/ai-doc-assistant` 语义化版本演进（changeset 管理）。
- 破坏性接口变更须升 major 并在此协议「协议偏差」与 CHANGELOG 记录。
- 当前契约版本：`v0`（MVP，未冻结，随实现可能调整）。

## 协议偏差

- 无统一成功信封（直接返回资源对象），与部分后端「code/data/message 信封」习惯不同——本项目是本地工具 BFF，简化优先。

## 待确认

- `MISSING`：SSE 断线重连 / 续传策略（MVP 可不支持，重发请求；实现期确认）。
- `MISSING`：standalone（非 Vite）部署模式下是否需要 token 鉴权（ADR-0002 留作后续，MVP 仅 localhost）。
