# 国际化本地服务与安全写回设计

## 配置与启动

- `loadConfig` 负责发现和 jiti import；`resolveConfig` 负责 schema、默认值与路径。
- CLI 使用严格 parser，支持 `--config/--root/--host/--port/--open`，拒绝未知参数。
- Vite programmatic server 只加载包内 UI 与 i18n middleware，`configFile: false`，默认 loopback。

## ServerContext

`ServerContext` 持有 resolved config、canonical roots、adapter registry、AI transport、filesystem、scan/preview registries 与 apply locks。真实绝对路径只存在 server 内部。

## API

- `GET /config`：sanitized config 与 provider status。
- `POST /scan`：返回 scan summary、resource IDs、units 和 baseline hashes。
- `POST /translate`：SSE 推送 progress/candidate/error/done，支持 cancel。
- `POST /preview`：服务端重建 operations、校验 baseline，返回 diff 与 apply token。
- `POST /apply`：只消费 apply token，再次校验后写盘并返回 rescan 摘要。

共享协议使用运行时 schema 解码，不在 route/UI 内重复 cast 字段。

## 安全与一致性

- 请求 reader 在读取过程中执行 byte limit；JSON content type、私有 header 和同源检查在 handler 前完成。
- resource ID 由 server registry 解析；lexical/canonical containment 在每个副作用前重算。
- preview/apply token 绑定 scan、baseline、operations digest、过期时间和一次性状态。
- apply 按 resource 加锁；同目录 temp + rename；瞬时锁有界重试，冲突不重试。
- 公开错误不含绝对路径、secret 或上游正文；日志统一 redactor。
