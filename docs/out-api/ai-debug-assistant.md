# AI 文档与调试助手接口文档

## 来源

- PRD：`docs/prds/组件AI文档与调试助手.md`（已定稿）
- 架构：`docs/architecture/overview.md`（ACCEPTED）、ADR-0002（BFF 密钥隔离）、ADR-0004（Orama 索引）、ADR-0005（Vite 插件栈）
- 全局协议：`docs/out-api/_protocol.md`
- 状态：契约设计（接口实现尚未编码，标 `status: planned`；实现期校验路由后转 `confirmed`）

## 接口清单

| 方法 | 路径 | 用途 | 状态 |
|---|---|---|---|
| POST | `/__ai-doc/api/query` | 自然语言提问，SSE 流式返回答案 + 来源 + 示例 | planned |
| GET | `/__ai-doc/api/index/status` | 查询知识库索引状态 | planned |
| POST | `/__ai-doc/api/index/build` | 触发重建知识库索引 | planned |
| GET | `/__ai-doc/api/components` | 列出已索引的组件清单 | planned |
| GET | `/__ai-doc/api/health` | BFF 健康检查 | planned |

## 自然语言提问（流式）

### 请求

`POST /__ai-doc/api/query`

```json
{ "question": "DateRangePicker 怎么限制只能选最近7天？", "topK": 5 }
```

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| question | body | string | 是 | 用户自然语言问题 |
| topK | body | number | 否 | 检索召回条数，默认 5 |

### 响应

- `Content-Type: text/event-stream`（SSE）。事件序列见 `_protocol.md`「流式响应」：
  - `sources` → 检索命中（先于正文，让 UI 先渲染引用）
  - `token`（多次）→ 答案增量
  - `example` → 生成的 `.vue` 示例（可送沙箱挂载）
  - `done` → 结束

```
event: sources
data: [{"component":"DateRangePicker","doc":"docs/out-components/DateRangePicker.md","score":0.82}]

event: token
data: 你可以通过 `disabledDate` 限制可选范围。

event: example
data: {"lang":"vue","code":"<template>\n<DateRangePicker :disabled-date=\"...\" />\n</template>"}

event: done
data: {"finishReason":"stop"}
```

### 错误码

| 状态码 | code | 说明 |
|---|---|---|
| 400 | INVALID_REQUEST | question 为空 |
| 409 | INDEX_NOT_READY | 索引未就绪，需先 build |
| 429 | UPSTREAM_RATE_LIMITED | 上游大模型限流 |
| 502 | UPSTREAM_ERROR | 大模型 / embedding 调用失败 |

### 联调说明

- 检索：先对 question 算 embedding（`text-embedding-3-small`），Orama 混合检索（向量 + BM25）取 topK。
- 类型提示来自 AST 契约（确定性注入），非大模型臆测。
- 首字延迟目标 < 3s（主要源于上游模型）；检索目标 < 500ms。

## 查询索引状态

### 请求

`GET /__ai-doc/api/index/status`

### 响应

```json
{ "state": "ready", "componentCount": 8, "builtAt": "2026-06-13T10:00:00Z", "stale": false }
```

| 字段 | 类型 | 说明 |
|---|---|---|
| state | string | 索引状态机：`not_built` / `building` / `ready` / `stale`（见架构状态机） |
| componentCount | number | 已索引组件数 |
| builtAt | string\|null | 上次构建时间（ISO8601），未构建为 null |
| stale | boolean | 源码变更后是否标记过期 |

### 错误码

| 状态码 | code | 说明 |
|---|---|---|
| 500 | INTERNAL_ERROR | 读取索引元数据失败 |

## 触发重建索引

### 请求

`POST /__ai-doc/api/index/build`

```json
{ "force": false }
```

| 名称 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| force | body | boolean | 否 | 为 true 时忽略 stale 判断强制全量重建 |

### 响应

- 202 Accepted（异步构建，状态经 `index/status` 轮询）：

```json
{ "state": "building", "startedAt": "2026-06-13T10:05:00Z" }
```

### 错误码

| 状态码 | code | 说明 |
|---|---|---|
| 409 | INDEX_NOT_READY | 已有构建在进行中 |
| 502 | UPSTREAM_ERROR | embedding 调用失败 |

### 联调说明

- 构建流程（架构数据流构建期）：扫描 `packages/**` → extractor 抽契约 → generator 出示例 → indexer 算 embedding + 建 Orama 索引 → persist 落包内本地文件。

## 列出已索引组件

### 请求

`GET /__ai-doc/api/components`

### 响应

```json
{ "items": [{ "name": "DateRangePicker", "package": "@moluoxixi/components", "propsCount": 12 }], "total": 8 }
```

### 错误码

| 状态码 | code | 说明 |
|---|---|---|
| 409 | INDEX_NOT_READY | 索引未就绪 |

## 健康检查

### 请求

`GET /__ai-doc/api/health`

### 响应

```json
{ "ok": true, "version": "0.1.0", "providers": { "chat": "configured", "embedding": "configured" } }
```

- `providers.*` 仅返回配置状态字面量（`configured` / `missing`），**绝不返回密钥**。

## Mock 与测试数据

- 测试设计环节细化 SSE Mock（用固定事件序列驱动 UI 测试）与 provider stub（避免测试真实打外部模型）。
- `MISSING`：Mock fixture 的具体事件样本待测试设计环节（`test-docs`）产出。

## 待确认

- `MISSING`：接口实现尚未编码，路径/字段以实现期路由校验为准，届时状态转 `confirmed`。
- `MISSING`：`example` 事件是否一问可返回多个示例（多组件场景）——实现期确认。
- `MISSING`：index/build 的进度百分比是否需要上报（MVP 仅 building/ready 两态）。
